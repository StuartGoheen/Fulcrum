/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './**/*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Audiowide', 'sans-serif'],
        body: ['Exo 2', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
