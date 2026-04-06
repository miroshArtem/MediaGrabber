# T-05 — Set Up Permissions

**Epic**: EP-02 (Browser Extension Core)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:55

---

## Goal

Configure proper permissions in manifest.json for all required browser APIs.

---

## Subtasks

- [ ] Review required permissions list
- [ ] Add `webRequest` permission for network monitoring
- [ ] Add `storage` permission for settings
- [ ] Add `downloads` permission for browser downloads (if used)
- [ ] Add `nativeMessaging` permission for CoApp communication
- [ ] Add `tabs` permission for tab queries
- [ ] Add host permissions for all URLs
- [ ] Test each permission works correctly

---

## Permissions Matrix

| Permission | Purpose | Required |
|------------|---------|----------|
| `webRequest` | Monitor network requests | Yes (detection) |
| `<all_urls>` (host_permissions) | Access all websites | Yes |
| `storage` | Save settings | Yes |
| `nativeMessaging` | Communicate with CoApp | Yes |
| `tabs` | Query active tab | Yes |
| `downloads` | Browser download API | Optional (may use CoApp instead) |

---

## Manifest Permissions Configuration

```json
{
  "permissions": [
    "storage",
    "tabs",
    "nativeMessaging",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

---

## Important Notes

### webRequestBlocking

In Manifest V3, `webRequestBlocking` permission is **deprecated** for blocking requests. Use `declarativeNetRequest` instead if you need to block/modify.

For **observation only** (which is what we need for detection), `webRequest` works without `blocking`:

```typescript
// No "blocking" extraInfoSpec needed for observation
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Just observe, don't block
  },
  { urls: ['<all_urls>'] }
);
```

### declarativeNetRequest

If you need to **block** requests (e.g., for ad blocking features):

```json
{
  "permissions": ["declarativeNetRequest"],
  "declarative_net_request": {
    "rule_resources": ["rules.json"]
  }
}
```

For MediaGrabber, we primarily need observation, not blocking.

---

## Tests

- [ ] Extension loads without permission errors
- [ ] Network requests are logged in background
- [ ] Native messaging connects successfully
- [ ] Storage saves and retrieves data
- [ ] Tab query returns correct tab
