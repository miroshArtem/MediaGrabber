// Download Manager — VDH-style RPC handlers
// Registers: downloads.download, downloads.search, downloads.cancel

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import rpc from './rpc';

// got 12+ is ESM-only; lazy-load via native dynamic import so this CJS
// module can use it. The Function wrapper prevents TypeScript from
// rewriting import() into require() (which would throw ERR_REQUIRE_ESM).
const nativeImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;
let _got: any;
async function getGot(): Promise<any> {
  if (!_got) {
    _got = (await nativeImport('got')).default;
  }
  return _got;
}

const defaultDownloadFolder = path.join(os.homedir(), 'Downloads');

let currentDownloadId = 0;
const downloads: Record<number, any> = {};

function cleanupEntry(downloadId: number): void {
  setTimeout(() => { delete downloads[downloadId]; }, 60000);
}

rpc.listen({
  'downloads.download': async (options: any = {}) => {
    const got = await getGot();

    const filename = path.join(
      options.directory || defaultDownloadFolder,
      options.filename || 'download'
    );

    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const dlOptions: any = {
      rejectUnauthorized: !!options.rejectUnauthorized,
      headers: {}
    };
    (options.headers || []).forEach((header: any) => {
      dlOptions.headers[header.name] = header.value;
    });

    const downloadId = ++currentDownloadId;
    const stream = got.stream(options.url, dlOptions);

    downloads[downloadId] = {
      stream,
      totalBytes: 0,
      bytesReceived: 0,
      url: options.url,
      filename,
      state: 'in_progress',
      error: null
    };

    stream.on('response', (response: any) => {
      const contentLength = response.headers['content-length'];
      if (contentLength) {
        downloads[downloadId].totalBytes = parseInt(contentLength, 10);
        response.on('data', (data: Buffer) => {
          downloads[downloadId].bytesReceived += data.length;
        });
      }
    });

    stream.on('error', (error: any) => {
      const entry = downloads[downloadId];
      if (!entry) return;
      // ECONNRESET after receiving data usually means the server closed
      // the connection after a complete transfer — treat as complete.
      if (error.code === 'ECONNRESET' && entry.bytesReceived > 0) {
        entry.state = 'complete';
      } else {
        entry.state = 'interrupted';
        entry.error = error.message || String(error);
        rpc.call('downloadError', downloadId, entry.error).catch(() => {});
      }
      cleanupEntry(downloadId);
    });

    const fileStream = fs.createWriteStream(filename);
    stream.pipe(fileStream)
      .on('finish', () => {
        const entry = downloads[downloadId];
        if (entry && entry.state === 'in_progress') {
          entry.state = 'complete';
          rpc.call('downloadComplete', downloadId, filename).catch(() => {});
        }
        cleanupEntry(downloadId);
      })
      .on('error', (err: Error) => {
        const entry = downloads[downloadId];
        if (entry) {
          entry.state = 'interrupted';
          entry.error = err.message || String(err);
          rpc.call('downloadError', downloadId, entry.error).catch(() => {});
        }
        cleanupEntry(downloadId);
      });

    return downloadId;
  },

  'downloads.search': (query: any = {}) => {
    const entry = downloads[query.id];
    if (entry) {
      return [{
        totalBytes: entry.totalBytes,
        bytesReceived: entry.bytesReceived,
        url: entry.url,
        filename: entry.filename,
        state: entry.state,
        error: entry.error
      }];
    }
    return [];
  },

  'downloads.cancel': (downloadId: number) => {
    const entry = downloads[downloadId];
    if (entry && entry.state === 'in_progress') {
      entry.state = 'interrupted';
      entry.error = 'Aborted';
      try { entry.stream.destroy(); } catch { /* already destroyed */ }
    }
  }
});

console.error('[MediaGrabber CoApp] Downloads module loaded (default folder: %s)', defaultDownloadFolder);
