// Popup Script
// Handles quality selection, download initiation, and progress display

import { loadSettings } from '../lib/settings';
import { initTheme } from '../lib/theme';

interface VideoQuality {
  height: number;
  width?: number;
  bitrate?: number;
  url: string;
  label?: string;
  formatArgs?: string[];
  formatId?: string;
  ext?: string;
  fps?: number;
  fileSize?: number;
}

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  type: 'm3u8' | 'mpd' | 'direct' | 'hls' | 'dash' | 'mp4' | 'webm' | 'ytdlp';
  qualities: VideoQuality[];
  thumbnail?: string;
  duration?: number;
  fileSize?: number;
}

interface QualityOption {
  label: string;
  bandwidth: number;
  bandwidthLabel: string;
  resolution?: string;
  url: string;
  height?: number;
  sizeLabel?: string;
  formatArgs?: string[];
  formatId?: string;
  ext?: string;
  fps?: number;
  fileSize?: number;
}

let port: chrome.runtime.Port;
let selectedVideo: VideoInfo | null = null;
let selectedQualityIndex = 0;
let currentQualities: QualityOption[] = [];
let activeTabId: number | null = null;
let currentDownloadId: string | null = null;

// Connect to background script
function initPopup(): void {
  port = chrome.runtime.connect({ name: 'popup' });
  
  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'MEDIA_LIST':
        renderMediaList(msg.videos);
        break;
      case 'DOWNLOAD_STARTED':
        if (msg.success) {
          showDownloadStarted(msg.downloadId);
        } else {
          showError(msg.error || 'Download failed');
        }
        break;
      case 'DOWNLOAD_PROGRESS':
        updateProgressUI(msg.progress || msg);
        break;
      case 'DOWNLOAD_COMPLETE':
        showDownloadComplete();
        break;
      case 'DOWNLOAD_ERROR':
        showError(msg.error || 'Download failed');
        break;
      case 'ACTIVE_DOWNLOAD':
        restoreDownloadUI(msg.downloadId, msg.filename, msg.progress);
        break;
      case 'NO_ACTIVE_DOWNLOAD':
        requestMediaList();
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
  initTheme();
  initPopup();
  setupEventListeners();
  initializePopupState();
});

async function initializePopupState(): Promise<void> {
  activeTabId = await getActiveTabId();
  if (port && activeTabId != null) {
    updateStatus('Checking for media…');
    port.postMessage({ type: 'GET_ACTIVE_DOWNLOAD', tabId: activeTabId });
  } else {
    requestMediaList();
  }
}

async function getActiveTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs[0]?.id ?? null);
    });
  });
}

function setupEventListeners(): void {
  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    requestMediaList();
  });
  
  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });
  
  // Download button
  document.getElementById('download-btn')?.addEventListener('click', () => {
    if (selectedVideo && currentQualities.length > 0) {
      const quality = currentQualities[selectedQualityIndex];
      startDownload(selectedVideo, quality);
    }
  });
  
  // Cancel button
  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    cancelDownload();
  });
  
  // Error dismiss button
  document.getElementById('error-dismiss')?.addEventListener('click', () => {
    hideError();
  });
}

function requestMediaList(): void {
  if (port) {
    port.postMessage({ type: 'GET_MEDIA', tabId: activeTabId });
    updateStatus('Checking for media…');
  }
}

function updateStatus(text: string, type: 'info' | 'error' | 'success' = 'info'): void {
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  if (statusBar && statusText) {
    statusBar.className = 'status-bar';
    if (type === 'error') statusBar.classList.add('error');
    if (type === 'success') statusBar.classList.add('success');
    statusText.textContent = text;
  }
}

/**
 * Render the list of detected media
 */
function renderMediaList(videos: VideoInfo[]): void {
  const emptyState = document.getElementById('empty-state')!;
  const videoList = document.getElementById('video-list')!;
  const mediaDetails = document.getElementById('media-details')!;
  const downloadSection = document.getElementById('download-section')!;
  const container = document.getElementById('videos')!;
  const timedVideos = videos.filter(
    (video) => typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0
  );
  const displayVideos = timedVideos.length > 0 ? timedVideos : videos;
  
  if (!displayVideos || displayVideos.length === 0) {
    emptyState.classList.remove('hidden');
    videoList.classList.add('hidden');
    mediaDetails.classList.add('hidden');
    downloadSection.classList.add('hidden');
    updateStatus('No media detected on this page', 'info');
    return;
  }
  
  emptyState.classList.add('hidden');
  videoList.classList.remove('hidden');
  
  container.innerHTML = '';
  let updatedSelectedVideo: VideoInfo | null = null;
  let updatedSelectedElement: HTMLElement | null = null;
  
  displayVideos.forEach((video, index) => {
    const videoEl = createMediaItem(video, index);
    container.appendChild(videoEl);
    if (selectedVideo?.id === video.id) {
      updatedSelectedVideo = video;
      updatedSelectedElement = videoEl;
    }
  });

  if (updatedSelectedVideo && updatedSelectedElement) {
    selectMedia(updatedSelectedVideo, updatedSelectedElement);
  }
  
  updateStatus(`${displayVideos.length} media found`, 'success');
}

