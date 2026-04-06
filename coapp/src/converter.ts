// FFmpeg Converter Wrapper
// Handles FFmpeg operations for HLS/DASH downloads and stream merging

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface FFmpegProgress {
  percent: number;
  time: number;
  speed?: number;
}

export interface FFmpegOptions {
  inputUrl: string;
  outputPath: string;
  quality?: string; // 'best', 'high', 'medium', 'low', or specific height like '1080'
  format?: 'mp4' | 'webm' | 'mkv';
  onProgress?: (progress: FFmpegProgress) => void;
}

export class FFmpegConverter {
  private ffmpegPath: string;
  
  constructor() {
    this.ffmpegPath = this.findFfmpeg();
  }
  
  private findFfmpeg(): string {
    // Check bundled FFmpeg first
    const platform = process.platform;
    const baseDir = path.dirname(process.execPath);
    
    let bundledPath: string;
    if (platform === 'win32') {
      bundledPath = path.join(baseDir, '..', 'ffmpeg', 'win', 'ffmpeg.exe');
    } else if (platform === 'darwin') {
      bundledPath = path.join(baseDir, '..', 'ffmpeg', 'mac', 'ffmpeg');
    } else {
      bundledPath = path.join(baseDir, '..', 'ffmpeg', 'linux', 'ffmpeg');
    }
    
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
    
    // Fall back to system FFmpeg
    return 'ffmpeg';
  }
  
  /**
   * Download HLS stream and merge segments
   */
  async downloadHLS(options: FFmpegOptions): Promise<void> {
    const args = this.buildHLSArgs(options);
    return this.runFFmpeg(args, options);
  }
  
  /**
   * Download DASH stream
   */
  async downloadDASH(options: FFmpegOptions): Promise<void> {
    const args = this.buildDASHArgs(options);
    return this.runFFmpeg(args, options);
  }
  
  /**
   * Merge video and audio tracks
   */
  async mergeStreams(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-y',
      outputPath
    ];
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg merge failed: ${stderr}`));
        }
      });
    });
  }
  
  private buildHLSArgs(options: FFmpegOptions): string[] {
    const args = [
      '-i', options.inputUrl,
      '-c', 'copy',
      '-y'
    ];
    
    if (options.format) {
      args.push('-f', options.format);
    }
    
    args.push(options.outputPath);
    return args;
  }
  
  private buildDASHArgs(options: FFmpegOptions): string[] {
    const args = [
      '-i', options.inputUrl,
      '-c', 'copy',
      '-y'
    ];
    
    if (options.format) {
      args.push('-f', options.format);
    }
    
    args.push(options.outputPath);
    return args;
  }
  
  private runFFmpeg(args: string[], options: FFmpegOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        
        // Parse progress from stderr
        if (options.onProgress) {
          const progress = this.parseProgress(stderr);
          if (progress) {
            options.onProgress(progress);
          }
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });
  }
  
  private parseProgress(stderr: string): FFmpegProgress | null {
    // Parse time=00:01:23.45 format
    const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!timeMatch) return null;
    
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = parseInt(timeMatch[3]);
    const centiseconds = parseInt(timeMatch[4]);
    
    const time = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    
    // Parse speed
    const speedMatch = stderr.match(/speed=\s*([\d.]+)x/);
    const speed = speedMatch ? parseFloat(speedMatch[1]) : undefined;
    
    return { percent: 0, time, speed };
  }
  
  /**
   * Get FFmpeg version
   */
  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, ['-version']);
      let output = '';
      
      ffmpeg.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const match = output.match(/ffmpeg version ([^\s]+)/);
          resolve(match ? match[1] : 'unknown');
        } else {
          reject(new Error('Failed to get FFmpeg version'));
        }
      });
    });
  }
}
