import themeJson from './theme.json';

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

export type ColorScheme = 'dark' | 'light';

/** Every colour name a palette must define. */
export type ColorKey =
  | 'bg' | 'surface1' | 'surface2' | 'surface3'
  | 'textPrimary' | 'textSecondary' | 'textMuted'
  | 'accent' | 'accentInk'
  | 'success' | 'successInk' | 'danger' | 'dangerInk' | 'warning'
  | 'dayDone' | 'dayMissed' | 'dayToday' | 'dayFuture'
  | 'border' | 'scrimTop' | 'scrimBottom';

/**
 * The shape of a palette, not the exact hexes of one: light and dark must be
 * interchangeable wherever a theme is consumed.
 */
export type Colors = Record<ColorKey, string>;

/**
 * Colour values live in `palette.json` so that exactly one file defines them and
 * both consumers read it: this module (typed, for `useTheme()`) and
 * `tailwind.config.js` (for NativeWind classes). A colour that drifted between
 * the two would defeat the contrast tests, which assert against these values.
 */
export const palette: Record<ColorScheme, Colors> = themeJson.colors;

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
export type TypeVariant =
  | 'display1' | 'display2' | 'title' | 'headline' | 'body' | 'label' | 'caption';

/**
 * One ramp, seven steps, shared with Tailwind's `fontSize` scale so a class and
 * a style object cannot disagree about what `body` means.
 */
export const type: Record<TypeVariant, { fontSize: number; lineHeight: number }> =
  Object.fromEntries(
    Object.entries(themeJson.fontSize).map(([k, [fontSize, lineHeight]]) => [
      k,
      { fontSize, lineHeight },
    ]),
  ) as Record<TypeVariant, { fontSize: number; lineHeight: number }>;

export const space: Record<
  'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'gutter',
  number
> = themeJson.space;

export const radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'pill', number> = themeJson.radius;

/** Smallest comfortable tap target. Enforced by `Pressable` wrappers. */
export const MIN_TAP: number = themeJson.minTap;

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