/**
 * Create a media item element
 */
function createMediaItem(video: VideoInfo, index: number): HTMLElement {
  const div = document.createElement('div');
  div.className = 'media-item';
  div.dataset.index = String(index);
  
  // Calculate duration if available
  const durationStr = video.duration ? formatDuration(video.duration) : '';
  
  const iconHtml = video.thumbnail
    ? `<div class="media-thumbnail-wrapper">
         <img class="media-thumbnail" alt="${escapeHtml(video.title || 'Video thumbnail')}">
       </div>
       <div class="media-icon media-icon-fallback hidden">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
           <polygon points="5 3 19 12 5 21 5 3"></polygon>
         </svg>
       </div>`
    : `<div class="media-icon">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
           <polygon points="5 3 19 12 5 21 5 3"></polygon>
         </svg>
       </div>`;

  div.innerHTML = `
    ${iconHtml}
    <div class="media-info">
      <div class="media-type">${getTypeLabel(video.type)}</div>
      <div class="media-title">${escapeHtml(video.title || 'Unknown Video')}</div>
      ${durationStr ? `<div class="media-duration">${durationStr}</div>` : ''}
    </div>
  `;

  const thumbnail = div.querySelector('.media-thumbnail') as HTMLImageElement | null;
  if (thumbnail) {
    thumbnail.src = video.thumbnail || '';
    thumbnail.addEventListener('error', () => {
      thumbnail.closest('.media-thumbnail-wrapper')?.classList.add('hidden');
      div.querySelector('.media-icon-fallback')?.classList.remove('hidden');
    });
  }
  
  div.addEventListener('click', () => selectMedia(video, div));
  
  return div;
}

/**
 * Select a media item and show quality options
 */
function selectMedia(video: VideoInfo, element: HTMLElement): void {
  // Remove previous selection
  document.querySelectorAll('.media-item').forEach(el => {
    el.classList.remove('selected');
  });
  
  // Select this one
  element.classList.add('selected');
  
  selectedVideo = video;
  
  // Show media details with quality options
  const mediaDetails = document.getElementById('media-details')!;
  const downloadSection = document.getElementById('download-section')!;
  
  document.getElementById('media-title')!.textContent = video.title || 'Unknown Video';
  
  // Convert qualities to options
  currentQualities = video.qualities.map(q => ({
    label: q.label || getQualityLabel(q.height),
    bandwidth: q.bitrate || 0,
    bandwidthLabel: q.bitrate ? formatBandwidth(q.bitrate) : 'Unknown',
    resolution: q.width && q.height ? `${q.width}x${q.height}` : undefined,
    url: q.url,
    height: q.height,
    sizeLabel: getSizeLabel(q, video),
    formatArgs: q.formatArgs,
    formatId: q.formatId,
    ext: q.ext,
    fps: q.fps,
    fileSize: q.fileSize
  }));
  
  // If no qualities from detection, use direct URL
  if (currentQualities.length === 0 && video.type !== 'ytdlp') {
    currentQualities = [{
      label: 'Direct',
      bandwidth: 0,
      bandwidthLabel: 'Unknown',
      url: video.url,
      sizeLabel: video.fileSize ? formatFileSize(video.fileSize) : undefined
    }];
  }
  
  renderQualityList();
  
  mediaDetails.classList.remove('hidden');
  downloadSection.classList.remove('hidden');
  
  // Set default filename
  const filenameInput = document.getElementById('filename') as HTMLInputElement;
  if (filenameInput) {
    const suffix = currentQualities[0]?.label ? `_${currentQualities[0].label}` : '';
    filenameInput.value = `${video.title || 'video'}${suffix}`;
  }
}

/**
 * Render quality selection list
 */
