# T-04 — Quality Detection

**Epic**: EP-03 (Video Detection & Parsing)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:15

---

## Goal

Implement quality detection and presentation to user for quality selection.

---

## Subtasks

- [ ] Create quality info structure (bandwidth, resolution, codec)
- [ ] Implement quality sorting (best to worst)
- [ ] Create human-readable quality labels (1080p, 720p, etc.)
- [ ] Format bandwidth as Mbps/Kbps
- [ ] Filter out duplicate quality levels
- [ ] Handle missing metadata gracefully

---

## Quality Info Structure

```typescript
interface QualityInfo {
  label: string;        // "1080p", "720p", "480p"
  bandwidth: number;    // bits per second
  bandwidthLabel: string; // "5 Mbps", "2.5 Mbps"
  resolution?: string;   // "1920x1080"
  codec?: string;       // "avc1.4d401f"
  url: string;          // Direct URL or playlist URL
}
```

---

## Quality Label Generation

```typescript
function getQualityLabel(resolution?: string, bandwidth?: number): string {
  if (resolution) {
    const height = parseInt(resolution.split('x')[1]);
    
    if (height >= 2160) return '4K';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    if (height >= 240) return '240p';
    return `${height}p`;
  }
  
  if (bandwidth) {
    const mbps = bandwidth / 1000000;
    if (mbps >= 10) return 'Ultra High';
    if (mbps >= 5) return 'High';
    if (mbps >= 2) return 'Medium';
    if (mbps >= 1) return 'Low';
    return 'Very Low';
  }
  
  return 'Unknown';
}

function formatBandwidth(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bps / 1000)} Kbps`;
}
```

---

## Quality Aggregation

```typescript
function aggregateQualities(variants: VariantStream[]): QualityInfo[] {
  const seen = new Map<string, QualityInfo>();
  
  for (const variant of variants) {
    const key = `${variant.resolution || 'unknown'}-${variant.bandwidth}`;
    
    if (!seen.has(key)) {
      seen.set(key, {
        label: getQualityLabel(variant.resolution, variant.bandwidth),
        bandwidth: variant.bandwidth,
        bandwidthLabel: formatBandwidth(variant.bandwidth),
        resolution: variant.resolution,
        codec: variant.codecs,
        url: variant.url
      });
    }
  }
  
  // Sort by bandwidth (highest first)
  return Array.from(seen.values()).sort((a, b) => b.bandwidth - a.bandwidth);
}
```

---

## Tests

- [ ] "1920x1080" → "1080p"
- [ ] "1280x720" → "720p"
- [ ] 3000000 bps → "3.0 Mbps"
- [ ] Duplicates are filtered out
- [ ] Sorted correctly (best first)
