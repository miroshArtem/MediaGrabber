# T-02 — Request/Response Pattern

**Epic**: EP-06 (Extension ↔ CoApp Communication)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 22:30

---

## Goal

Implement the request/response pattern for RPC calls from extension to CoApp.

---

## Subtasks

- [ ] Define RPC message format
- [ ] Implement request ID tracking
- [ ] Implement Promise-based API
- [ ] Handle timeouts
- [ ] Handle connection loss
- [ ] Test multiple concurrent requests

---

## Request/Response Flow

```
Extension                          CoApp
   │                                 │
   │──── {"type":"weh#rpc",...} ───▶│  Request
   │◀─── {"type":"weh#rpc",...} ────│  Response
   │                                 │
```

---

## Implementation Details

```typescript
// Request message structure
{
  "type": "weh#rpc",
  "_request": 1,
  "_method": "convert",
  "_args": [["arg1", "arg2"], { option: true }]
}

// Response structure (success)
{
  "type": "weh#rpc",
  "_reply": 1,
  "_result": { "exitCode": 0 }
}

// Response structure (error)
{
  "type": "weh#rpc",
  "_reply": 1,
  "_error": "FFmpeg not found"
}
```

---

## Concurrent Request Handling

```typescript
class RPCClient {
  private pending = new Map<number, { resolve: Function; reject: Function; timeout: number }>();
  
  async call(method: string, ...args: any[]): Promise<any> {
    const id = this.getNextId();
    
    const promise = new Promise((resolve, reject) => {
      // Set timeout (60 seconds default)
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} (id=${id}) timed out`));
      }, 60000);
      
      this.pending.set(id, { resolve, reject, timeout });
    });
    
    this.send({ type: 'weh#rpc', _request: id, _method: method, _args: args });
    
    return promise;
  }
  
  private handleResponse(msg: { _reply: number; _result?: any; _error?: string }): void {
    const pending = this.pending.get(msg._reply);
    if (!pending) return;
    
    clearTimeout(pending.timeout);
    this.pending.delete(msg._reply);
    
    if (msg._error) {
      pending.reject(new Error(msg._error));
    } else {
      pending.resolve(msg._result);
    }
  }
}
```

---

## Tests

- [ ] Single request returns response
- [ ] Multiple concurrent requests resolve correctly
- [ ] Request timeout works
- [ ] Errors are thrown on failure