function renderQualityList(): void {
  const container = document.getElementById('quality-list')!;
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  container.innerHTML = '';
  
  if (currentQualities.length === 0) {
    container.innerHTML = '<p class="no-quality">Loading YouTube qualities…</p>';
    if (downloadBtn) downloadBtn.disabled = true;
    return;
  }
  if (downloadBtn) downloadBtn.disabled = false;
  
  // Quick options
  const quickOptions = document.createElement('div');
  quickOptions.className = 'quick-options';
  quickOptions.innerHTML = `
    <button class="quick-btn" data-quality="best">Best</button>
    <button class="quick-btn" data-quality="worst">Lowest</button>
  `;
  container.appendChild(quickOptions);
  
  quickOptions.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const quality = target.dataset.quality;
      
      if (quality === 'best') {
        selectQuality(0);
      } else if (quality === 'worst') {
        const index = findLowestVideoQualityIndex();
        selectQuality(index >= 0 ? index : currentQualities.length - 1);
      }
    });
  });
  
  // Individual quality options
  currentQualities.forEach((q, index) => {
    const option = document.createElement('label');
    option.className = 'quality-option';
    option.dataset.index = String(index);
    
    option.innerHTML = `
      <input type="radio" name="quality" value="${index}" class="quality-radio">
      <span class="quality-label">${q.label}</span>
      ${q.resolution ? `<span class="quality-bandwidth">${q.resolution}</span>` : ''}
      <span class="quality-bandwidth">${q.bandwidthLabel}</span>
      ${q.sizeLabel ? `<span class="quality-size">${q.sizeLabel}</span>` : ''}
    `;
    
    const radio = option.querySelector('input[type="radio"]') as HTMLInputElement;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        selectQuality(index);
      }
    });
    
    option.addEventListener('click', () => {
      selectQuality(index);
    });
    
    container.appendChild(option);
  });
  
  // Select quality based on defaultQuality setting
  loadSettings().then(settings => {
    if (settings.defaultQuality === 'worst') {
      selectQuality(currentQualities.length - 1);
    } else {
      selectQuality(0);
    }
  }).catch(() => selectQuality(0));
}

/**
 * Select a quality option
 */
function selectQuality(index: number): void {
  selectedQualityIndex = index;
  
  // Update visual selection
  document.querySelectorAll('.quality-option').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
    const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
    if (radio) radio.checked = i === index;
  });
  
  // Update filename with selected quality
  if (selectedVideo) {
    const quality = currentQualities[index];
    const filenameInput = document.getElementById('filename') as HTMLInputElement;
    if (filenameInput) {
      filenameInput.value = `${selectedVideo.title || 'video'}_${quality.label}`;
    }
  }
}

/**
 * Start a download
 */
function startDownload(video: VideoInfo, quality: QualityOption): void {
  const filenameInput = document.getElementById('filename') as HTMLInputElement;
  const filename = filenameInput?.value || `${video.title || 'video'}`;
  
  // Show progress UI
  showDownloadingUI();
  
  if (port) {
    port.postMessage({
      type: 'DOWNLOAD',
      tabId: activeTabId,
      video: {
        ...video,
        url: quality.url,
        qualities: [{
          height: quality.height,
          bitrate: quality.bandwidth,
          url: quality.url,
          label: quality.label,
          formatArgs: quality.formatArgs,
          formatId: quality.formatId,
          ext: quality.ext,
          fps: quality.fps,
          fileSize: quality.fileSize
        }]
      },
      filename: filename
    });
  }
}

function showDownloadingUI(): void {
  const emptyState = document.getElementById('empty-state')!;
  const videoList = document.getElementById('video-list')!;
  const mediaDetails = document.getElementById('media-details')!;
  const downloadSection = document.getElementById('download-section')!;
  const downloadProgress = document.getElementById('download-progress')!;
  const error = document.getElementById('error')!;
  
  emptyState.classList.add('hidden');
  videoList.classList.add('hidden');
  mediaDetails.classList.add('hidden');
  downloadSection.classList.add('hidden');
  error.classList.add('hidden');
  downloadProgress.classList.remove('hidden');
  
  // Reset progress
  updateProgressUI({ percent: 0, speed: 0 });
}

function restoreDownloadUI(downloadId: string, filename: string, progress: any): void {
  currentDownloadId = downloadId;

  const emptyState = document.getElementById('empty-state')!;
  const videoList = document.getElementById('video-list')!;
  const mediaDetails = document.getElementById('media-details')!;
  const downloadSection = document.getElementById('download-section')!;
  const downloadProgress = document.getElementById('download-progress')!;
  const error = document.getElementById('error')!;

  emptyState.classList.add('hidden');
  videoList.classList.add('hidden');
  mediaDetails.classList.add('hidden');
  downloadSection.classList.add('hidden');
  error.classList.add('hidden');
  downloadProgress.classList.remove('hidden');

  const filenameEl = document.getElementById('progress-filename');
  if (filenameEl && filename) {
    filenameEl.textContent = filename;
  }

  updateProgressUI(progress || { percent: 0 });
  updateStatus('Downloading…', 'info');
}

function showDownloadStarted(downloadId: string): void {
  currentDownloadId = downloadId;
  updateStatus('Download started…', 'info');
}

