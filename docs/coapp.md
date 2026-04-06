# Companion Application (CoApp) — Technical Details

## Overview

The Companion Application (`vdhcoapp`) is a Node.js application that runs as a separate native process, invoked by the browser extension via Native Messaging.

**Repository**: https://github.com/aclap-dev/vdhcoapp

**Status**: Fully Open Source (GPL-2.0)

---

## Source Code Structure

```
vdhcoapp/
├── app/
│   └── src/
│       ├── main.js              # Entry point, native messaging handshake
│       ├── converter.js         # ffmpeg wrapper for HLS/DASH/conversion (10KB+)
│       ├── downloads.js         # HTTP download manager
│       ├── file.js             # File system operations
│       ├── weh-rpc.js          # RPC protocol implementation
│       ├── request.js          # HTTP request utilities
│       ├── native-autoinstall.js  # Browser registration
│       ├── vm.js               # Sandboxed JavaScript VM
│       └── logger.js          # Logging utilities
├── config.toml                 # Platform-specific configuration
├── package.json
└── tests/                      # Test suite with RPC protocol tests
```

---

## main.js — Entry Point

### Responsibilities

1. **Native Messaging Setup**
   - Read messages from stdin (4-byte length prefix + JSON)
   - Write responses to stdout
   - Handle process startup/shutdown

2. **RPC Router**
   - Register handlers for all RPC methods
   - Route incoming requests to appropriate modules
   - Handle errors and send responses

3. **CoApp Lifecycle**
   - Ping/pong with extension
   - Graceful shutdown on `quit` command

### Message Transport Protocol

```javascript
// Receiving messages (length-prefixed binary protocol)
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

// Sending messages
function sendMessage(message) {
  let msgStr = Buffer.from(JSON.stringify(message), "utf8");
  let lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32LE(msgStr.length, 0);
  process.stdout.write(lengthBuf);
  process.stdout.write(msgStr);
}
```

---

## converter.js — FFmpeg Wrapper

### Key Methods

| Method | Purpose |
|--------|---------|
| `convert(args, options)` | Run ffmpeg with arguments, track progress |
| `probe(input, json, headers)` | Get media info via ffprobe |
| `abortConvert()` | Kill running ffmpeg process |

### How Conversion Works

```javascript
"convert": async (args = ["-h"], options = {}) => {
  // Build ffmpeg command
  const ffmpeg_base_args = "-progress pipe:1 -hide_banner -loglevel error";
  args = [...ffmpeg_base_args.split(" "), ...args];
  
  // Spawn ffmpeg process
  const child = spawn(ffmpeg, args);
  
  // Parse progress from stdout (format: key=value\n)
  child.stdout.on("data", (lines) => {
    lines.toString("utf-8").split("\n").forEach(on_line);
  });
  
  // Report progress via RPC callback
  if (progressInfo["progress"]) {
    await rpc.call("convertOutput", options.progressTime, seconds, info);
  }
}
```

### FFmpeg Executable Discovery

```javascript
function findExecutableFullPath(programName, extraPath = "") {
  programName = ensureProgramExt(programName);
  const envPath = (process.env.PATH || '');
  const pathArr = envPath.split(path.delimiter);
  
  if (extraPath) {
    pathArr.unshift(extraPath);
  }
  
  return pathArr
    .map((x) => path.join(x, programName))
    .find((x) => fileExistsSync(x));
}
```

### Common FFmpeg Operations

1. **HLS Download**
   ```
   ffmpeg -i <m3u8_url> -c copy output.mp4
   ```

2. **DASH Download**
   ```
   ffmpeg -i <mpd_url> -c copy output.mp4
   ```

3. **Merge Video + Audio**
   ```
   ffmpeg -i video.mp4 -i audio.mp4 -c copy -map 0:v:0 -map 1:a:0 output.mp4
   ```

4. **Re-encode with Progress**
   ```
   ffmpeg -i input.mp4 -c:v libx264 -c:a aac -progress pipe:1 output.mp4
   ```

---

## downloads.js — Download Manager

### HTTP Download Implementation

Uses the `got` library for HTTP streaming:
```javascript
let downloadItem = got.stream(options.url, dlOptions);
downloadItem.pipe(fs.createWriteStream(filename));
```

### Download State Tracking

```javascript
const downloads = {
  <downloadId>: {
    downloadItem,        // The got stream
    totalBytes,         // Content-Length header
    bytesReceived,      // Progress counter
    url,                // Source URL
    filename,           // Destination path
    state: "in_progress" | "complete" | "interrupted",
    error               // Error message if failed
  }
};
```

### Handling Interrupted Downloads

```javascript
downloadItem.on('error', (error) => {
  if (error.code == 'ECONNRESET') {
    // Server ended connection early
    // Content is still valid - ffmpeg will handle truncated video
    let downloadEntry = downloads[downloadId];
    if (downloadEntry) {
      downloadEntry.state = "complete";  // Mark as complete anyway
    }
  }
});
```

### Request API

For media probing and smaller requests:
- `request(url, options)` — Returns full response body
- `requestBinary(url, options)` — Streaming response

Supports:
- Custom headers
- Proxy configuration
- Range requests

---

## file.js — File System Operations

### RPC Methods Provided

