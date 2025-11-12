/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tsinghua: {
          purple: '#660099',
          light: '#F5F5F5',
          dark: '#33004D'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif']
      }
    },
  },
  plugins: [],
}