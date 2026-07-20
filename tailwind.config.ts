import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          container: "rgb(var(--color-primary-container) / <alpha-value>)",
          fixed: "rgb(var(--color-primary-fixed) / <alpha-value>)",
          "fixed-dim": "rgb(var(--color-primary-fixed-dim) / <alpha-value>)",
        },
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",
        "on-primary-fixed": "#001a42",
        "on-primary-fixed-variant": "#004395",
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          dim: "rgb(var(--color-surface-dim) / <alpha-value>)",
          bright: "rgb(var(--color-surface-bright) / <alpha-value>)",
          container: "rgb(var(--color-surface-container) / <alpha-value>)",
          "container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
          "container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
          "container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
          "container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        },
        "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
        "surface-tint": "rgb(var(--color-surface-tint) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        secondary: {
          DEFAULT: "rgb(var(--color-secondary) / <alpha-value>)",
          container: "rgb(var(--color-secondary-container) / <alpha-value>)",
          fixed: "#d8e3fb",
          "fixed-dim": "#bcc7de",
        },
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",
        "on-secondary-fixed": "#111c2d",
        "on-secondary-fixed-variant": "#3c475a",
        tertiary: {
          DEFAULT: "#4f5d72",
          container: "#67758c",
          fixed: "#d5e3fd",
          "fixed-dim": "#b9c7e0",
        },
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#fdfcff",
        "on-tertiary-fixed": "#0d1c2f",
        "on-tertiary-fixed-variant": "#3a485c",
        outline: {
          DEFAULT: "rgb(var(--color-outline) / <alpha-value>)",
          variant: "rgb(var(--color-outline-variant) / <alpha-value>)",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--color-inverse-on-surface) / <alpha-value>)",
        "inverse-primary": "#adc6ff",
        background: "rgb(var(--color-background) / <alpha-value>)",
        "on-background": "rgb(var(--color-on-background) / <alpha-value>)",
        // New semantic tokens for common patterns
        card: {
          DEFAULT: "rgb(var(--color-card) / <alpha-value>)",
          border: "rgb(var(--color-card-border) / <alpha-value>)",
        },
        "card-border-hover": "rgb(var(--color-card-border-hover) / <alpha-value>)",
        "input-bg": "rgb(var(--color-input-bg) / <alpha-value>)",
        "input-border": "rgb(var(--color-input-border) / <alpha-value>)",
        // ─── Plot Maps brand tokens ───
        // Safety-orange accent reserved for "mark this parcel" moments.
        // Don't use for general UI — it loses meaning if overused.
        stake: {
          DEFAULT: "rgb(var(--color-stake) / <alpha-value>)",
          hover: "rgb(var(--color-stake-hover) / <alpha-value>)",
        },
        "on-stake": "rgb(var(--color-on-stake) / <alpha-value>)",
        // Blueprint navy for data ink, parcel IDs, coordinates, mono text.
        blueprint: {
          DEFAULT: "rgb(var(--color-blueprint) / <alpha-value>)",
          soft: "rgb(var(--color-blueprint-soft) / <alpha-value>)",
        },
        // Zoning-legend status palette — domain-derived semantic colors.
        status: {
          commercial: "rgb(var(--color-status-commercial) / <alpha-value>)",
          industrial: "rgb(var(--color-status-industrial) / <alpha-value>)",
          pending: "rgb(var(--color-status-pending) / <alpha-value>)",
          active: "rgb(var(--color-status-active) / <alpha-value>)",
          cold: "rgb(var(--color-status-cold) / <alpha-value>)",
          neutral: "rgb(var(--color-status-neutral) / <alpha-value>)",
        },
        // Pricing tool (/price) — dark hero surface. Ported from lemoore-homes.
        charcoal: "#18181b",
      },
      // ─── Paper-shadow elevation system ───
      // Warm-tinted shadows that suggest paper weight on parchment.
      // Replace generic Tailwind shadows (shadow-md, shadow-lg) with these.
      boxShadow: {
        "paper-sm": "var(--shadow-paper-sm)",
        "paper-md": "var(--shadow-paper-md)",
        "paper-lg": "var(--shadow-paper-lg)",
        "paper-xl": "var(--shadow-paper-xl)",
      },
      fontFamily: {
        // Plot Maps: Geist Sans for everything, Geist Mono for data/coords.
        // Fallbacks preserved for graceful degradation.
        headline: ["var(--font-geist-sans)", "Manrope", "sans-serif"],
        body: ["var(--font-geist-sans)", "Inter", "sans-serif"],
        label: ["var(--font-geist-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "0.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
