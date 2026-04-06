// Error types for MediaGrabber extension

export class CoAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CoAppError';
  }
}

export class ConnectionError extends CoAppError {
  constructor(message: string = 'Failed to connect to CoApp') {
    super(message, 'CONNECTION_ERROR', true);
  }
}

export class TimeoutError extends CoAppError {
  constructor(method: string, timeout: number = 60000) {
    super(`Method '${method}' timed out after ${timeout}ms`, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

export class MethodError extends CoAppError {
  constructor(message: string, public method?: string) {
    super(message, 'METHOD_ERROR', false);
    this.name = 'MethodError';
  }
}

export class FFmpegError extends CoAppError {
  constructor(message: string, public exitCode?: number) {
    super(message, 'FFMPEG_ERROR', false);
    this.name = 'FFmpegError';
  }
}

export class DownloadError extends CoAppError {
  constructor(message: string, public downloadId?: string) {
    super(message, 'DOWNLOAD_ERROR', true);
    this.name = 'DownloadError';
  }
}

// Error codes for easy checking
export const ErrorCodes = {
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TIMEOUT: 'TIMEOUT',
  METHOD_ERROR: 'METHOD_ERROR',
  FFMPEG_ERROR: 'FFMPEG_ERROR',
  DOWNLOAD_ERROR: 'DOWNLOAD_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];