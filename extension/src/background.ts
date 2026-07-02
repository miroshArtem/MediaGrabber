// MediaGrabber Service Worker (Background Script)
// Manifest V3 — webRequest, media detection, download orchestration.

import { NativeClient } from './lib/native-client';
import { VideoInfo } from './lib/types';
import { M3U8ParserWrapper } from './lib/m3u8-parser';
import { DashParserWrapper } from './lib/dash-parser';
import { loadSettings, Settings } from './lib/settings';

interface PageMetadata {
  title?: string;
  thumbnail?: string;
  duration?: number;
  pageUrl?: string;
}

const nativeClient = new NativeClient();

// Media storage by tabId
const mediaByTab = new Map<number, VideoInfo[]>();
const interceptedMediaByTab = new Map<number, Set<string>>();
const pageMetadataByTab = new Map<number, PageMetadata>();
const ytdlpFormatUrlByTab = new Map<number, string>();

// Active downloads: key = downloadKey, value = tracking info
const activeDownloads = new Map<string, {
  pid?: number;
  downloadId?: number;
  type: 'convert' | 'direct' | 'ytdlp';
  video?: VideoInfo;
  directory: string;
  filename: string;
  tabId?: number;
  lastProgress?: { percent: number; speed?: string; bytesReceived?: number; totalBytes?: number; eta?: number };
}>();

// Popup connections
const popupPorts = new Set<chrome.runtime.Port>();

// Default download directory (sent by CoApp or fallback)
let defaultDownloadDir = '';
let coappPlatform = '';
let cachedSettings: Settings | null = null;

async function getSettings(): Promise<Settings> {
  if (!cachedSettings) {
    cachedSettings = await loadSettings();
  }
  return cachedSettings;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    cachedSettings = changes.settings.newValue || null;
  }
});

function notify(title: string, message: string): void {
  getSettings().then(settings => {
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
        title: `MediaGrabber — ${title}`,
        message
      });
    }
  });
}

// Register handlers for CoApp → extension calls (push progress)
nativeClient.listen({
  // FFmpeg progress push: (progressTime, currentSeconds, info)
  convertOutput: (progressTime: number, currentSeconds: number, info: any) => {
    for (const [key, dl] of activeDownloads) {
      if (!dl.video) continue;
      if (dl.type !== 'convert' && dl.type !== 'ytdlp') continue;
      const duration = dl.video.duration || 0;
      const percent = info?.percent != null
        ? Math.min(100, info.percent)
        : duration > 0 ? Math.min(100, (currentSeconds / duration) * 100) : 0;
      dl.lastProgress = { percent, speed: info?.speed || '', eta: info?.eta };
      popupPorts.forEach(port => {
        port.postMessage({
          type: 'DOWNLOAD_PROGRESS',
          downloadId: key,
          progress: { percent, currentSeconds, speed: info?.speed || '', eta: info?.eta, bitrate: info?.bitrate || '' }
        });
      });
    }
  },

  // CoApp tells us the ffmpeg PID for a convert operation
  convertStartNotification: (startHandler: any, pid: number) => {
    const keyedDownload = activeDownloads.get(String(startHandler));
    if (keyedDownload && keyedDownload.type === 'convert') {
      keyedDownload.pid = pid;
      return;
    }

    // Fallback for older CoApp calls without startHandler.
    for (const dl of activeDownloads.values()) {
      if (dl.type === 'convert' && dl.pid === undefined) {
        dl.pid = pid;
        break;
      }
    }
  },

  // Direct download complete (pushed by CoApp)
  downloadComplete: (downloadId: number, outputPath: string) => {
    const key = `direct_${downloadId}`;
    const dl = activeDownloads.get(key);
    if (dl) {
      popupPorts.forEach(port => {
        port.postMessage({ type: 'DOWNLOAD_COMPLETE', downloadId: key, outputPath });
      });
      activeDownloads.delete(key);
    }
  },

  // Direct download error (pushed by CoApp)
  downloadError: (downloadId: number, error: string) => {
    const key = `direct_${downloadId}`;
    popupPorts.forEach(port => {
      port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: key, error });
    });
    activeDownloads.delete(key);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[MediaGrabber] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[MediaGrabber] Service worker starting');
});

