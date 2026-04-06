# T-01 — Popup HTML/CSS

**Epic**: EP-04 (UI Implementation)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-07 00:20

---

## Goal

Create the popup HTML structure and CSS styling.

---

## Subtasks

- [ ] Create `popup.html` with semantic structure
- [ ] Create media list container
- [ ] Create quality selector UI
- [ ] Create download button
- [ ] Create status/progress area
- [ ] Add responsive CSS
- [ ] Add dark/light theme support (optional)

---

## popup.html Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Header -->
    <header class="popup-header">
      <h1 class="popup-title">MediaGrabber</h1>
      <button id="settings-btn" class="icon-btn" title="Settings">
        <svg>...</svg>
      </button>
    </header>
    
    <!-- Status Bar -->
    <div id="status-bar" class="status-bar hidden">
      <span id="status-text">No media detected</span>
    </div>
    
    <!-- Media List -->
    <div id="media-list" class="media-list">
      <!-- Media items will be inserted here -->
      <div class="empty-state" id="empty-state">
        <svg class="empty-icon">...</svg>
        <p>No media detected on this page</p>
        <button id="refresh-btn" class="btn btn-secondary">Refresh</button>
      </div>
    </div>
    
    <!-- Selected Media Details -->
    <div id="media-details" class="media-details hidden">
      <h2 id="media-title">Video Title</h2>
      <div id="quality-list" class="quality-list">
        <!-- Quality options will be inserted here -->
      </div>
    </div>
    
    <!-- Download Section -->
    <div id="download-section" class="download-section hidden">
      <div class="filename-input">
        <label for="filename">Filename:</label>
        <input type="text" id="filename" placeholder="video.mp4">
      </div>
      <button id="download-btn" class="btn btn-primary">
        <span class="btn-text">Download</span>
        <span class="btn-progress hidden">Downloading...</span>
      </button>
    </div>
    
    <!-- Footer -->
    <footer class="popup-footer">
      <span class="version">v1.0.0</span>
    </footer>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

---

## popup.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 360px;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
  background: #fff;
}

.popup-container {
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

/* Header */
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
}

/* Media List */
.media-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.media-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f9f9f9;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.media-item:hover {
  background: #f0f0f0;
}

.media-item.selected {
  background: #e3f2fd;
  border: 1px solid #2196f3;
}

.media-info {
  flex: 1;
}

.media-type {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.media-title {
  font-weight: 500;
  margin: 4px 0;
}

/* Quality Selector */
.quality-list {
  padding: 8px;
}

.quality-option {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 6px;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
}

.quality-option:hover {
  background: #e8e8e8;
}

.quality-option.selected {
  background: #e3f2fd;
  border: 1px solid #2196f3;
}

.quality-radio {
  margin-right: 10px;
}

.quality-label {
  font-weight: 500;
}

.quality-bandwidth {
  font-size: 12px;
  color: #666;
  margin-left: auto;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

/* Progress */
.progress-bar {
  width: 100%;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s;
}

/* Utility */
.hidden {
  display: none !important;
}
```

---

## Tests

- [ ] Popup opens without errors
- [ ] CSS renders correctly
- [ ] All elements are visible and styled
- [ ] Scroll works for long lists
