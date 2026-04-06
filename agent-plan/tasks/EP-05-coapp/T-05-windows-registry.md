# T-05 — Windows Registry Configuration

**Epic**: EP-05 (Companion App Development)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:25

---

## Goal

Implement Windows registry configuration for native messaging host registration.

---

## Subtasks

- [ ] Create native messaging manifest JSON
- [ ] Implement registry key creation (Windows)
- [ ] Implement manifest file installation
- [ ] Implement auto-uninstall
- [ ] Test registration/unregistration

---

## Native Messaging Manifest

```json
{
  "name": "com.mediagrabber.coapp",
  "description": "MediaGrabber companion application",
  "path": "C:\\Program Files\\MediaGrabber\\coapp.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://{chrome_extension_id}/",
    "chrome-extension://{edge_extension_id}/"
  ]
}
```

---

## Registration Script (Windows)

```typescript
// coapp/src/native-autoinstall.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MANIFEST_NAME = 'com.mediagrabber.coapp.json';

function getManifestPath(): string {
  return path.join(getInstallDir(), MANIFEST_NAME);
}

function getInstallDir(): string {
  // Default install location
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\MediaGrabber';
  } else if (process.platform === 'darwin') {
    return '/Applications/MediaGrabber';
  } else {
    return path.join(require('os').homedir(), '.mediagrabber');
  }
}

function getManifestContent(): object {
  return {
    name: 'com.mediagrabber.coapp',
    description: 'MediaGrabber companion application',
    path: path.join(getInstallDir(), getCoAppBinaryName()),
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://{EXTENSION_ID}/'
    ]
  };
}

function getCoAppBinaryName(): string {
  return process.platform === 'win32' ? 'coapp.exe' : 'coapp';
}

function getRegistryKeyPath(): string {
  if (process.platform === 'win32') {
    return 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.mediagrabber.coapp';
  }
  return '';
}

export async function registerManifest(): Promise<void> {
  const manifest = getManifestContent();
  const manifestPath = getManifestPath();
  
  // Ensure install directory exists
  await fs.promises.mkdir(getInstallDir(), { recursive: true });
  
  // Write manifest file
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Windows: Add registry key
  if (process.platform === 'win32') {
    const keyPath = getRegistryKeyPath();
    try {
      execSync(`reg add "${keyPath}" /ve /d "${manifestPath}" /f`);
    } catch (e) {
      console.error('Failed to add registry key:', e);
    }
  } else if (process.platform === 'darwin') {
    // macOS: Copy to ~/Library/Application Support/...
    const destDir = path.join(
      require('os').homedir(),
      'Library', 'Application Support',
      'Google', 'Chrome', 'NativeMessagingHosts'
    );
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(
      manifestPath,
      path.join(destDir, MANIFEST_NAME)
    );
  } else {
    // Linux: Copy to ~/.config/google-chrome/...
    const destDir = path.join(
      require('os').homedir(),
      '.config', 'google-chrome', 'NativeMessagingHosts'
    );
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(
      manifestPath,
      path.join(destDir, MANIFEST_NAME)
    );
  }
}

export async function unregisterManifest(): Promise<void> {
  if (process.platform === 'win32') {
    const keyPath = getRegistryKeyPath();
    try {
      execSync(`reg delete "${keyPath}" /f`);
    } catch (e) {
      // Key may not exist
    }
  }
  
  // Remove manifest file
  const manifestPath = getManifestPath();
  try {
    await fs.promises.unlink(manifestPath);
  } catch (e) {
    // File may not exist
  }
}
```

---

## Manual Registration

Users can also manually register by creating the manifest file:

**Windows (per-user):**
```
%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\com.mediagrabber.coapp.json
```

**Windows (system-wide):**
```
HKEY_LOCAL_MACHINE\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.mediagrabber.coapp
```

**macOS:**
```
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.mediagrabber.coapp.json
```

**Linux:**
```
~/.config/google-chrome/NativeMessagingHosts/com.mediagrabber.coapp.json
```

---

## Tests

- [ ] Manifest file is created correctly
- [ ] Registry key is added on Windows
- [ ] Manifest is in correct location for Chrome
- [ ] Unregister removes registry key
- [ ] Extension can connect to CoApp
