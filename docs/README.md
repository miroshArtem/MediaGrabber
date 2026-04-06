# Video DownloadHelper — Technical Documentation

## Table of Contents

1. [Overview](./overview.md)
2. [Architecture](./architecture.md)
3. [Companion App (CoApp)](./coapp.md)
4. [Native Messaging Protocol](./native-messaging.md)
5. [FFmpeg Integration](./ffmpeg.md)
6. [Video Detection](./detection.md)
7. [Version History](./changelog.md)

---

## Quick Facts

| Property | Value |
|----------|-------|
| **Developer** | Michel Gutierrez (mig), later Paul |
| **Browser Support** | Firefox, Chrome, Edge |
| **CoApp Status** | Open Source (GitHub: aclap-dev/vdhcoapp) |
| **Extension Status** | Proprietary (closed source) |
| **Written In** | JavaScript/Node.js (CoApp), WebExtensions API (Extension) |
| **License** | Freemium |

---

## Key Finding

**The browser extension source code is NOT publicly available.** Only the Companion App (CoApp) is open source. The video-downloadhelper GitHub repository contains only store listing assets (screenshots, README).

This documentation attempts to reconstruct the full picture from:
- Open-source CoApp source code analysis
- GitHub discussions and Wiki
- Mozilla Add-ons blog post (2016)
- Technical discussions and troubleshooting guides
