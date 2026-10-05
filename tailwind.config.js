/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderWidth: {
        '3': '3px',
      },
      backgroundOpacity: {
        '8': '0.08',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-right': 'slideInRight 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
