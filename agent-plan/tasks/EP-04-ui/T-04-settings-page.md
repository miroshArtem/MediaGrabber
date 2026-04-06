# T-04 — Settings Page

**Epic**: EP-04 (UI Implementation)
**Priority**: P2
**Status**: DN (done)
**Last updated**: 2026-04-07 00:40

---

## Goal

Implement settings page for configuring extension behavior.

---

## Subtasks

- [ ] Create settings popup/page
- [ ] Add download directory setting
- [ ] Add default quality preference
- [ ] Add auto-download option
- [ ] Add notifications toggle
- [ ] Add CoApp connection status
- [ ] Save/load settings from storage

---

## Settings Structure

```typescript
interface Settings {
  downloadPath: string;      // Save directory
  defaultQuality: 'best' | 'worst' | 'ask';
  autoDownload: boolean;      // Auto-start download when detected
  showNotifications: boolean;
  coappPath?: string;        // Custom CoApp path
}
```

---

## Settings UI

```html
<div id="settings-panel" class="settings-panel hidden">
  <h2>Settings</h2>
  
  <div class="setting-item">
    <label for="download-path">Download Directory</label>
    <input type="text" id="download-path" placeholder="Default browser directory">
    <button id="browse-btn" class="btn btn-secondary">Browse</button>
  </div>
  
  <div class="setting-item">
    <label for="default-quality">Default Quality</label>
    <select id="default-quality">
      <option value="best">Best Available</option>
      <option value="worst">Lowest</option>
      <option value="ask">Ask Each Time</option>
    </select>
  </div>
  
  <div class="setting-item">
    <label>
      <input type="checkbox" id="auto-download">
      Auto-download when media detected
    </label>
  </div>
  
  <div class="setting-item">
    <label>
      <input type="checkbox" id="show-notifications" checked>
      Show notifications
    </label>
  </div>
  
  <div class="setting-item">
    <label>CoApp Status:</label>
    <span id="coapp-status" class="status-indicator">Checking...</span>
  </div>
  
  <div class="setting-actions">
    <button id="save-settings" class="btn btn-primary">Save</button>
    <button id="reset-settings" class="btn btn-secondary">Reset</button>
  </div>
</div>
```

---

## Settings Persistence

```typescript
const DEFAULT_SETTINGS: Settings = {
  downloadPath: '',
  defaultQuality: 'ask',
  autoDownload: false,
  showNotifications: true
};

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(['settings']);
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

async function initializeSettings(): Promise<void> {
  const settings = await loadSettings();
  
  // Populate form
  (document.getElementById('download-path') as HTMLInputElement).value = settings.downloadPath;
  (document.getElementById('default-quality') as HTMLSelectElement).value = settings.defaultQuality;
  (document.getElementById('auto-download') as HTMLInputElement).checked = settings.autoDownload;
  (document.getElementById('show-notifications') as HTMLInputElement).checked = settings.showNotifications;
}

// Save button handler
document.getElementById('save-settings')?.addEventListener('click', async () => {
  const settings: Settings = {
    downloadPath: (document.getElementById('download-path') as HTMLInputElement).value,
    defaultQuality: (document.getElementById('default-quality') as HTMLSelectElement).value as any,
    autoDownload: (document.getElementById('auto-download') as HTMLInputElement).checked,
    showNotifications: (document.getElementById('show-notifications') as HTMLInputElement).checked
  };
  
  await saveSettings(settings);
  showNotification('Settings saved');
});
```

---

## Tests

- [ ] Settings load from storage on popup open
- [ ] Settings save to storage on button click
- [ ] Form values match saved settings
- [ ] Reset button restores defaults
