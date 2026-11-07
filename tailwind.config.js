/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // The board (dark) is the default, so 'dark:' variants apply whenever light is not chosen.
  darkMode: ['selector', ':root:not([data-theme="light"])'],
  theme: {
    extend: {
      colors: {
        deep: 'rgb(var(--c-deep) / <alpha-value>)',
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--c-line-strong) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          hover: 'rgb(var(--c-accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--c-accent-ink) / <alpha-value>)',
          fg: 'rgb(var(--c-accent-fg) / <alpha-value>)',
        },
        success: { DEFAULT: 'rgb(var(--c-success) / <alpha-value>)', soft: 'rgb(var(--c-success-soft) / <alpha-value>)' },
        danger: { DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)', soft: 'rgb(var(--c-danger-soft) / <alpha-value>)' },
        warn: { DEFAULT: 'rgb(var(--c-warn) / <alpha-value>)', soft: 'rgb(var(--c-warn-soft) / <alpha-value>)' },
        info: { DEFAULT: 'rgb(var(--c-info) / <alpha-value>)', soft: 'rgb(var(--c-info-soft) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"Barlow Semi Condensed"', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        led: ['"Doto Variable"', 'Doto', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['12px', { lineHeight: '16px' }],
        xs: ['13px', { lineHeight: '18px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '22px' }],
        md: ['16px', { lineHeight: '22px' }],
        lg: ['18px', { lineHeight: '24px' }],
        xl: ['22px', { lineHeight: '28px' }],
        '2xl': ['26px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        sheet: 'var(--shadow-sheet)',
      },
      borderRadius: {
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '14px',
        '3xl': '18px',
      },
      transitionDuration: { 150: '150ms', 200: '200ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: { '0%': { opacity: '0.55' }, '50%': { opacity: '1' }, '100%': { opacity: '0.55' } },
      },
      animation: { shimmer: 'shimmer 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
