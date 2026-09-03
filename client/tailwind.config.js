/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Фирменный шрифт клуба ФЛЭШ — Science Gothic (variable 100..900).
        // Используется для заголовков, эмблемы и лейблов.
        display: ['"Science Gothic"', "Montserrat", "sans-serif"],
        heading: ['"Science Gothic"', "Montserrat", "sans-serif"],
        // Монтсерра для цифр: у него есть tabular figures, которые критичны
        // для таймера и денежных сумм (цифры не «прыгают» по ширине).
        sans: ['"Montserrat"', "Inter", "system-ui", "sans-serif"],
        numeric: ['"Montserrat"', '"JetBrains Mono"', "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Фирменная палитра клуба ФЛЭШ.
        // PITCH BLACK #161008 — основной фон (тёплый глубокий чёрный).
        felt: {
          DEFAULT: "#1F1810",
          dark: "#161008",
          light: "#2A2117",
        },
        // SUNFLOWER GOLD #FDC86C — фирменный акцент.
        gold: {
          DEFAULT: "#FDC86C",
          light: "#FFE19D",
          dark: "#D9A440",
        },
        // WHITE SMOKE #F2F2F2 — фирменный цвет текста.
        smoke: "#F2F2F2",
      },
      backgroundImage: {
        // Диагональный градиент подсолнечного золота для названия и акцентов.
        "gold-gradient":
          "linear-gradient(135deg, #D9A440 0%, #FDC86C 45%, #FFE19D 60%, #D9A440 100%)",
      },
      boxShadow: {
        "gold-glow": "0 0 24px rgba(253, 200, 108, 0.35)",
      },
    },
  },
  plugins: [],
};
