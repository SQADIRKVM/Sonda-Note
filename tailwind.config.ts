import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1040px",
      xl: "1280px",
    },
    extend: {
      colors: {
        cream: "var(--cream)",
        paper: "var(--paper)",
        sage: "var(--sage)",
        butter: "var(--butter)",
        blush: "var(--blush)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        olive: "var(--olive)",
        lime: "var(--lime)",
        clay: "var(--clay)",
        line: "var(--line)",
        rule: "var(--rule)",
        sn: {
          canvas: "var(--sn-canvas)",
          surface: "var(--sn-surface)",
          "surface-raised": "var(--sn-surface-raised)",
          invert: "var(--sn-invert)",
          hairline: "var(--sn-hairline)",
          "hairline-strong": "var(--sn-hairline-strong)",
          ink: "var(--sn-ink)",
          "ink-secondary": "var(--sn-ink-secondary)",
          "ink-tertiary": "var(--sn-ink-tertiary)",
          "ink-on-invert": "var(--sn-ink-on-invert)",
          accent: "var(--sn-accent)",
          "accent-raw": "var(--sn-accent-raw)",
          "accent-tint": "var(--sn-accent-tint)",
          live: "var(--sn-live)",
          "live-raw": "var(--sn-live-raw)",
          "live-tint": "var(--sn-live-tint)",
          alert: "var(--sn-alert)",
          "alert-tint": "var(--sn-alert-tint)",
          link: "var(--sn-link)",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Iowan Old Style", "serif"],
        sans: ["system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
