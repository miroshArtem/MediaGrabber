# T-02 — M3U8 Parser Implementation

**Epic**: EP-03 (Video Detection & Parsing)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 00:00

---

## Goal

Implement robust M3U8 playlist parsing to extract variant streams and quality information.

---

## Subtasks

- [ ] Fetch M3U8 playlist from detected URL
- [ ] Parse master playlist (contains variant streams)
- [ ] Parse media playlist (contains segments)
- [ ] Extract quality/bandwidth info from variant streams
- [ ] Resolve relative URLs in playlists
- [ ] Handle both #EXTM3U and #EXT-X-VERSION tags
- [ ] Use m3u8-parser library

---

## M3U8 Format Examples

**Master Playlist:**
```
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1920x1080
video/1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
video/720p.m3u8
```

**Media Playlist:**
```
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:1
#EXTINF:10.0,
segment1.ts
#EXTINF:10.0,
segment2.ts
#EXT-X-ENDLIST
```

---

## Implementation using m3u8-parser

```typescript
// lib/m3u8-parser.ts

import { parse } from 'm3u8-parser';

interface VariantStream {
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  url: string;
}

interface ParsedPlaylist {
  type: 'master' | 'media';
  variants: VariantStream[];
  segments?: string[];
  duration?: number;
}

export async function parseM3U8(url: string): Promise<ParsedPlaylist> {
  const response = await fetch(url);
  const text = await response.text();
  
  const parser = parse(text);
  
  // Check if master playlist (has variants)
  if (parser.variants && parser.variants.length > 0) {
    return {
      type: 'master',
      variants: parser.variants.map(v => ({
        bandwidth: v.bandwidth,
        resolution: v.resolution?.width + 'x' + v.resolution?.height,
        codecs: v.codecs,
        url: resolveUrl(v.uri, url)
      }))
    };
  }
  
  // Media playlist (has segments)
  const segments = parser.segments?.map(s => resolveUrl(s.uri, url)) || [];
  const duration = parser.segments?.reduce((sum, s) => sum + (s.duration || 0), 0);
  
  return {
    type: 'media',
    variants: [],
    segments,
    duration
  };
}

function resolveUrl(segmentUrl: string, baseUrl: string): string {
  if (segmentUrl.startsWith('http')) return segmentUrl;
  
  const base = new URL(baseUrl);
  base.pathname = base.pathname.replace(/[^/]*$/, '');
  
  if (segmentUrl.startsWith('/')) {
    return `${base.origin}${segmentUrl}`;
  }
  
  return `${base.href}${segmentUrl}`;
}
```

---

## Quality Selection Logic

```typescript
export function selectQuality(variants: VariantStream[], preference: 'best' | 'worst' | number): VariantStream {
  if (preference === 'best') {
    return variants.reduce((best, current) => 
      current.bandwidth > best.bandwidth ? current : best
    );
  }
  
  if (preference === 'worst') {
    return variants.reduce((worst, current) => 
      current.bandwidth < worst.bandwidth ? current : worst
    );
  }
  
  // Specific bandwidth
  return variants.find(v => v.bandwidth <= preference) || variants[0];
}
```

---

## Tests

- [ ] Master playlist with 1080p/720p/480p variants parses correctly
- [ ] Media playlist segments are extracted
- [ ] Duration is calculated correctly
- [ ] Relative URLs are resolved to absolute
- [ ] Bandwidth values are correct
