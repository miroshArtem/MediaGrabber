import { Settings, DEFAULT_SETTINGS, loadSettings, saveSettings, resetSettings, checkCoAppStatus, ThemeMode } from '../lib/settings';
import { applyTheme, initTheme } from '../lib/theme';

let currentSettings: Settings = { ...DEFAULT_SETTINGS };
let selectedTheme: ThemeMode = 'system';

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  await initializeSettings();
  setupEventListeners();
  setupThemeSelector();
  checkCoAppConnection();
});

async function initializeSettings(): Promise<void> {
  try {
    currentSettings = await loadSettings();
    selectedTheme = currentSettings.theme;

    const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
    const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;

    if (defaultQuality) defaultQuality.value = currentSettings.defaultQuality;
    if (showNotifications) showNotifications.checked = currentSettings.showNotifications;
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
  }
}

function setupThemeSelector(): void {
  const selector = document.getElementById('theme-selector');
  if (!selector) return;

  updateThemeButtons(selectedTheme);

  selector.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = (btn as HTMLElement).dataset.theme as ThemeMode;
      if (!theme) return;
      selectedTheme = theme;
      applyTheme(theme);
      updateThemeButtons(theme);
    });
  });
}

function updateThemeButtons(theme: ThemeMode): void {
  document.querySelectorAll('.theme-option').forEach(btn => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

function setupEventListeners(): void {
  document.getElementById('close-btn')?.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.getElementById('save-btn')?.addEventListener('click', async () => {
    await saveCurrentSettings();
  });

  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    await handleResetSettings();
  });
}

async function saveCurrentSettings(): Promise<void> {
  const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
  const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;

  const settings: Settings = {
    defaultQuality: (defaultQuality?.value as Settings['defaultQuality']) || 'ask',
    showNotifications: showNotifications?.checked ?? true,
    theme: selectedTheme
  };

  try {
    await saveSettings(settings);
    currentSettings = settings;
    showNotification('Settings saved');
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
    selectedTheme = currentSettings.theme;

    const defaultQuality = document.getElementById('default-quality') as HTMLSelectElement;
    const showNotifications = document.getElementById('show-notifications') as HTMLInputElement;

    if (defaultQuality) defaultQuality.value = 'ask';
    if (showNotifications) showNotifications.checked = true;

    applyTheme(selectedTheme);
    updateThemeButtons(selectedTheme);

    showNotification('Settings reset to defaults');
  } catch (error) {
    showNotification('Failed to reset settings', 'error');
  }
}

async function checkCoAppConnection(): Promise<void> {
  const statusEl = document.getElementById('coapp-status');
  const versionEl = document.getElementById('coapp-version');

  if (!statusEl) return;

  statusEl.textContent = 'Checking\u2026';
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
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.setAttribute('role', 'status');
  notification.setAttribute('aria-live', 'polite');

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}
