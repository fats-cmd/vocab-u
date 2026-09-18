/**
 * Tailwind / NativeWind theme.
 *
 * Reads the same `src/design/theme.json` that `useTheme()` does, so a class and
 * a style object can never disagree about what `surface-1` or `body` means.
 * Colours resolve through CSS variables written by `scripts/generate-theme-css.mjs`,
 * which is what makes light/dark switch without a `dark:` prefix on every class.
 *
 * @type {import('tailwindcss').Config}
 */
const theme = require('./src/design/theme.json');

const px = (values) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, `${v}px`]));

const fontSize = Object.fromEntries(
  Object.entries(theme.fontSize).map(([k, [size, line]]) => [k, [`${size}px`, `${line}px`]]),
);

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        surface: {
          1: 'var(--c-surface1)',
          2: 'var(--c-surface2)',
          3: 'var(--c-surface3)',
        },
        ink: {
          DEFAULT: 'var(--c-text-primary)',
          secondary: 'var(--c-text-secondary)',
          muted: 'var(--c-text-muted)',
        },
        accent: { DEFAULT: 'var(--c-accent)', ink: 'var(--c-accent-ink)' },
        success: { DEFAULT: 'var(--c-success)', ink: 'var(--c-success-ink)' },
        danger: { DEFAULT: 'var(--c-danger)', ink: 'var(--c-danger-ink)' },
        warning: 'var(--c-warning)',
        day: {
          done: 'var(--c-day-done)',
          missed: 'var(--c-day-missed)',
          today: 'var(--c-day-today)',
          future: 'var(--c-day-future)',
        },
        line: 'var(--c-border)',
      },
      fontFamily: {
        // Two roles, not three — see the note in src/design/tokens.ts.
        display: ['Georgia', 'serif'],
        sans: ['System', 'sans-serif'],
      },
      spacing: px(theme.space),
      borderRadius: px(theme.radius),
      fontSize,
      minHeight: { tap: `${theme.minTap}px` },
      minWidth: { tap: `${theme.minTap}px` },
    },
  },
  plugins: [],
};
