# T-06 — Set Up Build Pipeline

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P2
**Status**: DN (done)
**Last updated**: 2026-04-06 23:30

---

## Goal

Set up a simple build and packaging system for both extension and CoApp.

---

## Subtasks

- [ ] Configure esbuild for bundling extension scripts
- [ ] Create build script that compiles both TypeScript and bundles JS
- [ ] Create packaging script that bundles extension into ZIP for Chrome Web Store
- [ ] Document build commands in README
- [ ] Create a simple Makefile or npm scripts for Windows

---

## Build Scripts (extension/package.json)

```json
{
  "scripts": {
    "build": "npm run clean && tsc -p tsconfig.json && npm run bundle",
    "bundle": "esbuild src/background.ts --bundle --outfile=dist/background.js --platform=browser && esbuild src/content.ts --bundle --outfile=dist/content.js --platform=browser",
    "watch": "npm run build && npm run bundle -- --watch",
    "package": "cd dist && powershell Compress-Archive -Path * -DestinationPath ../MediaGrabber.zip -Force"
  }
}
```

---

## Tests

- [ ] `npm run build` produces valid `dist/` directory
- [ ] `npm run package` creates `MediaGrabber.zip`
- [ ] ZIP contains valid extension structure (manifest.json at root)
- [ ] Extension can be loaded as unpacked extension in Chrome
