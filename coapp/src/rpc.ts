// Bidirectional RPC protocol (weh#rpc)
// Both CoApp and extension can send requests and receive responses.
// Based on VDH's weh-rpc.js pattern.

type RpcHandler = (...args: any[]) => Promise<any> | any;

interface RpcMessage {
  type: string;
  _request?: number;
  _method?: string;
  _args?: any[];
  _reply?: number;
  _result?: any;
  _error?: string;
}

class RpcProtocol {
  private replyId = 0;
  private replies = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners: Record<string, RpcHandler> = {};
  private post: ((msg: RpcMessage) => void) | null = null;

  setPost(fn: (msg: RpcMessage) => void): void {
    this.post = fn;
  }

  call<T = any>(method: string, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.post) {
        reject(new Error("RPC not connected"));
        return;
      }
      const rid = ++this.replyId;
      this.replies.set(rid, { resolve, reject });
      this.post({
        type: "weh#rpc",
        _request: rid,
        _method: method,
        _args: args
      });
    });
  }

  receive(message: RpcMessage): void {
    if (message._request !== undefined) {
      const handler = this.listeners[message._method!];
      Promise.resolve()
        .then(() => {
          if (typeof handler !== "function") {
            throw new Error(`Method ${message._method} is not a function`);
          }
          return handler.apply(null, message._args || []);
        })
        .then((result) => {
          this.post!({
            type: "weh#rpc",
            _reply: message._request,
            _result: result
          });
        })
        .catch((error) => {
          this.post!({
            type: "weh#rpc",
            _reply: message._request,
            _error: error.message || String(error)
          });
        });
    } else if (message._reply !== undefined) {
      const reply = this.replies.get(message._reply);
      this.replies.delete(message._reply);
      if (!reply) return;
      if (message._error) {
        reply.reject(new Error(message._error));
      } else {
        reply.resolve(message._result);
      }
    }
  }

  listen(handlers: Record<string, RpcHandler>): void {
    Object.assign(this.listeners, handlers);
  }
}

const rpc = new RpcProtocol();
export default rpc;
export { RpcProtocol };
