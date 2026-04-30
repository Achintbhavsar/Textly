/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#6366f1", hover: "#4f46e5" },
        "background-dark": "#0f172a",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in",
        "slide-in-from-right-4": "slideInFromRight 0.5s ease-out",
        "slide-in-from-left-4": "slideInFromLeft 0.5s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideInFromRight: {
          "0%": { transform: "translateX(1rem)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        slideInFromLeft: {
          "0%": { transform: "translateX(-1rem)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};