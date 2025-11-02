/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NYC-themed colors
        'nyc-blue': '#003f7f',
        'nyc-orange': '#ff6319',
        'civic-green': '#22c55e',
        'permit-yellow': '#fbbf24'
      },
      fontFamily: {
        'helvetica-neue-bold-condensed': ['"Helvetica Neue LT Pro 77 Bold Condensed"', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}