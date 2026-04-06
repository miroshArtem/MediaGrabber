// MediaGrabber CoApp - Main Entry Point
// Native companion app for handling downloads and FFmpeg operations

import * as fs from 'fs';
import * as path from 'path';
import { NativeMessagingHost } from './native-messaging';
import { DownloadManager } from './downloads';
import { FileOperations } from './file';
import { RpcProtocol } from './rpc';

class MediaGrabberApp {
  private nativeHost: NativeMessagingHost;
  private downloadManager: DownloadManager;
  private fileOps: FileOperations;
  private rpc: RpcProtocol;
  
  constructor() {
    this.fileOps = new FileOperations();
    this.downloadManager = new DownloadManager(this.fileOps);
    this.rpc = new RpcProtocol();
    this.nativeHost = new NativeMessagingHost(this.rpc);
  }
  
  async start(): Promise<void> {
    console.log('[MediaGrabber CoApp] Starting...');
    
    // Initialize FFmpeg
    await this.checkFfmpeg();
    
    // Start native messaging host
    await this.nativeHost.start();
    
    console.log('[MediaGrabber CoApp] Ready');
  }
  
  private async checkFfmpeg(): Promise<void> {
    const ffmpegPath = this.getFfmpegPath();
    
    if (!fs.existsSync(ffmpegPath)) {
      console.warn('[MediaGrabber] FFmpeg not found at:', ffmpegPath);
      console.warn('[MediaGrabber] Downloads will fail until FFmpeg is installed');
    } else {
      console.log('[MediaGrabber] FFmpeg found at:', ffmpegPath);
    }
  }
  
  private getFfmpegPath(): string {
    const platform = process.platform;
    const baseDir = path.dirname(process.execPath);
    
    if (platform === 'win32') {
      return path.join(baseDir, 'ffmpeg', 'win', 'ffmpeg.exe');
    } else if (platform === 'darwin') {
      return path.join(baseDir, 'ffmpeg', 'mac', 'ffmpeg');
    } else {
      return path.join(baseDir, 'ffmpeg', 'linux', 'ffmpeg');
    }
  }
}

// Start the app
const app = new MediaGrabberApp();
app.start().catch(console.error);

// Handle process termination
process.on('SIGINT', () => {
  console.log('[MediaGrabber CoApp] Shutting down...');
  process.exit(0);
});
