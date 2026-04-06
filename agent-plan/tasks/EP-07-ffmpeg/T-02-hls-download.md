# T-02 — HLS Download

**Epic**: EP-07 (FFmpeg Integration)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 22:35

---

## Goal

Implement HLS stream downloading via ffmpeg.

---

## Subtasks

- [ ] Download simple HLS stream
- [ ] Handle variant streams (select specific quality)
- [ ] Handle encrypted streams (AES-128)
- [ ] Handle cookies/headers for authenticated streams
- [ ] Test with real HLS streams

---

## HLS Download Command

```bash
# Basic HLS download
ffmpeg -i "http://example.com/stream.m3u8" -c copy output.mp4

# With specific variant
ffmpeg -i "http://example.com/720p.m3u8" -c copy output.mp4

# With custom headers
ffmpeg -i "http://example.com/stream.m3u8" -headers "Cookie: session=abc" -c copy output.mp4
```

---

## Implementation

```typescript
// coapp/src/converter.ts

async downloadHLS(
  url: string,
  outputPath: string,
  options: {
    headers?: { [key: string]: string };
    onProgress?: (progress: ProgressInfo) => void;
    duration?: number;
  } = {}
): Promise<string> {
  const args: string[] = [];
  
  // Add headers if provided
  if (options.headers) {
    const headerStr = Object.entries(options.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    args.push('-headers', headerStr);
  }
  
  // Input
  args.push('-i', url);
  
  // Output options
  args.push('-c', 'copy');  // Copy without re-encoding
  args.push('-y');         // Overwrite output
  
  // Output file
  args.push(outputPath);
  
  await this.ffmpeg.convert(args, {
    onProgress: options.onProgress
  });
  
  return outputPath;
}
```

---

## Handling Variant Playlists

When master playlist contains multiple qualities, user selects one:

```typescript
// Parse master playlist to get variant URLs
async parseMasterPlaylist(url: string): Promise<Variant[]> {
  // Use m3u8-parser or fetch and parse manually
  const response = await fetch(url);
  const text = await response.text();
  
  const variants: Variant[] = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('EXT-X-STREAM-INF')) {
      const bandwidth = this.extractBandwidth(lines[i]);
      const resolution = this.extractResolution(lines[i]);
      const playlistUrl = this.resolveUrl(lines[i + 1].trim(), url);
      
      variants.push({ bandwidth, resolution, url: playlistUrl });
      i++;
    }
  }
  
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}
```

---

## Tests

- [ ] Simple HLS stream downloads
- [ ] Variant stream selection works
- [ ] Progress is reported
- [ ] Output file is valid MP4
