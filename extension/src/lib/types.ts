// Type definitions for extension

export interface NativeMessage {
  type: string;
  payload: any;
}

export interface DownloadRequest {
  url: string;
  quality?: string;
  format?: 'mp4' | 'webm' | 'mkv';
  savePath?: string;
  filename?: string;
  duration?: number;
}

export interface DownloadResponse {
  success: boolean;
  downloadId?: string;
  error?: string;
}

export interface VideoQuality {
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
  kind?: 'video' | 'audio' | 'subtitle';
  language?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  type: 'm3u8' | 'mpd' | 'direct' | 'hls' | 'dash' | 'mp4' | 'webm' | 'ytdlp' | 'mse';
  qualities: VideoQuality[];
  childUrls?: string[];
  referer?: string;
  thumbnail?: string;
  duration?: number;
  fileSize?: number;
}

export interface DownloadProgress {
  downloadId: string;
  percent: number;
  speed?: number;
  eta?: number;
  complete: boolean;
  error?: string;
}
