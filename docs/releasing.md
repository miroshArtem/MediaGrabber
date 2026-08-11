# Releasing MediaGrabber

## Distribution model

MediaGrabber is distributed through GitHub Releases. The extension is not published in the Chrome Web Store.

The release contains:

- `MediaGrabber-extension.zip` for manual sideloading
- `MediaGrabber-Setup-win-x64.exe` for the native companion
- FFmpeg, ffprobe, and yt-dlp runtime binaries
- `SHA256SUMS.txt`
- `THIRD_PARTY_NOTICES.txt`

## User installation

1. Download the extension ZIP and Windows setup from the release page.
2. Run the setup executable. It installs CoApp and registers native messaging.
3. Extract the extension ZIP to a permanent folder.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the extracted extension folder containing `manifest.json`.
7. Reload the extension after the setup finishes.

The public key in `extension/manifest.json` fixes the extension ID as `igephdkobpgbfgdjmehckbhffbimgkii`. The installer uses this ID automatically, so users do not need to copy or enter it.

Chrome requires Developer mode and Load unpacked for extensions distributed outside the Chrome Web Store. This manual browser step cannot be replaced by a GitHub installer on normal Windows/macOS installations.

## Release workflow

Push a tag such as `v1.1.0`. GitHub Actions builds the Windows x64 release without repository secrets:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow derives the extension ID from the public manifest key and embeds it in the native host configuration.

## Runtime assets

The installer downloads FFmpeg, ffprobe, and yt-dlp from the matching GitHub Release. Each binary is pinned by URL and SHA-256 checksum in the embedded release configuration.

FFmpeg is distributed as a separate GPLv3 runtime program. Keep `THIRD_PARTY_NOTICES.txt` with every binary release.
