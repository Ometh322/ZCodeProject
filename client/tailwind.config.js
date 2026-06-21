/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Numeric/tabular font for the timer and chip counts.
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        // Decorative serif for the club emblem and major headings.
        display: ['"Cinzel"', "Georgia", "serif"],
      },
      colors: {
        // Black-and-gold theme. The legacy `felt` token is repurposed as the
        // black background scale (kept under the same name so existing
        // `bg-felt` / `bg-felt-dark` utilities continue to work).
        felt: {
          DEFAULT: "#0a0a0a",
          dark: "#000000",
          light: "#161616",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f5c518",
          dark: "#a8862e",
        },
      },
      backgroundImage: {
        // A subtle gold sheen used on hero elements (emblem, prize pool).
        "gold-gradient":
          "linear-gradient(135deg, #a8862e 0%, #f5c518 45%, #d4af37 60%, #a8862e 100%)",
      },
    },
  },
  plugins: [],
};
