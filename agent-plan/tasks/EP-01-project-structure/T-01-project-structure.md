# T-01 — Create Project Directory Structure

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:05

---

## Goal

Create the complete project directory structure with separate folders for extension, CoApp, documentation, and assets.

---

## Subtasks

- [ ] Create root `MediaGrabber/` directory structure
- [ ] Create `extension/` subdirectories (`src/`, `public/`, `icons/`)
- [ ] Create `extension/src/` subdirectories (`popup/`, `lib/`)
- [ ] Create `coapp/` subdirectories (`src/`, `ffmpeg/`, `ffmpeg/win/`, `ffmpeg/mac/`, `ffmpeg/linux/`)
- [ ] Create `installer/` subdirectories for platform-specific installers
- [ ] Create `docs/` directory (already exists with VDH research)
- [ ] Create `.gitignore` file
- [ ] Create `README.md` with project overview

---

## Expected Structure

```
MediaGrabber/
├── extension/
│   ├── manifest.json
│   ├── src/
│   │   ├── background.ts
│   │   ├── content.ts
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.ts
│   │   │   └── popup.css
│   │   └── lib/
│   │       ├── m3u8-parser.ts
│   │       ├── mpd-parser.ts
│   │       └── native-client.ts
│   ├── public/
│   │   └── icons/
│   │       ├── icon-16.png
│   │       ├── icon-32.png
│   │       ├── icon-48.png
│   │       └── icon-128.png
│   └── package.json
│
├── coapp/
│   ├── src/
│   │   ├── main.ts
│   │   ├── converter.ts
│   │   ├── downloads.ts
│   │   ├── file.ts
│   │   ├── rpc.ts
│   │   └── native-messaging.ts
│   ├── ffmpeg/
│   │   ├── win/ffmpeg.exe
│   │   ├── mac/ffmpeg
│   │   └── linux/ffmpeg
│   ├── package.json
│   └── tsconfig.json
│
├── installer/
│   ├── windows/
│   └── linux/
│
├── docs/                        # Already exists with VDH research
│
├── .gitignore
├── README.md
└── package.json                 # Workspace root (optional)
```

---

## Tests

- [ ] Verify all directories exist using `ls` or file explorer
- [ ] Verify `.gitignore` properly excludes `node_modules/`, `dist/`, `*.exe`
