// Native Messaging Client
// Handles communication with CoApp via native messaging protocol (weh#rpc)

import { NativeMessage, DownloadRequest, DownloadResponse } from './types';
import { ConnectionError, TimeoutError, MethodError, CoAppError } from './errors';

const APP_ID = 'com.mediagrabber.coapp';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

interface RPCRequest {
  type: 'weh#rpc';
  _request: number;
  _method: string;
  _args: unknown[];
}

interface RPCResponse {
  type: 'weh#rpc';
  _reply: number;
  _result?: unknown;
  _error?: string;
}

interface RPCNotification {
  type: 'weh#rpc';
  _notify: string;
  _data: unknown[];
}

type IncomingMessage = RPCResponse | RPCNotification;

export class NativeClient {
  private port: chrome.runtime.Port | null = null;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  private requestId = 0;
  private notifyListeners = new Map<string, ((...args: unknown[]) => void)[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private connectResolver: (() => void) | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Clean up existing connection
        this.disconnect();

        this.port = chrome.runtime.connectNative(APP_ID);

        this.port.onMessage.addListener((msg: IncomingMessage) => {
          this.handleMessage(msg);
        });

        this.port.onDisconnect.addListener(() => {
          this.isConnected = false;
          this.port = null;
          console.log('[NativeClient] Disconnected from CoApp');
          this.scheduleReconnect();
        });

        // Store resolver to call when connection is established
        this.connectResolver = resolve;

        // Wait for connection confirmation or timeout
        setTimeout(() => {
          if (this.port) {
            this.isConnected = true;
            if (this.connectResolver) {
              this.connectResolver();
              this.connectResolver = null;
            }
            resolve();
          } else {
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleMessage(msg: IncomingMessage): void {
    if ('_reply' in msg) {
      // Response to our request
      const pending = this.pendingRequests.get(msg._reply);
      if (pending) {
        if (msg._error) {
          pending.reject(new Error(msg._error));
        } else {
          pending.resolve(msg._result);
        }
        this.pendingRequests.delete(msg._reply);
      }
    } else if ('_notify' in msg) {
      // Notification from CoApp
      const listeners = this.notifyListeners.get(msg._notify) || [];
      listeners.forEach(fn => {
        try {
          fn(...msg._data);
        } catch (e) {
          console.error(`[NativeClient] Notification handler error for ${msg._notify}:`, e);
        }
      });
    }
  }

  async call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    if (!this.port || !this.isConnected) {
      await this.connect();
    }

    const requestId = ++this.requestId;

    const request: RPCRequest = {
      type: 'weh#rpc',
      _request: requestId,
      _method: method,
      _args: args
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject });

      if (!this.port) {
        this.pendingRequests.delete(requestId);
        reject(new ConnectionError('Not connected to CoApp'));
        return;
      }

      this.port.postMessage(request);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new TimeoutError(method, DEFAULT_TIMEOUT));
        }
      }, DEFAULT_TIMEOUT);
    });
  }

  /**
   * Register a listener for notifications from CoApp
   * @param name Notification name (e.g., 'convertOutput', 'downloadProgress')
   * @param callback Function to call when notification arrives
   */
  onNotify(name: string, callback: (...args: unknown[]) => void): void {
    if (!this.notifyListeners.has(name)) {
      this.notifyListeners.set(name, []);
    }
    this.notifyListeners.get(name)!.push(callback);
  }

  /**
   * Remove a notification listener
   */
  offNotify(name: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.notifyListeners.get(name);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log('[NativeClient] Scheduling reconnect in 5 seconds...');
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      try {
        this.port.disconnect();
      } catch {
        // Port may already be disconnected
      }
      this.port = null;
    }
    this.isConnected = false;
    this.connectResolver = null;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Retry a function with exponential backoff
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = DEFAULT_MAX_RETRIES,
    delay: number = DEFAULT_RETRY_DELAY
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e: any) {
        lastError = e;
        
        // Check if error is recoverable
        if (e instanceof CoAppError && !e.recoverable) {
          throw e;
        }
        
        console.warn(`[NativeClient] Attempt ${attempt}/${maxRetries} failed:`, e.message);
        
        if (attempt < maxRetries) {
          await this.sleep(delay * attempt);
        }
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for common operations

  async sendDownloadRequest(request: DownloadRequest): Promise<DownloadResponse> {
    return this.call<DownloadResponse>('download', request);
  }

  async getProgress(downloadId: string): Promise<unknown> {
    return this.call('getProgress', downloadId);
  }

  async cancelDownload(downloadId: string): Promise<void> {
    return this.call('cancelDownload', downloadId);
  }

  async getInfo(): Promise<{ version: string; ffmpegPath: string }> {
    return this.call('info');
  }

  async convert(ffmpegArgs: string[], options?: { progressTime?: number }): Promise<{ success: boolean; output?: string; error?: string }> {
    return this.call('convert', ffmpegArgs, options);
  }
}