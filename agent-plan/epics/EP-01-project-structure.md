# EP-01 — Project Setup & Infrastructure

**Index**: `agent-plan/EPICS.md`
**Status**: NS (not started)
**Last updated**: 2026-04-06 21:50

---

## Goal

Set up the complete project infrastructure: directory structure, package.json files, TypeScript/build configuration, Git repository, and development environment.

---

## Tasks

| Task ID | Priority | Status | Link |
|---------|----------|--------|------|
| T-01 | P1 | NS | agent-plan/tasks/EP-01-project-structure/T-01-create-directory-structure.md |
| T-02 | P1 | NS | agent-plan/tasks/EP-01-project-structure/T-02-setup-extension-package.md |
| T-03 | P1 | NS | agent-plan/tasks/EP-01-project-structure/T-03-setup-coapp-package.md |
| T-04 | P1 | NS | agent-plan/tasks/EP-01-project-structure/T-04-configure-typescript.md |
| T-05 | P1 | NS | agent-plan/tasks/EP-01-project-structure/T-05-setup-git.md |
| T-06 | P2 | NS | agent-plan/tasks/EP-01-project-structure/T-06-setup-build-pipeline.md |

---

## Description

This epic covers all foundational infrastructure work:

1. **Directory Structure** — Separating extension code from CoApp code
2. **Package.json** — npm configuration for both parts
3. **TypeScript** — Type safety for better maintainability
4. **Git** — Version control setup
5. **Build Pipeline** — Building and packaging the extension and CoApp

---

## Technical Context

### Project Structure

```
MediaGrabber/
├── extension/                    # Browser extension
│   ├── manifest.json            # Manifest V3
│   ├── src/
│   │   ├── background.ts       # Service worker
│   │   ├── content.ts          # Content script
│   │   ├── popup/              # Popup UI
│   │   └── lib/                # Shared utilities
│   ├── public/                  # Static assets
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── icons/
│   └── package.json
│
├── coapp/                       # Native companion app
│   ├── src/
│   │   ├── main.ts             # Entry point
│   │   ├── converter.ts        # ffmpeg wrapper
│   │   ├── downloads.ts        # Download manager
│   │   ├── file.ts            # File operations
│   │   ├── rpc.ts             # RPC protocol
│   │   └── native-messaging.ts # Native messaging
│   ├── ffmpeg/                 # Bundled ffmpeg
│   │   ├── win/ffmpeg.exe
│   │   ├── mac/ffmpeg
│   │   └── linux/ffmpeg
│   ├── package.json
│   └── tsconfig.json
│
├── installer/                    # Installation scripts
│   ├── windows/
│   └── ...
│
└── docs/                        # Documentation
```

### Key Technical Decisions

1. **Separate packages** — Extension and CoApp are separate npm packages
2. **TypeScript throughout** — Both extension and CoApp use TypeScript
3. **Bundled ffmpeg** — FFmpeg binaries included in CoApp distribution
4. **Manifest V3** — Required for Chrome Web Store compliance
