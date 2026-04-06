// MediaGrabber Service Worker (Background Script)
// Manifest V3 uses Service Workers instead of persistent background pages

import { NativeClient } from './lib/native-client';

const nativeClient = new NativeClient();

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // async response
});

async function handleMessage(message: any): Promise<any> {
  switch (message.type) {
    case 'VIDEO_DETECTED':
      return { success: true, videoId: message.videoId };
    case 'DOWNLOAD_REQUEST':
      return await nativeClient.sendDownloadRequest(message);
    case 'GET_DOWNLOAD_PROGRESS':
      return await nativeClient.getProgress(message.downloadId);
    default:
      return { error: 'Unknown message type' };
  }
}

// Keep service worker alive for native messaging
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'native-messaging') {
    port.onDisconnect.addListener(() => {
      console.log('Native messaging port disconnected');
    });
  }
});
