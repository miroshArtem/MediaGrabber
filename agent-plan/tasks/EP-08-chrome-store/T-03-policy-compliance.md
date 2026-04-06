# T-03 — Policy Compliance

**Epic**: EP-08 (Chrome Web Store Publishing)
**Priority**: P2
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:40

---

## Goal

Ensure extension complies with Chrome Web Store policies.

---

## Subtasks

- [ ] Review Chrome Web Store Program Policies
- [ ] Ensure no deceptive behavior
- [ ] Properly declare all permissions
- [ ] Implement proper data handling
- [ ] Add uninstall flow if needed

---

## Key Policies to Follow

### 1. Deceptive Behavior
- Clearly explain what the extension does
- Don't misrepresent functionality
- Don't promise to download from sites that block it

### 2. Permissions
All permissions must be:
- Necessary for functionality
- Declared in manifest
- Explained to user during install

### 3. Content Restrictions
- No copyrighted content downloading facilitation
- No malware or deceptive functionality
- No data collection without consent

### 4. Privacy
- Provide clear privacy policy
- Collect only necessary data
- Don't transmit user data without consent

---

## Permissions Justification

| Permission | Justification |
|------------|---------------|
| `<all_urls>` | Required to detect videos on any webpage |
| `webRequest` | Required to intercept media URLs for detection |
| `nativeMessaging` | Required to communicate with CoApp for downloading |
| `storage` | Used to save user settings |
| `tabs` | Required to identify active tab for media detection |

---

## Compliance Checklist

- [ ] Extension purpose is clearly stated
- [ ] All permissions have valid justification
- [ ] Privacy policy is posted
- [ ] No misleading descriptions
- [ ] No copyrighted content promotion
- [ ] User can uninstall easily
- [ ] Extension works as described

---

## Tests

- [ ] Extension passes Chrome's automated review
- [ ] No policy violations reported
- [ ] Extension is approved for publishing
