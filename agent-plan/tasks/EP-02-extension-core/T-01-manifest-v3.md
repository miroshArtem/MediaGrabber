# T-01 — Create Manifest V3

**Epic**: EP-02 (Browser Extension Core)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:35

---

## Goal

Create the Manifest V3 configuration file for Chrome/Edge extension.

---

## Subtasks

- [ ] Create `extension/manifest.json` with Manifest V3 format
- [ ] Configure `name`, `version`, `description`
- [ ] Set `manifest_version` to 3
- [ ] Add `permissions` array (storage, downloads, nativeMessaging)
- [ ] Add `host_permissions` for all URLs
- [ ] Configure `background.service_worker`
- [ ] Configure `content_scripts` with proper matches
- [ ] Add `action` for popup
- [ ] Add `icons` for toolbar

---

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "MediaGrabber",
  "version": "1.0.0",
  "description": "Download online videos with quality selection",
  
  "permissions": [
    "storage",
    "downloads",
    "nativeMessaging",
    "tabs"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_title": "MediaGrabber"
  },
  
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

## Key Differences from Manifest V2

| Aspect | MV2 | MV3 |
|--------|-----|-----|
| Background | `"scripts": ["bg.js"]` | `"service_worker": "bg.js"` |
| Permissions | All in `"permissions"` | Host permissions moved to `"host_permissions"` |
| Blocking web requests | `webRequestBlocking` | `declarativeNetRequest` |
| Popup | `"browser_action"` | `"action"` |

---

## Tests

- [ ] manifest.json is valid JSON
- [ ] Extension loads in Chrome without errors (`chrome://extensions`)
- [ ] Service worker appears in background page inspection
- [ ] Content script injects on page load
