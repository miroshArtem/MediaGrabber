// Native Messaging Client
// Handles communication with CoApp via native messaging protocol

import { NativeMessage, DownloadRequest, DownloadResponse } from './types';

export class NativeClient {
  private port: chrome.runtime.Port | null = null;
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port = chrome.runtime.connectNative('com.mediagrabber.app');
      
      this.port.onMessage.addListener((message: any) => {
        console.log('[NativeClient] Received:', message);
      });
      
      this.port.onDisconnect.addListener(() => {
        console.log('[NativeClient] Disconnected');
        this.port = null;
      });
      
      // Resolve after a short delay to allow connection
      setTimeout(resolve, 100);
    });
  }
  
  async sendMessage(message: NativeMessage): Promise<any> {
    if (!this.port) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Not connected to native app'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Native messaging timeout'));
      }, 30000);
      
      const listener = (response: any) => {
        clearTimeout(timeout);
        this.port!.onMessage.removeListener(listener);
        resolve(response);
      };
      
      this.port.onMessage.addListener(listener);
      this.port.postMessage(message);
    });
  }
  
  async sendDownloadRequest(request: DownloadRequest): Promise<DownloadResponse> {
    return this.sendMessage({
      type: 'download',
      payload: request
    });
  }
  
  async getProgress(downloadId: string): Promise<any> {
    return this.sendMessage({
      type: 'get_progress',
      payload: { downloadId }
    });
  }
  
  async cancelDownload(downloadId: string): Promise<void> {
    await this.sendMessage({
      type: 'cancel',
      payload: { downloadId }
    });
  }
}
