import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0a0e17",
          900: "#0f1420",
          850: "#141b2b",
          800: "#1a2236",
          700: "#242e45",
          600: "#374361",
        },
        signal: {
          50: "#eff6ff", 100: "#dbeafe", 300: "#93c5fd", 400: "#60a5fa",
          500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
        },
        amber: {
          50: "#fffbeb", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "card-hover": "0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
        glow: "0 0 0 1px rgb(59 130 246 / 0.15), 0 0 24px -4px rgb(59 130 246 / 0.35)",
      },
      backgroundImage: {
        "blueprint-grid":
          "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
      },
      backgroundSize: { "grid-sm": "24px 24px", "grid-lg": "64px 64px" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scan-line": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(0.97) translateY(4px)" }, "100%": { opacity: "1", transform: "scale(1) translateY(0)" } },
        "slide-in-right": { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "scan-line": "scan-line 2.4s linear infinite",
        "scale-in": "scale-in 0.18s ease-out both",
        "slide-in-right": "slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
