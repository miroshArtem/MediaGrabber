// Native Messaging Host
// Handles native messaging protocol with Chrome/Edge extension
// Uses 4-byte length prefix + JSON (same as Video DownloadHelper)

import { RpcProtocol, RpcRequest, RpcResponse } from './rpc';

export class NativeMessagingHost {
  private rpc: RpcProtocol;
  private messageBuffer: Buffer;
  
  constructor(rpc: RpcProtocol) {
    this.rpc = rpc;
    this.messageBuffer = Buffer.alloc(0);
  }
  
  /**
   * Start listening for native messages
   */
  start(): void {
    // Set binary mode on Windows to avoid line ending conversion
    if (process.platform === 'win32') {
      this.setBinaryMode();
    }
    
    // Read from stdin as raw binary
    process.stdin.on('data', (chunk: Buffer) => {
      this.messageBuffer = Buffer.concat([this.messageBuffer, chunk]);
      this.processMessages();
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      process.exit(0);
    });
    
    console.error('[MediaGrabber CoApp] Started');
  }
  
  /**
   * Set binary mode on Windows
   */
  private setBinaryMode(): void {
    try {
      // Try to set O_BINARY on Windows
      const FIONBIO = 0x5421;
      const fileno = (process.stdin as any).fileno;
      if (fileno !== undefined) {
        require('ffi') || null; // Will fail if ffi not available
      }
    } catch (e) {
      // If setting binary mode fails, continue anyway
      console.error('[MediaGrabber] Could not set binary mode:', e.message);
    }
  }
  
  /**
   * Process messages from buffer
   */
  private processMessages(): void {
    while (this.messageBuffer.length >= 4) {
      // Read 4-byte little-endian length
      const messageLength = this.messageBuffer.readUInt32LE(0);
      
      // Check if we have complete message
      if (this.messageBuffer.length < 4 + messageLength) {
        return; // Wait for more data
      }
      
      // Extract message
      const messageData = this.messageBuffer.slice(4, 4 + messageLength);
      this.messageBuffer = this.messageBuffer.slice(4 + messageLength);
      
      // Parse JSON
      try {
        const messageStr = messageData.toString('utf8');
        const message = JSON.parse(messageStr) as RpcRequest;
        
        // Route to handlers
        this.handleMessage(message);
      } catch (error) {
        console.error('[NativeMessaging] Failed to parse message:', error);
        this.sendError('Invalid JSON message');
      }
    }
  }
  
  /**
   * Handle an incoming message
   */
  private async handleMessage(request: RpcRequest): Promise<void> {
    try {
      const response = await this.rpc.processRequest(request);
      this.sendResponse(response);
    } catch (error) {
      console.error('[NativeMessaging] Handler error:', error);
      this.sendError(error.message || 'Unknown error');
    }
  }
  
  /**
   * Send a response with length prefix
   */
  private sendResponse(response: RpcResponse): void {
    const responseJson = JSON.stringify(response);
    const responseBuffer = Buffer.from(responseJson, 'utf8');
    
    // Create 4-byte length prefix (little-endian)
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(responseBuffer.length, 0);
    
    // Write to stdout
    process.stdout.write(lengthBuffer);
    process.stdout.write(responseBuffer);
  }
  
  /**
   * Send an error response
   */
  private sendError(error: string): void {
    const response: RpcResponse = {
      id: 'error',
      error
    };
    this.sendResponse(response);
  }
}
