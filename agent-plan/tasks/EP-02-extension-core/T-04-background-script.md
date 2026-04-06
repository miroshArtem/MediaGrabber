# T-04 — Implement Background Script (Popup Communication)

**Epic**: EP-02 (Browser Extension Core)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:50

---

## Goal

Implement the background script's popup communication layer — sending media data to popup and receiving download requests.

---

## Subtasks

- [ ] Create popup connection handler
- [ ] Implement `chrome.runtime.onConnect` listener for popup
- [ ] Implement `sendMediaList` to popup
- [ ] Implement download request handler from popup
- [ ] Handle popup open/close lifecycle

---

## Background Script Popup Communication

```typescript
// background.ts - Popup communication section

// Store active popup connections
const popupPorts = new Set<chrome.runtime.Port>();

// Listen for popup connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPorts.add(port);
    
    port.onMessage.addListener((msg) => {
      handlePopupMessage(port, msg);
    });
    
    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
    });
    
    // Send current media for active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const media = mediaByTab.get(tabs[0].id) || [];
        port.postMessage({ action: 'mediaList', media });
      }
    });
  }
});

function handlePopupMessage(port: chrome.runtime.Port, msg: any): void {
  switch (msg.action) {
    case 'getMedia':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const media = mediaByTab.get(tabs[0].id) || [];
          port.postMessage({ action: 'mediaList', media });
        }
      });
      break;
      
    case 'download':
      startDownload(msg.media, msg.filename);
      break;
      
    case 'setQuality':
      // User selected specific quality
      selectedQualities.set(tabs[0].id, msg.quality);
      break;
  }
}

// Notify all popups when new media is detected
function notifyPopups(tabId: number): void {
  const media = mediaByTab.get(tabId);
  if (media) {
    popupPorts.forEach(port => {
      port.postMessage({ action: 'mediaList', media });
    });
  }
}
```

---

## Popup Side (popup.ts)

```typescript
// popup.ts - runs in popup context

let port = chrome.runtime.connect({ name: 'popup' });

port.onMessage.addListener((msg) => {
  if (msg.action === 'mediaList') {
    renderMediaList(msg.media);
  }
});

function renderMediaList(mediaList: any[]): void {
  const container = document.getElementById('media-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  mediaList.forEach(media => {
    const item = createMediaItem(media);
    container.appendChild(item);
  });
}

document.getElementById('refresh-btn')?.addEventListener('click', () => {
  port.postMessage({ action: 'getMedia' });
});
```

---

## Tests

- [ ] Popup opens and connects to background
- [ ] Media list appears in popup
- [ ] Download button triggers download request
- [ ] Popup receives updates when new media detected
