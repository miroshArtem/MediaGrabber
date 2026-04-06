// Native Messaging Host Auto-Install
// Handles registration/unregistration of native messaging host

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MANIFEST_NAME = 'com.mediagrabber.coapp.json';

export interface ManifestContent {
  name: string;
  description: string;
  path: string;
  type: string;
  allowed_origins: string[];
}

function getInstallDir(): string {
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\MediaGrabber';
  } else if (process.platform === 'darwin') {
    return '/Applications/MediaGrabber';
  } else {
    return path.join(require('os').homedir(), '.mediagrabber');
  }
}

function getCoAppBinaryName(): string {
  return process.platform === 'win32' ? 'coapp.exe' : 'coapp';
}

function getManifestPath(): string {
  return path.join(getInstallDir(), MANIFEST_NAME);
}

function getRegistryKeyPath(): string {
  if (process.platform === 'win32') {
    return 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.mediagrabber.coapp';
  }
  return '';
}

function getManifestContent(extensionIds?: string[]): ManifestContent {
  const defaultOrigins = [
    'chrome-extension://{CHROME_EXTENSION_ID}/',
    'chrome-extension://{EDGE_EXTENSION_ID}/'
  ];
  
  return {
    name: 'com.mediagrabber.coapp',
    description: 'MediaGrabber companion application',
    path: path.join(getInstallDir(), getCoAppBinaryName()),
    type: 'stdio',
    allowed_origins: extensionIds?.length ? extensionIds.map(id => `chrome-extension://${id}/`) : defaultOrigins
  };
}

/**
 * Register the native messaging manifest
 */
export async function registerManifest(extensionIds?: string[]): Promise<void> {
  const manifest = getManifestContent(extensionIds);
  const manifestPath = getManifestPath();
  
  // Ensure install directory exists
  await fs.promises.mkdir(getInstallDir(), { recursive: true });
  
  // Write manifest file
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.error(`[MediaGrabber] Manifest written to: ${manifestPath}`);
  
  // Register based on platform
  if (process.platform === 'win32') {
    await registerWindows(manifestPath);
  } else if (process.platform === 'darwin') {
    await registerMac(manifestPath);
  } else {
    await registerLinux(manifestPath);
  }
}

/**
 * Unregister the native messaging manifest
 */
export async function unregisterManifest(): Promise<void> {
  if (process.platform === 'win32') {
    await unregisterWindows();
  } else if (process.platform === 'darwin') {
    await unregisterMac();
  } else {
    await unregisterLinux();
  }
  
  // Remove manifest file
  const manifestPath = getManifestPath();
  try {
    await fs.promises.unlink(manifestPath);
    console.error(`[MediaGrabber] Manifest removed: ${manifestPath}`);
  } catch {
    // File may not exist
  }
}

// Windows registration
async function registerWindows(manifestPath: string): Promise<void> {
  const keyPath = getRegistryKeyPath();
  try {
    execSync(`reg add "${keyPath}" /ve /d "${manifestPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key added: ${keyPath}`);
  } catch (e) {
    console.error('[MediaGrabber] Failed to add registry key:', e);
    throw e;
  }
}

async function unregisterWindows(): Promise<void> {
  const keyPath = getRegistryKeyPath();
  try {
    execSync(`reg delete "${keyPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key removed: ${keyPath}`);
  } catch {
    // Key may not exist
  }
}

// macOS registration
async function registerMac(manifestPath: string): Promise<void> {
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
  
  console.error(`[MediaGrabber] Manifest copied to: ${destDir}`);
}

async function unregisterMac(): Promise<void> {
  const manifestPath = path.join(
    require('os').homedir(),
    'Library', 'Application Support',
    'Google', 'Chrome', 'NativeMessagingHosts',
    MANIFEST_NAME
  );
  
  try {
    await fs.promises.unlink(manifestPath);
    console.error(`[MediaGrabber] Manifest removed from macOS`);
  } catch {
    // File may not exist
  }
}

// Linux registration
async function registerLinux(manifestPath: string): Promise<void> {
  const destDir = path.join(
    require('os').homedir(),
    '.config', 'google-chrome', 'NativeMessagingHosts'
  );
  
  await fs.promises.mkdir(destDir, { recursive: true });
  await fs.promises.copyFile(
    manifestPath,
    path.join(destDir, MANIFEST_NAME)
  );
  
  console.error(`[MediaGrabber] Manifest copied to: ${destDir}`);
}

async function unregisterLinux(): Promise<void> {
  const manifestPath = path.join(
    require('os').homedir(),
    '.config', 'google-chrome', 'NativeMessagingHosts',
    MANIFEST_NAME
  );
  
  try {
    await fs.promises.unlink(manifestPath);
    console.error(`[MediaGrabber] Manifest removed from Linux`);
  } catch {
    // File may not exist
  }
}

// CLI for registration
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'register') {
    const extensionIds = args.slice(1);
    registerManifest(extensionIds)
      .then(() => {
        console.error('[MediaGrabber] Registration complete');
        process.exit(0);
      })
      .catch((e) => {
        console.error('[MediaGrabber] Registration failed:', e);
        process.exit(1);
      });
  } else if (args[0] === 'unregister') {
    unregisterManifest()
      .then(() => {
        console.error('[MediaGrabber] Unregistration complete');
        process.exit(0);
      })
      .catch((e) => {
        console.error('[MediaGrabber] Unregistration failed:', e);
        process.exit(1);
      });
  } else {
    console.log('Usage: coapp register [extension-id...] | unregister');
    process.exit(1);
  }
}