| Method | Purpose |
|--------|---------|
| `fs.write` / `fs.write2` | Write bytes to file |
| `fs.readFile` | Read entire file |
| `fs.open` / `fs.close` | File descriptor operations |
| `fs.mkdirp` | Recursive directory creation |
| `fs.stat` | Get file metadata |
| `fs.rename` | Move/rename file |
| `fs.unlink` | Delete file |
| `fs.copyFile` | Copy file |

### Filename Uniqueness

```javascript
"makeUniqueFileName": (...args) => {
  // Ensures no filename collisions by appending -01, -02, etc.
}
```

### Temporary Files

Uses `tmp` package:
```javascript
tmp.file()     // Creates a temporary file
tmp.tmpName()  // Generates unique temp filename
```

---

## weh-rpc.js — RPC Protocol

### Protocol Name

`weh#rpc` — "WebExtension Host RPC"

### Message Format

**Request**:
```json
{
  "type": "weh#rpc",
  "_request": 1,
  "_method": "convert",
  "_args": [["arg1", "arg2"], { "option": true }]
}
```

**Response (Success)**:
```json
{
  "type": "weh#rpc",
  "_reply": 1,
  "_result": { "output": "file.mp4" }
}
```

**Response (Error)**:
```json
{
  "type": "weh#rpc",
  "_reply": 1,
  "_error": "FFmpeg not found"
}
```

### Registered RPC Methods

From source code analysis:

| Module | Methods |
|--------|---------|
| `main.js` | `info`, `quit`, `ping`, `env` |
| `converter.js` | `convert`, `probe`, `abortConvert` |
| `downloads.js` | `downloads.download`, `downloads.search`, `downloads.cancel` |
| `file.js` | `fs.write`, `fs.write2`, `fs.readFile`, `fs.mkdirp`, `fs.open`, `fs.close`, `fs.stat`, `fs.rename`, `fs.unlink`, `fs.copyFile`, `listFiles`, `makeUniqueFileName` |
| `request.js` | `request`, `requestBinary` |
| `vm.js` | `vm.run` |
| Various | `path.homeJoin`, `tmp.file`, `tmp.tmpName`, `play`, `filepicker` |

---

## vm.js — Sandboxed JavaScript VM

CoApp includes a sandboxed JavaScript VM for running untrusted code:

```javascript
rpc.listen({
  "vm.run": async (code) => {
    const sandbox = {};
    const script = new vm.Script(code);
    const result = script.runInNewContext(sandbox);
    return result;
  },
});
```

This allows execution of arbitrary JavaScript in an isolated context.

---

## logger.js — Logging

```javascript
let logfile = process.env.WEH_NATIVE_LOGFILE;

if (!logfile) {
  module.exports = {
    info: () => {},
    error: () => {},
    warn: () => {},
    log: () => {},
  };
} else {
  let logger = simplelogger.createSimpleFileLogger(logfile);
  module.exports = logger;
}
```

Logging is **disabled by default**. Enable via `WEH_NATIVE_LOGFILE` environment variable.

---

## Installation & Registration

### Native Messaging Manifest

CoApp registers via JSON manifest files:

**Windows Registry Locations**:
```
HKLM\Software\Mozilla\NativeMessagingHosts\net.downloadhelper.coapp
HKLM\Software\Google\Chrome\NativeMessagingHosts\net.downloadhelper.coapp
HKLM\Software\Microsoft\Edge\NativeMessagingHosts\net.downloadhelper.coapp
```

**macOS Locations**:
```
~/Library/Application Support/Mozilla/NativeMessagingHosts/
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
```

**Linux Locations**:
```
~/.mozilla/native-messaging-hosts/
~/.config/google-chrome/NativeMessagingHosts/
```

### Manifest Structure

```json
{
  "name": "net.downloadhelper.coapp",
  "description": "Video DownloadHelper companion app",
  "path": "/path/to/vdhcoapp",
  "type": "stdio",
  "allowed_extensions": [
    "video-downloadhelper@downloadhelper.net",
    "{b9db16a4-6edc-47ec-a1f4-b86292ed211d}"
  ]
}
```

### Auto-Registration

The `native-autoinstall.js` module handles browser-specific registration:
- Detects browser type (Firefox/Chrome/Edge)
- Places manifest in correct location
- Requires browser restart or extension reload

---

## Configuration (config.toml)

Platform-specific paths and settings:

```toml
[paths]
  firefox.windows = "Software\\Mozilla\\NativeMessagingHosts"
  chrome.windows = "Software\\Google\\Chrome\\NativeMessagingHosts"
  edge.windows = "Software\\Microsoft\\Edge\\NativeMessagingHosts"
  firefox.macos = "~/Library/Application Support/Mozilla/NativeMessagingHosts"
  firefox.linux = "~/.mozilla/native-messaging-hosts"
```

---

## Bundled FFmpeg

CoApp ships with platform-specific FFmpeg binaries:
- `ffmpeg.exe` (Windows)
- `ffmpeg` (macOS, Linux)
- `ffprobe` (all platforms)

These are **modified builds** with patches from Paul (current maintainer).

### Linux "noffmpeg" Builds

For Linux, there are "noffmpeg" variants that use the system's FFmpeg instead:
```bash
./vdhcoapp install
```

Or use system ffmpeg by installing via package manager and linking.
