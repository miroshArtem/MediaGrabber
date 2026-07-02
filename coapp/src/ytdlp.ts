import { spawn as nodeSpawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import rpc from './rpc';

const ytdlpChildren = new Map<number, ChildProcess>();
const to_kill = new Set<ChildProcess>();

function spawn(arg0: string, argv: string[]): ChildProcess {
  const child = nodeSpawn(arg0, argv, { windowsHide: true });
  if (child.pid) {
    to_kill.add(child);
    child.on('exit', () => { to_kill.delete(child); });
  }
  return child;
}

function findYtDlp(): string {
  const platform = process.platform;
  const exe = platform === 'win32' ? '.exe' : '';
  const paths: string[] = [
    path.join(__dirname, '..', 'ytdlp', platform === 'win32' ? 'win' : platform, 'yt-dlp' + exe),
    path.join(process.cwd(), 'ytdlp', 'yt-dlp' + exe)
  ];

  if (platform === 'win32') {
    const roots = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Python'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python')
    ];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      for (const dir of fs.readdirSync(root)) {
        paths.push(path.join(root, dir, 'Scripts', 'yt-dlp.exe'));
      }
    }
  }

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return 'yt-dlp';
}

function findFFmpegDir(): string {
  const platform = process.platform;
  const exe = platform === 'win32' ? '.exe' : '';
  const dir1 = path.join(__dirname, '..', 'ffmpeg', platform === 'win32' ? 'win' : platform);
  const dir2 = path.join(process.cwd(), 'ffmpeg');
  if (fs.existsSync(path.join(dir1, 'ffmpeg' + exe))) return dir1;
  if (fs.existsSync(path.join(dir2, 'ffmpeg' + exe))) return dir2;
  return '';
}

const ytdlpBin = findYtDlp();
const ffmpegDir = findFFmpegDir();

const DL_PERCENT_RE = /\[download\]\s+([\d.]+)%/;
const SPEED_RE = /at\s+([\d.]+\w+\/s)/;
const ETA_RE = /ETA\s+([\d:]+)/;

function killAll(): void {
  to_kill.forEach(c => { try { c.kill(); } catch { /* gone */ } });
}

rpc.listen({
  abortYtdlp: (pid: number) => {
    const child = ytdlpChildren.get(pid);
    if (child && child.exitCode == null) {
      try { child.kill(); } catch { /* gone */ }
    }
    return { success: true };
  },

  ytdlp: async (
    url: string,
    args: string[] = [],
    options: { progressTime?: number; startHandler?: any; outputDir?: string; filename?: string } = {}
  ) => {
    const outputDir = options.outputDir || path.join(os.homedir(), 'Downloads');
    const outputTemplate = path.join(outputDir, options.filename || '%(title)s.%(ext)s');

    const baseArgs = [
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '-o', outputTemplate
    ];

    if (ffmpegDir) {
      baseArgs.push('--ffmpeg-location', ffmpegDir);
    }

    const fullArgs = [...baseArgs, ...args, url];
    const child = spawn(ytdlpBin, fullArgs);
    if (child.pid) ytdlpChildren.set(child.pid, child);

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    if (options.startHandler) {
      try { await rpc.call('convertStartNotification', options.startHandler, child.pid); }
      catch { /* extension not listening */ }
    }

    const onLine = async (line: string): Promise<void> => {
      const m = DL_PERCENT_RE.exec(line);
      if (!m) return;
      const percent = parseFloat(m[1]);
      const speedMatch = SPEED_RE.exec(line);
      const etaMatch = ETA_RE.exec(line);
      const info: any = {
        percent,
        speed: speedMatch ? speedMatch[1] : '',
        eta: etaMatch ? etaMatch[1] : '',
        source: 'ytdlp'
      };
      try {
        await rpc.call('convertOutput', options.progressTime || 1000, 0, info);
      } catch {
        try { child.kill(); } catch { /* gone */ }
      }
    };

    if (options.progressTime) {
      child.stdout?.on('data', (data: Buffer) => {
        data.toString('utf8').split('\n').forEach((line: string) => {
          if (line.trim()) void onLine(line);
        });
      });
    }

    return new Promise((resolve) => {
      child.on('exit', (code) => {
        if (child.pid) ytdlpChildren.delete(child.pid);
        resolve({ exitCode: code, pid: child.pid, stderr });
      });
    });
  }
});

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
process.on('exit', killAll);
console.error('[MediaGrabber CoApp] yt-dlp module loaded (binary: %s)', ytdlpBin);
