// MediaGrabber Content Script
// Runs on every page to detect video streams

import { VideoInfo, VideoQuality } from './lib/types';

interface DetectedMedia {
  type: 'hls' | 'dash' | 'mp4' | 'webm' | 'direct';
  url: string;
  qualities?: VideoQuality[];
  pageUrl: string;
}

class NetworkInterceptor {
  private interceptedUrls = new Set<string>();
  private mediaDetector: MediaDetector;
  
  constructor(mediaDetector: MediaDetector) {
    this.mediaDetector = mediaDetector;
  }
  
  setup(): void {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        // Skip non-main-frame requests for most media types
        // But always capture manifest files
        const isManifest = details.url.includes('.m3u8') || details.url.includes('.mpd');
        if (details.frameId !== 0 && !isManifest) {
          return;
        }
        
        const url = details.url;
        
        // Skip already intercepted
        if (this.interceptedUrls.has(url)) return;
        
        // Check if media-related
        if (this.isMediaUrl(url)) {
          this.interceptedUrls.add(url);
          this.onMediaUrlDetected(url, details);
        }
      },
      { urls: ['<all_urls>'] }
    );
  }
  
  private isMediaUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('.m3u8') ||
      lower.includes('.mpd') ||
      lower.includes('/manifest') ||
      lower.includes('.mp4') ||
      lower.includes('.webm') ||
      lower.includes('.ts') ||
      lower.includes('.m4s') ||
      lower.includes('.m4a') ||
      lower.includes('.aac')
    );
  }
  
  private onMediaUrlDetected(url: string, details: any): void {
    const type = this.guessMediaType(url);
    console.log('[MediaGrabber] Media URL intercepted:', url, type);
    
    // Send to background
    chrome.runtime.sendMessage({
      type: 'VIDEO_DETECTED',
      video: {
        id: this.generateVideoId(url),
        title: this.extractTitle(),
        url: url,
        type: type,
        qualities: []
      }
    });
  }
  
  private guessMediaType(url: string): 'hls' | 'dash' | 'mp4' | 'webm' | 'direct' {
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.mpd')) return 'dash';
    if (lower.includes('.mp4')) return 'mp4';
    if (lower.includes('.webm')) return 'webm';
    return 'direct';
  }
  
  private generateVideoId(url: string): string {
    return `video_${btoa(url).substring(0, 20)}_${Date.now()}`;
  }
  
  private extractTitle(): string {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle) return ogTitle;
    
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    if (twitterTitle) return twitterTitle;
    
    return document.title || 'Unknown Video';
  }
}

class MediaDetector {
  private mediaUrls = new Set<string>();
  private manifestUrls = new Set<string>();
  private detectedVideos: VideoInfo[] = [];
  private networkInterceptor: NetworkInterceptor;
  
  constructor() {
    this.networkInterceptor = new NetworkInterceptor(this);
    this.setupWebRequestListener();
    this.setupDOMObserver();
    this.scanExistingMedia();
  }
  
  /**
   * Set up webRequest listener for network interception
   */
  private setupWebRequestListener(): void {
    this.networkInterceptor.setup();
  }
  
