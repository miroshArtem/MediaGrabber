# Video DownloadHelper — Architecture Overview

## Two-Component System

Video DownloadHelper consists of two completely separate components that communicate via Native Messaging:

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER EXTENSION                        │
│  ┌─────────────────┐    ┌─────────────────────────────┐   │
│  │  Background      │    │  Content Scripts             │   │
│  │  Scripts         │◄──►│  (injected into web pages)  │   │
│  │                  │    │                             │   │
│  │  - UI Logic     │    │  - DOM Analysis             │   │
│  │  - Download Mgmt │    │  - Media Element Monitoring │   │
│  │  - CoApp Comm    │    │  - Network Interception     │   │
│  └─────────────────┘    └─────────────────────────────┘   │
│           │                         │                        │
│           └─────────────────────────┼────────────────────────┘
│                                     │ webRequest API, messaging
├─────────────────────────────────────┼────────────────────────┤
│           NATIVE MESSAGING          │  (stdin/stdout)
│                                     ▼
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Companion Application (CoApp)               ││
│  │                                                          ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ ││
│  │  │downloads │  │converter │  │   file   │  │ request │ ││
│  │  │  .js     │  │  .js     │  │   .js    │  │   .js   │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ ││
│  │                                                          ││
│  │  ┌──────────────────────────────────────────────────┐  ││
│  │  │              ffmpeg / ffprobe                      │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Component 1: Browser Extension

**Technology**: WebExtensions API (Cross-browser compatible)

### Permissions Required

From the extension manifest:
- `tabs` — access tab information
- `webRequest` — intercept network requests
- `webRequestBlocking` — modify/block requests
- `storage` — persist settings
- `<all_urls>` — access all websites (to detect media)
- `nativeMessaging` — communicate with CoApp

### Script Architecture

```
Background Scripts (runs in browser context)
├── Background page (persistent)
├── UI management (toolbar icon, panels)
├── Download queue management
├── Communication with content scripts
└── Native messaging to CoApp

Content Scripts (injected per-page)
├── DOM analysis (video/audio elements)
├── Network request monitoring
├── Media stream URL extraction
└── Message passing to background
```

### Content Script Responsibilities

1. **DOM Scanning**
   - Find `<video>` and `<audio>` elements
   - Extract `src` attributes and `currentSrc`
   - Monitor `play`, `error` events on media elements

2. **Network Interception** (via webRequest API)
   - Monitor `onBeforeRequest` — detect media URLs
   - Monitor `onHeadersReceived` — get Content-Type, Content-Length
   - Monitor `onCompleted` / `onError` — track request status

3. **Information Extraction**
   - Parse M3U8 playlist URLs (HLS)
   - Parse MPD manifest URLs (DASH)
   - Extract video metadata (title, duration, quality)

### Background Script Responsibilities

1. **State Management**
   - Track detected media across all tabs
   - Maintain download queue
   - Store user preferences

2. **CoApp Communication**
   - Establish native messaging connection
   - Send download requests to CoApp
   - Receive progress updates

3. **UI Rendering**
   - Update toolbar icon (grayed/colored)
   - Show download panel with detected media
   - Handle user interactions

---

## Component 2: Companion Application (CoApp)

**Technology**: Node.js (JavaScript)

**Open Source**: https://github.com/aclap-dev/vdhcoapp

### Why CoApp Exists

Browser extensions CANNOT:
- Write files to arbitrary filesystem locations
- Spawn native processes (ffmpeg)
- Make unrestricted network requests

CoApp bypasses these restrictions by running as a standalone native application invoked via Native Messaging.

### Directory Structure (CoApp)

```
vdhcoapp/
├── app/
│   └── src/
│       ├── main.js           # Entry point, native messaging handshake
│       ├── converter.js      # ffmpeg wrapper (HLS/DASH/conversion)
│       ├── downloads.js      # HTTP download manager
│       ├── file.js           # File system operations
│       ├── weh-rpc.js        # RPC protocol implementation
│       ├── request.js        # HTTP requests
│       ├── native-autoinstall.ts  # Browser registration
│       ├── vm.js             # Sandboxed JS VM
│       └── logger.js         # Logging utilities
├── config.toml               # Platform configuration
├── package.json
└── tests/
```

### Platform Support

| Platform | Format |
|----------|--------|
| Windows | `.exe` installer |
| macOS | `.pkg` / `.dmg` |
| Linux | `.tar.gz`, `.deb`, AUR (Arch) |

---

## Communication Flow: Detecting and Downloading a Video

```
1. User visits page with video
         │
         ▼
2. Content Script scans DOM, finds <video src="...">
         │
         ▼
3. Content Script monitors network via webRequest API
         │
         ▼
4. Media stream URL detected (e.g., .m3u8 playlist)
         │
         ▼
5. Background Script notified via messaging
         │
         ▼
6. Toolbar icon turns colored (media detected)
         │
         ▼
7. User clicks download button
         │
         ▼
8. Background Script sends request to CoApp via Native Messaging
         │
         ▼
9. CoApp spawns ffmpeg to download/merge the stream
         │
         ▼
10. Progress sent back via RPC callbacks
         │
         ▼
11. File written to disk by CoApp
```

---

## V10 Architecture Change

**December 2025**: Version 10 eliminated the CoApp dependency for downloads.

### What Changed

| Aspect | V9 and earlier | V10 |
|--------|---------------|-----|
| Download Method | CoApp (native process) | Browser Download API |
| ffmpeg Usage | For all HLS/DASH | Not used for downloads |
| Download Location | Any directory | Browser download folder only |
| Authenticated Requests | Via CoApp | Via browser cookies/headers |
| Speed | Slower (native network) | Faster (browser cache) |
| CoApp Required | Yes | No |

### Trade-offs

**Benefits of V10**:
- No installation of separate application
- Faster downloads (browser cache)
- More reliable for authenticated content
- Simpler architecture

**Limitations of V10**:
- Cannot choose download directory
- Limited to browser's download capabilities
- May not work for all streaming types

---

## Security Model

### Extension Allowlisting

Each CoApp manifest specifies which extensions can invoke it:

**Firefox** (extension IDs):
```json
"allowed_extensions": [
  "video-downloadhelper@downloadhelper.net",
  "{b9db16a4-6edc-47ec-a1f4-b86292ed211d}"
]
```

**Chrome/Edge** (extension origins):
```json
"allowed_origins": [
  "chrome-extension://lmjnegcaeklhafolokijcfjliaokphfk/"
]
```

### Native Messaging Security

- Communication is via stdin/stdout (not network sockets)
- JSON messages with fixed structure
- No arbitrary code execution from browser
- OS-level process isolation

---

## Key Architectural Decisions

### 1. Custom RPC Protocol (weh#rpc)

Rather than using standard WebExtension Native Messaging directly, VDH implements a proprietary RPC layer on top:

```
Browser Extension                    CoApp
      │                                │
      │──── {"type":"weh#rpc",...} ───▶│
      │                                │
      │◀─── {"type":"weh#rpc",...} ───│
      │                                │
```

### 2. ffmpeg as Download Engine

Starting ~2024, ffmpeg became the download engine (previously only for merging/conversion):
- Downloads HLS/DASH segments directly
- Handles stream remuxing
- Progress via `-progress pipe:1`

### 3. Content Script + Background Script Split

Needed because of multiprocess Firefox (e10s):
- Content scripts run in page context (isolated process)
- Background scripts run in extension context
- Communication via `browser.runtime.sendMessage`
