import type { Config } from "tailwindcss";

/**
 * Design tokens lifted from the product spec so the dashboard, the extension
 * popup, and the spec page all read as one product.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0C0C0A",
          2: "#141410",
          3: "#1C1C18",
          4: "#252520",
        },
        rule: {
          DEFAULT: "#2E2E28",
          2: "#3A3A32",
        },
        smoke: "#5C5C50",
        ash: "#8C8C78",
        paper: "#D4D4C0",
        cream: "#F0EFE6",
        saffron: {
          DEFAULT: "#FF6B00",
          2: "#FF8C35",
        },
        kerala: "#00B894",
        violet: "#9B72CF",
        rose: "#E17055",
        gold: "#FDCB6E",
      },
      fontFamily: {
        sans: ["var(--font-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "2px",
        card: "4px",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        pulse2: "pulse2 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
