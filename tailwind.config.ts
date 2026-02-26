import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern, clean but fun palette
        navy: { DEFAULT: "#0F172A", light: "#1E293B", dark: "#020617" },
        rust: { DEFAULT: "#F97316", light: "#FB923C", dark: "#EA580C" },
        slate: { DEFAULT: "#475569" },
        cream: { DEFAULT: "#F8FAFC" },
        gold: { DEFAULT: "#EAB308", light: "#FACC15" },
        sage: { DEFAULT: "#10B981", light: "#34D399" },
        pop: { DEFAULT: "#6366F1", light: "#818CF8" },
        cyan: { DEFAULT: "#06B6D4", light: "#22D3EE" },
      },
      fontFamily: {
        display: [
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        body: [
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
