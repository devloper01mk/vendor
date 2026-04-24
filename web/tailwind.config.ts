import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "hsl(var(--ink) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        canvas: "hsl(var(--canvas) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        panel: "hsl(var(--panel) / <alpha-value>)",
        "panel-muted": "hsl(var(--panel-muted) / <alpha-value>)",
        positive: "hsl(var(--positive) / <alpha-value>)",
        negative: "hsl(var(--negative) / <alpha-value>)",
      },
    },
  },
  plugins: [],
} satisfies Config;
