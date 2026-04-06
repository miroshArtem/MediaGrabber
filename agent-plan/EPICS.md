# EPICS — MediaGrabber Project

Project: MediaGrabber (Video Download Extension)  
Last updated: 2026-04-07 00:12

---

## Overview

Build a browser extension (Chrome/Edge) with companion native app for downloading online videos with quality selection. Similar to Video DownloadHelper.

**Architecture**: Extension (Manifest V3) + Native App (CoApp on Node.js) + FFmpeg

---

## Epic List

| EP | Title | Priority | Status | Tasks |
|----|-------|----------|--------|-------|
| EP-01 | Project Setup & Infrastructure | P1 | DN | 6 |
| EP-02 | Browser Extension Core | P1 | DN | 5 |
| EP-03 | Video Detection & Parsing | P1 | DN | 5 |
| EP-04 | UI Implementation | P1 | IP | 5 |
| EP-05 | Companion App (CoApp) | P1 | NS | 5 |
| EP-06 | Extension ↔ CoApp Communication | P1 | NS | 4 |
| EP-07 | FFmpeg Integration | P1 | NS | 5 |
| EP-08 | Chrome Web Store Publishing | P2 | NS | 4 |
| EP-09 | Microsoft Edge Publishing | P2 | NS | 2 |

**Total Tasks**: 41

---

## Detailed Task Index

### EP-01: Project Setup & Infrastructure
```
T-01 │ P1 │ DN │ tasks/EP-01-project-structure/T-01-project-structure.md
T-02 │ P1 │ DN │ tasks/EP-01-project-structure/T-02-extension-package.md
T-03 │ P1 │ DN │ tasks/EP-01-project-structure/T-03-coapp-package.md
T-04 │ P1 │ DN │ tasks/EP-01-project-structure/T-04-typescript-config.md
T-05 │ P1 │ DN │ tasks/EP-01-project-structure/T-05-git-setup.md
T-06 │ P2 │ DN │ tasks/EP-01-project-structure/T-06-build-pipeline.md
```

### EP-02: Browser Extension Core
```
T-01 │ P1 │ DN │ tasks/EP-02-extension-core/T-01-manifest-v3.md
T-02 │ P1 │ DN │ tasks/EP-02-extension-core/T-02-service-worker.md
T-03 │ P1 │ DN │ tasks/EP-02-extension-core/T-03-content-script.md
T-04 │ P1 │ DN │ tasks/EP-02-extension-core/T-04-background-script.md
T-05 │ P1 │ DN │ tasks/EP-02-extension-core/T-05-permissions.md
```

### EP-03: Video Detection & Parsing
```
T-01 │ P1 │ DN │ tasks/EP-03-video-detection/T-01-webrequest-interception.md
T-02 │ P1 │ DN │ tasks/EP-03-video-detection/T-02-m3u8-parser.md
T-03 │ P1 │ DN │ tasks/EP-03-video-detection/T-03-mpd-parser.md
T-04 │ P1 │ DN │ tasks/EP-03-video-detection/T-04-quality-detection.md
T-05 │ P2 │ DN │ tasks/EP-03-video-detection/T-05-dom-analysis.md
```

### EP-04: UI Implementation
```
T-01 │ P1 │ DN │ tasks/EP-04-ui/T-01-popup-html-css.md
T-02 │ P1 │ NS │ tasks/EP-04-ui/T-02-quality-selector.md
T-03 │ P1 │ NS │ tasks/EP-04-ui/T-03-download-progress.md
T-04 │ P2 │ NS │ tasks/EP-04-ui/T-04-settings-page.md
T-05 │ P2 │ NS │ tasks/EP-04-ui/T-05-icon-badge.md
```

### EP-05: Companion App (CoApp)
```
T-01 │ P1 │ NS │ tasks/EP-05-coapp/T-01-native-messaging-host.md
T-02 │ P1 │ NS │ tasks/EP-05-coapp/T-02-rpc-protocol.md
T-03 │ P1 │ NS │ tasks/EP-05-coapp/T-03-file-operations.md
T-04 │ P1 │ NS │ tasks/EP-05-coapp/T-04-download-manager.md
T-05 │ P1 │ NS │ tasks/EP-05-coapp/T-05-windows-registry.md
```

### EP-06: Extension ↔ CoApp Communication
```
T-01 │ P1 │ NS │ tasks/EP-06-communication/T-01-native-messaging-client.md
T-02 │ P1 │ NS │ tasks/EP-06-communication/T-02-request-response.md
T-03 │ P1 │ NS │ tasks/EP-06-communication/T-03-progress-callbacks.md
T-04 │ P1 │ NS │ tasks/EP-06-communication/T-04-error-handling.md
```

