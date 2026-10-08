/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#16263D',
          orange: '#C45116',
          sky: '#D9F0F7',
          mint: '#E3F0CE',
          canvas: '#F7F8FA',
          paper: '#FFFDFC',
          line: '#E6E8EB',
          muted: '#5E6877',
        },
      }
    },
    fontFamily: {
      sans: ['var(--font-plus-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  },
  plugins: [],
}
