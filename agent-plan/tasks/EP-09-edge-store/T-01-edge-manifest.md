# T-01 — Edge Manifest Configuration

**Epic**: EP-09 (Microsoft Edge Add-ons Publishing)
**Priority**: P2
**Status**: DN (done)
**Last updated**: 2026-04-06 22:45

---

## Goal

Configure extension for Microsoft Edge compatibility.

---

## Subtasks

- [ ] Add Edge extension ID to CoApp manifest
- [ ] Configure allowed_origins for Edge
- [ ] Test on Edge Chromium
- [ ] Handle Edge-specific quirks

---

## Edge Native Messaging Manifest

```json
{
  "name": "com.mediagrabber.coapp",
  "description": "MediaGrabber companion application",
  "path": "C:\\Program Files\\MediaGrabber\\coapp.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://{chrome_extension_id}/",
    "chrome-extension://{edge_extension_id}/"
  ]
}
```

---

## Key Differences from Chrome

| Aspect | Chrome | Edge |
|--------|--------|------|
| Extension ID | Different hash | Different hash |
| Store | Chrome Web Store | Microsoft Add-ons |
| Policies | Chrome policies | Edge policies |
| Native messaging | Same protocol | Same protocol |

---

## Testing on Edge

1. Enable Developer Mode in Edge (`edge://extensions`)
2. Load unpacked extension
3. Install CoApp
4. Test media detection and download

---

## Tests

- [ ] Extension loads on Edge
- [ ] CoApp connects on Edge
- [ ] Media detection works
- [ ] Downloads work
