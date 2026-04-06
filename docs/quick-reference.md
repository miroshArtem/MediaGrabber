# Video DownloadHelper — Quick Reference

## Extension IDs

| Browser | Extension ID |
|---------|-------------|
| Firefox | `video-downloadhelper@downloadhelper.net` |
| Chrome | `lmjnegcaeklhafolokijcfjliaokphfk` |
| Edge | `jmkaglaafmhbcpleggkmaliipiilhldn` |

## CoApp Details

| Property | Value |
|----------|-------|
| **Native Messaging Name** | `net.downloadhelper.coapp` |
| **Repository** | https://github.com/aclap-dev/vdhcoapp |
| **License** | GPL-2.0 |
| **Language** | Node.js |

## Key RPC Methods

| Method | Purpose |
|--------|---------|
| `ping` | Test connectivity |
| `info` | Get version, ffmpeg path |
| `convert` | Run ffmpeg conversion |
| `probe` | Get media info |
| `downloads.download` | Start download |
| `fs.write` | Write file to disk |
| `filepicker` | Open native file dialog |

## File Locations

### Windows CoApp Default
```
C:\Users\<user>\AppData\Local\DownloadHelper CoApp\
```

### Windows Downloads Default
```
C:\Users\<user>\dwhelper\
```

### Linux CoApp
```
~/.vdhcoapp/
```

### macOS CoApp
```
/Applications/DownloadHelper CoApp/
```

## Supported Stream Types

| Type | Format | Detection | Download |
|------|--------|-----------|----------|
| **HLS** | .m3u8 | ✓ | FFmpeg |
| **DASH** | .mpd | ✓ | FFmpeg |
| **MP4** | .mp4 | ✓ | Browser or FFmpeg |
| **WebM** | .webm | ✓ | Browser or FFmpeg |
| **YouTube** | HLS/DASH | ✓ (FF/Edge) | FFmpeg |
| **DRM** | Widevine | ✗ | Not possible |

## Common FFmpeg Commands

```bash
# Download HLS stream
ffmpeg -i "http://example.com/stream.m3u8" -c copy output.mp4

# Download DASH stream
ffmpeg -i "http://example.com/manifest.mpd" -c copy output.mp4

# Merge video + audio
ffmpeg -i video.mp4 -i audio.m4a -c copy -map 0:v -map 1:a output.mp4

# Re-encode to MP4
ffmpeg -i input.avi -c:v libx264 -c:a aac output.mp4

# Extract audio only
ffmpeg -i input.mp4 -vn -c:a copy output.aac
```

## Troubleshooting

### "CoApp not recognized"

1. Close browser
2. Reinstall CoApp
3. Restart browser
4. Check: `about:addons` → VDH → Preferences → Companion app installed

### "No video detected"

1. Check extension has `<all_urls>` permission
2. Try refreshing page
3. Some sites block detection
4. Use Network panel (F12) to find media URLs manually

### "Downloaded file has no audio"

- Video and audio may be separate streams
- VDH should merge automatically via FFmpeg
- Check if CoApp is installed and licensed

### "YouTube not working in Chrome"

- This is **expected** — Google blocks it in Chrome
- Use Firefox or Edge instead

## Links

- **Main Site**: https://www.downloadhelper.net/
- **Firefox Add-on**: https://addons.mozilla.org/firefox/addon/video-downloadhelper
- **Chrome Extension**: https://chrome.google.com/webstore/detail/video-downloadhelper
- **GitHub (CoApp)**: https://github.com/aclap-dev/vdhcoapp
- **GitHub Discussions**: https://github.com/aclap-dev/video-downloadhelper/discussions
- **License Purchase**: https://www.downloadhelper.net/premium
