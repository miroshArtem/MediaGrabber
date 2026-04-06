// M3U8 Playlist Parser
// Parses HLS manifest files to extract stream information

import { M3U8Parser } from 'm3u8-parser';

export interface M3U8StreamInfo {
  url: string;
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  name?: string;
}

export class M3U8ParserWrapper {
  /**
   * Parse an M3U8 playlist string and extract stream information
   */
  static parse(manifest: string): M3U8StreamInfo[] {
    const parser = new M3U8Parser();
    parser.push(manifest);
    parser.end();
    
    const streams: M3U8StreamInfo[] = [];
    
    if (parser.manifest.playlists) {
      for (const playlist of parser.manifest.playlists) {
        streams.push({
          url: playlist.uri,
          bandwidth: playlist.attributes.BANDWIDTH || 0,
          width: playlist.attributes.RESOLUTION?.width,
          height: playlist.attributes.RESOLUTION?.height,
          codecs: playlist.attributes.CODECS,
          name: this.getQualityName(playlist.attributes.RESOLUTION?.height)
        });
      }
    }
    
    // Sort by height (highest quality first)
    return streams.sort((a, b) => (b.height || 0) - (a.height || 0));
  }
  
  /**
   * Parse a variant playlist to get all segment URLs
   */
  static parseVariant(manifest: string): string[] {
    const parser = new M3U8Parser();
    parser.push(manifest);
    parser.end();
    
    const segments: string[] = [];
    
    if (parser.manifest.segments) {
      for (const segment of parser.manifest.segments) {
        if (segment.uri) {
          segments.push(segment.uri);
        }
      }
    }
    
    return segments;
  }
  
  /**
   * Get a human-readable quality name from height
   */
  private static getQualityName(height?: number): string {
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
