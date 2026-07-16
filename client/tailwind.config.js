/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // class-based dark mode
  theme: {
    extend: {
      colors: {
        brand: {
          // ── "Corporate Navy & Teal" — used directly via Tailwind utility
          // classes in a handful of places (Chatbot.jsx, LoginRegister.jsx's
          // always-dark showcase panel, Reports.jsx). The bulk of the app's
          // colors are inline styles (see client/src/constants/theme.js),
          // these three exist only for the real className-based usages.
          teal:   '#2DD4BF', // primary accent (matches constants/theme.js's dark-mode teal — all real usages are dark-leaning contexts)
          indigo: '#6366F1', // secondary accent
          violet: '#8B5CF6', // tertiary accent
        },
      },
    },
  },
  plugins: [],
}
