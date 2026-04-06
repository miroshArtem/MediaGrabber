// Popup Script

interface VideoQuality {
  height: number;
  width: number;
  bitrate: number;
  url: string;
}

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  type: 'm3u8' | 'mpd' | 'direct';
  qualities: VideoQuality[];
  thumbnail?: string;
  duration?: number;
}

let port: chrome.runtime.Port;

// Connect to background script
function initPopup(): void {
  port = chrome.runtime.connect({ name: 'popup' });
  
  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'MEDIA_LIST':
        renderVideoList(msg.videos);
        break;
      case 'DOWNLOAD_STARTED':
        if (msg.success) {
          showDownloadStarted(msg.downloadId);
        } else {
          showError(msg.error || 'Download failed');
        }
        break;
      case 'ERROR':
        showError(msg.message);
        break;
    }
  });
  
  port.onDisconnect.addListener(() => {
    console.log('[Popup] Disconnected from background');
    port = null;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initPopup();
  setupEventListeners();
});

function setupEventListeners(): void {
  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    requestMediaList();
  });
}

function requestMediaList(): void {
  if (port) {
    port.postMessage({ type: 'GET_MEDIA' });
  }
}

function renderVideoList(videos: VideoInfo[]): void {
  const noVideoEl = document.getElementById('no-video')!;
  const videoListEl = document.getElementById('video-list')!;
  const container = document.getElementById('videos')!;
  
  if (!videos || videos.length === 0) {
    noVideoEl.classList.remove('hidden');
    videoListEl.classList.add('hidden');
    return;
  }
  
  noVideoEl.classList.add('hidden');
  videoListEl.classList.remove('hidden');
  
  container.innerHTML = '';
  
  videos.forEach(video => {
    const videoEl = createVideoElement(video);
    container.appendChild(videoEl);
  });
}

function createVideoElement(video: VideoInfo): HTMLElement {
  const div = document.createElement('div');
  div.className = 'video-item';
  
  const qualityButtons = video.qualities && video.qualities.length > 0
    ? video.qualities.map(q => `
        <button class="quality-btn" data-url="${q.url}" data-height="${q.height}">
          ${q.height}p
        </button>
      `).join('')
    : `<button class="quality-btn" data-url="${video.url}" data-height="auto">
        Direct
      </button>`;
  
  div.innerHTML = `
    <div class="video-title">${escapeHtml(video.title || 'Unknown Video')}</div>
    <div class="video-type">${getTypeLabel(video.type)}</div>
    <div class="quality-list">
      ${qualityButtons}
    </div>
  `;
  
  div.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = (btn as HTMLElement).dataset.url;
      const height = (btn as HTMLElement).dataset.height;
      if (url) startDownload(video, url, height);
    });
  });
  
  return div;
}

function startDownload(video: VideoInfo, url: string, height?: string): void {
  showProgress();
  
  if (port) {
    port.postMessage({
      type: 'DOWNLOAD',
      video: {
        ...video,
        url: url
      },
      filename: `${video.title || 'video'}_${height || 'auto'}.mp4`
    });
  }
}

function showDownloadStarted(downloadId: string): void {
  const progressEl = document.getElementById('download-progress')!;
  const progressText = document.getElementById('progress-text')!;
  
  progressText.textContent = 'Download started...';
  
  // Start polling for progress
  pollProgress(downloadId);
}

async function pollProgress(downloadId: string): Promise<void> {
  const poll = async () => {
    if (!port) return;
    
    port.postMessage({ type: 'GET_PROGRESS', downloadId });
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Continue polling until download completes
    const progressEl = document.getElementById('download-progress');
    if (progressEl && !progressEl.classList.contains('hidden')) {
      setTimeout(poll, 1000);
    }
  };
  
  poll();
}

function showProgress(): void {
  document.getElementById('video-list')!.classList.add('hidden');
  document.getElementById('no-video')!.classList.add('hidden');
  document.getElementById('download-progress')!.classList.remove('hidden');
  document.getElementById('error')!.classList.add('hidden');
}

function showError(message: string): void {
  const errorEl = document.getElementById('error')!;
  const errorMsgEl = document.getElementById('error-message')!;
  
  errorMsgEl.textContent = message;
  errorEl.classList.remove('hidden');
  document.getElementById('download-progress')!.classList.add('hidden');
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'hls':
    case 'm3u8':
      return 'HLS Stream';
    case 'dash':
    case 'mpd':
      return 'DASH Stream';
    case 'mp4':
      return 'MP4 Video';
    case 'webm':
      return 'WebM Video';
    default:
      return 'Video';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
