# Native Messaging Protocol — Extension ↔ CoApp Communication

## Overview

Video DownloadHelper uses a **custom RPC protocol** called `weh#rpc` ("WebExtension Host RPC") layered on top of the standard WebExtension Native Messaging API.

This is NOT standard Native Messaging — VDH implements its own request/response semantics on top.

---

## Transport Layer

### Standard Native Messaging (What Browser Provides)

The browser handles:
- Starting the CoApp process
- Connecting extension's stdout/stdin to CoApp's stdin/stdout
- Passing messages via JSON with newline delimiter

### VDH Enhancement: Length-Prefixed Binary Protocol

VDH adds a 4-byte length prefix to each message:

```
┌──────────────┬─────────────────────────────────────┐
│  4 bytes     │  N bytes                             │
│  (LE uint32) │  UTF-8 JSON                          │
└──────────────┴─────────────────────────────────────┘
```

**Sending**:
```javascript
let msgStr = Buffer.from(JSON.stringify(message), "utf8");
let lengthBuf = Buffer.alloc(4);
lengthBuf.writeUInt32LE(msgStr.length, 0);
process.stdout.write(lengthBuf);
process.stdout.write(msgStr);
```

**Receiving**:
```javascript
function AppendInputString(chunk) {
  msgBacklog = Buffer.concat([msgBacklog, chunk]);
  
  while (true) {
    if (msgBacklog.length < 4) return;
    
    let msgLength = msgBacklog.readUInt32LE(0);
    
    if (msgBacklog.length < msgLength + 4) return;
    
    let msgString = msgBacklog.toString("utf8", 4, msgLength + 4);
    let msgObject = JSON.parse(msgString);
    
    rpc.receive(msgObject, Send);
    msgBacklog = msgBacklog.slice(msgLength + 4);
  }
}
```

---

## The weh#rpc Protocol

### Message Types

#### 1. Request

```json
{
  "type": "weh#rpc",
  "_request": 42,
  "_method": "convert",
  "_args": [
    ["-i", "http://example.com/stream.m3u8", "-c", "copy", "output.mp4"],
    { "progressTime": 1000 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"weh#rpc"` |
| `_request` | integer | Unique request ID for correlation |
| `_method` | string | Method name to invoke |
| `_args` | array | Arguments array (positional) |

#### 2. Response (Success)

```json
{
  "type": "weh#rpc",
  "_reply": 42,
  "_result": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"weh#rpc"` |
| `_reply` | integer | Correlates to `_request` |
| `_result` | any | Return value from method |

#### 3. Response (Error)

```json
{
  "type": "weh#rpc",
  "_reply": 42,
  "_error": "FFmpeg not found"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"weh#rpc"` |
| `_reply` | integer | Correlates to `_request` |
| `_error` | string | Error message |

#### 4. Notification (Server → Client)

Used for progress updates:

```json
{
  "type": "weh#rpc",
  "_notify": "convertOutput",
  "_data": [1000, 45.2, { "out_time_ms": "45200000" }]
}
```

### RPC Implementation (weh-rpc.js)

```javascript
class RpcRouter {
  constructor() {
    this.handlers = {};
    this.pending = {};
    this.nextRequestId = 1;
  }
  
  listen(handlers) {
    // Register method handlers
    this.handlers = handlers;
  }
  
  async receive(msg, sendFn) {
    if (msg._request) {
      // Handle incoming request
      const handler = this.handlers[msg._method];
      if (handler) {
        try {
          const result = await handler(...msg._args);
          sendFn({ type: "weh#rpc", _reply: msg._request, _result: result });
        } catch (e) {
          sendFn({ type: "weh#rpc", _reply: msg._request, _error: e.message });
        }
      }
    } else if (msg._notify) {
      // Handle notification
      const handler = this.handlers[msg._notify];
      if (handler) {
        handler(...msg._data);
      }
    } else if (msg._reply) {
      // Handle response to our request
      const pending = this.pending[msg._reply];
      if (pending) {
        if (msg._error) {
          pending.reject(new Error(msg._error));
        } else {
          pending.resolve(msg._result);
        }
        delete this.pending[msg._reply];
      }
    }
  }
  
  async call(method, ...args) {
    // Send request and wait for response
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending[requestId] = { resolve, reject };
      sendFn({
        type: "weh#rpc",
        _request: requestId,
        _method: method,
        _args: args
      });
    });
  }
}
```

---

## Typical Communication Sequence

### Downloading a Video

```
Extension                          CoApp
   │                                 │
   │─── ping ───────────────────────▶│
   │◀── pong ────────────────────────│
   │                                 │
   │─── info ───────────────────────▶│
   │◀── {version, ffmpegPath} ───────│
   │                                 │
   │─── convert([args], {progress}) ▶│
   │    │                            │
   │    │─── progress update ────────│
   │    │                            │
   │    │─── progress update ────────│
   │    │                            │
   │◀── {exitCode: 0} ───────────────│
   │                                 │
```

### Download with Progress Callbacks

The extension can pass a `progress` callback in options:

```javascript
// Extension side
coapp.convert([
  "-i", "http://example.com/video.m3u8",
  "-c", "copy",
  "output.mp4"
], {
  progressTime: 1000  // Report every 1000ms
});
```

CoApp responds with notifications:
```json
{
  "type": "weh#rpc",
  "_notify": "convertOutput",
  "_data": [1000, 45.2, { "out_time_ms": "45200000" }]
}
```

---

## Security Considerations

### 1. Extension Allowlisting

CoApp manifest specifies which extensions can invoke it:

```json
{
  "allowed_extensions": [
    "video-downloadhelper@downloadhelper.net"
  ]
}
```

Chrome/Edge use origins instead:
```json
{
  "allowed_origins": [
    "chrome-extension://lmjnegcaeklhafolokijcfjliaokphfk/"
  ]
}
```

### 2. stdio Communication

- No network sockets involved
- OS-level process isolation
- Messages are structured JSON only

### 3. Method Access Control

Only registered methods can be called. Extensions cannot invoke arbitrary CoApp methods.

---

## Browser Differences

### Firefox

- Uses extension ID for allowlisting
- Manifest at: `~/.mozilla/native-messaging-hosts/`
- Communication via `browser.runtime.sendNativeMessage()`

### Chrome

- Uses extension origin for allowlisting
- Manifest at: `~/.config/google-chrome/NativeMessagingHosts/`
- Communication via `chrome.runtime.sendNativeMessage()`

### Edge

- Similar to Chrome
- Manifest at: `~/.config/microsoft-edge/NativeMessagingHosts/`

---

## Error Handling

### CoApp Not Found

If CoApp is not installed/registered:
```
Error: No such native application net.downloadhelper.coapp
```

### Method Not Found

```json
{
  "type": "weh#rpc",
  "_reply": 1,
  "_error": "Unknown method: nonexistentMethod"
}
```

### FFmpeg Errors

FFmpeg execution errors are caught and returned:
```json
{
  "type": "weh#rpc",
  "_reply": 1,
  "_error": "FFmpeg exited with code 1: Invalid data found"
}
```

---

## Debugging

### Enable Logging

Set environment variable:
```bash
WEH_NATIVE_LOGFILE=/tmp/vdh.log ./vdhcoapp
```

### Manual Testing

Send raw messages via stdio:
```bash
# Length-prefixed JSON
echo -ne '\x0b\x00\x00\x00{"type":"weh#rpc","_request":1,"_method":"ping","_args":[]}' | ./vdhcoapp
```
