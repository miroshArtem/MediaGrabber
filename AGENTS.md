# MediaGrabber — Agent Instructions

Browser extension (Chrome/Edge, Manifest V3) + Node.js companion app (CoApp) for downloading online videos with quality selection. Inspired by Video DownloadHelper. TypeScript throughout.

## Monorepo Layout

npm workspaces: `extension/` and `coapp/` are independent packages. Root `package.json` provides convenience scripts that `cd` into each.

| Dir | Package | Output | Notes |
|-----|---------|--------|-------|
| `extension/` | `mediagrabber-extension` | `dist/` | Manifest V3 service worker. Entry: `dist/background.js`. Build runs TypeScript plus esbuild bundling. |
| `coapp/` | `mediagrabber-coapp` | `dist/` | Native messaging host (stdio). Entry: `dist/main.js`. CommonJS. |
| `docs/` | — | — | VDH research / reference docs, not implementation. |
| `agent-plan/` | — | — | Project plan: epics (9), tasks (41). See below. |
| `installer/` | — | — | `linux/` and `windows/` subdirs (platform installers). |

## Commands

```bash
# Build everything (runs tsc + esbuild bundle in extension, tsc in coapp)
npm run build

# Build a single package
npm run build:extension   # or: cd extension && npm run build
npm run build:coapp      # or: cd coapp && npm run build

# Package extension ZIP for GitHub sideloading
npm run package:extension   # or: cd extension && npm run package

# Dev / watch
npm run dev:coapp           # coapp tsc --watch (works)
# NOTE: npm run dev:extension is BROKEN — extension has no "watch" script.
#       Re-run `npm run build` after changes.

# Run CoApp
cd coapp && npm start        # node dist/main.js

# Native messaging host registration (Windows/macOS/Linux)
cd coapp && node dist/native-autoinstall-cli.js register [extension-id...]
cd coapp && node dist/native-autoinstall-cli.js unregister
```

**Loading the extension:** `chrome://extensions/` → Developer mode → Load unpacked → select the **`extension/` folder** (not `extension/dist/`). The `manifest.json` lives at `extension/manifest.json`; all its paths (service worker, content scripts, popup, icons) are relative to that folder.

### Build Chain Detail

`npm run build` for the extension runs `tsc && npm run bundle`. `tsc` compiles `src/` → `dist/` as ES modules with bare imports. `bundle` runs esbuild to produce self-contained IIFE files that Chrome's service worker can execute:

| Source | Bundle output | Format |
|--------|--------------|--------|
| `src/background.ts` | `dist/background.js` | default (IIFE) |
| `src/content.ts` | `dist/content.js` | default (IIFE) |
| `src/mse-inject.ts` | `dist/mse-inject.js` | `--format=iife` (MAIN world) |
| `src/popup/popup.ts` | `dist/popup.js` | default (IIFE) |
| `src/popup/settings.ts` | `dist/settings.js` | default (IIFE) |

The `manifest.json` does NOT use `"type": "module"` — it relies on the bundled output. Running `tsc` alone will produce a `dist/` that Chrome cannot load.

## Verification

There are **no tests or lint** configured. The local verification is a successful full build (`npm run build`). GitHub Actions builds a Windows release when a `v*` tag is pushed.

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

## CoApp Runtime Paths

`coapp/src/paths.ts` centralizes user-local installation paths and runtime binary lookup. Release installs use `%LOCALAPPDATA%/MediaGrabber` on Windows, `~/Library/Application Support/MediaGrabber` on macOS, and `~/.local/share/MediaGrabber` on Linux. Development still resolves binaries from the CoApp project directory.

The CoApp download manager uses Node's built-in HTTP/HTTPS streams so the standalone SEA bundle has no ESM-only HTTP dependency.

## Standalone Release Builds

`coapp/scripts/build-sea.mjs` builds Node.js single-executable applications from the esbuild bundles. The installer can embed `release-config.json` and a gzip-compressed CoApp asset; direct embedding of an already-injected SEA binary is unsafe because it duplicates Node's SEA sentinel.

## Popup Architecture

The `default_popup` and `options_ui.page` in `manifest.json` point to `src/popup/popup.html` and `src/popup/settings.html` — these are **uncompiled HTML files** in the source tree. They reference bundled JS via relative paths: `<script src="../../dist/popup.js">` and `<script src="../../dist/settings.js">`.

**CSS sizing:** Chrome action popups must use fixed pixel dimensions. Viewport-relative values (`100vw`, `100vh`, `min()`) will collapse the popup to ~1px wide. Use explicit `width`, `min-height`, and `max-height` in px.

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
| Manifest V3 | Required by the extension runtime |
| Background | Service Worker (not persistent page) |
| Native Messaging | 4-byte length prefix + JSON (weh#rpc) |
| FFmpeg | Bundled with CoApp (not in repo) |
| Language | TypeScript throughout |
