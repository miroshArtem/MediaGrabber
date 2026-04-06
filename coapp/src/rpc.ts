// RPC Protocol
// Implements the weh#rpc-like protocol for extension <-> CoApp communication

export interface RpcRequest {
  id: string;
  method: string;
  params?: any;
}

export interface RpcResponse {
  id: string;
  result?: any;
  error?: string;
}

export interface RpcHandler {
  (params?: any): Promise<any>;
}

export class RpcProtocol {
  private handlers: Map<string, RpcHandler>;
  private requestId: number;
  
  constructor() {
    this.handlers = new Map();
    this.requestId = 0;
    this.registerDefaultHandlers();
  }
  
  /**
   * Register a handler for an RPC method
   */
  registerHandler(method: string, handler: RpcHandler): void {
    this.handlers.set(method, handler);
  }
  
  /**
   * Process an incoming RPC request
   */
  async processRequest(request: RpcRequest): Promise<RpcResponse> {
    const handler = this.handlers.get(request.method);
    
    if (!handler) {
      return {
        id: request.id,
        error: `Unknown method: ${request.method}`
      };
    }
    
    try {
      const result = await handler(request.params);
      return {
        id: request.id,
        result
      };
    } catch (error) {
      return {
        id: request.id,
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Create a new RPC request
   */
  createRequest(method: string, params?: any): RpcRequest {
    return {
      id: `req_${++this.requestId}`,
      method,
      params
    };
  }
  
  /**
   * Parse an RPC request from JSON
   */
  parseRequest(json: string): RpcRequest | null {
    try {
      const parsed = JSON.parse(json);
      if (parsed.method && parsed.id) {
        return parsed as RpcRequest;
      }
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Serialize an RPC response to JSON
   */
  serializeResponse(response: RpcResponse): string {
    return JSON.stringify(response);
  }
  
  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler('ping', async () => {
      return { pong: true, timestamp: Date.now() };
    });
    
    this.registerHandler('get_version', async () => {
      return { version: '1.0.0' };
    });
  }
}
