// FFmpeg Converter Wrapper
// Handles FFmpeg operations for HLS/DASH downloads and stream merging

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface FFmpegProgress {
  percent: number;
  outTimeMs: string;
  frame: number;
  fps: number;
  bitrate: string;
  totalSize: number;
  speed: string;
}

export interface FFmpegOptions {
  ffmpegPath?: string;
  progressTime?: number;
}

export interface FFmpegResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class FFmpegConverter {
  private ffmpegPath: string;
  private currentProcess: ChildProcess | null = null;
  
  constructor(options: FFmpegOptions = {}) {
    this.ffmpegPath = options.ffmpegPath || this.findFFmpeg();
  }
  
  /**
   * Download HLS stream and merge segments
   */
  async downloadHLS(options: {
    inputUrl: string;
    outputPath: string;
    quality?: string;
    format?: string;
    duration?: number;
    onProgress?: (progress: FFmpegProgress) => void;
  }): Promise<void> {
    const args = [
      '-i', options.inputUrl,
      '-c', 'copy',
      '-y',
      options.outputPath
    ];
    
    await this.convert(args, { duration: options.duration, onProgress: options.onProgress });
  }
  
  /**
   * Download DASH stream
   */
  async downloadDASH(options: {
    inputUrl: string;
    outputPath: string;
    quality?: string;
    format?: string;
    duration?: number;
    onProgress?: (progress: FFmpegProgress) => void;
  }): Promise<void> {
    const args = [
      '-i', options.inputUrl,
      '-c', 'copy',
      '-y',
      options.outputPath
    ];
    
    await this.convert(args, { duration: options.duration, onProgress: options.onProgress });
  }
  
  private findFFmpeg(): string {
    // Check bundled location
    const platform = process.platform;
    
    const paths = [
      // Development path
      path.join(__dirname, '..', 'ffmpeg', platform === 'win32' ? 'win' : platform, 'ffmpeg' + (platform === 'win32' ? '.exe' : '')),
      // Production path relative to executable
      path.join(process.cwd(), 'ffmpeg', 'ffmpeg' + (platform === 'win32' ? '.exe' : '')),
      // System PATH
      'ffmpeg'
    ];
    
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return 'ffmpeg'; // Fallback to system PATH
  }
  
  getPath(): string {
    return this.ffmpegPath;
  }
  
  async convert(
    args: string[],
    options: { progressTime?: number; duration?: number; onProgress?: (progress: FFmpegProgress) => void } = {}
  ): Promise<FFmpegResult> {
    const { progressTime = 1000, duration, onProgress } = options;
    
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-progress', 'pipe:1',
        '-hide_banner',
        ...args
      ];
      
      console.error('[FFmpeg] Command:', this.ffmpegPath, ffmpegArgs.join(' '));
      
      this.currentProcess = spawn(this.ffmpegPath, ffmpegArgs);
      
      let stdout = '';
      let stderr = '';
      let lastProgressTime = 0;
      
      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        stdout += text;
        
