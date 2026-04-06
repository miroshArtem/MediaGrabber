// Native Messaging Host
// Handles native messaging protocol with Chrome/Edge extension

import * as fs from 'fs';
import * as readline from 'readline';
import { RpcProtocol, RpcRequest, RpcResponse } from './rpc';

export class NativeMessagingHost {
  private rpc: RpcProtocol;
  private input: NodeJS.ReadStream;
  private output: NodeJS.WriteStream;
  
  constructor(rpc: RpcProtocol) {
    this.rpc = rpc;
    this.input = process.stdin;
    this.output = process.stdout;
  }
  
  /**
   * Start listening for native messages
   */
  async start(): Promise<void> {
    // Set binary mode on Windows to avoid line ending conversion
    if (process.platform === 'win32') {
      require('fs').setmode && require('fs').setmode(1); // O_BINARY
    }
    
    // Use readline to read messages line by line
    const rl = readline.createInterface({
      input: this.input,
      crlfDelay: Infinity
    });
    
    let messageBuffer = '';
    
    rl.on('line', async (line) => {
      // Skip empty lines
      if (!line.trim()) return;
      
      try {
        const response = await this.handleMessage(line);
        if (response) {
          this.sendMessage(response);
        }
      } catch (error) {
        console.error('[NativeMessaging] Error handling message:', error);
        this.sendError(error.message);
      }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      rl.close();
      process.exit(0);
    });
    
    console.error('[NativeMessaging] Host started');
  }
  
  /**
   * Handle an incoming message
   */
  private async handleMessage(line: string): Promise<string | null> {
    // First 4 bytes are message length (little-endian uint32)
    if (line.length < 4) {
      console.error('[NativeMessaging] Message too short');
      return null;
    }
    
    // Parse length prefix
    const lengthBuffer = Buffer.from(line.substring(0, 4), 'binary');
    const messageLength = lengthBuffer.readUInt32LE(0);
    
    // Get the JSON message
    const jsonMessage = line.substring(4, 4 + messageLength);
    
    if (!jsonMessage) {
      console.error('[NativeMessaging] Empty message');
      return null;
    }
    
    // Parse and process the request
    const request = JSON.parse(jsonMessage) as RpcRequest;
    const response = await this.rpc.processRequest(request);
    
    return this.formatResponse(response);
  }
  
  /**
   * Format a response with length prefix
   */
  private formatResponse(response: RpcResponse): string {
    const json = JSON.stringify(response);
    const jsonBuffer = Buffer.from(json, 'utf8');
    
    // Create 4-byte length prefix
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(jsonBuffer.length, 0);
    
    return lengthBuffer.toString('binary') + jsonBuffer.toString('binary');
  }
  
  /**
   * Send a message to stdout
   */
  private sendMessage(message: string): void {
    this.output.write(message + '\n');
  }
  
  /**
   * Send an error response
   */
  private sendError(error: string): void {
    const response: RpcResponse = {
      id: 'error',
      error
    };
    this.sendMessage(this.formatResponse(response));
  }
}