// --- Media detection via webRequest (works in MV3 service worker) ---

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(details.url);
    } catch {
      return;
    }

    if (!isMediaUrl(parsedUrl)) return;

    void handleInterceptedMedia(details.tabId, details.url);
  },
  { urls: ['<all_urls>'] }
);

function isMediaUrl(url: URL): boolean {
  // Only http(s) — exclude blob:, data:, chrome-extension:, ws:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const path = url.pathname.toLowerCase();

  // HLS
  if (path.endsWith('.m3u8') || path.includes('.m3u8')) return true;
  // DASH
  if (path.endsWith('.mpd') || path.includes('.mpd')) return true;
  // Direct video files
  if (path.endsWith('.mp4')) return true;
  if (path.endsWith('.webm')) return true;

  // Do NOT match .ts (TypeScript files) or /manifest (web app manifests)
  return false;
}

function getMediaType(url: string): VideoInfo['type'] {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes('.m3u8')) return 'hls';
  if (path.includes('.mpd')) return 'dash';
  if (path.endsWith('.mp4')) return 'mp4';
  if (path.endsWith('.webm')) return 'webm';
  return 'direct';
}

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    return h === 'youtube.com' || h === 'www.youtube.com' ||
           h === 'm.youtube.com' || h === 'youtu.be' ||
           h === 'youtube-nocookie.com' || h === 'www.youtube-nocookie.com';
  } catch {
    return false;
  }
}

function fallbackYtdlpQualities(url: string): VideoInfo['qualities'] {
  return [
    { label: 'Best', height: 0, url, bitrate: 0, formatArgs: ['-f', 'bv*+ba/b'] },
    { label: 'Audio MP3', height: 0, url, bitrate: 0, formatArgs: ['-f', 'ba', '-x', '--audio-format', 'mp3', '--audio-quality', '0'] }
  ];
}

