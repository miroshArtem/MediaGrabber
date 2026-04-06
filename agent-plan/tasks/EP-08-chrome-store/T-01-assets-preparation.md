# T-01 — Store Assets Preparation

**Epic**: EP-08 (Chrome Web Store Publishing)
**Priority**: P2
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:40

---

## Goal

Prepare all required assets for Chrome Web Store listing.

---

## Subtasks

- [ ] Create store icon (128x128, 64x64, 48x48, 32x32, 16x16)
- [ ] Create screenshots (1280x800 or 640x400)
- [ ] Create store banner/hero image
- [ ] Write app description (short and long)
- [ ] Create privacy policy document
- [ ] Prepare promo images

---

## Required Assets

| Asset | Size | Notes |
|-------|------|-------|
| Store Icon | 128x128 PNG | Main store listing icon |
| Small Tile | 64x64 PNG | In store listings |
| Screenshots | 1280x800 or 640x400 PNG/JPG | Min 2, Max 8 |
| Marquee Banner | 1400x560 PNG | Optional promotional |
| Privacy Policy | HTML/TXT | Required for submission |

---

## Description Templates

**Short Description (80 characters)**:
```
Download online videos with quality selection
```

**Long Description (highlights)**:
```
MediaGrabber - Video Download Extension

Easily download online videos directly to your computer with quality selection.

Features:
• Detect videos on any webpage
• Choose from available quality options (1080p, 720p, 480p, etc.)
• Download HLS and DASH adaptive streams
• Automatic video+audio merging
• Works with most video hosting sites
• Fast downloads with progress tracking

How to use:
1. Install the extension
2. Visit a webpage with a video
3. Click the MediaGrabber icon
4. Select your preferred quality
5. Click Download

Note: Some websites may restrict video downloading.
```

---

## Privacy Policy Template

```markdown
Privacy Policy

MediaGrabber ("we", "our") operates this Chrome extension.

This page informs you of our policies regarding the collection, use, and 
disclosure of personal data when you use our extension.

Information We Collect:
- We do NOT collect any personal information
- We do NOT track your browsing activity
- We do NOT share any data with third parties

Local Processing:
- All video detection and downloading happens locally on your device
- Video URLs are processed in memory only during the download session
- No browsing history or video URLs are stored

Native Messaging:
- Our companion app (CoApp) runs locally on your computer
- It is used only for video downloading functionality
- No data is transmitted to external servers

Changes to This Policy:
We may update this policy from time to time. We will notify users of 
any changes by posting the new policy on this page.

Contact:
For questions about this privacy policy, please contact us.
```

---

## Tests

- [ ] All required icons are present and correctly sized
- [ ] Screenshots meet minimum requirements
- [ ] Description is within character limits
- [ ] Privacy policy is complete
