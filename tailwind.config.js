/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/services/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        surface: '#F0F0F3',
        surfaceActive: '#E0E1E6',
        text: '#000000',
        textSecondary: '#60646C',
        accent: '#2D6CF6',
        destructive: '#C53B3B',
        dark: {
          background: '#000000',
          surface: '#212225',
          surfaceActive: '#2E3135',
          text: '#ffffff',
          textSecondary: '#B0B4BA',
          accent: '#7FA7FF',
          destructive: '#FF7A7A',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};

