# Video DownloadHelper — Version History

## Timeline

| Year | Version | Key Changes |
|------|---------|-------------|
| 2006 | v1.0 | Initial release (Firefox 1.5 era) |
| ~2015 | v5.0.1 | First e10s-compatible version (Add-ons SDK) |
| Nov 2017 | v7.0.0 | WebExtensions rewrite (Firefox Quantum) |
| 2017+ | v7.x | CoApp introduced for file operations |
| 2018+ | v8.x | Mature WebExtensions version |
| 2019+ | v9.x | FFmpeg as download engine |
| Dec 2025 | v10.0 | CoApp no longer required |

---

## v1.0 — Initial Release (July 2006)

**Context**: Firefox 1.5 era

### Architecture
- Single XUL-based add-on
- All code ran in **same process** as page content
- Direct access to `window.content` for video URL extraction
- Direct file system writes permitted

### Features
- Basic video detection
- Simple file downloads
- Smart Naming feature (extracted titles from pages)

---

## v5.0.1 — Multiprocess Firefox Compatibility (March 2015)

**Context**: Mozilla introduced multiprocess Firefox (e10s)

### The Problem

In multiprocess Firefox:
- DOM content runs in **separate process** from add-on code
- Direct `window.content` access no longer possible
- Required **asynchronous communication** everywhere

### Migration Approach

VDH moved to Mozilla Add-ons SDK with **client-server architecture**:

```
┌─────────────────┐                    ┌─────────────────┐
│  Content        │  ◄── messaging ──► │  Main Process   │
│  Process        │                    │  (SDK modules)  │
│                 │                    │                 │
│  - DOM access   │                    │  - Preferences  │
│  - Media URLs  │                    │  - Localization │
│  - Page events │                    │  - Storage      │
└─────────────────┘                    └─────────────────┘
```

### Limitations Encountered

From Michel Gutierrez's blog post (2016):

1. **Resizing panels** — Content process knows dimensions, but only background process can resize
2. **Network traffic monitoring** — Required low-level APIs not in SDK
3. **Tab thumbnails** — SDK API didn't work in e10s mode, had to use framescript
4. **Compressed responses** — SDK didn't decode compressed network responses
5. **e10s detection** — No SDK API to detect if e10s was enabled

---

## v7.0.0 — WebExtensions Rewrite (November 14, 2017)

**Context**: Firefox 57 "Quantum" released

### The Breaking Change

Firefox 57 **killed** XUL extensions and Add-ons SDK:
- No more XUL overlays
- No more `require("sdk/*")` modules
- **WebExtensions only**

### What This Meant for VDH

New restrictions:
- Extensions **cannot write files to disk**
- Extensions **cannot spawn native processes**
- Extensions have **limited API access**

### The Solution: CoApp

To work around these restrictions, Michel created the **Companion Application (CoApp)**:

> "Browser add-ons or extensions (new terminology at that time) were no longer permitted to write files on the user's HDDs. The browser itself still could, but add-ons could no longer. This was considered an improvement in software security."

CoApp runs as a **separate native application** invoked via Native Messaging.

### Key Architectural Changes

| Aspect | v6 (XUL) | v7 (WebExtensions) |
|--------|----------|-------------------|
| File writing | Direct | Via CoApp |
| FFmpeg usage | Direct | Via CoApp |
| Process model | Single | Extension + CoApp |
| API access | All Firefox APIs | WebExtensions only |

---

## v7.x — Stabilization Period

### Features Added
- Improved YouTube support
- Better HLS/DASH handling
- CoApp auto-installation
- Premium licensing system

### Known Issues
- Slow conversion for some sites (user complaints from 2019)
- Unfinished downloads reported

---

## v8.x — Further Refinement

### Changes
- UI improvements
- Bug fixes for YouTube
- Better error handling
- Improved download reliability

---

## v9.x — FFmpeg as Download Engine

**Timeline**: CoApp started using ffmpeg as the download engine (~2023-2024)

### Before vs After

**Before (v7-v8)**:
- CoApp downloaded segments via HTTP
- FFmpeg only used for **merging/converting**
- Many downloads required manual processing

**After (v9)**:
- FFmpeg handles **entire download process**
- Downloads HLS/DASH directly via ffmpeg
- Simpler, more reliable

From Discussion #153:
> "The CoApp uses ffmpeg as its download engine. That is a relatively recent development since last year."

### Technical Changes

```bash
# Old approach: Download segments manually, then merge
curl -o seg1.ts http://cdn/seg1.ts
curl -o seg2.ts http://cdn/seg2.ts
ffmpeg -i "concat:seg1.ts|seg2.ts" -c copy output.mp4

# New approach: Let ffmpeg handle it
ffmpeg -i http://example.com/stream.m3u8 -c copy output.mp4
```

---

## v10.0 — Architecture Revolution (December 2025)

**Released**: December 2025

### The Big Change

V10 **eliminates CoApp requirement** for downloads:

> CoApp development discontinued as of Dec 2025

### How It Works

Instead of CoApp, V10 uses:
- **Browser Download API** — Native browser download capability
- **Browser Cache** — Content already in memory
- **Browser Auth** — Respects user's authenticated state

### Benefits

| Aspect | V9 (CoApp) | V10 |
|--------|-----------|-----|
| Installation | Requires CoApp install | Extension only |
| Speed | Native network (slower) | Browser cache (faster) |
| Auth handling | Via CoApp | Browser cookies |
| Download location | Any directory | Browser download folder |
| Reliability | Good | Better (uses browser internals) |

### Limitations

- **Download folder only** — Cannot choose arbitrary directory
- **CoApp still used** — For conversion, watermarking (premium)
- **No arbitrary ffmpeg** — Limited to browser's capabilities

---

## YouTube-Specific History

### Why Chrome Can't Download YouTube

> "Due to a legal restriction imposed by Google, the owner of both Chrome & YouTube, VDH for Chrome does not download from YouTube. Google has no power over Firefox nor Edge, so those versions of VDH download YouTube videos without any problem."

### YouTube Stream Changes

From various discussions:

| Time | YouTube Change | VDH Response |
|------|---------------|--------------|
| 2019 | Changes to HLS manifest format | v7.3.7 released June 26, 2019 |
| 2023 | Signature cipher changes | Frequent updates |
| 2024 | Ongoing | Maintainers continuously work on it |
| Ongoing | VPN detection | Cannot be fully bypassed |

---

## Platform-Specific Notes

### Firefox
- Original platform, most mature
- Full YouTube support
- CoApp optional (V10), required for some features (V9)

### Chrome
- Limited by Google's policies
- **No YouTube downloads**
- Same CoApp as Firefox

### Edge
- Uses Chromium like Chrome
- May have YouTube restrictions like Chrome
- Same CoApp as Firefox

### Linux
- No license required
- "noffmpeg" builds available for system ffmpeg
- Community support via AUR (Arch)

---

## Popularity Statistics

- **2006-2019**: Third most popular Firefox extension
- **Peak users**: ~2,848,968 (December 2019)
- **Top extensions beaten**: Adblock Plus, uBlock Origin (in Mozilla recommendations)
- **Download count**: 85+ million (2011, per Business Insider article)

---

## Future Direction

Based on V10's architecture:
- Less dependency on native applications
- More reliance on browser capabilities
- Potential for faster, more reliable downloads
- Continued YouTube arms race with Google
