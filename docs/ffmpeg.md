# FFmpeg Integration in Video DownloadHelper

## Overview

**FFmpeg** is the core engine of the Video DownloadHelper Companion Application (CoApp). It's used for:

1. **Downloading** HLS/DASH streams (converting stream to file)
2. **Merging** separate video and audio tracks
3. **Converting** between formats
4. **Probing** media information

---

## Bundled FFmpeg

CoApp ships with **modified FFmpeg builds** for each platform:

| Platform | Binary | Location |
|----------|--------|----------|
| Windows | `ffmpeg.exe`, `ffprobe.exe` | `C:\DownloadHelper CoApp\` |
| macOS | `ffmpeg`, `ffprobe` | `/Applications/DownloadHelper CoApp/` |
| Linux | `ffmpeg`, `ffprobe` | `~/.vdhcoapp/` |

### Modified Builds

Paul (current maintainer) has submitted patches to FFmpeg for:
- Bug fixes relevant to streaming
- Improved handling of partial streams
- Better progress reporting

These are **not** stock FFmpeg builds — they're compiled with VDH-specific modifications.

---

## Executable Discovery

CoApp searches for FFmpeg in this order:

```javascript
function findExecutableFullPath(programName, extraPath = "") {
  programName = ensureProgramExt(programName);
  
  // 1. Check bundled location first
  // 2. Check PATH environment variable
  // 3. Fall back to system default
  
  const envPath = (process.env.PATH || '');
  const pathArr = envPath.split(path.delimiter);
  
  if (extraPath) {
    pathArr.unshift(extraPath);  // Prioritize extra path
  }
  
  return pathArr
    .map((x) => path.join(x, programName))
    .find((x) => fileExistsSync(x));
}

// Usage
const ffmpeg = findExecutableFullPath("ffmpeg", coappDir);
const ffprobe = findExecutableFullPath("ffprobe", coappDir);
```

---

## FFmpeg Operations

### 1. HLS Stream Download

**Input**: M3U8 playlist URL (e.g., `https://example.com/video.m3u8`)

**Command**:
```bash
ffmpeg -i "https://example.com/video.m3u8" -c copy -hide_banner output.mp4
```

**Explanation**:
- `-i "url"` — Input stream URL
- `-c copy` — Copy streams without re-encoding (fast, no quality loss)
- `-hide_banner` — Suppress version/URL printing

### 2. DASH Stream Download

**Input**: MPD manifest URL (e.g., `https://example.com/video.mpd`)

**Command**:
```bash
ffmpeg -i "https://example.com/video.mpd" -c copy -hide_banner output.mp4
```

### 3. Merge Video + Audio Tracks

When video and audio are separate files:
```bash
ffmpeg -i video.mp4 -i audio.m4a -c copy -map 0:v:0 -map 1:a:0 output.mp4
```

### 4. Re-encode with Custom Settings

For maximum compatibility or smaller size:
```bash
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -preset medium -crf 23 output.mp4
```

### 5. Extract Single Track

**Video only**:
```bash
ffmpeg -i input.mp4 -c:v copy -an output.mp4
```

**Audio only**:
```bash
ffmpeg -i input.mp4 -c:a copy -vn output.aac
```

---

## Progress Tracking

### The `-progress pipe:1` Flag

VDH uses FFmpeg's machine-readable progress output:

```bash
ffmpeg -i input -progress pipe:1 -hide_banner output.mp4
```

**Output format** (key=value per line, frame every ~1s):
```
progress=continue
out_time_ms=45200000
out_time=00:00:45.200000
frame=1080
fps=30.00
stream_0_0_q=28.0
bitrate= 856.6kbits/s
total_size=4875234
speed= 1.85x
```

### Progress Parsing in CoApp

```javascript
function parseProgress(lines) {
  const info = {};
  lines.toString("utf-8").split("\n").forEach(line => {
    const [key, value] = line.split("=");
    if (key && value) {
      info[key.trim()] = value.trim();
    }
  });
  return info;
}

child.stdout.on("data", (lines) => {
  const info = parseProgress(lines);
  
  // Report via RPC callback every N ms
  if (shouldReport(now, lastReport, 1000)) {
    rpc.call("convertOutput", 
      options.progressTime,      // callback interval
      info.out_time_ms / 1000,   // current time in seconds
      info                       // full info object
    );
  }
});
```

---

## ffprobe — Media Information

### Getting Stream Info

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

**Output**:
```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_type": "video",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      "duration": "180.500"
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_type": "audio",
      "channels": 2,
      "sample_rate": "48000",
      "duration": "180.500"
    }
  ],
  "format": {
    "filename": "input.mp4",
    "size": "52428800",
    "format_name": "mov,mp4,m4a"
  }
}
```

### RPC Interface for Probe

```javascript
"probe": (input, json = false, headers = []) => {
  // If json=true, return parsed JSON
  // If json=false, return human-readable text
  const args = [
    "-v", "quiet",
    "-print_format", json ? "json" : "default",
    "-show_format", "-show_streams",
    input
  ];
  
  const result = spawnSync(ffprobe, args);
  return result;
}
```

---

## Error Handling

### Truncated/Partial Files

VDH CoApp has special handling for `ECONNRESET` errors:

```javascript
downloadItem.on('error', (error) => {
  if (error.code == 'ECONNRESET') {
    // Server closed connection early
    // FFmpeg can often still process the partial data
    downloadEntry.state = "complete";
  }
});
```

### Invalid Stream URLs

FFmpeg will exit with non-zero code:
```
ffmpeg exited with code 1: Invalid data found
```

This is caught and returned as RPC error.

### Missing Codecs

If codec is not supported:
```
ffmpeg exited with code 1: decoder (codec id 27) not found
```

---

## Watermarking

VDH can overlay watermarks using FFmpeg filters:

```bash
ffmpeg -i input.mp4 -i watermark.png -filter_complex "overlay=10:10" output.mp4
```

For unpaid CoApp users, VDH adds a **QR code watermark** via this mechanism.

---

## Linux "noffmpeg" Builds

For users who already have FFmpeg installed, VDH offers "noffmpeg" builds:

```bash
# Install system ffmpeg
sudo apt install ffmpeg  # Ubuntu/Debian
sudo dnf install ffmpeg  # Fedora

# Install VDH CoApp without bundled ffmpeg
curl -sSLf https://github.com/aclap-dev/vdhcoapp/releases/latest/download/install.sh | bash -s -- --no-ffmpeg
```

These builds use the system FFmpeg instead of the bundled one.

---

## Performance Considerations

### Why `-c copy`?

Using `copy` avoids re-encoding:
- **Faster**: No transcoding, just muxing
- **Lossless**: Original quality preserved
- **Limited**: Can't change resolution, bitrate, etc.

### When to Re-encode?

Use `-c:v libx264` instead of `-c copy` when:
- Target device doesn't support codec
- Need to reduce file size
- Want to change resolution/bitrate

---

## Relevant Source Files

- `vdhcoapp/app/src/converter.js` — FFmpeg wrapper (main integration)
- `vdhcoapp/app/src/downloads.js` — Download handling
- `vdhcoapp/app/src/request.js` — HTTP requests for stream fetching
