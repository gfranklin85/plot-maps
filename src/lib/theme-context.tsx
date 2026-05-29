'use client';

// ThemeProvider — drives Plot's light/dark theme system for public
// surfaces (landing, /position, /contact, /join-position, /map HUD).
//
// Locked 2026-05-30. See:
//   src/app/globals.css  — the --plot-* token system (light + dark
//                          overrides driven off data-theme on <html>)
//
// Persistence model:
//   1. localStorage 'plot.theme' is the source of truth when set
//   2. On first visit (no stored pref), match prefers-color-scheme
//   3. Default is dark when system pref unavailable
//
// SSR / hydration:
//   data-theme is set on <html> in a beforeInteractive inline script
//   inserted by ThemeBootstrap (separate component, layout-level).
//   This provider then reads what's already painted and never causes
//   a theme flash. Toggling re-writes both <html> and localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type PlotTheme = 'light' | 'dark';

interface ThemeCtx {
  theme: PlotTheme;
  toggleTheme: () => void;
  setTheme: (t: PlotTheme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = 'plot.theme';

function readInitialTheme(): PlotTheme {
  if (typeof window === 'undefined') return 'dark';
  // 1. Stored preference wins
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  // 2. System preference
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  // 3. Default
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read whatever the bootstrap script already painted onto <html>
  // so the provider state matches the DOM from frame 1. If for some
  // reason data-theme isn't set (script didn't run), fall back to
  // the same resolution logic.
  const [theme, setThemeState] = useState<PlotTheme>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    }
    return readInitialTheme();
  });

  const applyTheme = useCallback((t: PlotTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch { /* ignore */ }
  }, []);

  const setTheme = useCallback(
    (t: PlotTheme) => {
      setThemeState(t);
      applyTheme(t);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Cross-tab sync — if the user toggles theme in another tab, mirror
  // it here without forcing a reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === 'light' || v === 'dark') {
        setThemeState(v);
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', v);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <Ctx.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback for components rendered outside the provider —
    // they get a non-reactive dark-default. Allows the popup, etc.,
    // to render even if a caller forgets to wrap.
    return {
      theme: 'dark',
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return v;
}

/** Inline script run in <head> BEFORE React hydration. Sets data-theme
 *  on <html> using the same resolution logic as readInitialTheme().
 *  Prevents flash-of-wrong-theme during the first paint. Mount this
 *  inside the layout's <head> via dangerouslySetInnerHTML. */
export const THEME_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var s = window.localStorage.getItem('${STORAGE_KEY}');
    if (s === 'light' || s === 'dark') {
      document.documentElement.setAttribute('data-theme', s);
      return;
    }
  } catch (e) {}
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
      return;
    }
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', 'dark');
})();
`;