### EP-07: FFmpeg Integration
```
T-01 │ P1 │ NS │ tasks/EP-07-ffmpeg/T-01-ffmpeg-wrapper.md
T-02 │ P1 │ NS │ tasks/EP-07-ffmpeg/T-02-hls-download.md
T-03 │ P1 │ NS │ tasks/EP-07-ffmpeg/T-03-dash-download.md
T-04 │ P1 │ NS │ tasks/EP-07-ffmpeg/T-04-stream-merging.md
T-05 │ P1 │ NS │ tasks/EP-07-ffmpeg/T-05-progress-parsing.md
```

### EP-08: Chrome Web Store Publishing
```
T-01 │ P2 │ NS │ tasks/EP-08-chrome-store/T-01-assets-preparation.md
T-02 │ P2 │ NS │ tasks/EP-08-chrome-store/T-02-store-listing.md
T-03 │ P2 │ NS │ tasks/EP-08-chrome-store/T-03-policy-compliance.md
T-04 │ P2 │ NS │ tasks/EP-08-chrome-store/T-04-submission.md
```

### EP-09: Microsoft Edge Publishing
```
T-01 │ P2 │ NS │ tasks/EP-09-edge-store/T-01-edge-manifest.md
T-02 │ P2 │ NS │ tasks/EP-09-edge-store/T-02-edge-submission.md
```

---

## Priority Order for Execution

**P1 Tasks (Must Complete)**:
1. EP-01: Project Setup (T-01 → T-05)
2. EP-02: Extension Core (T-01 → T-05)
3. EP-03: Video Detection (T-01 → T-04)
4. EP-04: UI (T-01 → T-03)
5. EP-05: CoApp (T-01 → T-05)
6. EP-06: Communication (T-01 → T-04)
7. EP-07: FFmpeg (T-01 → T-05)

**P2 Tasks (Can Run in Parallel with P1 or After)**:
8. EP-04: UI (T-04 → T-05)
9. EP-08: Chrome Store
10. EP-09: Edge Store

---

## Project Structure

```
MediaGrabber/
├── extension/                    # Browser extension (Manifest V3)
│   ├── manifest.json
│   ├── src/
│   │   ├── background.ts       # Service worker
│   │   ├── content.ts          # Content script
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.ts
│   │   │   └── popup.css
│   │   └── lib/
│   │       ├── native-client.ts
│   │       ├── m3u8-parser.ts
│   │       └── mpd-parser.ts
│   └── package.json
│
├── coapp/                        # Native companion app (Node.js)
│   ├── src/
│   │   ├── main.ts             # Entry point
│   │   ├── converter.ts        # FFmpeg wrapper
│   │   ├── downloads.ts         # Download manager
│   │   ├── file.ts             # File operations
│   │   ├── rpc.ts              # RPC protocol
│   │   └── native-messaging.ts
│   ├── ffmpeg/                  # Bundled FFmpeg binaries
│   └── package.json
│
├── installer/                    # Platform installers
│
├── docs/                        # Documentation (VDH research)
│
└── agent-plan/                  # This plan
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manifest Version | V3 | Required for Chrome Web Store (mandatory since June 2024) |
| Background Script | Service Worker | MV3 uses service workers, not persistent pages |
| Native Messaging Protocol | 4-byte length prefix + JSON | Same as VDH, compatible with Chrome/Edge |
| FFmpeg Usage | Bundled with CoApp | Ensures consistent version, works offline |
| Stream Parsing | m3u8-parser npm | Well-tested, RFC 8216 compliant |
| Language | TypeScript | Type safety, better maintainability |

---

## Execution Notes

When starting implementation:
1. Begin with EP-01 (T-01 first)
2. Complete EP-01 fully before EP-02
3. EP-02 and EP-03 can overlap slightly (content script in EP-02 feeds detection in EP-03)
4. EP-05 (CoApp) can be developed in parallel with EP-02-04
5. EP-06 depends on EP-02 and EP-05 being mostly complete
6. EP-07 depends on EP-05

---

## Changelog

| Date | Action | Item | Details |
|------|--------|------|---------|
| 2026-04-06 22:50 | created | EPICS.md | Initial plan with 41 tasks across 9 epics |
| 2026-04-06 23:30 | status | EP-01 T-06 | Marked DN - Build pipeline complete |
| 2026-04-06 23:30 | status | EP-01 | Marked DN - Project setup complete |
| 2026-04-07 00:12 | status | EP-03 | Marked DN - Video detection complete |
| 2026-04-06 23:05 | created | extension/ | Created extension scaffold with manifest, src/, public/icons |
| 2026-04-06 23:05 | created | coapp/ | Created CoApp scaffold with TypeScript sources |
| 2026-04-06 23:05 | created | installer/ | Created platform-specific installer directories |
