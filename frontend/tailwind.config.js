/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0F1117',
        card: '#1A1D24',
        border: '#2B2F36',
        primary: {
          DEFAULT: '#FFA116',
          hover: '#E8920F',
          muted: 'rgba(255, 161, 22, 0.15)',
        },
        success: '#2ECC71',
        error: '#EF4444',
        muted: {
          DEFAULT: '#8B949E',
          foreground: '#C9D1D9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      /* App shell content width — keep Navbar / MainLayout / Footer in sync. */
      maxWidth: {
        app: '1600px',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
