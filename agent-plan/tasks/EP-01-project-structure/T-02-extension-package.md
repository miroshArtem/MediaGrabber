# T-02 — Set Up Extension Package.json

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:05

---

## Goal

Create package.json for the browser extension with all necessary dependencies and build scripts.

---

## Subtasks

- [ ] Create `extension/package.json` with proper configuration
- [ ] Add TypeScript as dev dependency
- [ ] Add `m3u8-parser` for M3U8 playlist parsing
- [ ] Add build tool (esbuild or webpack)
- [ ] Configure `build` script for TypeScript compilation
- [ ] Configure `watch` script for development
- [ ] Configure `clean` script

---

## Expected package.json

```json
{
  "name": "mediagrabber-extension",
  "version": "1.0.0",
  "description": "Browser extension for downloading online videos with quality selection",
  "main": "dist/background.js",
  "scripts": {
    "build": "tsc && esbuild src/background.ts --bundle --outfile=dist/background.js && esbuild src/content.ts --bundle --outfile=dist/content.js",
    "watch": "tsc --watch & esbuild src/background.ts --bundle --outfile=dist/background.js --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "esbuild": "^0.20.0",
    "@types/chrome": "^0.0.260"
  },
  "dependencies": {
    "m3u8-parser": "^6.2.0"
  }
}
```

---

## Tests

- [ ] Run `npm install` successfully
- [ ] Run `npm run build` and verify `dist/` output is generated
- [ ] Verify `dist/background.js` and `dist/content.js` exist
