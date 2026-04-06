# T-05 — DOM Analysis

**Epic**: EP-03 (Video Detection & Parsing)
**Priority**: P2
**Status**: DN (done)
**Last updated**: 2026-04-07 00:12

---

## Goal

Implement DOM analysis to supplement network-based detection (find video elements, extract sources).

---

## Subtasks

- [ ] Find all `<video>` and `<audio>` elements
- [ ] Extract `src` and `currentSrc` attributes
- [ ] Monitor for dynamically added elements (MutationObserver)
- [ ] Handle blob: URLs appropriately
- [ ] Extract media from `<source>` child elements
- [ ] Get video dimensions and duration

---

## Implementation

```typescript
// content.ts - DOM Analysis section

class DOMMediaFinder {
  private processedElements = new WeakSet<Element>();
  
  setup(): void {
    // Check existing media elements
    this.scanDocument();
    
    // Watch for dynamically added elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            this.processElement(node);
          }
        }
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  private scanDocument(): void {
    document.querySelectorAll('video, audio, source').forEach(el => {
      this.processElement(el);
    });
  }
  
  private processElement(element: Element): void {
    if (this.processedElements.has(element)) return;
    
    if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
      this.extractMediaFromElement(element);
    }
    
    if (element instanceof HTMLSourceElement) {
      const parent = element.parentElement;
      if (parent instanceof HTMLVideoElement || parent instanceof HTMLAudioElement) {
        this.extractMediaFromElement(parent);
      }
    }
    
    this.processedElements.add(element);
  }
  
  private extractMediaFromElement(el: HTMLMediaElement): void {
    const src = el.currentSrc || el.src;
    
    if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
      // Send to background
      chrome.runtime.sendMessage({
        action: 'mediaDetected',
        media: {
          type: 'direct',
          url: src,
          pageUrl: window.location.href,
          metadata: {
            duration: el.duration || undefined,
            videoWidth: el.videoWidth || undefined,
            videoHeight: el.videoHeight || undefined,
            tagName: el.tagName
          }
        }
      });
    }
    
    // Check child source elements
    el.querySelectorAll('source').forEach(source => {
      const sourceSrc = source.src;
      if (sourceSrc && !sourceSrc.startsWith('blob:')) {
        chrome.runtime.sendMessage({
          action: 'mediaDetected',
          media: {
            type: 'direct',
            url: sourceSrc,
            pageUrl: window.location.href,
            metadata: {
              type: source.type || undefined,
              tagName: 'SOURCE'
            }
          }
        });
      }
    });
  }
}
```

---

## Limitations

1. **Blob URLs** — Cannot download blob: URLs (in-memory media)
2. **MSE** — Media Source Extensions create dynamic streams not in DOM
3. **Encrypted Media** — DRM-protected content cannot be extracted

---

## Tests

- [ ] Standard video element is detected
- [ ] Source child element is detected
- [ ] Dynamically added video is detected
- [ ] Blob URLs are correctly skipped
- [ ] Metadata (dimensions, duration) is extracted
