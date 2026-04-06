# T-02 — RPC Protocol Implementation

**Epic**: EP-05 (Companion App Development)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 00:55

---

## Goal

Implement the RPC protocol layer (weh#rpc) that handles method dispatch and callbacks.

---

## Subtasks

- [ ] Create RPC router class
- [ ] Implement method registration
- [ ] Implement request/response handling
- [ ] Implement notification callbacks
- [ ] Implement error handling
- [ ] Add method for CoApp info/version

---

## RPC Protocol

```typescript
// coapp/src/rpc.ts

type RPCMethodHandler = (...args: any[]) => any | Promise<any>;
type RPCNotifyHandler = (...data: any[]) => void;

class RpcRouter {
  private methods = new Map<string, RPCMethodHandler>();
  private notifies = new Map<string, RPCNotifyHandler[]>();
  private pending = new Map<number, { resolve: Function; reject: Function }>();
  private nextRequestId = 1;
  
  // Send function injected from main
  private sendFn: (msg: any) => void;
  
  constructor(sendFn: (msg: any) => void) {
    this.sendFn = sendFn;
    
    // Register built-in methods
    this.register('info', this.info.bind(this));
    this.register('ping', this.ping.bind(this));
    this.register('quit', this.quit.bind(this));
  }
  
  register(name: string, handler: RPCMethodHandler): void {
    this.methods.set(name, handler);
  }
  
  onNotify(name: string, handler: RPCNotifyHandler): void {
    if (!this.notifies.has(name)) {
      this.notifies.set(name, []);
    }
    this.notifies.get(name)!.push(handler);
  }
  
  async handle(method: string, args: any[]): Promise<any> {
    const handler = this.methods.get(method);
    
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }
    
    try {
      return await handler(...args);
    } catch (e) {
      throw e;
    }
  }
  
  notify(notifyName: string, data: any[]): void {
    const handlers = this.notifies.get(notifyName) || [];
    handlers.forEach(h => {
      try {
        h(...data);
      } catch (e) {
        console.error('Notify error:', e);
      }
    });
  }
  
  // Send response back to extension
  private sendResponse(requestId: number, result: any): void {
    this.sendFn({
      type: 'weh#rpc',
      _reply: requestId,
      _result: result
    });
  }
  
  // Built-in methods
  private info(): { version: string; ffmpegPath: string } {
    return {
      version: '1.0.0',
      ffmpegPath: getFFmpegPath()
    };
  }
  
  private ping(): string {
    return 'pong';
  }
  
  private quit(): void {
    process.exit(0);
  }
}

function getFFmpegPath(): string {
  // Determine ffmpeg path based on platform
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'win32') {
    return path.join(__dirname, '..', 'ffmpeg', 'win', 'ffmpeg.exe');
  } else if (platform === 'darwin') {
    return path.join(__dirname, '..', 'ffmpeg', 'mac', 'ffmpeg');
  } else {
    return path.join(__dirname, '..', 'ffmpeg', 'linux', 'ffmpeg');
  }
}

export { RpcRouter };
```

---

## Registering Methods from Other Modules

```typescript
// In main.ts
import { RpcRouter } from './rpc';
import { registerConverterMethods } from './converter';
import { registerDownloadMethods } from './downloads';
import { registerFileMethods } from './file';

const rpc = new RpcRouter(sendMessage);

// Register module methods
registerConverterMethods(rpc);
registerDownloadMethods(rpc);
registerFileMethods(rpc);
```

---

## Tests

- [ ] `ping` returns `pong`
- [ ] `info` returns version and ffmpeg path
- [ ] `quit` exits the process
- [ ] Custom methods can be registered
- [ ] Unknown methods throw error
