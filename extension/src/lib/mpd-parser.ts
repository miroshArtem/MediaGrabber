// MPD Manifest Parser
// Parses DASH manifest files to extract adaptation sets and representations

import { MpdParser } from 'mpd-parser';

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
  representations: MPDRepresentation[];
}

export class MPDParserWrapper {
  /**
   * Parse a MPD manifest string and extract adaptation sets
   */
  static parse(manifest: string): MPDAdaptationSet[] {
    const parsed = MpdParser.parse(manifest);
    
    const adaptationSets: MPDAdaptationSet[] = [];
    
    if (parsed.mediaPresentationDuration && parsed.periods) {
      for (const period of parsed.periods) {
        if (period.adaptationSets) {
          for (const adaptationSet of period.adaptationSets) {
            const set: MPDAdaptationSet = {
              id: adaptationSet.id || 'unknown',
              mimeType: adaptationSet.mimeType || 'unknown',
              representations: []
            };
            
            if (adaptationSet.representations) {
              for (const rep of adaptationSet.representations) {
                set.representations.push({
                  id: rep.id || 'unknown',
                  bandwidth: rep.bandwidth || 0,
                  width: rep.width,
                  height: rep.height,
                  mimeType: rep.mimeType || set.mimeType,
                  codecs: rep.codecs,
                  url: this.getRepresentationUrl(rep)
                });
              }
            }
            
            // Sort by bandwidth (highest first)
            set.representations.sort((a, b) => b.bandwidth - a.bandwidth);
            adaptationSets.push(set);
          }
        }
      }
    }
    
    return adaptationSets;
  }
  
  /**
   * Extract the URL from a representation
   */
  private static getRepresentationUrl(rep: any): string {
    if (rep.baseUrl) return rep.baseUrl;
    if (rep.segmentBase?.initialization) return rep.segmentBase.initialization;
    return '';
  }
  
  /**
   * Get video representations sorted by quality
   */
  static getVideoRepresentations(manifest: string): MPDRepresentation[] {
    const sets = this.parse(manifest);
    const videoSets = sets.filter(s => s.mimeType.startsWith('video/'));
    
    const allReps: MPDRepresentation[] = [];
    for (const set of videoSets) {
      allReps.push(...set.representations);
    }
    
    return allReps.sort((a, b) => b.bandwidth - a.bandwidth);
  }
}
