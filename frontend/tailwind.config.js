/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        snack: {
          bg: '#0b0d10',
          panel: '#14181e',
          edge: '#232a33',
          text: '#e8edf4',
          muted: '#9aa6b2',
          accent: '#ffcc4d',
          good: '#3ddc97',
          bad: '#ff6b6b',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};