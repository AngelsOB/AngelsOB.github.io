/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 1px 1px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.45)',
      },
    },
  },
  plugins: [],
};
