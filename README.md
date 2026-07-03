<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="extension/public/icons/icon-128.png">
    <img src="extension/public/icons/icon-128.png" width="128" alt="MediaGrabber logo">
  </picture>
</p>

<p align="center">
  <strong>Download videos from any website. Pick your quality. No surprises.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-102%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 102+">
  <img src="https://img.shields.io/badge/Edge-102%2B-0078D7?logo=microsoftedge&logoColor=white" alt="Edge 102+">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

---

A browser extension that catches video streams as they pass through the browser and lets you download them in whatever quality you want. Think Video DownloadHelper, but modern, open source, and built for Manifest V3.

Why another downloader? Because the ones that work either haven't been updated in years, come with sketchy installers, or hide quality selection behind a paywall. MediaGrabber does the one thing you actually need — grab the video, give you a quality picker, and get out of your way.

### What it does

- **Detects everything.** HLS streams (.m3u8), DASH manifests (.mpd), direct MP4/WebM files, and even MSE-blobbed video that regular downloaders miss.
- **Quality selection that actually works.** Pick from every variant in the manifest — 240p through 4K. Separate entries for audio tracks and subtitles when the stream offers them.
- **YouTube support.** Full quality selection via yt-dlp integration. No, not just 360p and 720p. Everything the video was uploaded in.
- **Progress you can see.** Badge counter on the icon, download progress in the popup, optional desktop notifications.
- **No tracking, no analytics, no funny business.** The only thing that leaves your machine are the video files you ask for.

### Quick start

```bash
git clone https://github.com/nitroagility/MediaGrabber.git
cd MediaGrabber
npm install
npm run build
cd extension && npm run bundle
```

