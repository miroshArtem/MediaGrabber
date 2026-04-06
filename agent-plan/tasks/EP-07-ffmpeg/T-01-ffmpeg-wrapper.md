# T-01 — FFmpeg Wrapper

**Epic**: EP-07 (FFmpeg Integration)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 22:35

---

## Goal

Implement FFmpeg wrapper class that handles spawning ffmpeg processes and parsing output.

---

## Subtasks

- [ ] Create FFmpeg wrapper class
- [ ] Implement process spawning with args
- [ ] Implement stdout/stderr handling
- [ ] Implement progress parsing from stdout
- [ ] Implement process termination (abort)
- [ ] Find bundled ffmpeg executable

---

## FFmpeg Wrapper

```typescript
// coapp/src/converter.ts

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface FFmpegOptions {
  ffmpegPath?: string;
  progressTime?: number;
}

interface FFmpegResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ProgressInfo {
  outTimeMs: string;
  frame: number;
  fps: number;
  bitrate: string;
  totalSize: number;
  speed: string;
}

export class FFmpegWrapper {
  private ffmpegPath: string;
  private currentProcess: ChildProcess | null = null;
  
  constructor(options: FFmpegOptions = {}) {
    this.ffmpegPath = options.ffmpegPath || this.findFFmpeg();
  }
  
  private findFFmpeg(): string {
    // Check bundled location
    const platform = process.platform;
    const arch = process.arch;
    
    const paths = [
      path.join(__dirname, '..', 'ffmpeg', platform === 'win32' ? 'win' : platform, 'ffmpeg' + (platform === 'win32' ? '.exe' : '')),
      path.join(process.cwd(), 'ffmpeg', 'ffmpeg' + (platform === 'win32' ? '.exe' : '')),
      'ffmpeg' // System PATH
    ];
    
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return 'ffmpeg'; // Fallback to system PATH
  }
  
  async convert(
    args: string[],
    options: { progressTime?: number; onProgress?: (progress: ProgressInfo) => void } = {}
  ): Promise<FFmpegResult> {
    const { progressTime = 1000, onProgress } = options;
    
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-progress', 'pipe:1',
        '-hide_banner',
        ...args
      ];
      
      console.error('FFmpeg command:', this.ffmpegPath, ffmpegArgs.join(' '));
      
      this.currentProcess = spawn(this.ffmpegPath, ffmpegArgs);
      
      let stdout = '';
      let stderr = '';
      let lastProgressTime = 0;
      
      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        stdout += text;
        
        // Parse progress
        if (onProgress) {
          const progress = this.parseProgress(text);
          if (progress) {
            const now = Date.now();
            if (now - lastProgressTime >= progressTime) {
              lastProgressTime = now;
              onProgress(progress);
            }
          }
        }
      });
      
      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
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
  
  private parseProgress(text: string): ProgressInfo | null {
    const result: any = {};
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
      outTimeMs: result.out_time_ms || '0',
      frame: parseInt(result.frame || '0'),
      fps: parseFloat(result.fps || '0'),
      bitrate: result.bitrate || '',
      totalSize: parseInt(result.total_size || '0'),
      speed: result.speed || ''
    };
  }
  
  abort(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }
}
```

---

## Tests

- [ ] FFmpeg path is resolved correctly
- [ ] Conversion completes successfully
- [ ] Progress is parsed from stdout
- [ ] Abort kills the process
- [ ] Errors are thrown on failure
