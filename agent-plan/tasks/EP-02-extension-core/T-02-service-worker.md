# T-02 — Implement Service Worker

**Epic**: EP-02 (Browser Extension Core)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:40

---

## Goal

Implement the service worker (background script) that coordinates between content scripts, popup, and CoApp.

---

## Subtasks

- [ ] Create `background.ts` skeleton
- [ ] Implement `chrome.runtime.onMessage` listener
- [ ] Implement media storage (Map by tabId)
- [ ] Implement `connectNative` for CoApp communication
- [ ] Handle service worker lifecycle (install, activate)
- [ ] Implement keep-alive mechanism for native messaging port
- [ ] Add error handling and reconnection logic

---

## Service Worker Responsibilities

1. **Receive messages** from content scripts (media detected)
2. **Store media info** per tab
3. **Send messages** to popup (update UI)
4. **Coordinate downloads** via CoApp
5. **Maintain native messaging port** (keep alive)

---

## Basic Implementation

```typescript
// background.ts

// Media storage by tabId
const mediaByTab = new Map<number, DetectedMedia[]>();

// Native messaging port
let coappPort: chrome.runtime.Port | null = null;

// Connect to CoApp
function connectCoApp(): void {
  try {
    coappPort = chrome.runtime.connectNative('com.mediagrabber.coapp');
    
    coappPort.onMessage.addListener((msg) => {
      // Handle messages from CoApp
      handleCoAppMessage(msg);
    });
    
    coappPort.onDisconnect.addListener(() => {
      console.log('CoApp disconnected');
      coappPort = null;
      // Reconnect after delay
      setTimeout(connectCoApp, 5000);
    });
  } catch (e) {
    console.error('Failed to connect to CoApp:', e);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'mediaDetected':
      handleMediaDetected(sender.tab!.id, msg.media);
      break;
    case 'getMedia':
      sendResponse(mediaByTab.get(msg.tabId) || []);
      break;
    case 'download':
      startDownload(msg.media, msg.filename);
      sendResponse({ success: true });
      break;
  }
  return true; // Keep channel open for async response
});

function handleMediaDetected(tabId: number, media: DetectedMedia[]): void {
  mediaByTab.set(tabId, media);
  // Update badge to show count
  chrome.action.setBadgeText({ tabId, text: String(media.length) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' });
}

// Start download via CoApp
async function startDownload(media: DetectedMedia, filename: string): Promise<void> {
  if (!coappPort) {
    connectCoApp();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (coappPort) {
    coappPort.postMessage({
      type: 'weh#rpc',
      _request: Date.now(),
      _method: 'convert',
      _args: [['-i', media.url, '-c', 'copy', filename], { progressTime: 1000 }]
    });
  }
}

// Service worker lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('MediaGrabber installed');
  connectCoApp();
});
```

---

## Service Worker Lifecycle (Important!)

Chrome terminates service workers after ~30 seconds of inactivity. To keep alive:

1. **Use `connectNative` port** — Keeps service worker alive (Chrome 110+)
2. **Send periodic pings** to CoApp
3. **Handle `onDisconnect`** — Reconnect when CoApp restarts

---

## Tests

- [ ] Service worker starts without errors
- [ ] `chrome.runtime.onMessage` receives messages from content script
- [ ] Native messaging port connects successfully
- [ ] Service worker stays alive when connected to CoApp
- [ ] Service worker reconnects after CoApp restart
