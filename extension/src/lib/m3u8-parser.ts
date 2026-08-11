// M3U8 Playlist Parser
// Parses HLS manifest files to extract stream information

export interface M3U8StreamInfo {
  url: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  name?: string;
  audioGroupId?: string;
}

export interface MediaRendition {
  type: string;
  groupId?: string;
  name?: string;
  language?: string;
  uri?: string;
  default?: boolean;
  autoselect?: boolean;
}

export interface ParsedM3U8 {
  type: 'master' | 'media';
  variants: M3U8StreamInfo[];
  mediaRenditions?: MediaRendition[];
  childUrls?: string[];
  segments?: string[];
  duration?: number;
}

export class M3U8ParserWrapper {
  /**
   * Fetch and parse an M3U8 playlist from URL
   */
  static async fetchAndParse(url: string, referer?: string): Promise<ParsedM3U8> {
    const init: RequestInit = {};
    if (referer) init.referrer = referer;
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`HLS manifest request failed with HTTP ${response.status}`);
    }
    const text = await response.text();
    return M3U8ParserWrapper.parse(text, response.url || url);
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
    const mediaRenditions: MediaRendition[] = [];
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
        const rendition = M3U8ParserWrapper.parseMediaRendition(line);
        if (rendition.uri && baseUrl) {
          rendition.uri = M3U8ParserWrapper.resolveUrl(rendition.uri, baseUrl);
          childUrls.push(rendition.uri);
        }
        mediaRenditions.push(rendition);
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
    const audioGroupMembers = new Map<string, string[]>();
    for (const rendition of mediaRenditions) {
      if (rendition.type !== 'AUDIO' || !rendition.groupId) continue;
      const members = audioGroupMembers.get(rendition.groupId) || [];
      members.push([
        rendition.name || '',
        rendition.language || '',
        rendition.default ? '1' : '0',
        rendition.autoselect ? '1' : '0'
      ].join(':'));
      audioGroupMembers.set(rendition.groupId, members);
    }
    const audioGroupSignatures = new Map<string, string>();
    for (const [groupId, members] of audioGroupMembers) {
      audioGroupSignatures.set(groupId, members.sort().join('|'));
    }

    const seenVariantKeys = new Set<string>();
    const uniqueVariants = variants.filter((variant) => {
      const audioGroupKey = variant.audioGroupId
        ? audioGroupSignatures.get(variant.audioGroupId) || variant.audioGroupId
        : '';
      const key = `${variant.width || 0}:${variant.height || 0}:${variant.bandwidth}:${variant.codecs || ''}:${audioGroupKey}`;
      if (seenVariantKeys.has(key)) return false;
      seenVariantKeys.add(key);
      return true;
    });
    
    return {
      type: isMaster ? 'master' : 'media',
      variants: uniqueVariants,
      mediaRenditions: mediaRenditions.length > 0 ? mediaRenditions : undefined,
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
    
    const bwMatch = line.match(/BANDWIDTH=(\d+)/);
    if (bwMatch) {
      info.bandwidth = parseInt(bwMatch[1]);
    }
    
    const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
    if (resMatch) {
      info.width = parseInt(resMatch[1]);
      info.height = parseInt(resMatch[2]);
    }
    
    const codecsMatch = line.match(/CODECS="([^"]+)"/);
    if (codecsMatch) {
      info.codecs = codecsMatch[1];
    }

    const audioGroupMatch = line.match(/AUDIO="([^"]+)"/);
    if (audioGroupMatch) {
      info.audioGroupId = audioGroupMatch[1];
    }
    
    info.name = M3U8ParserWrapper.getQualityName(info.height);
    
    return info;
  }

  private static parseMediaRendition(line: string): MediaRendition {
    const rendition: MediaRendition = { type: 'AUDIO' };

    const typeMatch = line.match(/TYPE=([A-Z\-]+)/);
    if (typeMatch) rendition.type = typeMatch[1];

    const groupIdMatch = line.match(/GROUP-ID="([^"]+)"/);
    if (groupIdMatch) rendition.groupId = groupIdMatch[1];

    const nameMatch = line.match(/NAME="([^"]+)"/);
    if (nameMatch) rendition.name = nameMatch[1];

    const langMatch = line.match(/LANGUAGE="([^"]+)"/);
    if (langMatch) rendition.language = langMatch[1];

    const uriMatch = line.match(/URI="([^"]+)"/);
    if (uriMatch) rendition.uri = uriMatch[1];

    const defaultMatch = line.match(/DEFAULT=(YES|NO)/);
    if (defaultMatch) rendition.default = defaultMatch[1] === 'YES';

    const autoselectMatch = line.match(/AUTOSELECT=(YES|NO)/);
    if (autoselectMatch) rendition.autoselect = autoselectMatch[1] === 'YES';

    return rendition;
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
