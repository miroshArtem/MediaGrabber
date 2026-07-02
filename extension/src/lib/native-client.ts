// Native Messaging Client
// Bidirectional weh#rpc over chrome.runtime.connectNative Port.
// Both sides can send requests and receive responses.

import { ConnectionError, TimeoutError, CoAppError } from './errors';

const APP_ID = 'com.mediagrabber.coapp';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

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

export class NativeClient {
  private port: chrome.runtime.Port | null = null;
  private replyId = 0;
  private replies = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners: Record<string, RpcHandler> = {};
  private isConnected = false;
  private connectingPromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  async connect(): Promise<void> {
    if (this.isConnected && this.port) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.intentionalDisconnect = false;

    this.connectingPromise = new Promise<void>((resolve, reject) => {
      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connectNative(APP_ID);
      } catch (e: any) {
        this.connectingPromise = null;
        reject(new ConnectionError(e?.message || String(e)));
        return;
      }

      const send = (msg: RpcMessage): void => {
        try {
          port.postMessage(msg);
        } catch (e) {
          // port may have disconnected
        }
      };

      port.onMessage.addListener((msg: RpcMessage) => {
        this.receive(msg, send);
      });

      port.onDisconnect.addListener(() => {
        const lastError = chrome.runtime.lastError?.message;
        this.isConnected = false;
        this.port = null;
        this.connectingPromise = null;

        // Reject all pending requests
        for (const { reject: rej } of this.replies.values()) {
          rej(new ConnectionError(lastError || 'Disconnected from CoApp'));
        }
        this.replies.clear();

        if (!this.intentionalDisconnect) {
          this.scheduleReconnect();
        }
      });

      this.port = port;
      this.isConnected = true;
      this.connectingPromise = null;
      resolve();
    });

    return this.connectingPromise;
  }

  private receive(message: RpcMessage, send: (msg: RpcMessage) => void): void {
    if (message._request !== undefined) {
      // Incoming request from CoApp (e.g., convertOutput progress push)
      const handler = this.listeners[message._method!];
      Promise.resolve()
        .then(() => {
          if (typeof handler !== 'function') {
            throw new Error(`Method ${message._method} is not a function`);
          }
          return handler.apply(null, message._args || []);
        })
        .then((result) => {
          send({ type: 'weh#rpc', _reply: message._request, _result: result });
        })
        .catch((error) => {
          send({ type: 'weh#rpc', _reply: message._request, _error: error.message || String(error) });
        });
    } else if (message._reply !== undefined) {
      // Response to our request
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

  async call<T = any>(method: string, ...args: any[]): Promise<T> {
    if (!this.port || !this.isConnected) {
      await this.connect();
    }
    if (!this.port) throw new ConnectionError('Not connected to CoApp');

    const rid = ++this.replyId;

    return new Promise<T>((resolve, reject) => {
      const timeoutMs = (method === 'convert' || method === 'ytdlp') ? 0 : DEFAULT_TIMEOUT;
      const timer = timeoutMs > 0 ? setTimeout(() => {
        this.replies.delete(rid);
        reject(new TimeoutError(method, timeoutMs));
      }, timeoutMs) : null;

      this.replies.set(rid, {
        resolve: (v: any) => { if (timer) clearTimeout(timer); resolve(v); },
        reject: (e: Error) => { if (timer) clearTimeout(timer); reject(e); }
      });

      try {
        this.port.postMessage({
          type: 'weh#rpc',
          _request: rid,
          _method: method,
          _args: args
        });
      } catch (e: any) {
        this.replies.delete(rid);
        if (timer) clearTimeout(timer);
        reject(new ConnectionError(e?.message || String(e)));
      }
    });
  }

  listen(handlers: Record<string, RpcHandler>): void {
    Object.assign(this.listeners, handlers);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        console.log('[NativeClient] Reconnected to CoApp');
      } catch (e) {
        console.error('[NativeClient] Reconnect failed:', e);
        this.scheduleReconnect();
      }
    }, 5000);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      try { this.port.disconnect(); } catch { /* already gone */ }
      this.port = null;
    }
    this.isConnected = false;
    this.connectingPromise = null;
  }

  get connected(): boolean { return this.isConnected; }

  async withRetry<T>(fn: () => Promise<T>, maxRetries = DEFAULT_MAX_RETRIES, delay = DEFAULT_RETRY_DELAY): Promise<T> {
    let lastError: Error;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e: any) {
        lastError = e;
        if (e instanceof CoAppError && !e.recoverable) throw e;
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, delay * attempt));
      }
    }
    throw lastError!;
  }

  // Convenience methods

  async ping(): Promise<any> { return this.call('ping', 'hello'); }

  async info(): Promise<any> { return this.call('info'); }

  async convert(args: string[], options?: { progressTime?: number; startHandler?: any }): Promise<{ exitCode: number; pid: number; stderr: string }> {
    return this.call('convert', args, options || {});
  }

  async abortConvert(pid: number): Promise<void> { return this.call('abortConvert', pid); }

  async ytdlp(url: string, args: string[], options?: { progressTime?: number; startHandler?: any; outputDir?: string; filename?: string }): Promise<{ exitCode: number; pid: number; stderr: string }> {
    return this.call('ytdlp', url, args, options || {});
  }

  async abortYtdlp(pid: number): Promise<void> { return this.call('abortYtdlp', pid); }

  async downloadFile(options: { url: string; directory?: string; filename?: string; headers?: any[]; rejectUnauthorized?: boolean }): Promise<number> {
    return this.call('downloads.download', options);
  }

  async searchDownloads(id: number): Promise<any[]> { return this.call('downloads.search', { id }); }

  async cancelDownload(downloadId: number): Promise<void> { return this.call('downloads.cancel', downloadId); }

  async probe(input: string, json?: boolean, headers?: any[]): Promise<any> { return this.call('probe', input, json, headers); }
}
