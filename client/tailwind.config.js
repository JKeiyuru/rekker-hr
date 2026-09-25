// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface-2) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        ink: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        brand: {
          red: 'rgb(var(--color-red) / <alpha-value>)',
          redDark: 'rgb(var(--color-red-dark) / <alpha-value>)',
          green: 'rgb(var(--color-green) / <alpha-value>)',
          yellow: 'rgb(var(--color-yellow) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(0 0 0 / 0.08)',
        floating: '0 12px 40px -12px rgb(0 0 0 / 0.25)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        riseIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        fadeIn: 'fadeIn .18s ease-out',
        riseIn: 'riseIn .22s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
