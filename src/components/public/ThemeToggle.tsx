'use client';

// ThemeToggle — sun/moon toggle for Plot's light/dark theme system.
// Used in the header of every public page (landing, /position,
// /contact, /join-position, /map's HUD chrome). Locked 2026-05-30.
//
// Styled with the canonical --plot-* token palette so it inverts
// correctly with the theme it controls.

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  // The actual theme is only knowable on the client (it depends on
  // localStorage / data-theme painted by the bootstrap script). The
  // server always renders with the dark default, so to avoid a
  // hydration mismatch on the icon's <path>, we render a stable
  // placeholder until mounted, then swap in the real sun/moon glyph.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === 'dark';

  if (!mounted) {
    // First paint (server + client pre-hydration): a neutral, theme-
    // independent glyph so server and client markup match exactly.
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title="Toggle theme"
        className={`plot-theme-toggle ${className}`}
        suppressHydrationWarning
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="4.5" />
        </svg>
        <style jsx>{`
          .plot-theme-toggle{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:34px;
            height:34px;
            border-radius:9999px;
            border:1px solid var(--plot-divider-strong);
            color:var(--plot-edge);
            background:transparent;
            cursor:pointer;
          }
        `}</style>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={`plot-theme-toggle ${className}`}
    >
      {isDark ? (
        // Sun — clicking switches to light
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="2.5" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21.5" y2="12" />
          <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
          <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
          <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
          <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
        </svg>
      ) : (
        // Moon — clicking switches to dark
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7z" />
        </svg>
      )}
      <style jsx>{`
        .plot-theme-toggle{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:34px;
          height:34px;
          border-radius:9999px;
          border:1px solid var(--plot-divider-strong);
          color:var(--plot-edge);
          background:transparent;
          cursor:pointer;
          transition:background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .plot-theme-toggle:hover{
          background:color-mix(in srgb, var(--plot-edge) 14%, transparent);
          color:var(--plot-edge-bloom);
          border-color:var(--plot-edge);
        }
        .plot-theme-toggle:focus-visible{
          outline:2px solid var(--plot-signal);
          outline-offset:2px;
        }
      `}</style>
    </button>
  );
}
