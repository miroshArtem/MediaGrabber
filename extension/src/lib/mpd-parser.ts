// MPD Manifest Parser
// Parses DASH manifest files to extract adaptation sets and representations

export interface MPDRepresentation {
  id: string;
  bandwidth: number;
  width?: number;
  height?: number;
  mimeType?: string;
  codecs?: string;
  url: string;
}

export interface MPDAdaptationSet {
  id: string;
  mimeType: string;
  contentType: 'video' | 'audio' | 'application';
  representations: MPDRepresentation[];
}

export interface ParsedMPD {
  type: 'static' | 'dynamic';
  duration: number;
  adaptationSets: MPDAdaptationSet[];
}

export class MPDParserWrapper {
  /**
   * Fetch and parse a MPD manifest from URL
   */
  static async fetchAndParse(url: string): Promise<ParsedMPD> {
    const response = await fetch(url);
    const text = await response.text();
    return MPDParserWrapper.parse(text, url);
  }
  
  /**
   * Parse a MPD manifest string and extract adaptation sets
   */
  static parse(manifest: string, baseUrl?: string): ParsedMPD {
    const parser = new DOMParser();
    const doc = parser.parseFromString(manifest, 'application/xml');
    
    const mpd = doc.querySelector('MPD');
    if (!mpd) {
      return { type: 'static', duration: 0, adaptationSets: [] };
    }
    
    const type = (mpd.getAttribute('type') || 'static') as 'static' | 'dynamic';
    const durationStr = mpd.getAttribute('mediaPresentationDuration') || 'PT0S';
    const duration = MPDParserWrapper.parseDuration(durationStr);
    
    const adaptationSets: MPDAdaptationSet[] = [];
    
    mpd.querySelectorAll('AdaptationSet').forEach(as => {
      const mimeType = as.getAttribute('mimeType') || '';
      const contentType = MPDParserWrapper.getContentType(mimeType);
      
      const representations: MPDRepresentation[] = [];
      
      as.querySelectorAll('Representation').forEach(rep => {
        const baseUrlElem = rep.querySelector('BaseURL');
        let baseUrlStr = baseUrlElem?.textContent || '';
        
        if (baseUrl && baseUrlStr) {
          baseUrlStr = MPDParserWrapper.resolveUrl(baseUrlStr, baseUrl);
        }
        
        representations.push({
          id: rep.getAttribute('id') || 'unknown',
          bandwidth: parseInt(rep.getAttribute('bandwidth') || '0'),
          width: parseInt(rep.getAttribute('width') || '0') || undefined,
          height: parseInt(rep.getAttribute('height') || '0') || undefined,
          mimeType,
          codecs: rep.getAttribute('codecs') || undefined,
          url: baseUrlStr
        });
      });
      
      if (representations.length > 0) {
        // Sort by bandwidth (highest first)
        representations.sort((a, b) => b.bandwidth - a.bandwidth);
        
        adaptationSets.push({
          id: as.getAttribute('id') || 'unknown',
          mimeType,
          contentType,
          representations
        });
      }
    });
    
    return { type, duration, adaptationSets };
  }
  
  /**
   * Get content type from mime type
   */
  private static getContentType(mimeType: string): 'video' | 'audio' | 'application' {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'application';
  }
  
  /**
   * Parse ISO 8601 duration
   */
  static parseDuration(iso: string): number {
    // Parse ISO 8601 duration (PT1800S, PT1H30M45S, etc.)
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  /**
   * Resolve relative URL to absolute
   */
  static resolveUrl(relativeUrl: string, baseUrl: string): string {
    if (relativeUrl.startsWith('http')) {
      return relativeUrl;
    }
    
    if (relativeUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return `${url.origin}${relativeUrl}`;
    }
    
    // Relative path
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return base + relativeUrl;
  }
  
  /**
   * Get video representations sorted by quality
   */
  static getVideoRepresentations(manifest: string, baseUrl?: string): MPDRepresentation[] {
    const parsed = this.parse(manifest, baseUrl);
    const videoSets = parsed.adaptationSets.filter(s => s.contentType === 'video');
    
    const allReps: MPDRepresentation[] = [];
    for (const set of videoSets) {
      allReps.push(...set.representations);
    }
    
    return allReps.sort((a, b) => b.bandwidth - a.bandwidth);
  }
  
  /**
   * Get audio representations
   */
  static getAudioRepresentations(manifest: string, baseUrl?: string): MPDRepresentation[] {
    const parsed = this.parse(manifest, baseUrl);
    const audioSets = parsed.adaptationSets.filter(s => s.contentType === 'audio');
    
    const allReps: MPDRepresentation[] = [];
    for (const set of audioSets) {
      allReps.push(...set.representations);
    }
    
    return allReps.sort((a, b) => b.bandwidth - a.bandwidth);
  }
  
  /**
   * Select quality based on preference
   */
  static selectQuality(representations: MPDRepresentation[], preference: 'best' | 'worst' | number): MPDRepresentation | null {
    if (!representations || representations.length === 0) return null;
    
    if (preference === 'best') {
      return representations[0];
    }
    
    if (preference === 'worst') {
      return representations[representations.length - 1];
    }
    
    // Specific bandwidth
    const target = typeof preference === 'number' ? preference : 0;
    return representations.find(r => r.bandwidth <= target) || representations[0];
  }
}
