// FFmpeg Converter — VDH-style RPC handlers
// Registers: convert, abortConvert, probe, info

import { spawn as nodeSpawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import rpc from './rpc';
import { getRuntimeBinary, getRuntimeRoots } from './paths';

const convertChildren = new Map<number, ChildProcess>();
const to_kill = new Set<ChildProcess>();

function spawn(arg0: string, argv: string[]): ChildProcess {
  const child = nodeSpawn(arg0, argv);
  if (child.pid) {
    to_kill.add(child);
    child.on('exit', () => { to_kill.delete(child); });
  }
  return child;
}

function findFFmpeg(): string {
  const paths = [
    ...getRuntimeRoots().map(root => path.join(root, getRuntimeBinary('ffmpeg'))),
    path.join(process.cwd(), 'ffmpeg', 'ffmpeg' + (process.platform === 'win32' ? '.exe' : '')),
    'ffmpeg'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return 'ffmpeg';
}

function findFFprobe(): string {
  const paths = [
    ...getRuntimeRoots().map(root => path.join(root, getRuntimeBinary('ffprobe'))),
    path.join(process.cwd(), 'ffmpeg', 'ffprobe' + (process.platform === 'win32' ? '.exe' : '')),
    'ffprobe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return 'ffprobe';
}

const ffmpegBin = findFFmpeg();
const ffprobeBin = findFFprobe();

const PROPS_RE = /\S+=\s*\S+/;
const NAMEVAL_RE = /(\S+)=\s*(\S+)/;

function killAll(): void {
  to_kill.forEach((child) => {
    try { child.kill(); } catch { /* already exited */ }
  });
}

rpc.listen({
  abortConvert: (pid: number) => {
    const child = convertChildren.get(pid);
    if (child && child.exitCode == null) {
      try { child.stdin?.write('q'); } catch { /* stdin closed */ }
      setTimeout(() => {
        if (child && child.exitCode == null) {
          try { child.kill(9); } catch { /* already exited */ }
        }
      }, 10000);
    }
  },

  convert: async (args: string[] = ['-h'], options: any = {}) => {
    const ffmpegBaseArgs = '-progress pipe:1 -hide_banner -loglevel error'.split(' ');
    let manifestDir: string | undefined;
    let resolvedArgs = args;
    const manifestFiles = Array.isArray(options.manifestFiles) ? options.manifestFiles : [];
    if (manifestFiles.length > 0) {
      manifestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mediagrabber-hls-'));
      const replacements = new Map<string, string>();
      for (let i = 0; i < manifestFiles.length; i += 1) {
        const filePath = path.join(manifestDir, `manifest-${i}.m3u8`);
        await fs.promises.writeFile(filePath, String(manifestFiles[i]?.content || ''), 'utf8');
        replacements.set(String(manifestFiles[i]?.placeholder || ''), filePath);
      }
      resolvedArgs = args.map((arg) => replacements.get(arg) || arg);
    }

    const fullArgs = [...ffmpegBaseArgs, ...resolvedArgs];
    const child = spawn(ffmpegBin, fullArgs);
    if (child.pid) convertChildren.set(child.pid, child);

    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => { stderr += data.toString('utf8'); });

    if (options.startHandler) {
      try {
        await rpc.call('convertStartNotification', options.startHandler, child.pid);
      } catch { /* extension not listening */ }
    }

    let progressInfo: Record<string, string> = {};

    const onLine = async (line: string): Promise<void> => {
      const props = line.match(PROPS_RE) || [];
      props.forEach((prop: string) => {
        const m = NAMEVAL_RE.exec(prop);
        if (m) progressInfo[m[1]] = m[2];
      });
      if (progressInfo['progress']) {
        const info = progressInfo;
        progressInfo = {};
        if (typeof info['out_time_ms'] !== 'undefined') {
          // out_time_ms is in NANOSECONDS, not milliseconds
          const seconds = parseInt(info['out_time_ms'], 10) / 1_000_000;
          try {
            await rpc.call('convertOutput', options.progressTime, seconds, info);
          } catch {
            try { child.kill(); } catch { /* already exited */ }
          }
        }
      }
    };

    if (options.progressTime) {
      child.stdout?.on('data', (data: Buffer) => {
        data.toString('utf8').split('\n').forEach((line: string) => { onLine(line); });
      });
    }

    return new Promise((resolve) => {
      child.on('exit', async (code) => {
        if (child.pid) convertChildren.delete(child.pid);
        if (manifestDir) await fs.promises.rm(manifestDir, { recursive: true, force: true });
        resolve({ exitCode: code, pid: child.pid, stderr });
      });
    });
  },

  probe: (input: string, json: boolean = false, headers: string[] = []) => {
    const args: string[] = [];
    if (json) {
      args.push('-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams');
    }
    (headers || []).forEach((h: string) => {
      args.push('-headers', h);
    });
    args.push(input);

    return new Promise((resolve, reject) => {
      const child = spawn(ffprobeBin, args);
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString('utf8'); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString('utf8'); });
      child.on('exit', (code) => {
        if (code === 0) {
          if (json) {
            try {
              resolve(JSON.parse(stdout));
            } catch {
              reject(new Error('Failed to parse ffprobe JSON: ' + stderr));
            }
          } else {
            resolve(stdout);
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        }
      });
    });
  },

  'converter.info': () => {
    return new Promise((resolve) => {
      const child = spawn(ffmpegBin, ['-h']);
      let stdout = '';
      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString('utf8'); });
      child.on('exit', () => {
        const versionMatch = stdout.match(/ffmpeg version (\S+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        resolve({
          program: 'ffmpeg',
          version,
          converterBinary: ffmpegBin
        });
      });
    });
  }
});

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
process.on('exit', killAll);

console.error('[MediaGrabber CoApp] Converter module loaded (ffmpeg: %s)', ffmpegBin);
