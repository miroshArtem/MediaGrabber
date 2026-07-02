// DASH/MPD Manifest Parser
// Parses MPEG-DASH MPD (XML) manifests to extract stream information.
// Regex-based because DOMParser is not available in MV3 service workers.

export interface DashStreamInfo {
  url: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  frameRate?: string;
  mimeType?: string;
  name?: string;
  encrypted: boolean;
}

export interface ParsedDash {
  type: 'master' | 'media';
  variants: DashStreamInfo[];
  childUrls?: string[];
  duration?: number;
}

export class DashParserWrapper {
  static async fetchAndParse(url: string): Promise<ParsedDash> {
    const response = await fetch(url);
    const text = await response.text();
    return DashParserWrapper.parse(text, url);
  }

  static parse(manifest: string, manifestUrl: string): ParsedDash {
    if (!manifest.includes('<MPD') && !manifest.includes('urn:mpeg:dash')) {
      return { type: 'media', variants: [] };
    }

    const duration = DashParserWrapper.parseMediaDuration(manifest);
    const adaptationSets = DashParserWrapper.extractAdaptationSets(manifest);

    const variants: DashStreamInfo[] = [];
    const childUrls: Set<string> = new Set();

    for (const asBlock of adaptationSets) {
      const asAttrs = DashParserWrapper.extractAttrs(asBlock.openTag);
      const isVideo = DashParserWrapper.isVideoAdaptationSet(asAttrs);
      const encrypted = asBlock.content.includes('<ContentProtection');

      // Collect BaseURL and audio rendition URIs as childUrls
      const baseUrlMatch = asBlock.content.match(/<BaseURL[^>]*>([^<]+)<\/BaseURL>/);
      if (baseUrlMatch) {
        childUrls.add(DashParserWrapper.resolveUrl(baseUrlMatch[1].trim(), manifestUrl));
      }

      const representations = DashParserWrapper.extractRepresentations(asBlock.content);

      for (const repAttrs of representations) {
        const merged = { ...asAttrs, ...repAttrs };

        if (!isVideo && !DashParserWrapper.isVideoRepresentation(merged)) continue;

        const bandwidth = parseInt(merged.bandwidth || '0', 10);
        if (bandwidth <= 0) continue;

        const height = parseInt(merged.height || merged.maxHeight || '0', 10);
        const width = parseInt(merged.width || merged.maxWidth || '0', 10);

        variants.push({
          url: manifestUrl,
          bandwidth,
          width: width || undefined,
          height: height || undefined,
          codecs: merged.codecs,
          frameRate: merged.frameRate,
          mimeType: merged.mimeType,
          name: DashParserWrapper.getQualityName(height),
          encrypted
        });
      }
    }

    variants.sort((a, b) => b.bandwidth - a.bandwidth);

    const seen = new Set<string>();
    const deduped = variants.filter(v => {
      const key = `${v.height || 0}:${v.bandwidth}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      type: 'master',
      variants: deduped,
      childUrls: childUrls.size > 0 ? Array.from(childUrls) : undefined,
      duration
    };
  }

  private static extractAttrs(tag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = attrRegex.exec(tag)) !== null) {
      attrs[m[1]] = m[2];
    }
    return attrs;
  }

  private static extractAdaptationSets(xml: string): Array<{ openTag: string; content: string }> {
    const results: Array<{ openTag: string; content: string }> = [];
    const openRegex = /<AdaptationSet\b([^>]*)>/g;
    let match;

    while ((match = openRegex.exec(xml)) !== null) {
      const openTag = match[1] || '';
      const startIdx = openRegex.lastIndex;

      if (openTag.endsWith('/')) {
        results.push({ openTag: openTag.slice(0, -1).trim(), content: '' });
        continue;
      }

      const closeIdx = xml.indexOf('</AdaptationSet>', startIdx);
      if (closeIdx === -1) {
        results.push({ openTag: openTag.trim(), content: xml.substring(startIdx) });
      } else {
        results.push({ openTag: openTag.trim(), content: xml.substring(startIdx, closeIdx) });
      }
    }

    return results;
  }

  private static extractRepresentations(content: string): Array<Record<string, string>> {
    const results: Array<Record<string, string>> = [];
    const repRegex = /<Representation\b([^>]*?)>/g;
    let match;

    while ((match = repRegex.exec(content)) !== null) {
      const attrsStr = match[1] || '';
      const cleanAttrs = attrsStr.endsWith('/') ? attrsStr.slice(0, -1) : attrsStr;
      results.push(DashParserWrapper.extractAttrs(cleanAttrs));
    }

    return results;
  }

  private static isVideoAdaptationSet(attrs: Record<string, string>): boolean {
    const ct = attrs.contentType;
    if (ct === 'video') return true;
    if (ct === 'audio' || ct === 'text' || ct === 'image') return false;
    const mt = attrs.mimeType || '';
    return mt.startsWith('video/');
  }

  private static isVideoRepresentation(attrs: Record<string, string>): boolean {
    if (attrs.width || attrs.height || attrs.maxWidth || attrs.maxHeight) return true;
    const mt = attrs.mimeType || '';
    return mt.startsWith('video/');
  }

  private static parseMediaDuration(manifest: string): number | undefined {
    const match = manifest.match(/mediaPresentationDuration\s*=\s*"([^"]+)"/);
    if (!match) return undefined;
    return DashParserWrapper.parseIsoDuration(match[1]);
  }

  private static parseIsoDuration(iso: string): number | undefined {
    const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
    if (!m) return undefined;
    const hours = parseInt(m[1] || '0', 10);
    const mins = parseInt(m[2] || '0', 10);
    const secs = parseFloat(m[3] || '0');
    return hours * 3600 + mins * 60 + secs;
  }

  static resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  static getQualityName(height?: number): string {
    if (!height) return 'Unknown';
    if (height >= 2160) return '4K';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return `${height}p`;
  }
}
