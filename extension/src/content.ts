// MediaGrabber Content Script
// Runs on every page to detect video streams

import { VideoInfo, VideoQuality } from './lib/types';

interface DetectedMedia {
  type: 'hls' | 'dash' | 'mp4' | 'webm' | 'direct' | 'mse';
  url: string;
  qualities?: VideoQuality[];
  pageUrl: string;
}

class MediaDetector {
  private mediaUrls = new Set<string>();
  private manifestUrls = new Set<string>();
  private detectedVideos: VideoInfo[] = [];
  private lastMetadataKey = '';
  private metadataTimer: number | undefined;
  private mseState: { blobUrl?: string; mimeType?: string; codecs?: string; totalBytes: number; segmentUrls: string[]; initSegmentUrl?: string; duration?: number } = {
    totalBytes: 0,
    segmentUrls: []
  };

  constructor() {
    this.setupMSEListener();
    this.setupDOMObserver();
    this.scanExistingMedia();
    this.scheduleMetadataSend();

    document.addEventListener('DOMContentLoaded', () => this.sendPageMetadata(), { once: true });
    window.addEventListener('load', () => this.sendPageMetadata(), { once: true });
  }

  private setupMSEListener(): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || event.data.source !== 'MediaGrabber-MSE') return;

      const msg = event.data;
      switch (msg.type) {
        case 'source-buffer':
          this.mseState.blobUrl = msg.blobUrl;
          this.mseState.mimeType = msg.mimeType;
          this.mseState.codecs = msg.codecs;
          this.sendMSEToBackground();
          break;

        case 'segment-url':
          if (msg.isInit && !this.mseState.initSegmentUrl) {
            this.mseState.initSegmentUrl = msg.url;
          }
          if (this.mseState.segmentUrls.length < 500 && !this.mseState.segmentUrls.includes(msg.url)) {
            this.mseState.segmentUrls.push(msg.url);
          }
          if (this.mseState.segmentUrls.length === 1 || this.mseState.segmentUrls.length % 20 === 0) {
            this.sendMSEToBackground();
          }
          break;

        case 'duration':
          this.mseState.duration = msg.duration;
          this.sendMSEToBackground();
          break;

        case 'progress':
          this.mseState.totalBytes = msg.totalBytes;
          break;
      }
    });
  }

  private sendMSEToBackground(): void {
    if (!this.mseState.mimeType) return;
    const url = this.mseState.initSegmentUrl || this.mseState.blobUrl || '';
    if (!url) return;

    const codec = this.mseState.codecs || '';
    const isAudioOnly = this.mseState.mimeType.startsWith('audio/');

    const qualities: VideoQuality[] = [{
      height: 0,
      url,
      bitrate: 0,
      label: isAudioOnly ? 'Audio' : (codec ? codec.split(',')[0] : 'MSE Stream'),
      kind: isAudioOnly ? 'audio' : 'video'
    }];

    if (this.mseState.segmentUrls.length > 0 && this.mseState.initSegmentUrl) {
      qualities.push({
        height: 0,
        url: this.mseState.initSegmentUrl,
        bitrate: 0,
        label: 'All Segments',
        kind: 'video',
        formatArgs: ['-i', this.mseState.initSegmentUrl, ...this.mseState.segmentUrls.slice(1, 200).flatMap(u => ['-i', u]), '-c', 'copy']
      });
    }

    const media: DetectedMedia = {
      type: 'mse',
      url,
      qualities,
      pageUrl: window.location.href
    };

    try {
      chrome.runtime.sendMessage(
        { type: 'VIDEO_DETECTED', video: { ...media, id: `mse_${Date.now()}`, title: document.title || 'MSE Stream' } },
        () => { void chrome.runtime.lastError; }
      );
    } catch {
      // Extension context invalidated
    }
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

      this.scheduleMetadataSend();
    });

    const startObserving = () => {
      const target = document.body || document.documentElement;
      if (!target) {
        return;
      }

      observer.observe(target, { childList: true, subtree: true });
    };

    if (document.body || document.documentElement) {
      startObserving();
    } else {
      document.addEventListener('DOMContentLoaded', startObserving, { once: true });
    }
  }

  /**
   * Scan for existing media elements on page load
   */
  private scanExistingMedia(): void {
    if (!document.body && !document.documentElement) {
      document.addEventListener('DOMContentLoaded', () => this.scanExistingMedia(), { once: true });
      return;
    }

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
      this.sendPageMetadata();
    });
  }

  private scheduleMetadataSend(): void {
    if (this.metadataTimer !== undefined) return;
    this.metadataTimer = window.setTimeout(() => {
      this.metadataTimer = undefined;
      this.sendPageMetadata();
    }, 250);
  }

  private sendPageMetadata(): void {
    const metadata = {
      title: this.extractTitle(),
      thumbnail: this.extractThumbnail(),
      duration: this.getVideoDuration(),
      pageUrl: window.location.href
    };
    const key = JSON.stringify(metadata);
    if (key === this.lastMetadataKey) return;
    this.lastMetadataKey = key;

    try {
      chrome.runtime.sendMessage({ type: 'PAGE_METADATA', metadata }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension context invalidated (extension was reloaded)
    }
  }

  /**
   * Check if URL is a media URL
   */
  private isMediaUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const path = parsed.pathname.toLowerCase();
      return path.endsWith('.m3u8') || path.includes('.m3u8') ||
             path.endsWith('.mpd') || path.includes('.mpd') ||
             path.endsWith('.mp4') || path.endsWith('.webm');
    } catch {
      return false;
    }
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
    try {
      const path = new URL(url, window.location.href).pathname.toLowerCase();
      if (path.includes('.m3u8')) return 'hls';
      if (path.includes('.mpd')) return 'dash';
      if (path.endsWith('.mp4')) return 'mp4';
      if (path.endsWith('.webm')) return 'webm';
    } catch { /* ignore */ }
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
          duration: this.getVideoDuration(),
          thumbnail: this.extractThumbnail()
        }
      }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension context invalidated (extension was reloaded)
    }
  }

  /**
   * Generate a unique ID for a video
   */
  private generateVideoId(media: DetectedMedia): string {
    try {
      return `video_${btoa(encodeURIComponent(media.url)).substring(0, 20)}_${Date.now()}`;
    } catch {
      return `video_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    }
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
   * Extract thumbnail URL using cascading fallback (VDH-style):
   * 1. og:image meta tag
   * 2. twitter:image meta tag
   * 3. <video poster> attribute
   * 4. DOM scraping: img[class*=poster/preview/thumb]
   */
  private extractThumbnail(): string | undefined {
    const metaSelectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'meta[itemprop="thumbnailUrl"]',
      'meta[itemprop="image"]'
    ];

    for (const selector of metaSelectors) {
      const image = this.normalizeImageUrl(document.querySelector(selector)?.getAttribute('content'));
      if (image) return image;
    }

    const video = document.querySelector('video[poster]');
    if (video) {
      const poster = this.normalizeImageUrl(video.getAttribute('poster'));
      if (poster) return poster;
    }

    const posterImg = document.querySelector('img[class*="poster" i], img[class*="preview" i], img[class*="thumb" i], img[alt*="poster" i], img[alt*="постер" i]');
    if (posterImg instanceof HTMLImageElement) {
      const src = this.normalizeImageUrl(posterImg.currentSrc || posterImg.getAttribute('src') || posterImg.getAttribute('data-src') || posterImg.getAttribute('data-original'));
      if (src) return src;
    }

    return undefined;
  }

  private normalizeImageUrl(url: string | null | undefined): string | undefined {
    const value = url?.trim();
    if (!value || value.startsWith('data:image/gif')) return undefined;
    return this.resolveUrl(value, window.location.href);
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
          type: 'hls',
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
    try {
      return new URL(playlistUrl, baseUrl).href;
    } catch {
      return playlistUrl;
    }
  }
}

// Initialize when DOM is ready
new MediaDetector();
