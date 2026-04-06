// Quality Detection Utilities
// Handles quality detection, labeling, and formatting

export interface QualityInfo {
  label: string;           // "1080p", "720p", "4K"
  bandwidth: number;       // bits per second
  bandwidthLabel: string;  // "5 Mbps", "2.5 Mbps"
  height?: number;         // pixel height
  width?: number;          // pixel width
  resolution?: string;     // "1920x1080"
  codec?: string;          // "avc1.4d401f"
  url: string;             // Direct URL or playlist URL
}

export interface VideoQuality {
  height: number;
  width?: number;
  bitrate?: number;
  url: string;
}

/**
 * Generate quality label from resolution
 */
export function getQualityLabel(height?: number, bandwidth?: number): string {
  if (height) {
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

/**
 * Format bandwidth as human-readable string
 */
export function formatBandwidth(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bps / 1000)} Kbps`;
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert VideoQuality array to QualityInfo array
 */
export function toQualityInfo(qualities: VideoQuality[]): QualityInfo[] {
  const seen = new Map<string, QualityInfo>();
  
  for (const q of qualities) {
    const key = `${q.height}-${q.bitrate || 0}`;
    
    if (!seen.has(key)) {
      seen.set(key, {
        label: getQualityLabel(q.height, q.bitrate ? q.bitrate * 1000 : undefined),
        bandwidth: q.bitrate ? q.bitrate * 1000 : 0,
        bandwidthLabel: q.bitrate ? formatBandwidth(q.bitrate * 1000) : 'Unknown',
        height: q.height,
        width: q.width,
        resolution: q.width && q.height ? `${q.width}x${q.height}` : undefined,
        url: q.url
      });
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.bandwidth - a.bandwidth);
}

/**
 * Filter out duplicate quality levels
 */
export function deduplicateQualities(qualities: QualityInfo[]): QualityInfo[] {
  const seen = new Map<string, QualityInfo>();
  
  for (const q of qualities) {
    // Keep the first occurrence of each label
    if (!seen.has(q.label)) {
      seen.set(q.label, q);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.bandwidth - a.bandwidth);
}

/**
 * Select quality based on preference
 */
export function selectQuality(
  qualities: QualityInfo[],
  preference: 'best' | 'worst' | number
): QualityInfo | null {
  if (!qualities || qualities.length === 0) return null;
  
  if (preference === 'best') {
    return qualities[0]; // Already sorted by bandwidth desc
  }
  
  if (preference === 'worst') {
    return qualities[qualities.length - 1];
  }
  
  // Specific bandwidth (in Kbps)
  const target = typeof preference === 'number' ? preference * 1000 : 0;
  return qualities.find(q => q.bandwidth <= target) || qualities[0];
}

/**
 * Get quality label from bandwidth alone
 */
export function labelFromBandwidth(bandwidth: number): string {
  const mbps = bandwidth / 1000000;
  if (mbps >= 8) return '4K';
  if (mbps >= 5) return '1080p';
  if (mbps >= 2.5) return '720p';
  if (mbps >= 1) return '480p';
  if (mbps >= 0.5) return '360p';
  return 'Low';
}
