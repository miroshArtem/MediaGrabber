import { ThemeMode, loadSettings } from './settings';

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let mql: MediaQueryList | null = null;

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;

  if (mediaListener && mql) {
    mql.removeEventListener('change', mediaListener);
    mediaListener = null;
    mql = null;
  }

  if (mode === 'system') {
    mql = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      root.setAttribute('data-theme', mql!.matches ? 'dark' : 'light');
    };
    update();
    mediaListener = (e: MediaQueryListEvent) => {
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', mediaListener);
  } else {
    root.setAttribute('data-theme', mode);
  }
}

export async function initTheme(): Promise<void> {
  try {
    const settings = await loadSettings();
    applyTheme(settings.theme);
  } catch {
    applyTheme('system');
  }
}
