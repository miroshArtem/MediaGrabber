# T-04 — Extension Submission

**Epic**: EP-08 (Chrome Web Store Publishing)
**Priority**: P2
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:40

---

## Goal

Package and submit the extension to Chrome Web Store.

---

## Subtasks

- [ ] Package extension as ZIP
- [ ] Upload to Chrome Web Store Developer Dashboard
- [ ] Submit for review
- [ ] Address review feedback if needed
- [ ] Publish when approved
- [ ] Set up update mechanism

---

## Packaging

```bash
# Create production build
cd extension
npm run build
npm run package

# Creates MediaGrabber.zip in project root
```

---

## Submission Steps

1. **Developer Dashboard**
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New Item"
   - Upload ZIP file

2. **Store Listing**
   - Fill in all listing details
   - Upload assets

3. **Pricing & Distribution**
   - Set as Free or paid
   - Select regions

4. **Submit for Review**
   - Click "Submit for Review"
   - Wait for automated and manual review

5. **After Approval**
   - Extension goes live automatically
   - Or set specific publish date

---

## Update Mechanism

Chrome auto-updates extensions. For CoApp:

```json
// In manifest.json, CoApp should be auto-updated via the extension's update mechanism
```

For CoApp updates, include update check in extension:
```javascript
// Check for CoApp update on startup
chrome.runtime.onStartup.addListener(async () => {
  await checkCoAppUpdate();
});
```

---

## Tests

- [ ] ZIP packages correctly
- [ ] Upload succeeds
- [ ] Review passes
- [ ] Extension is published
- [ ] Updates work correctly
