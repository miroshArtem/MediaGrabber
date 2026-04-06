# T-03 — File Operations

**Epic**: EP-05 (Companion App Development)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:25

---

## Goal

Implement file system operations (read, write, mkdir) accessible via RPC.

---

## Subtasks

- [ ] Implement `fs.write` method
- [ ] Implement `fs.mkdirp` method
- [ ] Implement `fs.readFile` method
- [ ] Implement `fs.stat` method
- [ ] Implement `fs.rename` method
- [ ] Implement `fs.unlink` method
- [ ] Implement filename uniqueness checking

---

## File Methods Registration

```typescript
// coapp/src/file.ts

import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

export function registerFileMethods(rpc: RpcRouter): void {
  rpc.register('fs.write', fsWrite);
  rpc.register('fs.write2', fsWrite2);
  rpc.register('fs.readFile', fsReadFile);
  rpc.register('fs.mkdirp', fsMkdirp);
  rpc.register('fs.stat', fsStat);
  rpc.register('fs.rename', fsRename);
  rpc.register('fs.unlink', fsUnlink);
  rpc.register('fs.copyFile', fsCopyFile);
  rpc.register('listFiles', listFiles);
  rpc.register('makeUniqueFileName', makeUniqueFileName);
  rpc.register('tmp.file', tmpFile);
  rpc.register('tmp.tmpName', tmpTmpName);
  rpc.register('path.homeJoin', pathHomeJoin);
}

// Write file from byte array
async function fsWrite(filepath: string, data: number[]): Promise<void> {
  const dir = path.dirname(filepath);
  await fs.promises.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(data);
  await fs.promises.writeFile(filepath, buffer);
}

// Write file (alternate signature)
async function fsWrite2(filepath: string, data: number[], append: boolean = false): Promise<void> {
  const dir = path.dirname(filepath);
  await fs.promises.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(data);
  const flags = append ? 'a' : 'w';
  await fs.promises.writeFile(filepath, buffer, { flag: flags });
}

// Read file
async function fsReadFile(filepath: string): Promise<number[]> {
  const data = await fs.promises.readFile(filepath);
  return Array.from(data);
}

// Create directory recursively
async function fsMkdirp(dirpath: string): Promise<void> {
  await fs.promises.mkdir(dirpath, { recursive: true });
}

// Get file stats
async function fsStat(filepath: string): Promise<{
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: number;
}> {
  const stats = await fs.promises.stat(filepath);
  return {
    size: stats.size,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    mtime: stats.mtime.getTime()
  };
}

// Rename file
async function fsRename(oldPath: string, newPath: string): Promise<void> {
  await fs.promises.rename(oldPath, newPath);
}

// Delete file
async function fsUnlink(filepath: string): Promise<void> {
  await fs.promises.unlink(filepath);
}

// Copy file
async function fsCopyFile(src: string, dest: string): Promise<void> {
  await fs.promises.copyFile(src, dest);
}

// List directory
async function listFiles(dirpath: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dirpath);
  return entries;
}

// Generate unique filename
async function makeUniqueFileName(dir: string, filename: string): Promise<string> {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  
  let uniqueName = filename;
  let counter = 1;
  
  while (fs.existsSync(path.join(dir, uniqueName))) {
    uniqueName = `${base}-${counter}${ext}`;
    counter++;
  }
  
  return path.join(dir, uniqueName);
}

// Temporary file
function tmpFile(): Promise<{ name: string; fd: number }> {
  return new Promise((resolve, reject) => {
    tmp.file((err, path, fd) => {
      if (err) reject(err);
      else resolve({ name: path, fd });
    });
  });
}

// Temporary filename
function tmpTmpName(): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.tmpName((err, path) => {
      if (err) reject(err);
      else resolve(path);
    });
  });
}

// Path.join with home directory
function pathHomeJoin(...parts: string[]): string {
  return path.join(require('os').homedir(), ...parts);
}
```

---

## Tests

- [ ] `fs.write` creates file with correct content
- [ ] `fs.mkdirp` creates nested directories
- [ ] `fs.readFile` returns byte array
- [ ] `fs.stat` returns correct metadata
- [ ] `makeUniqueFileName` handles duplicates
