# T-04 — Stream Merging

**Epic**: EP-07 (FFmpeg Integration)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 22:35

---

## Goal

Implement merging of separate video and audio streams into a single file.

---

## Subtasks

- [ ] Merge video file + audio file
- [ ] Handle codec compatibility
- [ ] Re-encode if necessary
- [ ] Use -map for precise stream selection

---

## Merge Command

```bash
# Merge video + audio (same container, no re-encode)
ffmpeg -i video.mp4 -i audio.m4a -c copy -map 0:v:0 -map 1:a:0 output.mp4

# Re-encode if codecs incompatible
ffmpeg -i video.mp4 -i audio.m4a -c:v libx264 -c:a aac -map 0:v:0 -map 1:a:0 output.mp4
```

---

## Implementation

```typescript
// coapp/src/converter.ts

async mergeStreams(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  options: {
    reencode?: boolean;
    videoCodec?: string;
    audioCodec?: string;
    onProgress?: (progress: ProgressInfo) => void;
  } = {}
): Promise<string> {
  const args: string[] = [];
  
  // Inputs
  args.push('-i', videoPath);
  args.push('-i', audioPath);
  
  // Codec settings
  if (options.reencode) {
    args.push('-c:v', options.videoCodec || 'libx264');
    args.push('-c:a', options.audioCodec || 'aac');
  } else {
    args.push('-c', 'copy');
  }
  
  // Stream selection
  args.push('-map', '0:v:0');
  args.push('-map', '1:a:0');
  
  args.push('-y');
  args.push(outputPath);
  
  await this.ffmpeg.convert(args, {
    onProgress: options.onProgress
  });
  
  return outputPath;
}
```

---

## ffprobe for Stream Info

```typescript
async probe(filePath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const ffprobePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe');
    
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];
    
    const proc = spawn(ffprobePath, args);
    let stdout = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(stdout));
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });
  });
}
```

---

## Tests

- [ ] Video+audio are merged
- [ ] Output is playable
- [ ] Stream selection is correct
- [ ] Re-encode works when needed
