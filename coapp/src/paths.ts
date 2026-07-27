import * as os from 'os';
import * as path from 'path';

const platformFolder = process.platform === 'win32' ? 'win' : process.platform;
const executableSuffix = process.platform === 'win32' ? '.exe' : '';

export function getInstallDir(): string {
  if (process.env.MEDIAGRABBER_INSTALL_DIR) {
    return process.env.MEDIAGRABBER_INSTALL_DIR;
  }

  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'MediaGrabber');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'MediaGrabber');
  }

  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'MediaGrabber');
}

export function getRuntimeRoots(): string[] {
  return Array.from(new Set([
    process.env.MEDIAGRABBER_HOME,
    process.cwd(),
    getInstallDir(),
    path.dirname(process.execPath),
    path.resolve(__dirname, '..')
  ].filter((value): value is string => Boolean(value))));
}

export function getRuntimeBinary(kind: 'ffmpeg' | 'ffprobe' | 'ytdlp'): string {
  const name = kind === 'ytdlp' ? `yt-dlp${executableSuffix}` : `${kind}${executableSuffix}`;
  const folder = kind === 'ytdlp' ? 'ytdlp' : 'ffmpeg';
  return path.join(folder, platformFolder, name);
}

export function getHostBinaryPath(): string {
  return path.join(getInstallDir(), `coapp${executableSuffix}`);
}
