# T-02 — Quality Selector UI

**Epic**: EP-04 (UI Implementation)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:20

---

## Goal

Implement interactive quality selection UI that shows available qualities and allows user to choose.

---

## Subtasks

- [ ] Render quality options dynamically from detected media
- [ ] Show quality label (1080p, 720p, etc.)
- [ ] Show bandwidth/bitrate info
- [ ] Show codec info if available
- [ ] Allow single selection
- [ ] Visual indicator for selected quality
- [ ] "Best quality" and "Lowest quality" quick options

---

## Quality Option Rendering

```typescript
// popup.ts

interface QualityOption {
  label: string;        // "1080p"
  bandwidth: number;     // 3000000
  bandwidthLabel: string; // "3.0 Mbps"
  resolution?: string;   // "1920x1080"
  url: string;
}

function renderQualityList(qualities: QualityOption[]): void {
  const container = document.getElementById('quality-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (qualities.length === 0) {
    container.innerHTML = '<p class="no-quality">No quality options available</p>';
    return;
  }
  
  // Quick options
  const quickOptions = document.createElement('div');
  quickOptions.className = 'quick-options';
  quickOptions.innerHTML = `
    <button class="quick-btn" data-quality="best">Best</button>
    <button class="quick-btn" data-quality="worst">Lowest</button>
  `;
  container.appendChild(quickOptions);
  
  // Individual options
  qualities.forEach((q, index) => {
    const option = document.createElement('div');
    option.className = 'quality-option';
    option.dataset.index = String(index);
    
    option.innerHTML = `
      <input type="radio" name="quality" value="${index}" class="quality-radio">
      <span class="quality-label">${q.label}</span>
      ${q.resolution ? `<span class="quality-resolution">${q.resolution}</span>` : ''}
      <span class="quality-bandwidth">${q.bandwidthLabel}</span>
    `;
    
    option.addEventListener('click', () => selectQuality(index));
    container.appendChild(option);
  });
  
  // Select best quality by default
  selectQuality(0);
}

let selectedQualityIndex = 0;
let currentQualities: QualityOption[] = [];

function selectQuality(index: number): void {
  selectedQualityIndex = index;
  
  // Update visual selection
  document.querySelectorAll('.quality-option').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
    const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
    radio.checked = i === index;
  });
  
  // Show download section
  document.getElementById('download-section')?.classList.remove('hidden');
}
```

---

## Quick Selection Buttons

```typescript
// Quick select handlers
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.target as HTMLButtonElement;
    const quality = target.dataset.quality;
    
    if (quality === 'best') {
      selectQuality(0); // Already sorted best-first
    } else if (quality === 'worst') {
      selectQuality(currentQualities.length - 1);
    }
  });
});
```

---

## Tests

- [ ] Quality options render for detected media
- [ ] Radio selection works
- [ ] Only one quality can be selected
- [ ] Best/Worst quick buttons work
- [ ] Download section appears after selection
