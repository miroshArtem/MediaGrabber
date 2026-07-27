import { ThemeMode, loadSettings } from './settings';

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let mql: MediaQueryList | null = null;

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;

  const updateTheme = (theme: 'dark' | 'light') => {
    root.setAttribute('data-theme', theme);
    const themeColor = theme === 'dark' ? '#0e1015' : '#f7f8fa';
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.setAttribute('content', themeColor);
    });
  };

  if (mediaListener && mql) {
    mql.removeEventListener('change', mediaListener);
    mediaListener = null;
    mql = null;
  }

  if (mode === 'system') {
    mql = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      updateTheme(mql!.matches ? 'dark' : 'light');
    };
    update();
    mediaListener = (e: MediaQueryListEvent) => {
      updateTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', mediaListener);
  } else {
    updateTheme(mode);
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