Then head to [Loading the extension](#loading-the-extension) and you're off.

### What you'll need

Here's everything you need to install before MediaGrabber will work. If you've never done this kind of thing before — don't worry, each one has a direct link and a plain-English explanation.

| # | Thing | Why you need it | Where to get it |
|---|---|---|---|
| 1 | **Node.js 18 or newer** | Builds the extension and the companion app. Comes with npm (the package manager). | [nodejs.org](https://nodejs.org) — click the **LTS** button, run the installer, keep all defaults. |
| 2 | **Chrome 102+ or Edge 102+** | The browser the extension runs in. | You almost certainly have one of these already. If not: [google.com/chrome](https://www.google.com/chrome) |
| 3 | **FFmpeg** (and ffprobe) | Converts streaming video (HLS/DASH) into downloadable MP4 files. | [ffmpeg.org/download.html](https://ffmpeg.org/download.html) — see [Installing FFmpeg](#installing-ffmpeg) below. |
| 4 | **yt-dlp** | Downloads YouTube videos at full quality. | Two ways to get it — see [Installing yt-dlp](#installing-yt-dlp) below. Pick one. |
| 5 | **Python 3.8+** | Only needed if you install yt-dlp via pip (Option B). Not needed if you download the standalone yt-dlp binary. | [python.org/downloads](https://www.python.org/downloads) — run the installer, **check the box that says "Add Python to PATH"** before clicking Install. |

> Node.js and Python are one-time installs — you install them, they stay on your system, and you never think about them again. FFmpeg and yt-dlp are the only things you place inside the project folder.

#### Installing FFmpeg

1. Go to [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Hover over the Windows / Apple / Linux icon depending on your OS
3. Under "Get packages & executable files" pick **"Windows builds from gyan.dev"** (Windows) or **"Static builds for macOS"** (Mac) or use your package manager on Linux (`sudo apt install ffmpeg` on Ubuntu)
4. Download the **essentials** or **release** build (not the full one — it's 300MB)
5. Open the zip, find `ffmpeg.exe` and `ffprobe.exe` inside the `bin/` folder
6. Copy both files into the matching platform folder inside the project:

```
coapp/ffmpeg/win/        ← ffmpeg.exe + ffprobe.exe (Windows)
coapp/ffmpeg/mac/        ← ffmpeg + ffprobe (macOS)
coapp/ffmpeg/linux/      ← ffmpeg + ffprobe (Linux)
```

The folders already exist in the repo — you're just dropping the files in. No installer to run, no PATH to set up.

#### Installing yt-dlp

You have two options. **Option A is easier if you're not a developer.** Both work exactly the same once installed.

**Option A — standalone binary (recommended, no Python needed)**

1. Go to [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases)
2. Find the latest release (the one at the top)
3. Download the file for your platform:
   - Windows: `yt-dlp.exe`
   - macOS: `yt-dlp_macos` (rename it to `yt-dlp` after downloading)
   - Linux: `yt-dlp_linux` (rename to `yt-dlp`)
4. Drop the file into the matching platform folder inside the project:

```
coapp/ytdlp/win/         ← yt-dlp.exe (Windows)
coapp/ytdlp/mac/         ← yt-dlp (macOS)
coapp/ytdlp/linux/       ← yt-dlp (Linux)
```

Done. No terminal, no pip, no Python.

**Option B — pip (if you already have Python or prefer command-line)**

```bash
pip install yt-dlp
```

This puts `yt-dlp` into your Python Scripts folder, which the CoApp finds automatically on Windows. On macOS/Linux it'll be on your PATH. If you go this route, you can skip placing the binary in `coapp/ytdlp/` — the CoApp will find it.

> On macOS/Linux you might need to run `chmod +x yt-dlp` after downloading the binary to make it executable.

### Build it

This is an npm monorepo — one `npm install` grabs everything for both packages.

```bash
# From the project root
npm install        # installs deps for extension + CoApp
npm run build      # compiles TypeScript for both
cd extension && npm run bundle   # ⚠️ DON'T SKIP THIS — esbuild bundle for the browser
```

That last step trips people up. The TypeScript compiler spits out ES modules, but Chrome's service worker can't resolve bare imports like `import { foo } from './lib/bar'`. esbuild bundles everything into self-contained files the browser actually understands. Miss this step and the extension will fail silently with an opaque import error.

### Loading the extension

1. Open `chrome://extensions` (or `edge://extensions` in Edge)
2. Flip on **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the **`extension/`** folder — the one with `manifest.json` in it
5. Copy the 32-character **Extension ID** from the card that appears — you'll need it in a minute

Folks sometimes try to load `extension/dist/` instead. Don't. The manifest lives in `extension/` and all its paths (popup HTML, icons, background script) are relative to that folder.

### Setting up the native companion

The extension alone can detect videos. But for HLS/DASH conversion, YouTube downloads, and progress notifications, it needs the CoApp running as a Native Messaging Host.

Before registering, make sure FFmpeg and yt-dlp are in place (see [Installing FFmpeg](#installing-ffmpeg) and [Installing yt-dlp](#installing-yt-dlp) above). If you already have both available globally from any terminal, you can skip that step.

Now register the native messaging host so Chrome knows how to talk to it:

**Windows:**
```bash
cd coapp
node dist/native-autoinstall.js register abcdef123456...   # your extension ID
```
This writes the necessary registry keys for both Chrome and Edge.

**macOS:**
```bash
cd coapp
node dist/native-autoinstall.js register abcdef123456...
```
Copies the manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`.

**Linux:**
```bash
cd coapp
node dist/native-autoinstall.js register abcdef123456...
```
Copies the manifest to `~/.config/google-chrome/NativeMessagingHosts/`.

After registering, go back to `chrome://extensions` and hit the reload button (↻) on the MediaGrabber card. Open any page with a video, click the MediaGrabber icon, then go to the **Settings** tab — you should see "CoApp: connected" near the top.

If it doesn't connect, check the [Troubleshooting](#troubleshooting) section.

### Using it

Click the MediaGrabber icon on any page with video content. The popup lists everything it found — separate rows for different qualities, audio tracks, and subtitles.

- Click a quality to start downloading
- Use the **⚙** tab to set your default quality preference (best, 1080p, 720p, etc.)
- The badge on the icon shows how many videos are available on the current tab

YouTube works a little differently. When you're on a YouTube video, the popup shows yt-dlp formats instead of raw detected media. Same quality picker, just powered by yt-dlp under the hood. Everything from 144p to 4K shows up.

### How it works (the short version)

The extension runs a [service worker](extension/src/background.ts) that listens for network requests. When it spots a media manifest or direct video URL, it parses it to extract all available quality variants. For HLS and DASH, the parsing is pure regex (no DOMParser in service workers). For YouTube, a Node.js companion app shells out to yt-dlp and ships the format list back.

Two content scripts run on every page: one in the normal isolated world for DOM scanning and media detection, and one injected into the page's own JavaScript context to hook into MSE (Media Source Extensions) — that's how we catch video served through blob URLs that normal request interception misses.

The companion app handles the heavy lifting: FFmpeg for HLS/DASH conversion, yt-dlp for YouTube, and HTTP streaming for direct downloads. Communication between extension and CoApp uses Chrome's native messaging API with a 4-byte length-prefixed JSON protocol.

### Troubleshooting

**"CoApp: disconnected" in Settings**

The most common issue. Check that:
- You ran the `native-autoinstall.js register` command with the correct extension ID
- You reloaded the extension after registering
- FFmpeg is in one of the expected locations (see [Setting up the native companion](#setting-up-the-native-companion))

You can also run the CoApp manually to see error output:
```bash
cd coapp && node dist/main.js
```
It prints the resolved paths for FFmpeg, ffprobe, and yt-dlp on startup. If any of them show just `ffmpeg` or `yt-dlp` (without a full path), the binary wasn't found.

**No videos showing up on a site**

Most sites serve video a few seconds after the page loads. Try refreshing the page with the extension already active. If it's a site that lazy-loads video on scroll, scroll to where the player lives and wait a moment.

**YouTube shows no formats**

yt-dlp needs to be reachable. Check that it's in `coapp/ytdlp/{your-platform}/` or available on your system PATH. Test it manually: `yt-dlp --version` should work from any terminal.

**Download starts but stalls**

Probably FFmpeg missing. The conversion step needs FFmpeg to mux HLS/DASH segments into a playable file. Without it, the download will hang.

### Development

There are no tests, linter, or CI yet. The build verification is: does `tsc` succeed?

```bash
npm run build             # tsc for both packages
cd extension && npm run bundle  # esbuild — ALWAYS after build
```

> `npm run dev:extension` is broken — the extension package has no watch script. Just re-run build + bundle after changes.

For the CoApp:
```bash
npm run dev:coapp         # tsc --watch (this one works)
cd coapp && npm start     # run the companion
```

The extension's source lives in `extension/src/`. The main files:
- `background.ts` — service worker, intercepts requests, manages tab state
- `content.ts` — page-level media detection, MSE message listener
- `mse-inject.ts` — injected into the page's JS context to hook MediaSource
- `lib/m3u8-parser.ts` — HLS manifest parsing
- `lib/dash-parser.ts` — DASH manifest parsing
- `lib/native-client.ts` — native messaging bridge

### Contributing

This is a side project I'm actively hacking on. If you run into a site where detection doesn't work, open an issue with the URL — that's genuinely the most helpful thing you can do. PRs are welcome too, especially for platform installer scripts (the `installer/` directory is currently empty).

### License

MIT — do whatever you want with it. If you build something cool, let me know.
