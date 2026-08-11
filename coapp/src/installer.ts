import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { gunzipSync } from 'zlib';
import { getInstallDir, getRuntimeBinary } from './paths';
import { registerManifest, unregisterManifest } from './native-autoinstall';

type RuntimeKind = 'ffmpeg' | 'ffprobe' | 'ytdlp';
type ReleaseConfig = {
  extensionId?: string;
  runtime?: Partial<Record<RuntimeKind, { url?: string; sha256?: string }>>;
};

function getSeaAsset(name: string): Buffer | undefined {
  try {
    const sea = require('node:sea');
    if (!sea.isSea()) return undefined;
    return Buffer.from(sea.getAsset(name));
  } catch {
    return undefined;
  }
}

async function getReleaseConfig(): Promise<ReleaseConfig> {
  const embedded = getSeaAsset('release-config.json');
  if (embedded) return JSON.parse(embedded.toString('utf8'));

  const configPath = path.join(path.dirname(process.execPath), 'release-config.json');
  try {
    return JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      result[key] = args[++i];
    } else {
      result[key] = true;
    }
  }
  return result;
}

function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function download(url: string, destination: string, redirects = 0): Promise<void> {
  if (redirects > 5) return Promise.reject(new Error('Too many download redirects'));
  if (!url.startsWith('https:')) return Promise.reject(new Error(`Only HTTPS downloads are supported: ${url}`));

  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(new URL(response.headers.location, url).toString(), destination, redirects + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      pipeline(response, file).then(resolve).catch(reject);
    });
    request.on('error', reject);
  });
}

async function installFile(kind: RuntimeKind, url: string | undefined, expectedHash: string | undefined, installDir: string): Promise<void> {
  const destination = path.join(installDir, getRuntimeBinary(kind));
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });

  if (!url) {
    if (fs.existsSync(destination)) return;
    throw new Error(`No ${kind} binary found and no --${kind}-url was provided`);
  }
  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new Error(`A SHA-256 checksum is required for --${kind}-url`);
  }

  const temporary = `${destination}.download-${process.pid}`;
  try {
    await download(url, temporary);
    const actualHash = await sha256(temporary);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`${kind} checksum mismatch: expected ${expectedHash}, got ${actualHash}`);
    }
    await fs.promises.rename(temporary, destination);
    if (process.platform !== 'win32') {
      await fs.promises.chmod(destination, 0o755);
    }
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
}

async function install(): Promise<void> {
  const args = parseArgs(process.argv.slice(3));
  const config = await getReleaseConfig();
  const extensionId = typeof args['extension-id'] === 'string' ? args['extension-id'] : config.extensionId;
  if (!extensionId) throw new Error('Missing extension ID in release config or --extension-id');
  const installDir = typeof args['install-dir'] === 'string' ? args['install-dir'] : getInstallDir();
  process.env.MEDIAGRABBER_INSTALL_DIR = installDir;
  await fs.promises.mkdir(installDir, { recursive: true });

  let temporaryCoapp: string | undefined;
  const compressedCoappAsset = getSeaAsset('coapp.bin.gz');
  const coappAsset = compressedCoappAsset ? gunzipSync(compressedCoappAsset) : getSeaAsset('coapp.bin');
  if (coappAsset) {
    temporaryCoapp = path.join(os.tmpdir(), `mediagrabber-coapp-${process.pid}${process.platform === 'win32' ? '.exe' : ''}`);
    await fs.promises.writeFile(temporaryCoapp, coappAsset);
  }
  const coappSource = typeof args.coapp === 'string'
    ? args.coapp
    : temporaryCoapp || path.join(path.dirname(process.execPath), `coapp${process.platform === 'win32' ? '.exe' : ''}`);
  const coappDestination = path.join(installDir, `coapp${process.platform === 'win32' ? '.exe' : ''}`);
  try {
    if (!fs.existsSync(coappSource)) {
      throw new Error(`CoApp binary not found: ${coappSource}`);
    }
    await fs.promises.copyFile(coappSource, coappDestination);
    if (process.platform !== 'win32') await fs.promises.chmod(coappDestination, 0o755);

    if (typeof args['extension-source'] === 'string') {
      await fs.promises.cp(args['extension-source'], path.join(installDir, 'extension'), { recursive: true });
    }

    for (const kind of ['ffmpeg', 'ffprobe', 'ytdlp'] as RuntimeKind[]) {
      const configEntry = config.runtime?.[kind];
      const url = typeof args[`${kind}-url`] === 'string' ? args[`${kind}-url`] as string : configEntry?.url;
      const hash = typeof args[`${kind}-sha256`] === 'string' ? args[`${kind}-sha256`] as string : configEntry?.sha256;
      await installFile(kind, url, hash, installDir);
    }
    await registerManifest([extensionId]);
    console.log(`MediaGrabber installed in ${installDir}`);
  } finally {
    if (temporaryCoapp) await fs.promises.rm(temporaryCoapp, { force: true });
  }
}

async function uninstall(): Promise<void> {
  const args = parseArgs(process.argv.slice(3));
  const installDir = typeof args['install-dir'] === 'string' ? args['install-dir'] : getInstallDir();
  process.env.MEDIAGRABBER_INSTALL_DIR = installDir;
  await unregisterManifest();
  console.log(`Native messaging registration removed for ${installDir}`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'install';
  if (command === 'install') {
    await install();
  } else if (command === 'uninstall') {
    await uninstall();
  } else {
    console.log('Usage: installer install --extension-id ID --coapp PATH [options]');
    console.log('       installer uninstall [--install-dir PATH]');
    console.log('Runtime options require URL and SHA-256 pairs: --ffmpeg-url URL --ffmpeg-sha256 HASH');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[MediaGrabber] Installation failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
