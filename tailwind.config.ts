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
        navy: { DEFAULT: "#1B2A4A", light: "#2A3D66", dark: "#111D35" },
        rust: { DEFAULT: "#C75B39", light: "#D97B5E", dark: "#A14828" },
        slate: { DEFAULT: "#4A5568" },
        cream: { DEFAULT: "#FAF8F5" },
        gold: { DEFAULT: "#D4A853", light: "#E4C47A" },
        sage: { DEFAULT: "#7BA68D", light: "#9EC5AD" },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
