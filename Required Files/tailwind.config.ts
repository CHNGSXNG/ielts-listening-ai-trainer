import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "sans-serif"
        ]
      },
      boxShadow: {
        glass: "0 24px 80px rgba(77, 98, 130, 0.16)",
        glow: "0 0 28px rgba(79, 140, 255, 0.32)"
      },
      colors: {
        accent: "#4f8cff",
        violetSoft: "#7c5cff"
      }
    }
  },
  plugins: []
};

export default config;
