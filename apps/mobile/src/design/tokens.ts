/**
 * Design tokens.
 *
 * Every value here is checked by `tests/tokens.test.ts`, which fails CI if a
 * text/background pair drops below WCAG AA or two adjacent surfaces become
 * indistinguishable. The reference app's card (#2d2d2d) on page (#222222)
 * measures 1.16 — legible in a screenshot, gone on a phone in daylight. Surfaces
 * here are spaced so that cannot happen.
 *
 * Feature code uses `useTheme()`. Literal colours and pixel values in a screen
 * are a review rejection.
 */

export const palette = {
  dark: {
    /**
     * Page and the two surfaces that carry text, each >= 1.25 from the one below.
     *
     * Three text tiers over four text-bearing surfaces is over-constrained in
     * dark mode — the muted tier ends up indistinguishable from the secondary
     * one. So `surface3` is deliberately NOT a text surface: it is for inactive
     * controls, dividers and chips, and nothing sets body text on it.
     */
    bg: '#0F0F0F',
    surface1: '#262626',
    surface2: '#363636',
    /** Non-text surface: inactive controls, dividers, chips. */
    surface3: '#464646',

    textPrimary: '#FFFFFF',
    textSecondary: '#B8B8B8',
    /** The dimmest text allowed, and only down to `surface2`. */
    textMuted: '#A0A0A0',

    accent: '#7FC8C0',
    /** Text placed on `accent`. */
    accentInk: '#06201E',

    success: '#7FC888',
    successInk: '#052009',
    danger: '#E8877A',
    dangerInk: '#2A0B06',
    warning: '#E8C87A',

    /** Streak states. `future` must never look like `missed`. */
    dayDone: '#7FC8C0',
    dayMissed: '#6B4A45',
    dayToday: '#FFFFFF',
    dayFuture: '#2F2F2F',

    border: '#3D3D3D',
    /**
     * Scrim over photography. Dark mode gets no drop shadows at all — elevation
     * is a surface lightness step, because a black shadow on a dark background
     * reads as a smudge.
     */
    scrimTop: 'rgba(15,15,15,0.15)',
    scrimBottom: 'rgba(15,15,15,0.88)',
  },
  light: {
    bg: '#FFFFFF',
    surface1: '#E5E5E5',
    surface2: '#CBCBCB',
    /** Non-text surface: inactive controls, dividers, chips. */
    surface3: '#B4B4B4',

    textPrimary: '#121212',
    textSecondary: '#3F3F3F',
    textMuted: '#555555',

    accent: '#1F6F67',
    accentInk: '#FFFFFF',

    success: '#1B6B29',
    successInk: '#FFFFFF',
    danger: '#A32718',
    dangerInk: '#FFFFFF',
    warning: '#7A5A00',

    dayDone: '#1F6F67',
    dayMissed: '#D9A79F',
    dayToday: '#121212',
    dayFuture: '#E3E3E3',

    border: '#B4B4B4',
    scrimTop: 'rgba(0,0,0,0.10)',
    scrimBottom: 'rgba(0,0,0,0.72)',
  },
} as const;

export type ColorScheme = keyof typeof palette;
/**
 * Widened from the literal token values on purpose: the light and dark tables
 * must be interchangeable, so the type is the *shape* of a palette, not the
 * exact hexes of one of them.
 */
export type Colors = Record<keyof (typeof palette)['dark'], string>;

/**
 * Two type roles, not three. The reference app runs a serif for titles, a sans
 * for body and a rounded script in the feed — the script appears in exactly one
 * place and belongs to no system.
 */
export const fonts = {
  display: { fontFamily: 'Georgia', fontWeight: '700' },
  text: { fontFamily: 'System', fontWeight: '400' },
  textBold: { fontFamily: 'System', fontWeight: '700' },
} as const;

/**
 * One ramp, seven steps. Card label size is chosen from this ramp by the card's
 * `size` prop — it does not drift with grid density the way the reference app's
 * 2-up and 3-up topic labels do.
 */
export const type = {
  display1: { fontSize: 40, lineHeight: 46, letterSpacing: -0.5 },
  display2: { fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  title: { fontSize: 24, lineHeight: 30 },
  headline: { fontSize: 20, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Minimum side gutter. Nothing touches the screen edge. */
  gutter: 16,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Smallest comfortable tap target. Enforced by `Pressable` wrappers. */
export const MIN_TAP = 48;

export const duration = { fast: 120, base: 200, slow: 320 } as const;

/**
 * Status is never carried by colour alone. Each state has a distinct glyph, so
 * the results list reads correctly in greyscale and for colour-blind users.
 */
export const statusIcon = {
  correct: 'check',
  incorrect: 'cross',
  skipped: 'dash',
} as const;
