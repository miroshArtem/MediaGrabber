// Settings Page Script
// Handles settings UI interactions and persistence

import { Settings, DEFAULT_SETTINGS, loadSettings, saveSettings, resetSettings, checkCoAppStatus } from '../lib/settings';

interface SettingsLocal {
  downloadPath: string;
  defaultQuality: 'best' | 'worst' | 'ask';
  autoDownload: boolean;
  showNotifications: boolean;
}

let currentSettings: SettingsLocal = { ...DEFAULT_SETTINGS };

document.addEventListener('DOMContentLoaded', async () => {
  await initializeSettings();
  setupEventListeners();
  checkCoAppConnection();
});

async function initializeSettings(): Promise<void> {
  try {
    currentSettings = await loadSettings();
    
    // Populate form
    const downloadPath = document.getElementById('download-path') as HTMLInputElement;
    const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
    const autoDownload = document.getElementById('auto-download') as HTMLInputElement;
    const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;
    
    if (downloadPath) downloadPath.value = currentSettings.downloadPath;
    if (defaultQuality) defaultQuality.value = currentSettings.defaultQuality;
    if (autoDownload) autoDownload.checked = currentSettings.autoDownload;
    if (showNotifications) showNotifications.checked = currentSettings.showNotifications;
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
  }
}

function setupEventListeners(): void {
  // Close button
  document.getElementById('close-btn')?.addEventListener('click', () => {
    window.close();
  });
  
  // Browse button
  document.getElementById('browse-btn')?.addEventListener('click', async () => {
    // Note: chrome.downloads doesn't provide directory picker API
    // User must enter path manually or we use default
    const downloadPath = document.getElementById('download-path') as HTMLInputElement;
    if (downloadPath) {
      downloadPath.value = ''; // Reset to default
      showNotification('Using browser default download directory');
    }
  });
  
  // Save button
  document.getElementById('save-btn')?.addEventListener('click', async () => {
    await saveCurrentSettings();
  });
  
  // Reset button
  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    await handleResetSettings();
  });
}

async function saveCurrentSettings(): Promise<void> {
  const downloadPath = document.getElementById('download-path') as HTMLInputElement;
  const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
  const autoDownload = document.getElementById('auto-download') as HTMLInputElement;
  const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;
  
  const settings: Settings = {
    downloadPath: downloadPath?.value || '',
    defaultQuality: (defaultQuality?.value as Settings['defaultQuality']) || 'ask',
    autoDownload: autoDownload?.checked || false,
    showNotifications: showNotifications?.checked ?? true
  };
  
  try {
    await saveSettings(settings);
    currentSettings = settings;
    showNotification('Settings saved successfully');
  } catch (error) {
    showNotification('Failed to save settings', 'error');
  }
}

async function handleResetSettings(): Promise<void> {
  if (!confirm('Reset all settings to defaults?')) {
    return;
  }
  
  try {
    currentSettings = await resetSettings();
    
    // Update form
    const downloadPath = document.getElementById('download-path') as HTMLInputElement;
    const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
    const autoDownload = document.getElementById('auto-download') as HTMLInputElement;
    const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;
    
    if (downloadPath) downloadPath.value = '';
    if (defaultQuality) defaultQuality.value = 'ask';
    if (autoDownload) autoDownload.checked = false;
    if (showNotifications) showNotifications.checked = true;
    
    showNotification('Settings reset to defaults');
  } catch (error) {
    showNotification('Failed to reset settings', 'error');
  }
}

async function checkCoAppConnection(): Promise<void> {
  const statusEl = document.getElementById('coapp-status');
  const versionEl = document.getElementById('coapp-version');
  
  if (!statusEl) return;
  
  statusEl.textContent = 'Checking...';
  statusEl.className = 'status-indicator checking';
  
  const status = await checkCoAppStatus();
  
  if (status.connected) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status-indicator connected';
    if (versionEl && status.version) {
      versionEl.textContent = `v${status.version}`;
    }
  } else {
    statusEl.textContent = 'Disconnected';
    statusEl.className = 'status-indicator disconnected';
    if (versionEl) {
      versionEl.textContent = 'CoApp not running';
    }
  }
}

function showNotification(message: string, type: 'success' | 'error' = 'success'): void {
  // Simple notification - could be improved with toast UI
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 16px;
    right: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    text-align: center;
    ${type === 'success' ? 'background: #e8f5e9; color: #2e7d32;' : 'background: #ffebee; color: #c62828;'}
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2000);
}
