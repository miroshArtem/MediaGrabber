# T-01 — Native Messaging Client (Extension Side)

**Epic**: EP-06 (Extension ↔ CoApp Communication)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:30

---

## Goal

Implement native messaging client in the extension's service worker to communicate with CoApp.

---

## Subtasks

- [ ] Create `native-client.ts` library
- [ ] Implement `connectNative` wrapper
- [ ] Implement request/response pattern
- [ ] Implement notification listener
- [ ] Handle connection errors
- [ ] Implement auto-reconnect

---

## Native Messaging Client

```typescript
// extension/src/lib/native-client.ts

const APP_ID = 'com.mediagrabber.coapp';

interface RPCRequest {
  type: 'weh#rpc';
  _request: number;
  _method: string;
  _args: any[];
}

interface RPCResponse {
  type: 'weh#rpc';
  _reply: number;
  _result?: any;
  _error?: string;
}

interface RPCNotification {
  type: 'weh#rpc';
  _notify: string;
  _data: any[];
}

type IncomingMessage = RPCResponse | RPCNotification;

export class NativeClient {
  private port: chrome.runtime.Port | null = null;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private requestId = 0;
  private notifyListeners = new Map<string, Function[]>();
  private reconnectTimer: number | null = null;
  private isConnected = false;
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.port = chrome.runtime.connectNative(APP_ID);
        
        this.port.onMessage.addListener((msg: IncomingMessage) => {
          this.handleMessage(msg);
        });
        
        this.port.onDisconnect.addListener(() => {
          this.isConnected = false;
          this.scheduleReconnect();
        });
        
        // Wait for connection
        setTimeout(() => {
          if (this.port) {
            this.isConnected = true;
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
      // Notification
      const listeners = this.notifyListeners.get(msg._notify) || [];
      listeners.forEach(fn => fn(...msg._data));
    }
  }
  
  async call<T = any>(method: string, ...args: any[]): Promise<T> {
    if (!this.port) {
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
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.port!.postMessage(request);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 60000);
    });
  }
  
  onNotify(name: string, callback: (...args: any[]) => void): void {
    if (!this.notifyListeners.has(name)) {
      this.notifyListeners.set(name, []);
    }
    this.notifyListeners.get(name)!.push(callback);
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        console.log('Reconnected to CoApp');
      } catch (e) {
        console.error('Reconnect failed:', e);
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
      this.port.disconnect();
      this.port = null;
    }
    this.isConnected = false;
  }
  
  get connected(): boolean {
    return this.isConnected;
  }
}
```

---

## Usage in Background Script

```typescript
// background.ts

const coapp = new NativeClient();

async function initializeCoApp(): Promise<void> {
  try {
    await coapp.connect();
    console.log('CoApp connected');
    
    // Test connection
    const info = await coapp.call<{ version: string; ffmpegPath: string }>('info');
    console.log('CoApp version:', info.version);
  } catch (e) {
    console.error('Failed to connect to CoApp:', e);
  }
}

// Start download
async function startDownload(mediaUrl: string, filename: string): Promise<void> {
  try {
    // Set up progress listener
    coapp.onNotify('convertOutput', (time: number, percent: number, info: any) => {
      // Send progress to popup
      sendToPopup({ action: 'downloadProgress', progress: { time, percent, ...info } });
    });
    
    // Start conversion
    await coapp.call('convert', [
      ['-i', mediaUrl, '-c', 'copy', filename],
      { progressTime: 1000 }
    ]);
    
    sendToPopup({ action: 'downloadComplete' });
  } catch (e: any) {
    sendToPopup({ action: 'downloadError', error: e.message });
  }
}
```

---

## Tests

- [ ] CoApp connects on startup
- [ ] `info` method returns version
- [ ] Reconnect happens after disconnect
- [ ] Progress notifications work
- [ ] Errors are properly propagated
