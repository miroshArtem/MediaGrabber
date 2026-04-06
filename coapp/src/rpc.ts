// RPC Protocol
// Implements the weh#rpc protocol for extension <-> CoApp communication

import * as path from 'path';

export interface RpcRequest {
  id: string;
  method: string;
  params?: any;
  _request?: number;  // Request ID for weh#rpc
  _method?: string;   // Method name for weh#rpc
  _args?: any[];     // Arguments for weh#rpc
}

export interface RpcResponse {
  id: string;
  result?: any;
  error?: string;
  _reply?: number;   // Reply ID for weh#rpc
  _result?: any;     // Result for weh#rpc
  _error?: string;  // Error for weh#rpc
}

export type RpcHandler = (params?: any) => Promise<any>;

export class RpcProtocol {
  private handlers: Map<string, RpcHandler>;
  private requestId: number;
  private sendFn: ((msg: any) => void) | null = null;
  
  constructor() {
    this.handlers = new Map();
    this.requestId = 0;
    this.registerDefaultHandlers();
  }
  
  /**
   * Set the send function for sending responses
   */
  setSendFunction(sendFn: (msg: any) => void): void {
    this.sendFn = sendFn;
  }
  
  /**
   * Register a handler for an RPC method
   */
  registerHandler(method: string, handler: RpcHandler): void {
    this.handlers.set(method, handler);
  }
  
  /**
   * Process an incoming RPC request (supports both formats)
   */
  async processRequest(request: RpcRequest): Promise<RpcResponse> {
    // Support both formats:
    // 1. Standard: { id, method, params }
    // 2. weh#rpc: { _request, _method, _args }
    let method: string;
    let params: any;
    
    if (request._method) {
      // weh#rpc format
      method = request._method;
      params = request._args;
    } else {
      // Standard format
      method = request.method;
      params = request.params;
    }
    
    const handler = this.handlers.get(method);
    
    if (!handler) {
      return this.createErrorResponse(request, `Unknown method: ${method}`);
    }
    
    try {
      const result = await handler(params);
      return this.createSuccessResponse(request, result);
    } catch (error) {
      return this.createErrorResponse(request, error.message || 'Unknown error');
    }
  }
  
  /**
   * Create success response
   */
  private createSuccessResponse(request: RpcRequest, result: any): RpcResponse {
    // Use weh#rpc format if request used it
    if (request._request !== undefined) {
      return {
        id: String(request._request),
        _reply: request._request,
        _result: result
      };
    }
    return {
      id: request.id,
      result
    };
  }
  
  /**
   * Create error response
   */
  private createErrorResponse(request: RpcRequest, error: string): RpcResponse {
    if (request._request !== undefined) {
      return {
        id: String(request._request),
        _reply: request._request,
        _error: error
      };
    }
    return {
      id: request.id,
      error
    };
  }
  
  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler('ping', async () => {
      return 'pong';
    });
    
    this.registerHandler('get_version', async () => {
      return { version: '1.0.0' };
    });
    
    this.registerHandler('info', async () => {
      return {
        version: '1.0.0',
        ffmpegPath: this.getFFmpegPath(),
        platform: process.platform,
        arch: process.arch
      };
    });
    
    this.registerHandler('quit', async () => {
      setTimeout(() => process.exit(0), 100);
      return { ok: true };
    });
  }
  
  /**
   * Get FFmpeg path based on platform
   */
  private getFFmpegPath(): string {
    const platform = process.platform;
    
    if (platform === 'win32') {
      return path.join(__dirname, '..', 'ffmpeg', 'win', 'ffmpeg.exe');
    } else if (platform === 'darwin') {
      return path.join(__dirname, '..', 'ffmpeg', 'mac', 'ffmpeg');
    } else {
      return path.join(__dirname, '..', 'ffmpeg', 'linux', 'ffmpeg');
    }
  }
}
