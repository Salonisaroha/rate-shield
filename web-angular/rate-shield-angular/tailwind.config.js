/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'global-bg': '#ECEEF2',
        'sidebar-bg': '#0F1117',
        'sidebar-border': '#1C1F26',
        'accent': '#6366F1',
        'accent-hover': '#4F46E5',
        'accent-light': '#EEF2FF',
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08)',
        'sidebar': '1px 0 0 0 #EAECF0',
      }
    },
  },
  plugins: [],
}

