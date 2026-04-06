# T-03 — Progress Callbacks

**Epic**: EP-06 (Extension ↔ CoApp Communication)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:30

---

## Goal

Implement progress callback mechanism for long-running operations like downloads.

---

## Subtasks

- [ ] Define notification message format
- [ ] Implement `onNotify` in client
- [ ] Implement `convertOutput` notification in CoApp
- [ ] Parse ffmpeg progress output
- [ ] Calculate percentage and speed

---

## Progress Notification Format

```json
{
  "type": "weh#rpc",
  "_notify": "convertOutput",
  "_data": [1000, 45.2, { "out_time_ms": "45200000", "speed": "1.85x" }]
}
```

**Data fields:**
- `_data[0]`: Progress time (ms)
- `_data[1]`: Current time in seconds
- `_data[2]`: FFmpeg progress info object

---

## Client-Side Progress Handling

```typescript
// extension/src/lib/native-client.ts

interface ConvertProgress {
  timeMs: number;
  currentSeconds: number;
  outTimeMs: string;
  frame: number;
  fps: number;
  bitrate: string;
  totalSize: number;
  speed: string;
}

coapp.onNotify('convertOutput', (progressTime: number, currentSeconds: number, info: ConvertProgress) => {
  // Calculate percentage if duration is known
  const percent = duration ? (currentSeconds / duration) * 100 : 0;
  
  // Parse speed (e.g., "1.85x")
  const speedMatch = info.speed?.match(/([\d.]+)x/);
  const speedMultiplier = speedMatch ? parseFloat(speedMatch[1]) : 0;
  
  // Estimate remaining time
  const remainingSeconds = duration ? duration - currentSeconds : Infinity;
  
  sendProgressToPopup({
    percent,
    speed: speedMultiplier * estimatedBitrate,
    timeRemaining: remainingSeconds / speedMultiplier
  });
});
```

---

## CoApp-Side Progress Parsing

```typescript
// coapp/src/converter.ts

function parseProgress(data: string): ConvertProgress {
  const lines = data.split('\n');
  const result: any = {};
  
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }
  
  return {
    outTimeMs: result.out_time_ms || '0',
    frame: parseInt(result.frame || '0'),
    fps: parseFloat(result.fps || '0'),
    bitrate: result.bitrate || '',
    totalSize: parseInt(result.total_size || '0'),
    speed: result.speed || ''
  };
}
```

---

## Tests

- [ ] Progress notifications arrive during conversion
- [ ] Percentage is calculated correctly
- [ ] Speed is parsed correctly
- [ ] UI updates in real-time
