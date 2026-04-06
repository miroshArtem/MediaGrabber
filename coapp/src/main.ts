// MediaGrabber CoApp - Main Entry Point
// Native companion app for handling downloads and FFmpeg operations

import * as fs from 'fs';
import * as path from 'path';
import { NativeMessagingHost } from './native-messaging';
import { DownloadManager } from './downloads';
import { FileOperations } from './file';
import { RpcProtocol } from './rpc';
import { FFmpegConverter } from './converter';

class MediaGrabberApp {
  private nativeHost: NativeMessagingHost;
  private downloadManager: DownloadManager;
  private fileOps: FileOperations;
  private rpc: RpcProtocol;
  private ffmpeg: FFmpegConverter;
  
  constructor() {
    this.fileOps = new FileOperations();
    this.ffmpeg = new FFmpegConverter();
    this.downloadManager = new DownloadManager(this.ffmpeg);
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
    const ffmpegPath = this.ffmpeg.getPath();
    
    if (!fs.existsSync(ffmpegPath)) {
      console.warn('[MediaGrabber] FFmpeg not found at:', ffmpegPath);
      console.warn('[MediaGrabber] Downloads will fail until FFmpeg is installed');
    } else {
      console.log('[MediaGrabber] FFmpeg found at:', ffmpegPath);
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
