/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/services/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F6F8FC',
        surface: '#FFFFFF',
        surfaceActive: '#E7ECF5',
        text: '#131722',
        textSecondary: '#5A6478',
        accent: '#2F66E8',
        success: '#2E8D5A',
        warning: '#B57720',
        destructive: '#C94A4A',
        dark: {
          background: '#0E131B',
          surface: '#171F2B',
          surfaceActive: '#243040',
          text: '#EAF0FF',
          textSecondary: '#A1AFC6',
          accent: '#7CA4FF',
          success: '#58C889',
          warning: '#E9B35A',
          destructive: '#F08A8A',
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
