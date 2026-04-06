// Settings Management
// Handles loading, saving, and managing extension settings

export interface Settings {
  downloadPath: string;
  defaultQuality: 'best' | 'worst' | 'ask';
  autoDownload: boolean;
  showNotifications: boolean;
  coappPath?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  downloadPath: '',
  defaultQuality: 'ask',
  autoDownload: false,
  showNotifications: true
};

/**
 * Load settings from chrome storage
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...result.settings };
  } catch (error) {
    console.error('[MediaGrabber] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to chrome storage
 */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error('[MediaGrabber] Failed to save settings:', error);
    throw error;
  }
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<Settings> {
  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[MediaGrabber] Failed to reset settings:', error);
    throw error;
  }
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const settings = await loadSettings();
  return settings[key];
}

/**
 * Update a specific setting
 */
export async function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  const settings = await loadSettings();
  settings[key] = value;
  await saveSettings(settings);
}

/**
 * Check if CoApp is connected and working
 */
export async function checkCoAppStatus(): Promise<{ connected: boolean; version?: string }> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'PING' });
    if (response && response.success) {
      return { connected: true, version: response.version };
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}
