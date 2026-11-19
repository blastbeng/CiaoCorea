import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/**
 * La scelta del tema è del browser, non del profilo: chi studia la sera e chi
 * studia in treno possono essere la stessa persona, ma il fastidio per un fondo
 * chiaro è della stanza, non dell'account. Per questo la chiave non ha user id.
 */
const STORAGE_KEY = 'ciaocorea.theme.v1';
const DEFAULT_THEME: Theme = 'dark';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    // Safari in navigazione privata nega lo storage: vale il predefinito.
    return DEFAULT_THEME;
  }
}

/** Scrive il tema sull'elemento radice: il resto lo fanno i token in theme.css. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Anche la barra del browser (Android, Safari) segue la coppia di temi.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f3f3' : '#0d1620');
}

export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Senza storage la scelta vale per questa visita.
    }
  }, [theme]);

  const toLight = theme === 'dark';
  const label = toLight ? 'Passa al tema chiaro' : 'Passa al tema scuro';

  return (
    <button
      type="button"
      className={
        floating ? 'btn btn--sm btn--ghost theme-toggle theme-toggle--floating' : 'btn btn--sm btn--ghost theme-toggle'
      }
      onClick={() => setTheme(toLight ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{toLight ? '☀' : '☾'}</span>
    </button>
  );
}
