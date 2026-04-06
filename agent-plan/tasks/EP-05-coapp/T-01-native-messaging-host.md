# T-01 — Native Messaging Host

**Epic**: EP-05 (Companion App Development)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 00:50

---

## Goal

Implement the native messaging host that receives messages from the browser extension via stdin/stdout.

---

## Subtasks

- [ ] Set up Node.js entry point (main.ts)
- [ ] Implement 4-byte length prefix reading from stdin
- [ ] Implement JSON message parsing
- [ ] Implement message routing to handlers
- [ ] Implement response writing to stdout
- [ ] Handle process start/stop lifecycle
- [ ] Handle Windows O_BINARY mode for stdio

---

## Native Messaging Protocol (Chrome/Edge)

Chrome and Edge use **4-byte length prefix** (little-endian on Windows) + UTF-8 JSON:

```
┌──────────────┬─────────────────────────────────────┐
│  4 bytes     │  N bytes                             │
│  (LE uint32) │  UTF-8 JSON                          │
└──────────────┴─────────────────────────────────────┘
```

---

## main.ts Implementation

```typescript
// coapp/src/main.ts

import * as fs from 'fs';
import * as path from 'path';

// Ensure binary mode on Windows for stdin/stdout
if (process.platform === 'win32') {
  // Set stdin/stdout to binary mode
  require('child_process').execSync('chcp 65001');
  const __setmode = (require('fs')).constants.O_BINARY;
  (process.stdin as any).setRawMode && (process.stdin as any).setRawMode(true);
}

// Message backlog buffer
let msgBacklog = Buffer.alloc(0);

// Read from stdin
process.stdin.on('data', (chunk: Buffer) => {
  msgBacklog = Buffer.concat([msgBacklog, chunk]);
  processMessages();
});

function processMessages(): void {
  while (msgBacklog.length >= 4) {
    // Read 4-byte little-endian length
    const msgLength = msgBacklog.readUInt32LE(0);
    
    // Check if we have complete message
    if (msgBacklog.length < msgLength + 4) {
      return; // Wait for more data
    }
    
    // Extract message
    const msgString = msgBacklog.toString('utf8', 4, 4 + msgLength);
    const msg = JSON.parse(msgString);
    
    // Remove processed message from backlog
    msgBacklog = msgBacklog.slice(4 + msgLength);
    
    // Route message to handlers
    handleMessage(msg);
  }
}

function handleMessage(msg: any): void {
  if (msg._method) {
    // RPC request - route to method handler
    const result = rpc.handle(msg._method, msg._args);
    
    sendResponse(msg._request, result);
  } else if (msg._notify) {
    // Notification - fire and forget
    rpc.notify(msg._notify, msg._data);
  }
}

function sendResponse(requestId: number, result: any): void {
  const response = {
    type: 'weh#rpc',
    _reply: requestId,
    _result: result
  };
  sendMessage(response);
}

function sendError(requestId: number, error: string): void {
  const response = {
    type: 'weh#rpc',
    _reply: requestId,
    _error: error
  };
  sendMessage(response);
}

function sendMessage(msg: any): void {
  const msgStr = JSON.stringify(msg);
  const msgBuffer = Buffer.from(msgStr, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(msgBuffer.length, 0);
  process.stdout.write(lengthBuffer);
  process.stdout.write(msgBuffer);
}

// Handle process exit
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

console.error('MediaGrabber CoApp started'); // stderr for logging
```

---

## Windows I/O Mode Note

> On Windows, the native messaging host is also passed a command line argument with a handle to the calling Microsoft Edge native window: `--parent-window=<decimal handle value>`.

Also important:

> **Windows-only:** Make sure that the program's I/O mode is set to `O_BINARY`. By default, the I/O mode is `O_TEXT`, which corrupts the message format.

Use `_setmode(_fileno(stdin), _O_BINARY);` on Windows.

---

## Tests

- [ ] CoApp starts without errors
- [ ] Can receive messages from extension
- [ ] Messages are parsed correctly
- [ ] Responses are sent correctly formatted
- [ ] Handles invalid JSON gracefully
