// Native Messaging Host Auto-Install
// Handles registration/unregistration of native messaging host

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getHostBinaryPath, getInstallDir } from './paths';

const MANIFEST_NAME = 'com.mediagrabber.coapp.json';

export interface ManifestContent {
  name: string;
  description: string;
  path: string;
  type: string;
  allowed_origins: string[];
}
function getManifestPath(): string {
  return path.join(getInstallDir(), MANIFEST_NAME);
}
function getChromeRegistryKeyPath(): string {
  if (process.platform === 'win32') {
    return 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.mediagrabber.coapp';
  }
  return '';
}

function getEdgeRegistryKeyPath(): string {
  if (process.platform === 'win32') {
    return 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.mediagrabber.coapp';
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
    path: getHostBinaryPath(),
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
  // Register for Chrome
  const chromeKeyPath = getChromeRegistryKeyPath();
  try {
    execSync(`reg add "${chromeKeyPath}" /ve /d "${manifestPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key added: ${chromeKeyPath}`);
  } catch (e) {
    console.error('[MediaGrabber] Failed to add Chrome registry key:', e);
    throw e;
  }
  
  // Register for Edge
  const edgeKeyPath = getEdgeRegistryKeyPath();
  try {
    execSync(`reg add "${edgeKeyPath}" /ve /d "${manifestPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key added: ${edgeKeyPath}`);
  } catch (e) {
    console.error('[MediaGrabber] Failed to add Edge registry key:', e);
    // Don't throw - Edge registration is not critical
  }
}

async function unregisterWindows(): Promise<void> {
  // Unregister Chrome
  const chromeKeyPath = getChromeRegistryKeyPath();
  try {
    execSync(`reg delete "${chromeKeyPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key removed: ${chromeKeyPath}`);
  } catch {
    // Key may not exist
  }
  
  // Unregister Edge
  const edgeKeyPath = getEdgeRegistryKeyPath();
  try {
    execSync(`reg delete "${edgeKeyPath}" /f`, { stdio: 'pipe' });
    console.error(`[MediaGrabber] Registry key removed: ${edgeKeyPath}`);
  } catch {
    // Key may not exist
  }
}

// macOS registration
async function registerMac(manifestPath: string): Promise<void> {
  const home = require('os').homedir();
  const destinations = [
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
    path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts')
  ];

  for (const destDir of destinations) {
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(manifestPath, path.join(destDir, MANIFEST_NAME));
    console.error(`[MediaGrabber] Manifest copied to: ${destDir}`);
  }
}

async function unregisterMac(): Promise<void> {
  const home = require('os').homedir();
  const destinations = [
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
    path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts')
  ];

  for (const destDir of destinations) {
    try {
      await fs.promises.unlink(path.join(destDir, MANIFEST_NAME));
      console.error(`[MediaGrabber] Manifest removed from: ${destDir}`);
    } catch {
      // File may not exist
    }
  }
}
// Linux registration
async function registerLinux(manifestPath: string): Promise<void> {
  const home = require('os').homedir();
  const destinations = [
    path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
    path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts')
  ];

  for (const destDir of destinations) {
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(manifestPath, path.join(destDir, MANIFEST_NAME));
    console.error(`[MediaGrabber] Manifest copied to: ${destDir}`);
  }
}

async function unregisterLinux(): Promise<void> {
  const home = require('os').homedir();
  const destinations = [
    path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
    path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts')
  ];

  for (const destDir of destinations) {
    try {
      await fs.promises.unlink(path.join(destDir, MANIFEST_NAME));
      console.error(`[MediaGrabber] Manifest removed from: ${destDir}`);
    } catch {
      // File may not exist
    }
  }
}
