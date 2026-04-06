# T-03 — DASH Download

**Epic**: EP-07 (FFmpeg Integration)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:35

---

## Goal

Implement DASH stream downloading via ffmpeg.

---

## Subtasks

- [ ] Download DASH MPD manifest
- [ ] Handle separate video/audio tracks
- [ ] Merge video+audio after download
- [ ] Handle MPD with multiple periods
- [ ] Test with real DASH streams

---

## DASH Download Command

```bash
# Basic DASH download
ffmpeg -i "http://example.com/manifest.mpd" -c copy output.mp4

# With authentication
ffmpeg -i "http://example.com/manifest.mpd" -headers "Authorization: Bearer $TOKEN" -c copy output.mp4
```

---

## Implementation

```typescript
// coapp/src/converter.ts

async downloadDASH(
  url: string,
  outputPath: string,
  options: {
    headers?: { [key: string]: string };
    onProgress?: (progress: ProgressInfo) => void;
  } = {}
): Promise<string> {
  const args: string[] = [];
  
  if (options.headers) {
    const headerStr = Object.entries(options.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    args.push('-headers', headerStr);
  }
  
  args.push('-i', url);
  args.push('-c', 'copy');
  args.push('-y');
  args.push(outputPath);
  
  await this.ffmpeg.convert(args, {
    onProgress: options.onProgress
  });
  
  return outputPath;
}
```

---

## Video+Audio Merge

When DASH provides separate video and audio, ffmpeg can download both and merge:

```bash
# Download and merge video + audio
ffmpeg -i "video.mpd" -i "audio.mpd" \
  -c:v copy -c:a copy \
  -map 0:v:0 -map 1:a:0 \
  output.mp4
```

---

## Tests

- [ ] DASH manifest is processed
- [ ] Video+audio are merged correctly
- [ ] Progress is reported
- [ ] Output file is valid MP4
