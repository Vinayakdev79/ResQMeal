/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary brand: forest, 700 = #173F35
        forest: {
          50: '#EEF4F2',
          100: '#D5E4DE',
          200: '#AACAC0',
          300: '#7AAD9C',
          400: '#4E8A79',
          500: '#2F6B5B',
          600: '#225448',
          700: '#173F35',
          800: '#12332B',
          900: '#0C221D',
        },
        // Page background
        cream: {
          DEFAULT: '#F8F6F0',
        },
        // Secondary accent: sage
        sage: {
          DEFAULT: '#A8B9A3',
          50: '#F3F6F2',
          100: '#E4EBE2',
          200: '#CAD7C7',
          300: '#B9C8B4',
          400: '#8FA388',
          500: '#748B70',
          600: '#5C7158',
          700: '#46573F',
          800: '#343F2F',
          900: '#232B20',
        },
        // Primary text: charcoal
        charcoal: {
          DEFAULT: '#252B28',
          50: '#F4F5F4',
          100: '#E4E6E5',
          200: '#C8CCCA',
          300: '#A3A9A6',
          400: '#7C837F',
          500: '#5C645F',
          600: '#454C48',
          700: '#343A37',
          800: '#252B28',
          900: '#161A18',
        },
        // Subtle neutral surface tint
        mist: '#EAE9E2',
        // Card surface
        surface: '#FFFFFF',
        // Supporting text (named "muted" so the default Tailwind slate palette stays intact)
        muted: '#6B716D',
        // Card surface (legacy alias)
        card: '#FFFFFF',
        // Subtle neutral border
        line: '#E4E1D7',
        // Semantic status colours (badges, alerts), toned down to fit the palette
        success: {
          50: '#EEF7F2',
          100: '#D6EEDF',
          500: '#3E9468',
          700: '#2B6B4A',
          800: '#1F4F37',
        },
        warning: {
          50: '#FBF6EA',
          100: '#F4E6C2',
          500: '#C98A2B',
          700: '#9A6418',
          800: '#6E4610',
        },
        danger: {
          50: '#FBF1EF',
          100: '#F5DCD8',
          500: '#C65446',
          700: '#9C3A2E',
          800: '#6F2A21',
        },
        info: {
          50: '#EEF4FA',
          100: '#D6E4F3',
          500: '#3F7BB8',
          700: '#2D5F93',
          800: '#224870',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
        'slide-in-left': 'slide-in-left 0.4s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
