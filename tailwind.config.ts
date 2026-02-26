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
        // Brand palette — matching TopRealtyTools.com logo
        navy: { DEFAULT: "#1B3A6B", light: "#2B5EA7", dark: "#0F2544" },
        rust: { DEFAULT: "#F97316", light: "#FB923C", dark: "#EA580C" },
        slate: { DEFAULT: "#475569" },
        cream: { DEFAULT: "#F8FAFC" },
        gold: { DEFAULT: "#EAB308", light: "#FACC15" },
        sage: { DEFAULT: "#10B981", light: "#34D399" },
        pop: { DEFAULT: "#2B5EA7", light: "#3B7DD8" },
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
