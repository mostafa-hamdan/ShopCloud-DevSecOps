/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["system-ui", "sans-serif"] },
      colors: {
        slate: { 950: "#0b1220" },
        accent: "#1e40af", // a different accent so admin is visually distinct
      },
    },
  },
  plugins: [],
};
