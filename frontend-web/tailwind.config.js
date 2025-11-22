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
          purple: '#660874',
          light: '#F5F5F5',
          dark: '#D93379'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif']
      }
    },
  },
  plugins: [],
}