# Video Detection — How VDH Finds Media

## Overview

**NOTE**: The browser extension source code is NOT publicly available. The detection logic described here is reconstructed from:

- GitHub discussions and issues
- Mozilla Add-ons blog post (2016)
- Troubleshooting documentation
- User reports and observations

**The exact algorithms remain proprietary.**

---

## Detection Mechanisms

Video DownloadHelper uses **multiple parallel detection strategies**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETECTION STRATEGIES                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  1. Network     │  2. DOM          │  3. Manifest Parsing         │
│  Interception  │  Analysis        │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ webRequest API │ <video> elements │ M3U8 playlist URLs           │
│ Monitors HTTP   │ <audio> elements │ MPD manifest URLs           │
│ requests       │ currentSrc attr  │ Signature/decipher URLs     │
│ Looks for      │ play() events    │ Adaptive stream detection   │
│ media MIME     │ error events     │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

## 1. Network Request Interception

### WebRequest API Usage

VDH uses the `webRequest` API to monitor all HTTP traffic:

```javascript
// Hypothetical reconstruction based on WebExtensions API
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Check if this looks like a media request
    if (isMediaRequest(details)) {
      addMediaURL(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Get Content-Type, Content-Length
    const contentType = getHeader(details.responseHeaders, 'content-type');
    const contentLength = getHeader(details.responseHeaders, 'content-length');
    
    if (isMediaContentType(contentType)) {
      updateMediaInfo(details.url, { contentType, contentLength });
    }
  },
  { urls: ["<all_urls>"] }
);
```

### Media MIME Types Detected

Based on extensions, VDH likely detects:
- `video/mp4`
- `video/webm`
- `video/ogg`
- `application/x-mpegURL` (HLS)
- `application/dash+xml` (DASH)
- `audio/mpeg`
- `audio/ogg`

### URL Patterns

VDH looks for common media URL patterns:
- `.mp4` — MP4 video files
- `.webm` — WebM video files
- `.m3u8` — HLS playlists
- `.mpd` — DASH manifests
- `/seg-*.ts` — HLS segments
- `/manifest.*` — DASH manifests

---

## 2. DOM Analysis

### Media Element Detection

Content script scans page DOM for media elements:

```javascript
// Hypothetical reconstruction
function scanMediaElements() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  
  videos.forEach(video => {
    const src = video.currentSrc || video.src;
    if (src) {
      addMediaURL(src, {
        type: 'video',
        element: video
      });
    }
  });
}

// Monitor for dynamically added elements
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
        processMediaElement(node);
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });
```

### Event Listeners

VDH likely attaches listeners to media elements:
- `play` — Stream started
- `pause` — Stream paused
- `ended` — Stream ended
- `error` — Error occurred
- `loadedmetadata` — Metadata loaded
- `timeupdate` — Playback position changed

---

## 3. Manifest Parsing

### HLS Detection (M3U8)

HLS streams are identified by `.m3u8` playlist URLs:

```
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:1
#EXTINF:10.0,
segment1.ts
#EXTINF:10.0,
segment2.ts
#EXT-X-ENDLIST
```

VDH parses the manifest to:
- Extract segment URLs
- Determine total duration
- Identify available quality levels
- Find alternative audio tracks

### DASH Detection (MPD)

DASH streams use MPD manifests:

```xml
<MPD xmlns="urn:mpeg:dash:manifest:2011">
  <Period>
    <AdaptationSet>
      <Representation id="1" bandwidth="4000000" width="1920" height="1080">
        <BaseURL>video.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

### YouTube-Specific Detection

YouTube detection is particularly complex due to:
- Encrypted signatures in URLs
- Regional streaming endpoints
- Adaptive HLS/DASH streams
- VPN detection and blocking

**According to Discussion #1074**:
> "YouTube is trying to block every download (there are different tools which are updating continuously because they change the way to release the links to download the stream)"

---

## Detection Challenges

### 1. Dynamic URL Generation

Many sites generate media URLs dynamically via JavaScript:
```javascript
// Site might do something like this
const url = generateVideoURL(videoId, timestamp, signature);
video.src = url;
```

VDH must intercept the network request after JavaScript sets `src`.

### 2. Blob URLs

Some sites use `blob:` URLs:
```javascript
video.src = 'blob:https://example.com/a1b2c3d4';
```

These point to in-memory data, requiring different handling.

### 3. Encrypted/DRM Content

Sites with DRM protection cannot be downloaded:
- Widevine (Google)
- PlayReady (Microsoft)
- FairPlay (Apple)

VDH explicitly states: **"What can I do if the video is protected by DRM?"** — Answer: Nothing, it can't be done.

### 4. Geo-Restricted Content

YouTube uses different streaming endpoints per region:
- Different CDN endpoints per country
- VPN detection may block access
- Some content unavailable in certain regions

---

## Information Extraction

### Smart Naming

VDH's Smart Naming feature extracts the video title from page content:

```javascript
// Hypothetical
function getVideoTitle() {
  // Try various sources in order of preference
  return (
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('h1')?.textContent ||
    document.title
  );
}
```

### Quality Detection

VDH identifies available quality levels:
- From M3U8 variant streams (multiple `#EXT-X-STREAM-INF`)
- From MPD Representation elements
- From URL patterns (e.g., `1080p`, `720p`)

### Download Options

For each detected media, VDH shows options:
- Available quality levels
- Format (MP4, WebM, etc.)
- File size estimates
- Audio/video track info

---

## Tab Monitoring

### Multi-Tab Support

VDH tracks media detection per tab:

```javascript
// Hypothetical
const tabMedia = new Map();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Page loaded, start scanning
    startMediaDetection(tabId);
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  // Clean up
  tabMedia.delete(tabId);
});
```

### Icon State

Toolbar icon changes based on detection:
- **Grayscale**: No media detected
- **Colored**: Media detected in current tab
- **Animated**: Download in progress

---

## Troubleshooting Detection Issues

From the FAQ and discussions:

### "VDH doesn't detect video on site X"

Possible reasons:
1. Site uses uncommon streaming format
2. Site blocks detection (obfuscation, CDN restrictions)
3. Video requires authentication (VDH may not have access to auth cookies)
4. Browser extension permissions missing

### "Downloaded file has no audio"

This typically happens when:
1. Video and audio are in separate streams (VDH should merge them via CoApp/ffmpeg)
2. Site delivers audio via separate URL
3. Player uses MSE (Media Source Extensions) with custom audio loading

### "Some YouTube videos not detected"

- YouTube continuously changes their streaming mechanisms
- VPN users may see different endpoints
- Age-restricted videos require special handling
- Live streams work differently than VOD

---

## Technical Constraints

### Multiprocess Firefox (e10s)

When Firefox introduced multiprocess architecture:
- Content scripts run in **isolated content process**
- Background scripts run in **extension process**
- Communication via message passing required

This made VDH's architecture more complex.

### Browser API Limitations

WebExtensions APIs don't provide:
- Direct access to raw network sockets
- Modification of encrypted media requests
- Access to DRM-protected content
- Unlimited file system access

These constraints shaped VDH's two-component architecture.

---

## Future of Detection

### V10 Changes

Version 10 shifted to Browser Download API:
- Uses browser's cache for content
- Respects browser's authentication state
- May improve detection on some sites

### Limitations

- Still cannot bypass DRM
- Still cannot detect dynamically generated URLs before they're requested
- Still dependent on webRequest API behavior
