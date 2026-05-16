/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx,js,jsx}', './components/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F172A',
        brand: '#15803D',     // Malabar green
        accent: '#F59E0B',
        forra: '#7C2D12',
        warn: '#DC2626',
        ok: '#16A34A',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
    },
  },
  plugins: [],
};
