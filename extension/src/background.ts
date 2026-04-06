// MediaGrabber Service Worker (Background Script)
// Manifest V3 uses Service Workers instead of persistent background pages

import { NativeClient } from './lib/native-client';
import { VideoInfo } from './lib/types';

// Media storage by tabId
const mediaByTab = new Map<number, VideoInfo[]>();

// Native messaging client
const nativeClient = new NativeClient();

// CoApp connection state
let coappConnected = false;

// Popup connections
const popupPorts = new Set<chrome.runtime.Port>();

// Connect to CoApp on startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[MediaGrabber] Extension installed');
  connectCoApp();
});

// Service worker lifecycle - keep alive for native messaging
chrome.runtime.onStartup.addListener(() => {
  console.log('[MediaGrabber] Service worker starting');
  connectCoApp();
});

/**
 * Connect to CoApp via native messaging
 */
function connectCoApp(): void {
  nativeClient.connect()
    .then(() => {
      coappConnected = true;
      console.log('[MediaGrabber] Connected to CoApp');
    })
    .catch((err) => {
      coappConnected = false;
      console.error('[MediaGrabber] Failed to connect to CoApp:', err);
      // Reconnect after delay
      setTimeout(connectCoApp, 5000);
    });
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // Keep channel open for async response
});

/**
 * Handle popup connections via chrome.runtime.onConnect
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPorts.add(port);
    
    port.onMessage.addListener((msg) => {
      handlePopupMessage(port, msg);
    });
    
    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
      console.log('[MediaGrabber] Popup disconnected');
    });
    
    // Send current media for active tab when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const videos = mediaByTab.get(tabs[0].id) || [];
        port.postMessage({ type: 'MEDIA_LIST', videos });
      }
    });
  }
});

/**
 * Handle messages from popup
 */
function handlePopupMessage(port: chrome.runtime.Port, msg: any): void {
  switch (msg.type) {
    case 'GET_MEDIA':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          const videos = mediaByTab.get(tabs[0].id) || [];
          port.postMessage({ type: 'MEDIA_LIST', videos });
        }
      });
      break;
    
    case 'DOWNLOAD':
      startDownload(msg.video, msg.filename)
        .then(result => port.postMessage({ type: 'DOWNLOAD_STARTED', ...result }))
        .catch(err => port.postMessage({ type: 'ERROR', message: err.message }));
      break;
    
    case 'CANCEL_DOWNLOAD':
      handleCancelDownload(msg.downloadId)
        .then(result => port.postMessage({ type: 'DOWNLOAD_CANCELLED', ...result }))
        .catch(err => port.postMessage({ type: 'ERROR', message: err.message }));
      break;
  }
}

/**
 * Notify all popups when new media is detected
 */
function notifyPopups(tabId: number): void {
  const videos = mediaByTab.get(tabId);
  if (videos) {
    popupPorts.forEach(port => {
      port.postMessage({ type: 'MEDIA_LIST', videos });
    });
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'VIDEO_DETECTED':
      return handleVideoDetected(sender.tab?.id, message.video);
    
    case 'GET_VIDEOS':
      return getVideosForTab(message.tabId);
    
    case 'DOWNLOAD_REQUEST':
      return handleDownloadRequest(message);
    
    case 'GET_DOWNLOAD_PROGRESS':
      return handleGetProgress(message.downloadId);
    
    case 'CANCEL_DOWNLOAD':
      return handleCancelDownload(message.downloadId);
    
    case 'PING':
      return { success: true, timestamp: Date.now() };
    
    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Handle video detection from content script
 */
function handleVideoDetected(tabId: number | undefined, video: VideoInfo): any {
  if (tabId === undefined) {
    return { error: 'No tabId' };
  }
  
  // Get or create video list for tab
  const videos = mediaByTab.get(tabId) || [];
  
  // Check if video already exists
  const existingIndex = videos.findIndex(v => v.url === video.url);
  if (existingIndex >= 0) {
    videos[existingIndex] = video;
  } else {
    videos.push(video);
  }
  
  mediaByTab.set(tabId, videos);
  
  // Update badge to show count
  chrome.action.setBadgeText({ tabId, text: String(videos.length) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' });
  
  console.log(`[MediaGrabber] Detected video on tab ${tabId}:`, video.title);
  
  // Notify popups of new media
  notifyPopups(tabId);
  
  return { success: true, count: videos.length };
}

/**
 * Get videos for a specific tab
 */
function getVideosForTab(tabId: number): any {
  const videos = mediaByTab.get(tabId) || [];
  return { videos };
}

/**
 * Handle download request
 */
async function handleDownloadRequest(request: { url: string; quality?: string; filename?: string }): Promise<any> {
  if (!coappConnected) {
    // Try to reconnect
    await nativeClient.connect();
    if (!coappConnected) {
      return { error: 'CoApp not connected' };
    }
  }
  
  try {
    const response = await nativeClient.sendDownloadRequest({
      url: request.url,
      quality: request.quality,
      format: 'mp4',
      filename: request.filename
    });
    
    return response;
  } catch (err) {
    return { error: `Download failed: ${err.message}` };
  }
}

/**
 * Start a download
 */
async function startDownload(video: VideoInfo, filename?: string): Promise<any> {
  if (!coappConnected) {
    await nativeClient.connect();
    if (!coappConnected) {
      throw new Error('CoApp not connected');
    }
  }

  // Set up progress notifications before starting download
  nativeClient.onNotify('convertOutput', (progressTime: number, currentSeconds: number, info: any) => {
    // Send progress to popup
    popupPorts.forEach(port => {
      port.postMessage({
        type: 'DOWNLOAD_PROGRESS',
        progress: {
          timeMs: progressTime,
          currentSeconds,
          percent: video.duration ? (currentSeconds / video.duration) * 100 : 0,
          ...info
        }
      });
    });
  });

  nativeClient.onNotify('downloadComplete', (downloadId: string, outputPath: string) => {
    popupPorts.forEach(port => {
      port.postMessage({
        type: 'DOWNLOAD_COMPLETE',
        downloadId,
        outputPath
      });
    });
  });

  nativeClient.onNotify('downloadError', (downloadId: string, error: string) => {
    popupPorts.forEach(port => {
      port.postMessage({
        type: 'DOWNLOAD_ERROR',
        downloadId,
        error
      });
    });
  });
  
  return nativeClient.sendDownloadRequest({
    url: video.url,
    quality: video.qualities?.[0]?.height?.toString(),
    format: 'mp4',
    filename: filename || `${video.title || 'video'}.mp4`
  });
}

/**
 * Get download progress
 */
async function handleGetProgress(downloadId: string): Promise<any> {
  try {
    const progress = await nativeClient.getProgress(downloadId);
    return progress;
  } catch (err) {
    return { error: `Failed to get progress: ${err.message}` };
  }
}

/**
 * Cancel an active download
 */
async function handleCancelDownload(downloadId: string): Promise<any> {
  try {
    await nativeClient.cancelDownload(downloadId);
    return { success: true };
  } catch (err) {
    return { error: `Failed to cancel: ${err.message}` };
  }
}

// Periodic ping to keep service worker alive
setInterval(() => {
  if (coappConnected) {
    chrome.runtime.sendMessage({ type: 'PING' })
      .catch(() => {
        // Service worker might be terminated, try to reconnect
        coappConnected = false;
        connectCoApp();
      });
  }
}, 25000); // Every 25 seconds