        // Parse progress from stdout (structured output)
        if (onProgress) {
          const progress = this.parseProgress(text);
          if (progress) {
            // Calculate percent if duration is known
            if (duration && progress.outTimeMs) {
              const currentSeconds = parseInt(progress.outTimeMs, 10) / 1000;
              progress.percent = (currentSeconds / duration) * 100;
            }
            const now = Date.now();
            if (now - lastProgressTime >= progressTime) {
              lastProgressTime = now;
              onProgress(progress);
            }
          }
        }
      });
      
      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        stderr += text;
        // Also try to parse progress from stderr for compatibility
        if (onProgress) {
          const progress = this.parseLegacyProgress(text);
          if (progress) {
            // Calculate percent if duration is known
            if (duration && progress.outTimeMs) {
              const currentSeconds = parseInt(progress.outTimeMs, 10) / 1000;
              progress.percent = (currentSeconds / duration) * 100;
            }
            const now = Date.now();
            if (now - lastProgressTime >= progressTime) {
              lastProgressTime = now;
              onProgress(progress);
            }
          }
        }
      });
      
      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        
        if (code === 0) {
          resolve({ exitCode: code || 0, stdout, stderr });
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });
      
      this.currentProcess.on('error', (err) => {
        this.currentProcess = null;
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });
  }
  
  private parseProgress(text: string): FFmpegProgress | null {
    const result: Record<string, string> = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    if (Object.keys(result).length === 0) {
      return null;
    }
    
    return {
      percent: 0,
      outTimeMs: result['out_time_ms'] || '0',
      frame: parseInt(result['frame'] || '0', 10),
      fps: parseFloat(result['fps'] || '0'),
      bitrate: result['bitrate'] || '',
      totalSize: parseInt(result['total_size'] || '0', 10),
      speed: result['speed'] || ''
    };
  }
  
  // Parse legacy stderr progress output (time=00:01:23.45 format)
  private parseLegacyProgress(text: string): FFmpegProgress | null {
    // Match time=00:01:23.45 format
    const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!timeMatch) return null;
    
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    const centiseconds = parseInt(timeMatch[4], 10);
    
    const outTimeMs = String((hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10);
    
    // Parse frame
    const frameMatch = text.match(/frame=\s*(\d+)/);
    const frame = frameMatch ? parseInt(frameMatch[1], 10) : 0;
    
    // Parse fps
    const fpsMatch = text.match(/fps=\s*([\d.]+)/);
    const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;
    
    // Parse bitrate
    const bitrateMatch = text.match(/bitrate=\s*([\d.]+[kmg]?\/s?)/);
    const bitrate = bitrateMatch ? bitrateMatch[1] : '';
    
    // Parse speed
    const speedMatch = text.match(/speed=\s*([\d.]+)x/);
    const speed = speedMatch ? speedMatch[1] + 'x' : '';
    
    // Parse total size
    const sizeMatch = text.match(/size=\s*(\d+)kB/);
    const totalSize = sizeMatch ? parseInt(sizeMatch[1], 10) * 1024 : 0;
    
    return { percent: 0, outTimeMs, frame, fps, bitrate, totalSize, speed };
  }
  
  /**
   * Merge video and audio streams into a single file
   */
  async mergeStreams(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    options: {
      reencode?: boolean;
      videoCodec?: string;
      audioCodec?: string;
      duration?: number;
      onProgress?: (progress: FFmpegProgress) => void;
    } = {}
  ): Promise<void> {
    const args: string[] = [];
    
    // Inputs
    args.push('-i', videoPath);
    args.push('-i', audioPath);
    
    // Codec settings
    if (options.reencode) {
      args.push('-c:v', options.videoCodec || 'libx264');
      args.push('-c:a', options.audioCodec || 'aac');
    } else {
      args.push('-c', 'copy');
    }
    
    // Stream selection
    args.push('-map', '0:v:0');
    args.push('-map', '1:a:0');
    
    args.push('-y');
    args.push(outputPath);
    
    await this.convert(args, { duration: options.duration, onProgress: options.onProgress });
  }
  
  /**
   * Probe media file to get stream information
   */
  async probe(filePath: string): Promise<any> {
    const ffprobePath = this.ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];
    
    return new Promise((resolve, reject) => {
      const proc = spawn(ffprobePath, args);
      let stdout = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            reject(new Error('Failed to parse ffprobe output'));
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}`));
        }
      });
      
      proc.on('error', (err) => {
        reject(new Error(`ffprobe error: ${err.message}`));
      });
    });
  }
  
  abort(): void {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
      this.currentProcess = null;
    }
  }
  
  isRunning(): boolean {
    return this.currentProcess !== null;
  }
}

// Export a singleton instance for convenience
export const ffmpeg = new FFmpegConverter();