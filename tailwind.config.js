module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-exo)', 'Exo', 'sans-serif'],
        body: ['var(--font-exo)', 'Exo', 'sans-serif'],
        display: ['var(--font-exo)', 'Exo', 'sans-serif'],
      },
      fontSize: {
        base: '12px',
      },
    },
  },
  plugins: [],
};
