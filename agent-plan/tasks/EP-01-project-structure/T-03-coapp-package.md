# T-03 — Set Up CoApp Package.json

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:05

---

## Goal

Create package.json for the native companion app (CoApp) with Node.js dependencies.

---

## Subtasks

- [ ] Create `coapp/package.json` with proper configuration
- [ ] Add TypeScript as dev dependency
- [ ] Add `got` for HTTP downloads
- [ ] Add `tmp` for temporary file handling
- [ ] Add logging library (simplelogger or winston)
- [ ] Configure build scripts
- [ ] Add platform-specific ffmpeg path resolution

---

## Expected package.json

```json
{
  "name": "mediagrabber-coapp",
  "version": "1.0.0",
  "description": "Companion app for MediaGrabber extension",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "dependencies": {
    "got": "^12.6.0",
    "tmp": "^0.2.0"
  }
}
```

---

## Tests

- [ ] Run `npm install` successfully
- [ ] Run `npm run build` and verify `dist/` output is generated
- [ ] Test CoApp can be started and responds to ping
