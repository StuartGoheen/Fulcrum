/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary':        'var(--color-bg-primary)',
        'bg-panel':          'var(--color-bg-panel)',
        'bg-frame':          'var(--color-bg-frame)',
        'accent-primary':    'var(--color-accent-primary)',
        'accent-secondary':  'var(--color-accent-secondary)',
        'accent-deep':       'var(--color-accent-deep)',
        'text-primary':      'var(--color-text-primary)',
        'text-secondary':    'var(--color-text-secondary)',
        'border-subtle':     'var(--color-border)',
      },
      fontFamily: {
        display: ['Audiowide', 'sans-serif'],
        body:    ['Exo 2', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.833rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.167rem', { lineHeight: '1.75rem' }],
        'xl':   ['1.333rem', { lineHeight: '1.75rem' }],
        '2xl':  ['1.667rem', { lineHeight: '2rem' }],
        '3xl':  ['2rem',     { lineHeight: '2.25rem' }],
        '4xl':  ['2.667rem', { lineHeight: '2.75rem' }],
      },
      height: {
        'footer': '10vh',
        'navbar': '6vh',
      },
      width: {
        'frame': '25vw',
      },
      minWidth: {
        'frame': '200px',
      },
    },
  },
  plugins: [],
};
