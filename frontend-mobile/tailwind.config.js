/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        slate: { 950: '#020617', 900: '#0f172a', 800: '#1e293b' },
        orange: { 500: '#f97316', 600: '#ea580c' },
        cyan: { 500: '#06b6d4', 600: '#0891b2' }
      }
    },
  },
  plugins: [],
};
