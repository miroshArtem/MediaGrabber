# T-05 — Progress Parsing

**Epic**: EP-07 (FFmpeg Integration)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:35

---

## Goal

Implement robust progress parsing from ffmpeg's -progress output.

---

## Subtasks

- [ ] Parse -progress pipe:1 format
- [ ] Extract time, frame, fps, speed
- [ ] Calculate percentage from duration
- [ ] Handle incomplete lines
- [ ] Test with various streams

---

## FFmpeg Progress Output Format

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

---

## Parser Implementation

```typescript
// coapp/src/converter.ts

interface ParsedProgress {
  outTimeMs: number;      // milliseconds
  outTime: string;        // HH:MM:SS.ms
  frame: number;          // frame count
  fps: number;            // frames per second
  bitrate: string;        // e.g., "856.6kbits/s"
  totalSize: number;      // bytes
  speed: string;          // e.g., "1.85x"
}

function parseProgress(output: string): ParsedProgress | null {
  const lines = output.split('\n');
  const data: any = {};
  
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    
    const key = line.substring(0, eqIdx).trim();
    const value = line.substring(eqIdx + 1).trim();
    
    if (!key || !value) continue;
    
    data[key] = value;
  }
  
  if (Object.keys(data).length === 0) {
    return null;
  }
  
  return {
    outTimeMs: parseInt(data.out_time_ms || '0'),
    outTime: data.out_time || '00:00:00.000000',
    frame: parseInt(data.frame || '0'),
    fps: parseFloat(data.fps || '0'),
    bitrate: data.bitrate || '',
    totalSize: parseInt(data.total_size || '0'),
    speed: data.speed || ''
  };
}

// Calculate percentage from current time and duration
function calculatePercent(progress: ParsedProgress, durationSeconds: number): number {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0;
  }
  
  const currentSeconds = progress.outTimeMs / 1000;
  return Math.min(100, (currentSeconds / durationSeconds) * 100);
}
```

---

## Continuous Parsing

```typescript
let progressBuffer = '';

this.currentProcess.stdout?.on('data', (chunk: Buffer) => {
  progressBuffer += chunk.toString('utf8');
  
  // Process complete lines
  const lines = progressBuffer.split('\n');
  progressBuffer = lines.pop() || ''; // Keep incomplete line
  
  for (const line of lines) {
    const progress = parseProgress(line);
    if (progress) {
      this.onProgress?.(progress);
    }
  }
});
```

---

## Tests

- [ ] Progress lines are parsed correctly
- [ ] Percentage calculation is accurate
- [ ] Buffer handling works for chunked data
- [ ] Handle missing fields gracefully
