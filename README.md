# MediaGrabber

Browser extension (Chrome/Edge) + native companion app for downloading online videos with quality selection.

## Architecture

- **Extension** (Manifest V3, Service Worker)
- **CoApp** (Node.js native companion)
- **FFmpeg** (bundled for HLS/DASH stream handling)

## Project Structure

```
extension/     - Browser extension (Chrome/Edge)
coapp/         - Native companion app (Node.js)
installer/     - Platform-specific installers
docs/          - VDH research documentation
agent-plan/    - Project plan
```

## Development

### Extension
```bash
cd extension
npm install
npm run build
```

### CoApp
```bash
cd coapp
npm install
npm run build
npm start
```

## License

Private - All rights reserved