  /**
   * Set up DOM observer for dynamically added media elements
   */
  private setupDOMObserver(): void {
    // Watch for dynamically added video/audio elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLVideoElement || node instanceof HTMLAudioElement) {
            this.handleMediaElement(node as HTMLVideoElement);
          }
          // Check if it's an element with src attribute
          if (node instanceof Element) {
            const src = node.getAttribute('src');
            if (src && this.isMediaUrl(src)) {
              this.handleMediaUrl(src);
            }
            // Check for source elements inside video
            const sources = node.querySelectorAll('source[src]');
            sources.forEach(source => {
              const sourceSrc = source.getAttribute('src');
              if (sourceSrc) this.handleMediaUrl(sourceSrc);
            });
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  /**
   * Scan for existing media elements on page load
   */
  private scanExistingMedia(): void {
    // Check existing video elements
    document.querySelectorAll('video, audio').forEach(el => {
      this.handleMediaElement(el as HTMLVideoElement);
    });
    
    // Check for media source elements
    document.querySelectorAll('source[src]').forEach(source => {
      const src = source.getAttribute('src');
      if (src) this.handleMediaUrl(src);
    });
    
    // Check for iframe elements that might contain media
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const src = iframe.getAttribute('src');
        if (src && this.isMediaUrl(src)) {
          this.handleMediaUrl(src);
        }
      } catch {
        // Cross-origin iframe, ignore
      }
    });
  }
  
  /**
   * Handle a media element (video/audio)
   */
  private handleMediaElement(el: HTMLVideoElement): void {
    const src = el.currentSrc || el.src;
    if (src) {
      this.handleMediaUrl(src);
    }
    
    // Also check for source elements inside
    el.querySelectorAll('source[src]').forEach(source => {
      const sourceSrc = source.getAttribute('src');
      if (sourceSrc) this.handleMediaUrl(sourceSrc);
    });
    
    // Listen for source changes
    el.addEventListener('loadedmetadata', () => {
      const currentSrc = el.currentSrc;
      if (currentSrc) this.handleMediaUrl(currentSrc);
    });
  }
  
  /**
   * Check if URL is a media URL
   */
  private isMediaUrl(url: string): boolean {
    const mediaExts = ['.mp4', '.webm', '.ts', '.m4s', '.m4a', '.aac', '.ogv'];
    const mediaPatterns = ['/manifest', '.m3u8', '.mpd', 'hls.', 'dash.'];
    
    const lowerUrl = url.toLowerCase();
    return mediaExts.some(ext => lowerUrl.includes(ext)) ||
           mediaPatterns.some(pattern => lowerUrl.includes(pattern));
  }
  
  /**
   * Handle a detected media URL
   */
  private handleMediaUrl(url: string): void {
    if (this.mediaUrls.has(url)) return;
    this.mediaUrls.add(url);
    
    console.log('[MediaGrabber] Media URL detected:', url);
    
    // Determine media type
    const type = this.getMediaType(url);
    
    const media: DetectedMedia = {
      type,
      url,
      pageUrl: window.location.href
    };
    
    // Send to background script
    this.sendToBackground(media);
  }
  
  /**
   * Determine media type from URL
   */
  private getMediaType(url: string): 'hls' | 'dash' | 'mp4' | 'webm' | 'direct' {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('m3u8')) {
      return 'hls';
    }
    if (lowerUrl.includes('.mpd') || lowerUrl.includes('mpd')) {
      return 'dash';
    }
    if (lowerUrl.includes('.mp4')) {
      return 'mp4';
    }
    if (lowerUrl.includes('.webm')) {
      return 'webm';
    }
    
    return 'direct';
  }
  
  /**
   * Send detected media to background script
   */
  private sendToBackground(media: DetectedMedia): void {
    try {
      chrome.runtime.sendMessage({
        type: 'VIDEO_DETECTED',
        video: {
          id: this.generateVideoId(media),
          title: this.extractTitle(),
          url: media.url,
          type: media.type,
          qualities: media.qualities || [],
          duration: this.getVideoDuration()
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[MediaGrabber] Failed to send to background:', chrome.runtime.lastError);
        }
      });
    } catch (e) {
      console.error('[MediaGrabber] Error sending to background:', e);
    }
  }
  
  /**
   * Generate a unique ID for a video
   */
  private generateVideoId(media: DetectedMedia): string {
    return `video_${btoa(media.url).substring(0, 20)}_${Date.now()}`;
  }
  
  /**
   * Extract page title for video
   */
  private extractTitle(): string {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle) return ogTitle;
    
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    if (twitterTitle) return twitterTitle;
    
    return document.title || 'Unknown Video';
  }
  
  /**
   * Get video duration if available
   */
  private getVideoDuration(): number | undefined {
    const video = document.querySelector('video');
    if (video && video.duration && !isNaN(video.duration)) {
      return video.duration;
    }
    return undefined;
  }
  
  /**
   * Fetch and parse M3U8 playlist
   */
  async fetchAndParseM3U8(url: string): Promise<void> {
    if (this.manifestUrls.has(url)) return;
    this.manifestUrls.add(url);
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      const variants = this.parseM3U8Variants(text, url);
      
      if (variants.length > 0) {
        const media: VideoInfo = {
          id: this.generateVideoId({ type: 'hls', url, pageUrl: window.location.href }),
          title: this.extractTitle(),
          url,
          type: 'm3u8',
          qualities: variants
        };
        
        this.sendToBackground({
          type: 'hls',
          url,
          qualities: variants,
          pageUrl: window.location.href
        });
      }
    } catch (e) {
      console.error('[MediaGrabber] Failed to fetch M3U8:', e);
    }
  }
  
  /**
   * Parse M3U8 variants from playlist text
   */
  private parseM3U8Variants(text: string, baseUrl: string): VideoQuality[] {
    const variants: VideoQuality[] = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // EXT-X-STREAM-INF contains quality info
      if (line.includes('EXT-X-STREAM-INF')) {
        const quality = this.parseStreamInfo(line);
        const playlistUrl = lines[i + 1]?.trim();
        
        if (playlistUrl && !playlistUrl.startsWith('#')) {
          variants.push({
            height: quality.height || 0,
            width: quality.width || 0,
            bitrate: quality.bandwidth || 0,
            url: this.resolveUrl(playlistUrl, baseUrl)
          });
          i++; // Skip next line (playlist URL)
        }
      }
    }
    
    return variants.sort((a, b) => b.height - a.height);
  }
  
  /**
   * Parse stream info from M3U8 line
   */
  private parseStreamInfo(line: string): { bandwidth?: number; width?: number; height?: number } {
    const result: { bandwidth?: number; width?: number; height?: number } = {};
    
    const bwMatch = line.match(/BANDWIDTH=(\d+)/);
    if (bwMatch) result.bandwidth = parseInt(bwMatch[1]);
    
    const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
    if (resMatch) {
      result.width = parseInt(resMatch[1]);
      result.height = parseInt(resMatch[2]);
    }
    
    return result;
  }
  
  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(playlistUrl: string, baseUrl: string): string {
    if (playlistUrl.startsWith('http')) return playlistUrl;
    if (playlistUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return `${url.origin}${playlistUrl}`;
    }
    // Relative path
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return base + playlistUrl;
  }
}

// Initialize when DOM is ready
new MediaDetector();
