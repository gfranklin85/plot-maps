import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0058be",
          container: "#2170e4",
          fixed: "#d8e2ff",
          "fixed-dim": "#adc6ff",
        },
        "on-primary": "#ffffff",
        "on-primary-container": "#fefcff",
        "on-primary-fixed": "#001a42",
        "on-primary-fixed-variant": "#004395",
        surface: {
          DEFAULT: "#0c1324",
          dim: "#cbdbf5",
          bright: "#f8f9ff",
          container: "#e5eeff",
          "container-lowest": "#ffffff",
          "container-low": "#eff4ff",
          "container-high": "#dce9ff",
          "container-highest": "#d3e4fe",
        },
        "surface-variant": "#d3e4fe",
        "surface-tint": "#005ac2",
        "on-surface": "#dce1fb",
        "on-surface-variant": "#424754",
        secondary: {
          DEFAULT: "#545f73",
          container: "#d5e0f8",
          fixed: "#d8e3fb",
          "fixed-dim": "#bcc7de",
        },
        "on-secondary": "#ffffff",
        "on-secondary-container": "#586377",
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
          DEFAULT: "#727785",
          variant: "#c2c6d6",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        "inverse-primary": "#adc6ff",
        background: "#0c1324",
        "on-background": "#dce1fb",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
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
