/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ashen: {
          950: '#06050a',
          900: '#0d0b14',
          800: '#161322',
          700: '#231e36',
          600: '#342e50',
          500: '#4e4572',
          400: '#7568a3',
          300: '#a397d1',
          200: '#d0c9f0',
          100: '#edeaff',
        },
        ember: {
          500: '#ff5722',
          400: '#ff7043',
          600: '#f4511e',
        },
        cyanGlow: {
          400: '#22d3ee',
          500: '#06b6d4',
          300: '#67e8f9',
        },
        voidPurple: {
          500: '#a855f7',
          600: '#9333ea',
          400: '#c084fc',
        }
      },
      fontFamily: {
        medieval: ['Cinzel', 'Trajan Pro', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'subtle-float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      }
    },
  },
  plugins: [],
}
