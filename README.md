# MediaGrabber

Browser extension (Chrome/Edge) + native companion app for downloading online videos with quality selection.

## Architecture

- **Extension** (Manifest V3, Service Worker)
- **CoApp** (Node.js native companion)
- **FFmpeg** (bundled for HLS/DASH stream handling)

## Project Structure

```
MediaGrabber/
├── extension/     - Browser extension (Chrome/Edge)
├── coapp/          - Native companion app (Node.js)
├── installer/      - Platform-specific installers
├── docs/           - VDH research documentation
└── agent-plan/     - Project plan
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- FFmpeg (for CoApp)

### Build Extension

```bash
cd extension
npm install
npm run build
```

### Build CoApp

```bash
cd coapp
npm install
npm run build
```

### Package for Chrome Web Store

```bash
cd extension
npm run package
```

This creates `MediaGrabber.zip` in the extension directory.

### Load as Unpacked Extension (Chrome)

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` directory

## Development

### Watch Mode (Extension)

```bash
cd extension
npm run watch
```

### Run CoApp

```bash
cd coapp
npm start
```

## Native Messaging

The extension communicates with CoApp via native messaging using a 4-byte length prefix + JSON protocol (same as Video DownloadHelper).

## License

Private - All rights reserved
