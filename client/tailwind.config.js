/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // High-contrast antiqua for the tournament name + hero headings
        // (the "luxury display" face). Used sparingly — only on the biggest
        // text on screen.
        display: ['"Playfair Display"', "Georgia", "serif"],
        // Condensed uppercase sans-serif for section labels: BLINDS, TIME,
        // PRIZE, СЛЕДУЮЩИЙ УРОВЕНЬ etc. Gives the structured, formal look of
        // a casino/board layout without competing with the headline serif.
        heading: ['"Oswald"', '"Arial Narrow"', "sans-serif"],
        // Geometric sans for all numbers: timer, blinds, chip counts, prize
        // pool. Montserrat has clean tabular figures and looks modern-premium
        // at large sizes. The body/sans fallback is also Montserrat.
        sans: ['"Montserrat"', "Inter", "system-ui", "sans-serif"],
        numeric: ['"Montserrat"', '"JetBrains Mono"', "monospace"],
        // Kept for any legacy `font-mono` usage (admin code etc.).
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Charcoal (not pure black) — gold reads richer on #14141A than on
        // #000 and is gentler on the eyes in a dim club. `felt` is kept as the
        // token name so existing bg-felt utilities keep working.
        felt: {
          DEFAULT: "#14141A",
          dark: "#0B0B10",
          light: "#1E1E26",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#F5C518",
          dark: "#A8862E",
        },
      },
      backgroundImage: {
        // Diagonal gold sheen for the tournament name + hero accents.
        "gold-gradient":
          "linear-gradient(135deg, #A8862E 0%, #F5C518 45%, #D4AF37 60%, #A8862E 100%)",
      },
      // Soft gold glow used as text-shadow / box-shadow on hero elements.
      boxShadow: {
        "gold-glow": "0 0 24px rgba(212, 175, 55, 0.35)",
      },
    },
  },
  plugins: [],
};
