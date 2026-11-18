/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Strict Brand Palette
        cream: {
          DEFAULT: '#F3ECE0',
          50: '#FCF9F5',
          100: '#F8F4EE',
          200: '#F3ECE0', // Main background
          300: '#ECE1D0',
        },
        sand: {
          DEFAULT: '#D9C3A5',
          100: '#EFE7DC',
          200: '#E4D5C0',
          300: '#D9C3A5', // Card borders & surfaces
          400: '#C8AC89',
          500: '#B4936B',
          muted: '#8C7A6B',
        },
        orange: {
          DEFAULT: '#F26A1B', // Primary action, active nav, highlights
          hover: '#E0590B',
          light: '#FDEEE6',
          dark: '#C84F0E',
        },
        // Legibility Neutrals (Warm Dark Browns & Charcoal)
        neutral: {
          dark: '#2C221E',      // Primary headers & high contrast text
          body: '#5A4D45',      // Body text & descriptions
          subtle: '#8C7A6B',    // Muted timestamps & placeholders
          surface: '#FAF7F2',   // Clean card surface
          divider: '#E5D6C3',   // Subtle border lines
        },
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft-sand': '0 4px 20px -2px rgba(90, 77, 69, 0.06)',
        'card-sand': '0 2px 10px -1px rgba(90, 77, 69, 0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
