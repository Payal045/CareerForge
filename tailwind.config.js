// tailwind.config.js
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6FBF7',
          100: '#CCF7EF',
          300: '#66EAD9',
          500: '#00C2B3',
          700: '#089A86',
        },
        accent: {
          50: '#FFF8E6',
          100: '#FFF2CC',
          500: '#FFD166',
          700: '#F6B60F'
        },
        success: '#22C55E',
        danger: '#FF6B6B',
        neutral: {
          50: '#F8FAFC',
          100: '#EEF2F7',
          300: '#E6EEF6',
          700: '#475569',
          900: '#0F172A'
        }
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        display: ['Poppins', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px'
      },
      boxShadow: {
        card: '0 6px 18px rgba(15,23,42,0.06)',
        soft: '0 4px 10px rgba(15,23,42,0.04)',
      },
    },
  },
  plugins: [],
};
