// M3U8 Playlist Parser
// Parses HLS manifest files to extract stream information

export interface M3U8StreamInfo {
  url: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  name?: string;
}

export interface ParsedM3U8 {
  type: 'master' | 'media';
  variants: M3U8StreamInfo[];
  childUrls?: string[];
  segments?: string[];
  duration?: number;
}

export class M3U8ParserWrapper {
  /**
   * Fetch and parse an M3U8 playlist from URL
   */
  static async fetchAndParse(url: string): Promise<ParsedM3U8> {
    const response = await fetch(url);
    const text = await response.text();
    return M3U8ParserWrapper.parse(text, url);
  }
  
  /**
   * Parse an M3U8 playlist string and extract stream information
   */
  static parse(manifest: string, baseUrl?: string): ParsedM3U8 {
    if (!manifest.includes('#EXTM3U')) {
      return { type: 'media', variants: [], segments: [], duration: undefined };
    }
    // Use regex-based parsing since m3u8-parser may not be available in browser
    const lines = manifest.split('\n');
    
    const variants: M3U8StreamInfo[] = [];
    const childUrls: string[] = [];
    const segments: string[] = [];
    let isMaster = false;
    let targetDuration = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Master playlist indicator
      if (line.includes('EXT-X-STREAM-INF')) {
        isMaster = true;
        const variant = M3U8ParserWrapper.parseStreamInf(line);
        const playlistUrl = lines[i + 1]?.trim();
        
        if (playlistUrl && !playlistUrl.startsWith('#') && baseUrl) {
          variant.url = M3U8ParserWrapper.resolveUrl(playlistUrl, baseUrl);
          variants.push(variant);
          childUrls.push(variant.url);
          i++; // Skip next line
        }
      }

      // Alternate audio/subtitle rendition playlists referenced by the master.
      if (line.startsWith('#EXT-X-MEDIA:')) {
        isMaster = true;
        const uriMatch = line.match(/URI="([^"]+)"/);
        if (uriMatch && baseUrl) {
          childUrls.push(M3U8ParserWrapper.resolveUrl(uriMatch[1], baseUrl));
        }
      }
      
      // Media playlist - segment
      if (line.includes('EXTINF') && !line.includes('EXT-X-STREAM-INF')) {
        const durationMatch = line.match(/EXTINF:([\d.]+)/);
        if (durationMatch) {
          totalDuration += parseFloat(durationMatch[1]);
        }
        const segmentUrl = lines[i + 1]?.trim();
        if (segmentUrl && !segmentUrl.startsWith('#') && baseUrl) {
          segments.push(M3U8ParserWrapper.resolveUrl(segmentUrl, baseUrl));
          i++; // Skip next line
        }
      }
      
      // Target duration
      const targetMatch = line.match(/EXT-X-TARGETDURATION:(\d+)/);
      if (targetMatch) {
        targetDuration = parseInt(targetMatch[1]);
      }
    }
    
    // Sort variants by bandwidth (highest first)
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    
    return {
      type: isMaster ? 'master' : 'media',
      variants,
      childUrls: childUrls.length > 0 ? Array.from(new Set(childUrls)) : undefined,
      segments: segments.length > 0 ? segments : undefined,
      duration: segments.length > 0 ? totalDuration || segments.length * targetDuration : undefined
    };
  }
  
  /**
   * Parse EXT-X-STREAM-INF line for variant info
   */
  private static parseStreamInf(line: string): M3U8StreamInfo {
    const info: M3U8StreamInfo = {
      url: '',
      bandwidth: 0
    };
    
    // Parse BANDWIDTH
    const bwMatch = line.match(/BANDWIDTH=(\d+)/);
    if (bwMatch) {
      info.bandwidth = parseInt(bwMatch[1]);
    }
    
    // Parse RESOLUTION
    const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
    if (resMatch) {
      info.width = parseInt(resMatch[1]);
      info.height = parseInt(resMatch[2]);
    }
    
    // Parse CODECS
    const codecsMatch = line.match(/CODECS="([^"]+)"/);
    if (codecsMatch) {
      info.codecs = codecsMatch[1];
    }
    
    // Generate quality name
    info.name = M3U8ParserWrapper.getQualityName(info.height);
    
    return info;
  }
  
  /**
   * Resolve relative URL to absolute
   */
  static resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }
  
  /**
   * Get a human-readable quality name from height
   */
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
  
  /**
   * Select quality variant based on preference
   */
  static selectQuality(variants: M3U8StreamInfo[], preference: 'best' | 'worst' | number): M3U8StreamInfo | null {
    if (!variants || variants.length === 0) return null;
    
    if (preference === 'best') {
      return variants[0]; // Already sorted by bandwidth desc
    }
    
    if (preference === 'worst') {
      return variants[variants.length - 1];
    }
    
    // Specific bandwidth - find closest not exceeding
    const target = typeof preference === 'number' ? preference : 0;
    return variants.find(v => v.bandwidth <= target) || variants[0];
  }
}
