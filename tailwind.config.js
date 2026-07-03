/** @type {import('tailwindcss').Config} */
// Palette derived from the DMMA College seal: orange ring (primary), the deep
// navy of the truck/ship (sidebar + ink), and the green of the buildings/flask
// (success). Chart hues are validated for CVD in references/palette workflow.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Orange — the seal ring. Primary brand + actions.
        brand: {
          50: '#FEF3EA',
          100: '#FCE0CB',
          200: '#F8C29A',
          300: '#F3A066',
          400: '#EE8038',
          500: '#E8611C',
          600: '#D2540F',
          700: '#AE440D',
          800: '#8A360C',
          900: '#712D0C',
        },
        // Navy — the seal's truck/ship. Sidebar, deep ink.
        navy: {
          50: '#EEEEF6',
          100: '#D6D6EB',
          200: '#AEAED6',
          300: '#7E7EBB',
          400: '#5757A0',
          500: '#3B3B86',
          600: '#2E2E6E',
          700: '#262660',
          800: '#1F1F50',
          900: '#191942',
        },
        // Green — the seal's buildings/flask. Success / positive.
        moss: {
          50: '#EAF7EC',
          100: '#C9EBCF',
          500: '#2F9E44',
          600: '#268038',
          700: '#1F6A2F',
        },
        // Validated categorical chart hues.
        chart: {
          green: '#2F9E44',
          orange: '#E8611C',
          indigo: '#5B6AE5',
        },
        canvas: '#F5F5FA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
