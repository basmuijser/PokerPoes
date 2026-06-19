import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0D0D0D",
        panel: "#161616",
        panelAlt: "#1E1E1E",
        felt: "#2D6A4F",
        feltLight: "#3A8060",
        feltDark: "#1F4F39",
        chip: "#F5F5F5",
        muted: "#8A8A8A",
        danger: "#C13B3B",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(45,106,79,0.4), 0 8px 30px rgba(45,106,79,0.25)",
      },
      animation: {
        pop: "pop 220ms ease-out",
        fadeIn: "fadeIn 200ms ease-out",
        turnPulse: "turnPulse 1.4s ease-in-out infinite",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        turnPulse: {
          "0%, 100%": {
            boxShadow:
              "0 0 0 2px rgba(34,197,94,0.55), 0 0 16px rgba(34,197,94,0.45)",
          },
          "50%": {
            boxShadow:
              "0 0 0 3px rgba(74,222,128,0.95), 0 0 28px rgba(34,197,94,0.85)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
