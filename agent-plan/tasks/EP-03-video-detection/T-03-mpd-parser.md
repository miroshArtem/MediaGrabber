# T-03 — MPD Parser Implementation

**Epic**: EP-03 (Video Detection & Parsing)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 00:05

---

## Goal

Implement MPD (MPEG-DASH) manifest parsing to extract adaptation sets and representations.

---

## Subtasks

- [ ] Fetch MPD manifest from detected URL
- [ ] Parse Period and AdaptationSet elements
- [ ] Extract video and audio representations
- [ ] Extract bandwidth and resolution info
- [ ] Resolve segment URLs
- [ ] Handle both static and dynamic MPD

---

## MPD Format Example

```xml
<MPD xmlns="urn:mpeg:dash:manifest:2011" type="static">
  <Period duration="PT1800S">
    <AdaptationSet mimeType="video/mp4" maxBitrate="3000000">
      <Representation id="1" bandwidth="3000000" width="1920" height="1080">
        <BaseURL>video/1080p.mp4</BaseURL>
      </Representation>
      <Representation id="2" bandwidth="1500000" width="1280" height="720">
        <BaseURL>video/720p.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="3" bandwidth="128000">
        <BaseURL>audio/128kbps.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

---

## Implementation

```typescript
// lib/mpd-parser.ts

interface DASHRepresentation {
  id: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  url: string;
}

interface DASHAdaptationSet {
  mimeType: string;
  contentType: 'video' | 'audio';
  representations: DASHRepresentation[];
}

interface ParsedMPD {
  type: 'static' | 'dynamic';
  duration: number;
  adaptationSets: DASHAdaptationSet[];
}

export async function parseMPD(url: string): Promise<ParsedMPD> {
  const response = await fetch(url);
  const text = await response.text();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  
  const mpd = doc.querySelector('MPD');
  const type = mpd?.getAttribute('type') || 'static';
  
  // Parse duration (PT1800S format)
  const durationStr = mpd?.getAttribute('mediaPresentationDuration') || 'PT0S';
  const duration = parseDuration(durationStr);
  
  const adaptationSets: DASHAdaptationSet[] = [];
  
  mpd?.querySelectorAll('AdaptationSet').forEach(as => {
    const mimeType = as.getAttribute('mimeType') || '';
    const contentType = mimeType.startsWith('video') ? 'video' : 'audio';
    
    const representations: DASHRepresentation[] = [];
    
    as.querySelectorAll('Representation').forEach(rep => {
      const baseUrl = rep.querySelector('BaseURL')?.textContent;
      if (!baseUrl) return;
      
      representations.push({
        id: rep.getAttribute('id') || '',
        bandwidth: parseInt(rep.getAttribute('bandwidth') || '0'),
        width: parseInt(rep.getAttribute('width') || '0') || undefined,
        height: parseInt(rep.getAttribute('height') || '0') || undefined,
        codecs: rep.getAttribute('codecs') || undefined,
        url: resolveUrl(baseUrl, url)
      });
    });
    
    if (representations.length > 0) {
      adaptationSets.push({ mimeType, contentType, representations });
    }
  });
  
  return { type: type as 'static' | 'dynamic', duration, adaptationSets };
}

function parseDuration(iso: string): number {
  // Parse ISO 8601 duration (PT1800S)
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
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

## Tests

- [ ] MPD with video/audio AdaptationSets parses correctly
- [ ] Bandwidth values are extracted
- [ ] Resolution is extracted
- [ ] BaseURLs are resolved
- [ ] Duration is calculated
