# T-04 — Download Manager

**Epic**: EP-05 (Companion App Development)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 01:05

---

## Goal

Implement HTTP download functionality via CoApp (when extension delegates to CoApp for direct file downloads).

---

## Subtasks

- [ ] Implement `downloads.download` method
- [ ] Implement `downloads.search` method
- [ ] Implement `downloads.cancel` method
- [ ] Track download progress
- [ ] Handle partial/interrupted downloads
- [ ] Support custom headers

---

## Download Manager

```typescript
// coapp/src/downloads.ts

import * as fs from 'fs';
import got, { GotStream } from 'got';

interface DownloadEntry {
  id: string;
  url: string;
  filename: string;
  totalBytes?: number;
  bytesReceived: number;
  state: 'in_progress' | 'complete' | 'interrupted' | 'cancelled';
  stream?: GotStream;
  error?: string;
}

const downloads = new Map<string, DownloadEntry>();
let downloadCounter = 0;

export function registerDownloadMethods(rpc: RpcRouter): void {
  rpc.register('downloads.download', downloadsDownload);
  rpc.register('downloads.search', downloadsSearch);
  rpc.register('downloads.cancel', downloadsCancel);
}

async function downloadsDownload(
  options: {
    url: string;
    filename: string;
    headers?: { [key: string]: string };
    overwrite?: boolean;
  }
): Promise<{ id: string; filename: string }> {
  const id = `dl_${++downloadCounter}`;
  
  const entry: DownloadEntry = {
    id,
    url: options.url,
    filename: options.filename,
    bytesReceived: 0,
    state: 'in_progress'
  };
  
  downloads.set(id, entry);
  
  try {
    // Ensure directory exists
    const dir = require('path').dirname(options.filename);
    await fs.promises.mkdir(dir, { recursive: true });
    
    // Start download
    const stream = got.stream(options.url, {
      headers: options.headers,
    });
    
    entry.stream = stream as any;
    
    const file = fs.createWriteStream(options.filename);
    
    stream.on('downloadProgress', (progress) => {
      entry.totalBytes = progress.total;
      entry.bytesReceived = progress.transferred;
    });
    
    stream.pipe(file);
    
    // Wait for completion
    await new Promise<void>((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
      stream.on('error', (err) => {
        entry.state = 'interrupted';
        entry.error = err.message;
        reject(err);
      });
    });
    
    entry.state = 'complete';
    
    return { id, filename: options.filename };
  } catch (error: any) {
    entry.state = 'interrupted';
    entry.error = error.message;
    throw error;
  }
}

async function downloadsSearch(
  options: { id?: string; state?: string } = {}
): Promise<Array<{
  id: string;
  url: string;
  filename: string;
  totalBytes?: number;
  bytesReceived: number;
  state: string;
}>> {
  const results: any[] = [];
  
  for (const [id, entry] of downloads) {
    if (options.id && options.id !== id) continue;
    if (options.state && options.state !== entry.state) continue;
    
    results.push({
      id: entry.id,
      url: entry.url,
      filename: entry.filename,
      totalBytes: entry.totalBytes,
      bytesReceived: entry.bytesReceived,
      state: entry.state
    });
  }
  
  return results;
}

async function downloadsCancel(id: string): Promise<void> {
  const entry = downloads.get(id);
  
  if (entry && entry.stream) {
    entry.state = 'cancelled';
    (entry.stream as any).cancel();
  }
}
```

---

## Tests

- [ ] Download starts and completes
- [ ] Progress is tracked
- [ ] Cancel stops the download
- [ ] Search returns correct entries
- [ ] Handles ECONNRESET gracefully
