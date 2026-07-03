# MediaGrabber — Agent Instructions

Browser extension (Chrome/Edge, Manifest V3) + Node.js companion app (CoApp) for downloading online videos with quality selection. Inspired by Video DownloadHelper. TypeScript throughout.

## Monorepo Layout

npm workspaces: `extension/` and `coapp/` are independent packages. Root `package.json` provides convenience scripts that `cd` into each.

| Dir | Package | Output | Notes |
|-----|---------|--------|-------|
| `extension/` | `mediagrabber-extension` | `dist/` | Manifest V3 service worker. Entry: `dist/background.js`. Bundles with esbuild (separate from `tsc` build). |
| `coapp/` | `mediagrabber-coapp` | `dist/` | Native messaging host (stdio). Entry: `dist/main.js`. CommonJS. |
| `docs/` | — | — | VDH research / reference docs, not implementation. |
| `agent-plan/` | — | — | Project plan: epics (9), tasks (41). See below. |
| `installer/` | — | — | `linux/` and `windows/` subdirs (platform installers). |

## Commands

```bash
# Build everything (runs tsc in each workspace)
npm run build

# Build a single package
npm run build:extension   # or: cd extension && npm run build
npm run build:coapp      # or: cd coapp && npm run build

# Package extension for Chrome Web Store (creates MediaGrabber.zip)
npm run package:extension   # or: cd extension && npm run package

# Dev / watch
npm run dev:coapp           # coapp tsc --watch (works)
# NOTE: npm run dev:extension is BROKEN — extension has no "watch" script.
#       Use `cd extension && npm run build` after changes, or add a watch script.
# IMPORTANT: after `npm run build`, run `cd extension && npm run bundle` (esbuild).
#           tsc outputs ES modules with bare imports (no .js extensions) that Chrome
#           service worker cannot resolve. esbuild bundles into a single IIFE file.
#           The manifest does NOT use "type": "module" — it relies on the bundled output.

# Run CoApp
cd coapp && npm start        # node dist/main.js

# Extension bundling (esbuild, separate from tsc build)
cd extension && npm run bundle   # produces dist/background.js, content.js, mse-inject.js, popup.js, settings.js

# Native messaging host registration (Windows/macOS/Linux)
cd coapp && node dist/native-autoinstall.js register [extension-id...]
cd coapp && node dist/native-autoinstall.js unregister
```

Load unpacked extension: `chrome://extensions/` → Developer mode → Load unpacked → select `extension/dist/`.

## Verification

There are **no tests, lint, typecheck, or CI** configured. The only verification is a successful `tsc` build (`npm run build`). If asked to run tests or lint, they don't exist yet.

## TypeScript Config Quirks

- `tsconfig.base.json` exists at root but is **orphaned** — neither package extends it.
- Both `extension/tsconfig.json` and `coapp/tsconfig.json` set `strict: false` and `noImplicitAny: false` (the base config sets `strict: true`; packages ignore it).
- Both set `ignoreDeprecations: "6.0"` (TypeScript 6.0-specific).
- Extension: ESNext modules, `lib: ["ES2022", "DOM"]`, no declarations.
- CoApp: CommonJS, `lib: ["ES2022"]`, emits declarations + declaration maps.

## Native Messaging Protocol

