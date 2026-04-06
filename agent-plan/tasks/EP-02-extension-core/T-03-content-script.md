# T-03 — Implement Content Script

**Epic**: EP-02 (Browser Extension Core)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:45

---

## Goal

Implement the content script that detects media URLs on web pages via webRequest interception and DOM analysis.

---

## Subtasks

- [ ] Create `content.ts` skeleton
- [ ] Implement webRequest listener for network interception
- [ ] Implement M3U8 playlist detection
- [ ] Implement MPD manifest detection
- [ ] Implement DOM analysis for video/audio elements
- [ ] Send detected media to background script
- [ ] Handle page unload cleanup

---

## Content Script Responsibilities

1. **Monitor network requests** via `chrome.webRequest.onBeforeRequest`
2. **Detect media URLs** (.m3u8, .mpd, .mp4, .webm, etc.)
3. **Parse variant streams** from M3U8 playlists
4. **Analyze DOM** for video/audio elements
5. **Send findings** to background service worker

---

## Basic Implementation

```typescript
// content.ts

interface DetectedMedia {
  type: 'hls' | 'dash' | 'mp4' | 'webm';
  url: string;
  qualities?: MediaQuality[];
  pageUrl: string;
}

interface MediaQuality {
  bandwidth: number;
  resolution: string;
  url: string;
}

class MediaDetector {
  private mediaUrls = new Set<string>();
  private manifestUrls = new Set<string>();
  
  constructor() {
    this.setupWebRequestListener();
    this.setupDOMObserver();
  }
  
  private setupWebRequestListener(): void {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        const url = details.url;
        
        // Detect M3U8 (HLS)
        if (url.endsWith('.m3u8') || url.includes('m3u8')) {
          this.handleM3U8Url(url);
        }
        // Detect MPD (DASH)
        else if (url.endsWith('.mpd') || url.includes('mpd')) {
          this.handleMPDUrl(url);
        }
        // Detect direct media files
        else if (this.isMediaUrl(url)) {
          this.handleMediaUrl(url);
        }
      },
      { urls: ['<all_urls>'] }
    );
  }
  
  private isMediaUrl(url: string): boolean {
    const mediaExts = ['.mp4', '.webm', '.ts', '.m4s', '.m4a', '.aac'];
    return mediaExts.some(ext => url.toLowerCase().includes(ext));
  }
  
  private async handleM3U8Url(url: string): Promise<void> {
    if (this.manifestUrls.has(url)) return;
    this.manifestUrls.add(url);
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      const variants = this.parseM3U8(text, url);
      
      if (variants.length > 0) {
        this.sendToBackground({
          type: 'hls',
          url: url,
          qualities: variants,
          pageUrl: window.location.href
        });
      }
    } catch (e) {
      console.error('Failed to fetch M3U8:', e);
    }
  }
  
  private parseM3U8(text: string, baseUrl: string): MediaQuality[] {
    const variants: MediaQuality[] = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // EXT-X-STREAM-INF contains quality info
      if (line.includes('EXT-X-STREAM-INF')) {
        const quality = this.parseStreamInfo(line);
        const playlistUrl = lines[i + 1]?.trim();
        
        if (playlistUrl && !playlistUrl.startsWith('#')) {
          variants.push({
            bandwidth: quality.bandwidth || 0,
            resolution: quality.resolution || 'unknown',
            url: this.resolveUrl(playlistUrl, baseUrl)
          });
          i++; // Skip next line (playlist URL)
        }
      }
    }
    
    return variants;
  }
  
  private parseStreamInfo(line: string): { bandwidth?: number; resolution?: string } {
    const result: { bandwidth?: number; resolution?: string } = {};
    
    const bwMatch = line.match(/BANDWIDTH=(\d+)/);
    if (bwMatch) result.bandwidth = parseInt(bwMatch[1]);
    
    const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
    if (resMatch) result.resolution = resMatch[1];
    
    return result;
  }
  
  private resolveUrl(playlistUrl: string, baseUrl: string): string {
    if (playlistUrl.startsWith('http')) return playlistUrl;
    if (playlistUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return `${url.origin}${playlistUrl}`;
    }
    // Relative path
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return base + playlistUrl;
  }
  
  private sendToBackground(media: DetectedMedia): void {
    chrome.runtime.sendMessage({
      action: 'mediaDetected',
      media: media
    });
  }
}

// Initialize when DOM is ready
new MediaDetector();
```

---

## DOM Analysis (Supplementary)

Content script can also analyze DOM elements:

```typescript
private setupDOMObserver(): void {
  // Check existing media elements
  document.querySelectorAll('video, audio').forEach(el => {
    const src = (el as HTMLMediaElement).currentSrc || (el as HTMLMediaElement).src;
    if (src) this.handleMediaUrl(src);
  });
  
  // Watch for dynamically added elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLVideoElement || node instanceof HTMLAudioElement) {
          const src = (node as HTMLMediaElement).currentSrc;
          if (src) this.handleMediaUrl(src);
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
```

---

## Tests

- [ ] Content script loads without errors
- [ ] M3U8 URLs are detected in network tab
- [ ] M3U8 variants are parsed correctly
- [ ] Messages reach background script
- [ ] DOM video elements are detected
