/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
      },
      colors: {
        ink: "#111418",
        paper: "#fafaf7",
        accent: "#0d4f3c",
      },
    },
  },
  plugins: [],
};
