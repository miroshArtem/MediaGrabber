// Download Manager
// Manages active downloads and tracks progress

import * as fs from 'fs';
import * as path from 'path';
import { FFmpegConverter, FFmpegProgress } from './converter';

export interface Download {
  id: string;
  url: string;
  outputPath: string;
  status: 'pending' | 'downloading' | 'complete' | 'failed' | 'cancelled';
  progress: FFmpegProgress;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface DownloadOptions {
  url: string;
  outputDir: string;
  filename?: string;
  quality?: string;
  format?: 'mp4' | 'webm' | 'mkv';
}

export class DownloadManager {
  private downloads: Map<string, Download>;
  private ffmpeg: FFmpegConverter;
  private activeProcesses: Map<string, any>;
  
  constructor(ffmpeg: FFmpegConverter) {
    this.downloads = new Map();
    this.ffmpeg = ffmpeg;
    this.activeProcesses = new Map();
  }
  
  /**
   * Start a new download
   */
  async startDownload(options: DownloadOptions): Promise<string> {
    const downloadId = this.generateId();
    
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    // Determine output filename
    const filename = options.filename || this.generateFilename(options.url, options.format);
    const outputPath = path.join(options.outputDir, filename);
    
    const download: Download = {
      id: downloadId,
      url: options.url,
      outputPath,
      status: 'pending',
      progress: { percent: 0, outTimeMs: '0', frame: 0, fps: 0, bitrate: '', totalSize: 0, speed: '' },
      startedAt: new Date()
    };
    
    this.downloads.set(downloadId, download);
    
    // Start download asynchronously
    this.executeDownload(downloadId, options).catch(err => {
      this.updateDownloadStatus(downloadId, 'failed', undefined, err.message);
    });
    
    return downloadId;
  }
  
  /**
   * Cancel an active download
   */
  cancelDownload(downloadId: string): void {
    const process = this.activeProcesses.get(downloadId);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(downloadId);
      this.updateDownloadStatus(downloadId, 'cancelled');
    }
  }
  
  /**
   * Get download status
   */
  getDownload(downloadId: string): Download | undefined {
    return this.downloads.get(downloadId);
  }
  
  /**
   * Get all downloads
   */
  getAllDownloads(): Download[] {
    return Array.from(this.downloads.values());
  }
  
  /**
   * Remove a completed download from tracking
   */
  removeDownload(downloadId: string): void {
    this.downloads.delete(downloadId);
  }
  
  private async executeDownload(downloadId: string, options: DownloadOptions): Promise<void> {
    this.updateDownloadStatus(downloadId, 'downloading');
    
    try {
      const isHLS = options.url.includes('.m3u8');
      const isDASH = options.url.includes('.mpd');
      
      if (isHLS) {
        await this.ffmpeg.downloadHLS({
          inputUrl: options.url,
          outputPath: this.downloads.get(downloadId)!.outputPath,
          quality: options.quality,
          format: options.format,
          onProgress: (progress) => this.updateProgress(downloadId, progress)
        });
      } else if (isDASH) {
        await this.ffmpeg.downloadDASH({
          inputUrl: options.url,
          outputPath: this.downloads.get(downloadId)!.outputPath,
          quality: options.quality,
          format: options.format,
          onProgress: (progress) => this.updateProgress(downloadId, progress)
        });
      } else {
        // Direct file download
        await this.downloadDirect(options);
      }
      
      this.updateDownloadStatus(downloadId, 'complete');
    } catch (error) {
      this.updateDownloadStatus(downloadId, 'failed', undefined, error.message);
    }
  }
  
  private async downloadDirect(options: DownloadOptions): Promise<void> {
    // Use fetch to download direct files
    const https = require('https');
    const http = require('http');
    const urlModule = require('url');
    
    const download = Array.from(this.downloads.values()).find(d => d.url === options.url);
    if (!download) return;
    
    const urlParsed = urlModule.parse(options.url);
    const client = urlParsed.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(download.outputPath);
      
      client.get(options.url, (response: any) => {
        const total = parseInt(response.headers['content-length'] || '0');
        let downloaded = 0;
        
        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const percent = total > 0 ? (downloaded / total) * 100 : 0;
          this.updateProgress(download.id, { percent, time: 0 });
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err: Error) => {
        fs.unlink(download.outputPath, () => {});
        reject(err);
      });
    });
  }
  
  private updateProgress(downloadId: string, progress: FFmpegProgress): void {
    const download = this.downloads.get(downloadId);
    if (download) {
      download.progress = progress;
    }
  }
  
  private updateDownloadStatus(
    downloadId: string,
    status: Download['status'],
    progress?: FFmpegProgress,
    error?: string
  ): void {
    const download = this.downloads.get(downloadId);
    if (download) {
      download.status = status;
      if (progress) download.progress = progress;
      if (error) download.error = error;
      if (status === 'complete') download.completedAt = new Date();
    }
  }
  
  private generateId(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateFilename(url: string, format?: string): string {
    const ext = format || 'mp4';
    const timestamp = Date.now();
    return `video_${timestamp}.${ext}`;
  }
}