Extension ↔ CoApp communicate via Chrome/Edge native messaging:
- **Wire format**: 4-byte little-endian uint32 length prefix + UTF-8 JSON.
- **RPC format**: `weh#rpc` protocol — **bidirectional** (both sides can call each other's methods). Requests use `_request`/`_method`/`_args`; responses use `_reply`/`_result`/`_error`.
- `coapp/src/rpc.ts` is the CoApp-side singleton. `rpc.call(method, ...args)` sends a request TO the extension (returns Promise). `rpc.listen({name: handler})` registers handlers FOR requests FROM the extension.
- `extension/src/lib/native-client.ts` is the extension-side mirror. `nativeClient.call(method, ...args)` sends requests to CoApp. `nativeClient.listen({name: handler})` registers handlers for CoApp→extension calls.
- **Progress push**: CoApp calls `rpc.call('convertOutput', progressTime, currentSeconds, info)` to push FFmpeg progress to the extension (no polling). Extension handles it in `background.ts` via `nativeClient.listen({ convertOutput: ... })`.
- FFmpeg `out_time_ms` is in **nanoseconds** — divide by 1,000,000 for seconds.
- Native host name: `com.mediagrabber.coapp`.
- Windows registration writes to `HKCU\Software\Google\Chrome\NativeMessagingHosts\...` and the Edge equivalent.
- Dev registration script: `coapp/scripts/register-dev-host.ps1 -ExtensionId <id>` (builds a `pkg` executable, writes manifest to `%LOCALAPPDATA%\MediaGrabberDev\`).
- See `docs/native-messaging.md` for reference.

## FFmpeg

Not bundled in the repo (gitignored). The CoApp looks for it at:
1. `coapp/ffmpeg/{win|mac|linux}/ffmpeg[.exe]` (development)
2. `{cwd}/ffmpeg/ffmpeg[.exe]` (production)
3. System `PATH` (fallback)

Place the binary manually before downloads will work. `ffprobe` is expected alongside `ffmpeg`.

## got (HTTP client)

`coapp/src/downloads.ts` uses `got` v12+ which is **ESM-only**, but the CoApp is CommonJS. A `new Function('specifier', 'return import(specifier)')` wrapper prevents TypeScript from rewriting `import()` into `require()` (which would throw `ERR_REQUIRE_ESM`). Do not remove this wrapper.

## Content Scripts & MSE Hooking

The manifest registers **two** content scripts on `<all_urls>`, both at `document_start`:

| Script | World | Purpose |
|--------|-------|---------|
| `dist/content.js` | isolated (default) | DOM scanning, media detection, MSE listener (`window.postMessage`), sends page metadata |
| `dist/mse-inject.js` | `"MAIN"` | Hooks `MediaSource.addSourceBuffer`/`SourceBuffer.appendBuffer` to capture segment URLs; communicates via `window.postMessage` → content.js → background |

Key points:
- `mse-inject.ts` is a self-contained IIFE (esbuild `--format=iife`); it has **no access to `chrome.*` APIs** — only `window.postMessage`.
- `mse-inject.ts` uses `__MediaGrabberMSEHooked` guard to avoid double-hooking.
- `content.ts` silently catches `Extension context invalidated` errors on every `chrome.runtime.sendMessage` call (extension reload/uninstall).

## HLS & DASH Manifest Parsing

Both parsers (`extension/src/lib/m3u8-parser.ts`, `extension/src/lib/dash-parser.ts`) are **regex-based** — DOMParser is not available in MV3 service workers.

**Referer for CDN sites:** `fetchAndParse(url, referer?)` accepts an optional `referer` parameter and passes it as `fetch(url, { referrer })`. Some CDNs reject requests that lack a Referer header. Always pass `pageUrl` from page metadata when calling from `handleInterceptedMedia`.

**Redirect-chain dedup:** `handleInterceptedMedia` deduplicates HLS/DASH manifests by pathname only (ignoring hostname), because CDN redirect chains produce multiple intercepted URLs with identical paths but different hostnames (e.g. `z.cdn.com/.../hls.m3u8` → `marten.z.cdn.com/.../hls.m3u8`).

**Quality kinds:** `VideoQuality.kind` can be `'video'`, `'audio'`, or `'subtitle'`. Audio tracks come from `EXT-X-MEDIA TYPE=AUDIO`, subtitles from `EXT-X-MEDIA TYPE=SUBTITLES` or DASH text AdaptationSets.

## YouTube Handling

YouTube videos are handled **exclusively via yt-dlp** (`type: 'ytdlp'`). Ordinary detected media entries on YouTube tabs are ignored in `commitVideos`. The yt-dlp RPC (`ytdlpFormats`) runs in the CoApp and returns real `format_id`-based qualities.

## Working with Agent-Plan

Tasks are `.md` files in `agent-plan/tasks/{EP-XX-epic-name}/T-NN-name.md`. Epics are in `agent-plan/epics/`. Master list: `agent-plan/EPICS.md`.

- Read the full task file and parent epic before implementing.
- Update task status to `IP` (in progress) when starting, `DN` (done) when complete.
- Update `Last updated` timestamp in epic and task files when modifying.
- Append changelog entries to `agent-plan/CHANGELOG.md` when changing task/epic status.

## Key Technical Decisions

| Decision | Value |
|----------|-------|
| Manifest V3 | Mandatory for Chrome Web Store |
| Background | Service Worker (not persistent page) |
| Native Messaging | 4-byte length prefix + JSON (weh#rpc) |
| FFmpeg | Bundled with CoApp (not in repo) |
| Language | TypeScript throughout |
