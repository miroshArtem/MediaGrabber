# T-01 — WebRequest Interception

**Epic**: EP-03 (Video Detection & Parsing)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:15

---

## Goal

Implement network request interception to detect media URLs in real-time.

---

## Subtasks

- [ ] Set up `chrome.webRequest.onBeforeRequest` listener
- [ ] Filter for media-related URLs (.m3u8, .mpd, .mp4, .webm, .ts)
- [ ] Extract URL and tabId from request details
- [ ] Deduplicate detected URLs (avoid same URL twice)
- [ ] Forward detected URLs to background script
- [ ] Handle cross-frame requests

---

## Implementation

```typescript
// content.ts - Network interception

class NetworkInterceptor {
  private interceptedUrls = new Set<string>();
  
  setup(): void {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        // Skip non-main-frame requests if needed
        if (details.frameId !== 0 && !details.url.includes('m3u8') && !details.url.includes('mpd')) {
          return;
        }
        
        const url = details.url;
        
        // Skip already intercepted
        if (this.interceptedUrls.has(url)) return;
        
        // Check if media-related
        if (this.isMediaUrl(url)) {
          this.interceptedUrls.add(url);
          this.onMediaUrlDetected(url, details);
        }
      },
      { urls: ['<all_urls>'] }
    );
  }
  
  private isMediaUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('.m3u8') ||
      lower.includes('.mpd') ||
      lower.includes('.mp4') ||
      lower.includes('.webm') ||
      lower.includes('.ts') ||
      lower.includes('.m4s') ||
      lower.includes('.m4a') ||
      lower.includes('.aac')
    );
  }
  
  private onMediaUrlDetected(url: string, details: any): void {
    chrome.runtime.sendMessage({
      action: 'urlDetected',
      url: url,
      tabId: details.tabId,
      type: this.guessMediaType(url)
    });
  }
  
  private guessMediaType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.mpd')) return 'dash';
    if (lower.includes('.mp4') || lower.includes('.webm')) return 'direct';
    return 'unknown';
  }
}
```

---

## Tests

- [ ] M3U8 URL triggers detection
- [ ] MPD URL triggers detection
- [ ] Direct MP4 URL triggers detection
- [ ] Duplicate URLs are not reported twice
- [ ] Message reaches background script
