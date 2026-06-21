/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Numeric/tabular font for the timer and chip counts.
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        felt: {
          DEFAULT: "#0b3d2e",
          dark: "#062018",
          light: "#125a44",
        },
        gold: "#f5c518",
      },
    },
  },
  plugins: [],
};
