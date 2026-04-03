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
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.9375rem', { lineHeight: '1.3125rem' }],
        base: ['1.0625rem', { lineHeight: '1.5rem' }],
        lg: ['1.1875rem', { lineHeight: '1.625rem' }],
        xl: ['1.3125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.625rem', { lineHeight: '2rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
};
