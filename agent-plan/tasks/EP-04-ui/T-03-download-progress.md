# T-03 — Download Progress UI

**Epic**: EP-04 (UI Implementation)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:20

---

## Goal

Implement download progress display in popup with percentage, speed, and estimated time.

---

## Subtasks

- [ ] Create progress bar UI
- [ ] Show percentage complete
- [ ] Show download speed (MB/s)
- [ ] Show estimated time remaining
- [ ] Show cancel button
- [ ] Handle download complete state
- [ ] Handle download error state

---

## Progress UI Structure

```html
<div id="download-progress" class="download-progress hidden">
  <div class="progress-header">
    <span id="progress-filename" class="progress-filename">video.mp4</span>
    <button id="cancel-btn" class="cancel-btn" title="Cancel">✕</button>
  </div>
  <div class="progress-bar">
    <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
  </div>
  <div class="progress-stats">
    <span id="progress-percent">0%</span>
    <span id="progress-speed">0 MB/s</span>
    <span id="progress-time">--:-- remaining</span>
  </div>
</div>
```

---

## Progress Update Handling

```typescript
// popup.ts - Progress handling

interface ProgressInfo {
  percent: number;
  speed: number;  // bytes per second
  timeRemaining: number; // seconds
}

// Listen for progress updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'downloadProgress') {
    updateProgressUI(msg.progress);
  } else if (msg.action === 'downloadComplete') {
    showDownloadComplete();
  } else if (msg.action === 'downloadError') {
    showDownloadError(msg.error);
  }
});

function updateProgressUI(progress: ProgressInfo): void {
  const progressDiv = document.getElementById('download-progress');
  progressDiv?.classList.remove('hidden');
  
  const fill = document.getElementById('progress-fill');
  const percent = document.getElementById('progress-percent');
  const speed = document.getElementById('progress-speed');
  const time = document.getElementById('progress-time');
  
  if (fill) fill.style.width = `${progress.percent}%`;
  if (percent) percent.textContent = `${Math.round(progress.percent)}%`;
  if (speed) speed.textContent = formatSpeed(progress.speed);
  if (time) time.textContent = formatTime(progress.timeRemaining);
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec > 1000000) {
    return `${(bytesPerSec / 1000000).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1000).toFixed(0)} KB/s`;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showDownloadComplete(): void {
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = 'Download complete!';
    statusBar.classList.remove('hidden', 'error');
    statusBar.classList.add('success');
  }
  
  // Reset UI after delay
  setTimeout(() => {
    document.getElementById('download-progress')?.classList.add('hidden');
  }, 3000);
}

function showDownloadError(error: string): void {
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = `Error: ${error}`;
    statusBar.classList.remove('hidden', 'success');
    statusBar.classList.add('error');
  }
}

// Cancel button
document.getElementById('cancel-btn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'cancelDownload' });
});
```

---

## Download Button State

```typescript
function setDownloadButtonState(state: 'idle' | 'downloading' | 'disabled'): void {
  const btn = document.getElementById('download-btn');
  const btnText = btn?.querySelector('.btn-text');
  const btnProgress = btn?.querySelector('.btn-progress');
  
  if (!btn) return;
  
  switch (state) {
    case 'idle':
      btn.classList.remove('disabled');
      btnText?.classList.remove('hidden');
      btnProgress?.classList.add('hidden');
      break;
    case 'downloading':
      btn.classList.add('disabled');
      btnText?.classList.add('hidden');
      btnProgress?.classList.remove('hidden');
      break;
    case 'disabled':
      btn.classList.add('disabled');
      btn.disabled = true;
      break;
  }
}
```

---

## Tests

- [ ] Progress bar updates during download
- [ ] Percentage is accurate
- [ ] Speed is calculated correctly
- [ ] Time remaining is estimated
- [ ] Cancel button works
- [ ] Error state displays correctly
- [ ] Complete state displays correctly
