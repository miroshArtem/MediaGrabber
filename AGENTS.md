# MediaGrabber — Agent Instructions

## Project Overview

Browser extension (Chrome/Edge) + native companion app for downloading online videos with quality selection. Inspired by Video DownloadHelper.

**Architecture**: Extension (Manifest V3, Service Worker) + CoApp (Node.js) + FFmpeg

## Critical Execution Order

This is a **planned project** — no code exists yet. Follow this order:

1. **EP-01** (T-01→T-05) — Project setup first
2. **EP-02** → **EP-04** — Extension + UI
3. **EP-05** → **EP-06** → **EP-07** — CoApp + Communication + FFmpeg (can overlap with extension work)
4. **EP-08** → **EP-09** — Stores (P2, can parallelize)

## Key Technical Decisions (Do Not Change)

| Decision | Value |
|----------|-------|
| Manifest V3 | Mandatory for Chrome Web Store (required since June 2024) |
| Background | Service Worker (not persistent page) |
| Native Messaging | 4-byte length prefix + JSON (like VDH) |
| FFmpeg | Bundled with CoApp |
| Language | TypeScript throughout |

## Repository Structure

```
docs/           # Video DownloadHelper research (reference, not implementation)
agent-plan/      # Project plan with epics (9) and tasks (41)
  ├── EPICS.md  # Master task list
  ├── epics/    # One file per epic
  └── tasks/     # One folder per epic, task files inside
extension/       # (to be created) Browser extension
coapp/          # (to be created) Native companion app
```

## Working with Agent-Plan

- Tasks are `.md` files with subtasks, implementation details, and test criteria
- When implementing a task, read the full task file and the parent epic file
- Update task status to `IP` when starting, `DN` when complete
- Update `Last updated` timestamp in epic and task files when modifying
- Append changelog entry when changing task/epic status

## Native Messaging Protocol (Chrome/Edge)

Messages are length-prefixed binary JSON:
- 4-byte little-endian uint32 (message length)
- UTF-8 JSON message

This is the same protocol VDH uses. See `docs/native-messaging.md` for details.

## No Build Yet

No `extension/` or `coapp/` directories exist — these are planned. Do not look for source code that isn't there.
