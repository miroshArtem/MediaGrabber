// Popup Script

interface VideoQuality {
  height: number;
  url: string;
  size?: string;
}

interface VideoInfo {
  id: string;
  title: string;
  qualities: VideoQuality[];
  thumbnail?: string;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDetectedVideos();
});

async function loadDetectedVideos(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_DETECTED_VIDEOS' });
    
    const noVideoEl = document.getElementById('no-video')!;
    const videoListEl = document.getElementById('video-list')!;
    
    if (!response.videos || response.videos.length === 0) {
      noVideoEl.classList.remove('hidden');
      videoListEl.classList.add('hidden');
      return;
    }
    
    noVideoEl.classList.add('hidden');
    videoListEl.classList.remove('hidden');
    
    renderVideoList(response.videos);
  } catch (error) {
    showError('Failed to load videos');
  }
}

function renderVideoList(videos: VideoInfo[]): void {
  const container = document.getElementById('videos')!;
  container.innerHTML = '';
  
  videos.forEach(video => {
    const videoEl = createVideoElement(video);
    container.appendChild(videoEl);
  });
}

function createVideoElement(video: VideoInfo): HTMLElement {
  const div = document.createElement('div');
  div.className = 'video-item';
  div.innerHTML = `
    <div class="video-title">${video.title}</div>
    <div class="quality-list">
      ${video.qualities.map(q => `
        <button class="quality-btn" data-url="${q.url}">
          ${q.height}p
        </button>
      `).join('')}
    </div>
  `;
  
  div.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = (btn as HTMLElement).dataset.url;
      if (url) downloadVideo(url);
    });
  });
  
  return div;
}

async function downloadVideo(url: string): Promise<void> {
  showProgress();
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_REQUEST',
      url
    });
    
    if (response.success) {
      pollProgress(response.downloadId);
    } else {
      showError(response.error || 'Download failed');
    }
  } catch (error) {
    showError('Failed to start download');
  }
}

async function pollProgress(downloadId: string): Promise<void> {
  const interval = setInterval(async () => {
    const progress = await chrome.runtime.sendMessage({
      type: 'GET_DOWNLOAD_PROGRESS',
      downloadId
    });
    
    updateProgressUI(progress);
    
    if (progress.complete) {
      clearInterval(interval);
    }
  }, 1000);
}

function showProgress(): void {
  document.getElementById('video-list')!.classList.add('hidden');
  document.getElementById('no-video')!.classList.add('hidden');
  document.getElementById('download-progress')!.classList.remove('hidden');
}

function updateProgressUI(progress: { percent: number }): void {
  const fill = document.getElementById('progress-fill')!;
  const text = document.getElementById('progress-text')!;
  
  fill.style.width = `${progress.percent}%`;
  text.textContent = `${Math.round(progress.percent)}%`;
}

function showError(message: string): void {
  const errorEl = document.getElementById('error')!;
  const errorMsgEl = document.getElementById('error-message')!;
  
  errorMsgEl.textContent = message;
  errorEl.classList.remove('hidden');
}
