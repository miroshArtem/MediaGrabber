# T-05 — Toolbar Icon & Badge

**Epic**: EP-04 (UI Implementation)
**Priority**: P2
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:20

---

## Goal

Implement dynamic toolbar icon that shows detection status via badge.

---

## Subtasks

- [ ] Create toolbar icons (grayscale for no media, colored for detected)
- [ ] Implement badge text (count of detected media)
- [ ] Implement badge color (green for success, yellow for partial)
- [ ] Update icon on media detection
- [ ] Reset icon when tab changes/navigates

---

## Icon States

| State | Icon | Badge |
|-------|------|-------|
| No media | Grayscale icon | None |
| Media detected | Colored icon | Count (e.g., "3") |
| Downloading | Colored icon | Spinning/progress |
| Error | Colored icon with X | "!" |
| CoApp disconnected | Grayscale icon | "!" |

---

## Icon Implementation

```typescript
// background.ts - Icon management

const ICON_PATHS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};

type IconState = 'default' | 'detected' | 'downloading' | 'error';

function updateIcon(tabId: number, state: IconState, count?: number): void {
  // Set icon
  chrome.action.setIcon({
    tabId,
    path: getIconPath(state)
  });
  
  // Set badge
  if (state === 'error') {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#f44336' });
  } else if (count && count > 0) {
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#4caf50' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

function getIconPath(state: IconState): { [key: number]: string } {
  // Return different icons for different states
  // For simplicity, return same icon but with different colors
  return ICON_PATHS;
}

// Update when media detected
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'mediaDetected' && sender.tab) {
    const tabId = sender.tab.id;
    const mediaCount = msg.media?.length || 0;
    
    // Update storage
    mediaByTab.set(tabId, msg.media);
    
    // Update icon
    updateIcon(tabId, mediaCount > 0 ? 'detected' : 'default', mediaCount);
  }
});

// Reset on tab update (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    mediaByTab.delete(tabId);
    updateIcon(tabId, 'default', 0);
  }
});

// Reset on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  mediaByTab.delete(tabId);
});
```

---

## Tests

- [ ] Icon shows grayscale when no media
- [ ] Icon shows colored when media detected
- [ ] Badge shows correct count
- [ ] Badge clears when tab navigates
- [ ] Badge clears when tab closes
