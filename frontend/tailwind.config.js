/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        fedda: {
          'bg-0': '#09090b',
          'bg-1': '#111113',
          'bg-2': '#18181b',
          'bg-3': '#27272a',
          'text-1': '#fafafa',
          'text-2': '#a1a1aa',
          'text-3': '#71717a',
          'text-4': '#3f3f46',
          'accent': '#a78bfa',
          'accent-dim': '#7c3aed',
        },
      },
      borderRadius: {
        DEFAULT: '0.75rem', // 12px — xl everywhere
      },
      animation: {
        'in': 'fade-slide-in 0.15s ease-out',
      },
      keyframes: {
        'fade-slide-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