function updateProgressUI(progress: any): void {
  const fill = document.getElementById('progress-fill');
  const percentEl = document.getElementById('progress-percent');
  const speedEl = document.getElementById('progress-speed');
  const etaEl = document.getElementById('progress-eta');

  const percent = typeof progress.percent === 'number' ? progress.percent : 0;
  const hasMeasuredProgress = percent > 0;

  if (fill) {
    if (hasMeasuredProgress) {
      fill.classList.remove('indeterminate');
      fill.style.width = `${Math.min(100, percent)}%`;
    } else {
      fill.classList.add('indeterminate');
      fill.style.width = '35%';
    }
  }

  if (percentEl) {
    percentEl.textContent = hasMeasuredProgress ? `${Math.round(percent)}%` : '...';
  }

  // Handle FFmpeg speed (string like "1.5x") vs direct download (bytes)
  if (speedEl && progress.speed) {
    if (typeof progress.speed === 'string') {
      speedEl.textContent = progress.speed;
    } else if (typeof progress.speed === 'number' && progress.speed > 0) {
      speedEl.textContent = formatSpeed(progress.speed);
    }
  }

  // Handle direct download byte progress
  if (speedEl && progress.bytesReceived !== undefined && progress.totalBytes > 0) {
    const mbReceived = (progress.bytesReceived / 1000000).toFixed(1);
    const mbTotal = (progress.totalBytes / 1000000).toFixed(1);
    speedEl.textContent = `${mbReceived} / ${mbTotal} MB`;
  }

  if (etaEl && progress.eta) {
    etaEl.textContent = formatETA(progress.eta);
  }
}

function showDownloadComplete(): void {
  currentDownloadId = null;
  updateStatus('Download complete!', 'success');
  
  const downloadProgress = document.getElementById('download-progress')!;
  const fill = document.getElementById('progress-fill');
  
  if (fill) fill.style.width = '100%';
  if (fill) fill.style.background = 'var(--success)';
  
  // Auto close after 2 seconds
  setTimeout(() => {
    resetUI();
    requestMediaList();
  }, 2000);
}

function cancelDownload(): void {
  if (port && currentDownloadId) {
    port.postMessage({ type: 'CANCEL_DOWNLOAD', downloadId: currentDownloadId });
  }
  currentDownloadId = null;
  resetUI();
  updateStatus('Download cancelled', 'error');
}

function resetUI(): void {
  currentDownloadId = null;
  const emptyState = document.getElementById('empty-state')!;
  const videoList = document.getElementById('video-list')!;
  const mediaDetails = document.getElementById('media-details')!;
  const downloadSection = document.getElementById('download-section')!;
  const downloadProgress = document.getElementById('download-progress')!;
  const error = document.getElementById('error')!;
  const fill = document.getElementById('progress-fill');
  
  emptyState.classList.add('hidden');
  videoList.classList.remove('hidden');
  mediaDetails.classList.add('hidden');
  downloadSection.classList.add('hidden');
  downloadProgress.classList.add('hidden');
  error.classList.add('hidden');
  
  if (fill) {
    fill.classList.remove('indeterminate');
    fill.style.width = '0%';
    fill.style.background = 'var(--accent)';
  }
}

function showError(message: string): void {
  currentDownloadId = null;
  const errorEl = document.getElementById('error')!;
  const errorMsgEl = document.getElementById('error-message')!;
  
  if (errorMsgEl) errorMsgEl.textContent = message;
  errorEl.classList.remove('hidden');
  
  const downloadProgress = document.getElementById('download-progress')!;
  downloadProgress.classList.add('hidden');
  
  updateStatus('Error', 'error');
}

function hideError(): void {
  const errorEl = document.getElementById('error')!;
  errorEl.classList.add('hidden');
  resetUI();
}

/**
 * Utility functions
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'hls':
    case 'm3u8':
      return 'HLS';
    case 'dash':
    case 'mpd':
      return 'DASH';
    case 'mp4':
      return 'MP4';
    case 'webm':
      return 'WebM';
    case 'ytdlp':
      return 'YT-DLP';
    default:
      return 'Video';
  }
}

function getQualityLabel(height?: number): string {
  if (!height) return 'Unknown';
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
}

function formatBandwidth(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bps / 1000)} Kbps`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec > 1000000) {
    return `${(bytesPerSec / 1000000).toFixed(1)} MB/s`;
  }
  if (bytesPerSec > 1000) {
    return `${(bytesPerSec / 1000).toFixed(0)} KB/s`;
  }
  return `${bytesPerSec} B/s`;
}

function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function getSizeLabel(quality: VideoQuality, video: VideoInfo): string | undefined {
  if (quality.fileSize) return formatFileSize(quality.fileSize);
  if (video.fileSize) return formatFileSize(video.fileSize);
  if (quality.bitrate && video.duration) {
    return `~${formatFileSize((quality.bitrate * video.duration) / 8)}`;
  }
  return undefined;
}

function findLowestVideoQualityIndex(): number {
  for (let i = currentQualities.length - 1; i >= 0; i--) {
    if ((currentQualities[i].height || 0) > 0) return i;
  }
  return -1;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