function generateVideoId(url: string): string {
  // Safe base64 for non-ASCII URLs
  try {
    return `video_${btoa(encodeURIComponent(url)).substring(0, 20)}_${Date.now()}`;
  } catch {
    return `video_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  }
}

function mergeQualities(a: VideoInfo['qualities'] = [], b: VideoInfo['qualities'] = []): VideoInfo['qualities'] {
  const merged = new Map<string, VideoInfo['qualities'][number]>();
  [...a, ...b].forEach((quality) => {
    if (quality?.url && !merged.has(quality.url)) {
      merged.set(quality.url, quality);
    }
  });
  return Array.from(merged.values());
}

function mergeChildUrls(a?: string[], b?: string[]): string[] | undefined {
  const merged = Array.from(new Set([...(a || []), ...(b || [])]));
  return merged.length > 0 ? merged : undefined;
}

function commitVideos(tabId: number, videos: VideoInfo[]): void {
  mediaByTab.set(tabId, videos);
  const visibleCount = getVisibleVideosForTab(tabId).length;
  chrome.action.setBadgeText({ tabId, text: visibleCount > 0 ? String(visibleCount) : '' });
  if (visibleCount > 0) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' });
  }
  notifyPopups(tabId);
}

function getVisibleVideosForTab(tabId: number): VideoInfo[] {
  const videos = mediaByTab.get(tabId) || [];
  const metadata = pageMetadataByTab.get(tabId);
  if (metadata?.pageUrl && isYouTubeUrl(metadata.pageUrl)) {
    return videos.filter(video => video.type === 'ytdlp');
  }
  const timedVideos = videos.filter(video =>
    typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0
  );
  return timedVideos.length > 0 ? timedVideos : videos;
}

function upsertVideo(tabId: number, video: VideoInfo): void {
  let videos = mediaByTab.get(tabId) || [];

  if (video.type === 'hls') {
    const childUrls = new Set([
      ...(video.qualities || []).map((q) => q.url),
      ...(video.childUrls || [])
    ]);

    // Variant playlists are implementation details of a master HLS playlist.
    // Keep only the master entry that owns the quality list.
    const belongsToExistingMaster = videos.some((existing) =>
      existing.type === 'hls' &&
      existing.url !== video.url &&
      (
        existing.qualities?.some((quality) => quality.url === video.url) ||
        existing.childUrls?.includes(video.url)
      )
    );

    if (belongsToExistingMaster) {
      return;
    }

    if (childUrls.size > 0) {
      videos = videos.filter((existing) =>
        !(existing.type === 'hls' && existing.url !== video.url && childUrls.has(existing.url))
      );
    }

  }

  const existingIndex = videos.findIndex((v) => v.url === video.url);

  if (existingIndex >= 0) {
    const existing = videos[existingIndex];
    videos[existingIndex] = {
      ...existing,
      ...video,
      title: video.title || existing.title,
      qualities: video.qualities?.length ? video.qualities : videos[existingIndex].qualities,
      childUrls: video.childUrls?.length ? video.childUrls : videos[existingIndex].childUrls,
      thumbnail: video.thumbnail || existing.thumbnail,
      duration: video.duration || existing.duration,
      fileSize: video.fileSize || existing.fileSize
    };
  } else {
    videos.push(video);
  }

  commitVideos(tabId, videos);
}

async function getTabTitle(tabId: number): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      resolve(tab?.title || 'Detected media');
    });
  });
}

async function handleInterceptedMedia(tabId: number, url: string): Promise<void> {
  const seen = interceptedMediaByTab.get(tabId) || new Set<string>();
  if (seen.has(url)) return;
  seen.add(url);
  interceptedMediaByTab.set(tabId, seen);

  const metadata = pageMetadataByTab.get(tabId);
  const title = metadata?.title || await getTabTitle(tabId);
  const type = getMediaType(url);

  let qualities: VideoInfo['qualities'] = [];
  let childUrls: string[] | undefined;
  let duration: number | undefined;
  let fileSize: number | undefined;

  if (type === 'hls') {
    try {
      const parsed = await M3U8ParserWrapper.fetchAndParse(url);
      duration = parsed.duration;
      childUrls = parsed.childUrls;
      qualities = parsed.variants.map((variant) => ({
        height: variant.height || 0,
        width: variant.width,
        bitrate: variant.bandwidth,
        url: variant.url
      }));

      // Fallback: fetch media playlist for duration if master had none
      if (!duration && parsed.variants.length > 0) {
        try {
          const mediaPlaylist = await M3U8ParserWrapper.fetchAndParse(parsed.variants[0].url);
          duration = mediaPlaylist.duration;
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.warn('[MediaGrabber] Failed to parse HLS manifest:', error);
    }
  }

  if (type === 'dash') {
    try {
      const parsed = await DashParserWrapper.fetchAndParse(url);
      duration = parsed.duration;
      childUrls = parsed.childUrls;
      qualities = parsed.variants.map((variant) => ({
        height: variant.height || 0,
        width: variant.width,
        bitrate: variant.bandwidth,
        url: variant.url,
        label: variant.name
      }));
    } catch (error) {
      console.warn('[MediaGrabber] Failed to parse DASH manifest:', error);
    }
  }

  if (type === 'mp4' || type === 'webm') {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) fileSize = parseInt(contentLength, 10);
    } catch {
      // ignore — some servers don't support HEAD
    }

    try {
      await ensureCoAppConnected();
      const probe = await nativeClient.probe(url, true);
      const vStream = probe?.streams?.find((s: any) => s.codec_type === 'video');
      if (vStream) {
        const height = parseInt(vStream.height, 10) || 0;
        const width = parseInt(vStream.width, 10) || 0;
        qualities = [{
          height,
          width: width || undefined,
          bitrate: 0,
          url,
          label: M3U8ParserWrapper.getQualityName(height)
        }];
      }
      if (probe?.format?.duration) {
        duration = parseFloat(probe.format.duration);
      }
      if (probe?.format?.size && !fileSize) {
        fileSize = parseInt(probe.format.size, 10);
      }
    } catch {
      // ffprobe unavailable or URL unreachable — keep HEAD-only result
    }
  }

  upsertVideo(tabId, {
    id: generateVideoId(url),
    title,
    url,
    type,
    qualities,
    childUrls,
    duration: duration || metadata?.duration,
    thumbnail: metadata?.thumbnail,
    fileSize
  });

  console.log('[MediaGrabber] Intercepted media:', url, type);
}

// --- Popup communication ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPorts.add(port);

    port.onMessage.addListener((msg) => {
      handlePopupMessage(port, msg);
    });

    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
    });
  }
});

function handlePopupMessage(port: chrome.runtime.Port, msg: any): void {
  switch (msg.type) {
    case 'GET_MEDIA':
      if (typeof msg.tabId === 'number') {
        const videos = getVisibleVideosForTab(msg.tabId);
        port.postMessage({ type: 'MEDIA_LIST', videos });
      } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          const videos = tabs[0]?.id ? getVisibleVideosForTab(tabs[0].id) : [];
          port.postMessage({ type: 'MEDIA_LIST', videos });
        });
      }
      break;

    case 'DOWNLOAD':
      startDownload(msg.video, msg.filename, msg.tabId)
        .then(result => port.postMessage({ type: 'DOWNLOAD_STARTED', ...result }))
        .catch(err => port.postMessage({ type: 'ERROR', message: err.message }));
      break;

    case 'CANCEL_DOWNLOAD':
      handleCancelDownload(msg.downloadId)
        .then(result => port.postMessage({ type: 'DOWNLOAD_CANCELLED', ...result }))
        .catch(err => port.postMessage({ type: 'ERROR', message: err.message }));
      break;

    case 'GET_ACTIVE_DOWNLOAD': {
      const tabId = msg.tabId;
      const entry = [...activeDownloads.entries()].find(([, dl]) => dl.tabId === tabId);
      if (entry) {
        const [key, dl] = entry;
        port.postMessage({
          type: 'ACTIVE_DOWNLOAD',
          downloadId: key,
          video: dl.video,
          filename: dl.filename,
          progress: dl.lastProgress || { percent: 0 }
        });
      } else {
        port.postMessage({ type: 'NO_ACTIVE_DOWNLOAD' });
      }
      break;
    }
  }
}

function notifyPopups(tabId: number): void {
  const videos = getVisibleVideosForTab(tabId);
  if (videos) {
    popupPorts.forEach(port => {
      port.postMessage({ type: 'MEDIA_LIST', videos });
    });
  }
}

// --- Download orchestration ---

async function ensureCoAppConnected(): Promise<void> {
  if (!nativeClient.connected) {
    await nativeClient.connect();
  }

  if (!defaultDownloadDir) {
    try {
      const info = await nativeClient.info();
      defaultDownloadDir = info?.downloadDir || '';
      coappPlatform = info?.platform || '';
    } catch (error) {
      console.warn('[MediaGrabber] Failed to read CoApp info:', error);
    }
  }
}

function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return sanitized || `video_${Date.now()}`;
}

function ensureFilenameExtension(filename: string, extension: string): string {
  const baseName = filename.replace(/\.(mp4|webm|mkv|mov|m4v|avi|ts|m3u8|mp3|m4a|aac|opus|wav|flac)$/i, '');
  return `${baseName}.${extension.replace(/^\./, '')}`;
}

function getDefaultExtension(video: VideoInfo, type: VideoInfo['type']): string {
  if (type === 'webm') return 'webm';
  if (video.qualities[0]?.ext === 'mp3') return 'mp3';
  return 'mp4';
}

function joinOutputPath(directory: string, filename: string): string {
  if (!directory) return filename;
  const separator = coappPlatform === 'win32' ? '\\' : '/';
  return `${directory.replace(/[\\/]$/, '')}${separator}${filename}`;
}

async function startDownload(video: VideoInfo, filename?: string, tabId?: number): Promise<any> {
  await ensureCoAppConnected();

  const type = getMediaType(video.url);
  const outFilename = ensureFilenameExtension(
    sanitizeFilename(filename || `${video.title || 'video'}`),
    getDefaultExtension(video, type)
  );
  const directory = defaultDownloadDir;

  if (type === 'hls' || type === 'dash') {
    // FFmpeg convert path
    const downloadKey = `convert_${Date.now()}`;
    const outputPath = joinOutputPath(directory, outFilename);

    activeDownloads.set(downloadKey, {
      type: 'convert',
      video,
      directory,
      filename: outFilename,
      tabId
    });

    // Start ffmpeg asynchronously — progress comes via convertOutput push
    nativeClient.convert(
      ['-i', video.url, '-c', 'copy', '-y', outputPath],
      { progressTime: 1000, startHandler: downloadKey }
    ).then(result => {
      if (result.exitCode === 0) {
        notify('Download complete', outFilename);
        popupPorts.forEach(port => {
          port.postMessage({ type: 'DOWNLOAD_COMPLETE', downloadId: downloadKey, outputPath });
        });
      } else {
        notify('Download failed', outFilename);
        popupPorts.forEach(port => {
          port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: downloadKey, error: `FFmpeg exit code ${result.exitCode}: ${result.stderr}` });
        });
      }
      activeDownloads.delete(downloadKey);
    }).catch(err => {
      notify('Download failed', err.message);
      popupPorts.forEach(port => {
        port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: downloadKey, error: err.message });
      });
      activeDownloads.delete(downloadKey);
    });

    return { success: true, downloadId: downloadKey };
  } else if (video.type === 'ytdlp') {
    // yt-dlp path (YouTube etc.)
    const downloadKey = `ytdlp_${Date.now()}`;
    const formatArgs = video.qualities[0]?.formatArgs || fallbackYtdlpQualities(video.url)[0].formatArgs;

    activeDownloads.set(downloadKey, {
      type: 'ytdlp',
      video,
      directory,
      filename: outFilename,
      tabId
    });

    nativeClient.ytdlp(
      video.url,
      formatArgs,
      { progressTime: 1000, startHandler: downloadKey, outputDir: directory || undefined, filename: outFilename.replace(/\.[^.]+$/, '.%(ext)s') }
    ).then(result => {
      if (result.exitCode === 0) {
        notify('Download complete', outFilename);
        popupPorts.forEach(port => {
          port.postMessage({ type: 'DOWNLOAD_COMPLETE', downloadId: downloadKey });
        });
      } else {
        notify('Download failed', outFilename);
        popupPorts.forEach(port => {
          port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: downloadKey, error: `yt-dlp exit code ${result.exitCode}: ${result.stderr}` });
        });
      }
      activeDownloads.delete(downloadKey);
    }).catch(err => {
      notify('Download failed', err.message);
      popupPorts.forEach(port => {
        port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: downloadKey, error: err.message });
      });
      activeDownloads.delete(downloadKey);
    });

    return { success: true, downloadId: downloadKey };
  } else {
    // Direct download path
    const downloadId = await nativeClient.downloadFile({
      url: video.url,
      directory: directory || undefined,
      filename: outFilename
    });

    const downloadKey = `direct_${downloadId}`;
    activeDownloads.set(downloadKey, {
      type: 'direct',
      downloadId,
      video,
      directory,
      filename: outFilename,
      tabId
    });

    // Poll for direct download progress (CoApp pushes complete/error, but we poll for bytes)
    startDirectProgressPolling(downloadKey, downloadId, video.duration);

    return { success: true, downloadId: downloadKey };
  }
}

function startDirectProgressPolling(downloadKey: string, downloadId: number, duration?: number): void {
  const timer = setInterval(async () => {
    try {
      const results = await nativeClient.searchDownloads(downloadId);
      if (!results || results.length === 0) {
        clearInterval(timer);
        return;
      }

      const dl = results[0];
      const percent = dl.totalBytes > 0 ? (dl.bytesReceived / dl.totalBytes) * 100 : 0;

      const activeDl = activeDownloads.get(downloadKey);
      if (activeDl) {
        activeDl.lastProgress = { percent, bytesReceived: dl.bytesReceived, totalBytes: dl.totalBytes };
      }

      popupPorts.forEach(port => {
        port.postMessage({
          type: 'DOWNLOAD_PROGRESS',
          downloadId: downloadKey,
          progress: { percent, bytesReceived: dl.bytesReceived, totalBytes: dl.totalBytes }
        });
      });

      if (dl.state === 'complete') {
        clearInterval(timer);
        activeDownloads.delete(downloadKey);
      } else if (dl.state === 'interrupted') {
        clearInterval(timer);
        popupPorts.forEach(port => {
          port.postMessage({ type: 'DOWNLOAD_ERROR', downloadId: downloadKey, error: dl.error || 'Download interrupted' });
        });
        activeDownloads.delete(downloadKey);
      }
    } catch {
      // Single poll failure — don't abort, just skip this tick
    }
  }, 2000);
}

async function handleCancelDownload(downloadId: string): Promise<any> {
  const dl = activeDownloads.get(downloadId);
  if (!dl) {
    return { success: false, error: 'Download not found' };
  }

  if (dl.type === 'convert' && dl.pid !== undefined) {
    await nativeClient.abortConvert(dl.pid);
  } else if (dl.type === 'ytdlp' && dl.pid !== undefined) {
    await nativeClient.abortYtdlp(dl.pid);
  } else if (dl.type === 'direct' && dl.downloadId !== undefined) {
    await nativeClient.cancelDownload(dl.downloadId);
  }

  activeDownloads.delete(downloadId);
  return { success: true };
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'VIDEO_DETECTED':
      return handleVideoDetected(sender.tab?.id, message.video);

    case 'PAGE_METADATA':
      return handlePageMetadata(sender.tab?.id, message.metadata, sender.frameId);

    case 'GET_VIDEOS':
      return getVideosForTab(message.tabId);

    case 'PING': {
      let connected = false;
      let version: string | undefined;
      try {
        connected = nativeClient.connected;
        if (connected) {
          const info = await nativeClient.info();
          version = info?.version || 'unknown';
        }
      } catch { /* ignore */ }
      return { success: true, timestamp: Date.now(), connected, version };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

function handleVideoDetected(tabId: number | undefined, video: VideoInfo): any {
  if (tabId === undefined) return { error: 'No tabId' };
  upsertVideo(tabId, video);
  console.log(`[MediaGrabber] Detected video on tab ${tabId}:`, video.title);
  return { success: true, count: (mediaByTab.get(tabId) || []).length };
}

function normalizeYtdlpQualities(url: string, qualities: any[]): VideoInfo['qualities'] {
  return (qualities || [])
    .filter(q => Array.isArray(q?.formatArgs) && q.formatArgs.length > 0)
    .map(q => ({
      height: Number(q.height) || 0,
      width: Number(q.width) || undefined,
      bitrate: Number(q.bitrate) || 0,
      url,
      label: q.label,
      formatArgs: q.formatArgs,
      formatId: q.formatId,
      ext: q.ext,
      fps: Number(q.fps) || undefined,
      fileSize: Number(q.fileSize) || undefined
    }));
}

async function loadYouTubeFormats(tabId: number, url: string, videoId: string, metadata: PageMetadata): Promise<void> {
  try {
    await ensureCoAppConnected();
    const info = await nativeClient.ytdlpFormats(url);
    const currentMetadata = pageMetadataByTab.get(tabId) || metadata;
    if (currentMetadata.pageUrl !== url) return;

    const qualities = normalizeYtdlpQualities(url, info.qualities);
    upsertVideo(tabId, {
      id: videoId,
      title: info.title || currentMetadata.title || 'YouTube Video',
      url,
      type: 'ytdlp',
      qualities: qualities.length ? qualities : fallbackYtdlpQualities(url),
      thumbnail: info.thumbnail || currentMetadata.thumbnail,
      duration: info.duration || currentMetadata.duration
    });
  } catch (error) {
    console.warn('[MediaGrabber] Failed to load yt-dlp formats:', error);
    const currentMetadata = pageMetadataByTab.get(tabId) || metadata;
    if (currentMetadata.pageUrl !== url) return;
    upsertVideo(tabId, {
      id: videoId,
      title: currentMetadata.title || 'YouTube Video',
      url,
      type: 'ytdlp',
      qualities: fallbackYtdlpQualities(url),
      thumbnail: currentMetadata.thumbnail,
      duration: currentMetadata.duration
    });
  }
}

function addYouTubeVideo(tabId: number, metadata: PageMetadata): void {
  const url = metadata.pageUrl!;
  const videoId = `ytdlp_${tabId}`;

  const existing = (mediaByTab.get(tabId) || []).find(v => v.id === videoId);
  if (existing) {
    const urlChanged = existing.url !== url;
    const videos = (mediaByTab.get(tabId) || []).map(v =>
      v.id === videoId
        ? {
            ...v,
            title: metadata.title || v.title,
            thumbnail: metadata.thumbnail || v.thumbnail,
            duration: metadata.duration || v.duration,
            url,
            qualities: urlChanged ? [] : v.qualities
          }
        : v
    );
    commitVideos(tabId, videos);
  }

  if (ytdlpFormatUrlByTab.get(tabId) === url) return;
  ytdlpFormatUrlByTab.set(tabId, url);
  void loadYouTubeFormats(tabId, url, videoId, metadata);
}

function handlePageMetadata(tabId: number | undefined, metadata: PageMetadata, frameId?: number): any {
  if (tabId === undefined) return { error: 'No tabId' };

  const previous = pageMetadataByTab.get(tabId) || {};
  const isTopFrame = frameId === 0;
  const merged: PageMetadata = {
    pageUrl: isTopFrame ? (metadata.pageUrl || previous.pageUrl) : previous.pageUrl,
    title: isTopFrame ? (metadata.title || previous.title) : (previous.title || metadata.title),
    thumbnail: isTopFrame ? (metadata.thumbnail || previous.thumbnail) : (previous.thumbnail || metadata.thumbnail),
    duration: metadata.duration || previous.duration
  };

  pageMetadataByTab.set(tabId, merged);

  if (merged.pageUrl && isYouTubeUrl(merged.pageUrl)) {
    addYouTubeVideo(tabId, merged);
  }

  const videos = mediaByTab.get(tabId);
  if (videos?.length) {
    let changed = false;
    const updated = videos.map((video) => {
      const next = {
        ...video,
        thumbnail: video.thumbnail || merged.thumbnail,
        duration: video.duration || merged.duration
      };
      changed = changed || next.thumbnail !== video.thumbnail || next.duration !== video.duration;
      return next;
    });

    if (changed) {
      commitVideos(tabId, updated);
    }
  }

  return { success: true };
}

function getVideosForTab(tabId: number): any {
  return { videos: mediaByTab.get(tabId) || [] };
}
