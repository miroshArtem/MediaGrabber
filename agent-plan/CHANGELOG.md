# Changelog — MediaGrabber Project

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- (2026-04-07) Created CHANGELOG.md to track project changes

### Fixed
- (2026-04-07) Fixed rpc.ts type error - cast error to Error type in catch block
- (2026-04-07) Fixed file.ts getFreeSpace() - replaced non-existent fs.statfsSync with platform-specific implementation using `wmic` (Windows) and `df` (Unix)
- (2026-04-07) Fixed native-client.ts - removed unused NativeMessage import
- (2026-04-07) Fixed downloads.ts FFmpegProgress initialization - corrected format from `{ time: 0 }` to proper `{ outTimeMs: '0', frame: 0, ... }`
- (2026-04-07) Fixed EPICS.md task statuses - updated EP-05 T-05, EP-06 (all), EP-07 (all) from NS to DN
- (2026-04-07) Fixed main.ts type mismatch - DownloadManager now receives FFmpegConverter instead of FileOperations
- (2026-04-07) Added minimum_chrome_version to manifest.json for better compatibility

---

## [Completed Epics]

### EP-08: Chrome Web Store Publishing — 2026-04-07
- **T-01 Assets Preparation**: Created docs/PRIVACY.md and docs/STORE_LISTING.md with all required content
- **T-02 Store Listing**: Store listing content ready (title, descriptions, category, tags)
- **T-03 Policy Compliance**: Verified all permissions with proper justification
- **T-04 Submission**: Extension packaged and ready for submission

### EP-09: Microsoft Edge Add-ons Publishing — 2026-04-07
- **T-01 Edge Manifest**: Updated native-autoinstall.ts to register Edge native messaging host
- **T-02 Edge Submission**: All assets ready for Microsoft Edge Add-ons submission

### EP-05: Companion App (CoApp) — 2026-04-07
- **T-01 Native Messaging Host**: Implemented native-messaging.ts with 4-byte length prefix binary protocol (O_BINARY mode for Windows)
- **T-02 RPC Protocol**: Implemented rpc.ts with weh#rpc protocol support for Chrome/Edge compatibility
- **T-03 File Operations**: Implemented file.ts with cross-platform file operations
- **T-04 Download Manager**: Implemented downloads.ts with HLS/DASH/direct download support
- **T-05 Windows Registry**: Implemented native-autoinstall.ts with Windows registry configuration and macOS/Linux support

### EP-06: Extension ↔ CoApp Communication — 2026-04-07
- **T-01 Native Messaging Client**: Rewrote native-client.ts with full RPC protocol (request IDs, notifications, auto-reconnect, withRetry)
- **T-02 Request/Response**: Implemented Promise-based request/response pattern with timeout handling
- **T-03 Progress Callbacks**: Implemented onNotify/offNotify for progress notifications from CoApp
- **T-04 Error Handling**: Created errors.ts with typed error classes (CoAppError, ConnectionError, TimeoutError, MethodError, FFmpegError, DownloadError)

### EP-07: FFmpeg Integration — 2026-04-07
- **T-01 FFmpeg Wrapper**: Rewrote converter.ts with FFmpegConverter class using -progress pipe:1 for structured output
- **T-02 HLS Download**: Implemented downloadHLS() method for HLS stream downloading
- **T-03 DASH Download**: Implemented downloadDASH() method for DASH stream downloading
- **T-04 Stream Merging**: Implemented mergeStreams() and probe() methods for video+audio merging
- **T-05 Progress Parsing**: Implemented parseProgress() and parseLegacyProgress() for FFmpeg output parsing

### EP-04: UI Implementation — 2026-04-06
- **T-01 Popup HTML/CSS**: Created popup.html with header, status bar, media list, quality selector, download section, progress, error, footer
- **T-02 Quality Selector**: Implemented Best/Worst quick options in popup.ts
- **T-03 Download Progress**: Implemented formatSpeed, formatETA, and download progress display
- **T-04 Settings Page**: Created settings.html, settings.css, settings.ts with download path, quality preference, notifications
- **T-05 Icon Badge**: Implemented badge for media detection status in background.ts

### EP-03: Video Detection & Parsing — 2026-04-06
- **T-01 webRequest Interception**: Implemented NetworkInterceptor in content.ts
- **T-02 M3U8 Parser**: Implemented lib/m3u8-parser.ts with variant stream extraction
- **T-03 MPD Parser**: Implemented lib/mpd-parser.ts with adaptation sets
- **T-04 Quality Detection**: Implemented lib/quality-utils.ts with labeling and formatting
- **T-05 DOM Analysis**: Implemented DOM element detection for video/audio sources

### EP-02: Browser Extension Core — 2026-04-06
- **T-01 Manifest V3**: Created manifest.json with all required permissions
- **T-02 Service Worker**: Implemented background.ts with native messaging client
- **T-03 Content Script**: Implemented content.ts with NetworkInterceptor class
- **T-04 Background Script**: Implemented popup communication layer
- **T-05 Permissions**: Configured storage, downloads, nativeMessaging, tabs, activeTab, webRequest permissions

### EP-01: Project Setup & Infrastructure — 2026-04-06
- **T-01 Project Structure**: Created directory structure (extension/, coapp/, installer/, docs/)
- **T-02 Extension Package**: Set up extension/package.json with TypeScript, esbuild, m3u8-parser, mpd-parser
- **T-03 CoApp Package**: Set up coapp/package.json with Node.js dependencies (got, tmp, yargs)
- **T-04 TypeScript Config**: Created tsconfig.json for both extension and coapp
- **T-05 Git Setup**: Initialized git with main and develop branches, pushed to GitHub
- **T-06 Build Pipeline**: Created build scripts and root package.json

---

## [Initial Setup]
- (2026-04-06) Created project structure
- (2026-04-06) Initial plan with 9 epics and 41 tasks