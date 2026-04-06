# EP-02: Browser Extension Core (Manifest V3)

**Index**: agent-plan/EPICS.md  
**Status**: DN  
**Last updated**: 2026-04-06 23:55

## Goal

Build the core browser extension with Manifest V3, service worker background, content script injection, and proper Chrome/Edge permission handling.

## Tasks

| T-01 | P1 | DN | [T-01-manifest-v3.md](./tasks/EP-02-extension-core/T-01-manifest-v3.md) |
| T-02 | P1 | DN | [T-02-service-worker.md](./tasks/EP-02-extension-core/T-02-service-worker.md) |
| T-03 | P1 | DN | [T-03-content-script.md](./tasks/EP-02-extension-core/T-03-content-script.md) |
| T-04 | P1 | DN | [T-04-background-script.md](./tasks/EP-02-extension-core/T-04-background-script.md) |
| T-05 | P1 | DN | [T-05-permissions.md](./tasks/EP-02-extension-core/T-05-permissions.md) |

## Completed

- Created Manifest V3 configuration with all required permissions
- Implemented service worker with CoApp native messaging
- Implemented content script for media detection
- Implemented popup communication layer
- Configured permissions: webRequest, storage, nativeMessaging, tabs, downloads
