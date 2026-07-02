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

function asNumber(value: any): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatSize(format: any): number | undefined {
  return asNumber(format?.filesize) || asNumber(format?.filesize_approx);
}

function formatScore(format: any): number {
  return (asNumber(format?.tbr) || 0) * 1000000 + (formatSize(format) || 0) / 1000;
}

function chooseBest(formats: any[]): any | undefined {
  return formats.reduce((best, current) => {
    if (!best) return current;
    return formatScore(current) > formatScore(best) ? current : best;
  }, undefined);
}

function qualityLabel(format: any): string {
  const height = asNumber(format?.height) || 0;
  let label = height >= 2160 ? '4K' : height >= 1440 ? '1440p' : height ? `${height}p` : 'Video';
  const fps = asNumber(format?.fps);
  if (fps && fps > 30) label += ` ${Math.round(fps)}fps`;
  const dynamicRange = typeof format?.dynamic_range === 'string' ? format.dynamic_range : '';
  if (dynamicRange && dynamicRange !== 'SDR') label += ` ${dynamicRange}`;
  return label;
}

function audioSelectorFor(format: any): string {
  return format?.ext === 'webm' ? 'ba[ext=webm]/ba' : 'ba[ext=m4a]/ba';
}

function buildYtDlpQualities(info: any, url: string): any[] {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const audioFormats = formats.filter((format: any) =>
    format?.format_id && format?.acodec && format.acodec !== 'none' && format?.vcodec === 'none'
  );
  const bestAudio = chooseBest(audioFormats);

  const grouped = new Map<string, any>();
  formats
    .filter((format: any) =>
      format?.format_id &&
      format?.vcodec && format.vcodec !== 'none' &&
      asNumber(format.height)
    )
    .forEach((format: any) => {
      const fps = Math.round(asNumber(format.fps) || 0);
      const dynamicRange = format.dynamic_range || 'SDR';
      const key = `${format.height}:${fps}:${dynamicRange}`;
      const existing = grouped.get(key);
      if (!existing || formatScore(format) > formatScore(existing)) {
        grouped.set(key, format);
      }
    });

  const qualities: any[] = Array.from(grouped.values())
    .sort((a, b) =>
      (asNumber(b.height) || 0) - (asNumber(a.height) || 0) ||
      (asNumber(b.fps) || 0) - (asNumber(a.fps) || 0) ||
      formatScore(b) - formatScore(a)
    )
    .map((format: any) => {
      const formatId = String(format.format_id);
      const hasAudio = format.acodec && format.acodec !== 'none';
      const selector = hasAudio ? formatId : `${formatId}+${audioSelectorFor(format)}`;
      const size = formatSize(format);
      const audioSize = hasAudio ? undefined : formatSize(bestAudio);
      const fileSize = size && audioSize ? size + audioSize : size;
      return {
        height: asNumber(format.height) || 0,
        width: asNumber(format.width),
        bitrate: asNumber(format.tbr) ? Math.round(asNumber(format.tbr)! * 1000) : undefined,
        url,
        label: qualityLabel(format),
        formatArgs: ['-f', selector],
        formatId,
        ext: format.ext,
        fps: asNumber(format.fps),
        fileSize
      };
    });

  if (bestAudio) {
    qualities.push({
      height: 0,
      bitrate: asNumber(bestAudio.abr || bestAudio.tbr) ? Math.round(asNumber(bestAudio.abr || bestAudio.tbr)! * 1000) : undefined,
      url,
      label: 'Audio MP3',
      formatArgs: ['-f', 'ba', '-x', '--audio-format', 'mp3', '--audio-quality', '0'],
      formatId: String(bestAudio.format_id),
      ext: 'mp3',
      fileSize: formatSize(bestAudio)
    });
  }

  const manualSubs = info?.subtitles || {};
  const autoSubs = info?.automatic_captions || {};

  for (const [lang, subs] of Object.entries(manualSubs)) {
    if (!Array.isArray(subs) || subs.length === 0) continue;
    const best = (subs as any[]).find(s => s.ext === 'vtt') || (subs as any[]).find(s => s.ext === 'srt') || subs[0];
    if (best) {
      qualities.push({
        height: 0,
        url,
        label: `Subtitles — ${lang}`,
        kind: 'subtitle',
        language: lang,
        formatArgs: ['--write-subs', '--sub-lang', lang, '--sub-format', best.ext, '--skip-download'],
        ext: best.ext
      });
    }
  }

  for (const [lang, subs] of Object.entries(autoSubs)) {
    if (!Array.isArray(subs) || subs.length === 0) continue;
    if (manualSubs[lang]) continue;
    const best = (subs as any[]).find(s => s.ext === 'vtt') || (subs as any[]).find(s => s.ext === 'srt') || subs[0];
    if (best) {
      qualities.push({
        height: 0,
        url,
        label: `Subtitles — ${lang} (auto)`,
        kind: 'subtitle',
        language: lang,
        formatArgs: ['--write-auto-subs', '--sub-lang', lang, '--sub-format', best.ext, '--skip-download'],
        ext: best.ext
      });
    }
  }

  return qualities;
}

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

  ytdlpFormats: async (url: string) => {
    const args = ['--no-playlist', '--no-warnings', '-J', url];
    const child = spawn(ytdlpBin, args);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    return new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp format probe failed (${code}): ${stderr}`));
          return;
        }

        try {
          const info = JSON.parse(stdout.trim());
          resolve({
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            qualities: buildYtDlpQualities(info, url)
          });
        } catch (error: any) {
          reject(new Error(`Failed to parse yt-dlp format JSON: ${error.message || String(error)}`));
        }
      });
    });
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
