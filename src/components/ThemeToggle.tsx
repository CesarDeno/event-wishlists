import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const THEME_BG: Record<Theme, string> = {
  light: '#f2f2f7',
  dark: '#000000',
};

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignorar si storage está bloqueado
  }
  return getSystemTheme();
}

function syncThemeColorMeta(theme: Theme, hasOverride: boolean) {
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  metas.forEach((meta) => {
    if (hasOverride) {
      meta.content = THEME_BG[theme];
    } else if (meta.media.includes('dark')) {
      meta.content = THEME_BG.dark;
    } else {
      meta.content = THEME_BG.light;
    }
  });
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [hasOverride, setHasOverride] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'light' || saved === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    syncThemeColorMeta(theme, hasOverride);
  }, [theme, hasOverride]);

  useEffect(() => {
    if (hasOverride) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [hasOverride]);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setHasOverride(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignorar si storage está bloqueado
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-xs theme-toggle"
      onClick={toggleTheme}
      aria-label={
        theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      }
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
