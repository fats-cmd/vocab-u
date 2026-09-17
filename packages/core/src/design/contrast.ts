/**
 * WCAG contrast, in the domain core so that contrast is a *test*, not a review
 * comment. CI fails on a token pair below threshold, which is why the reference
 * app's card-on-page surfaces (barely 2% apart) cannot happen here.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function relativeLuminance(colour: string | Rgb): number {
  const { r, g, b } = typeof colour === 'string' ? parseHex(colour) : colour;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_AA_BODY = 4.5;
export const WCAG_AA_LARGE = 3.0;
/**
 * Two adjacent surfaces must be distinguishable without a border.
 *
 * Calibrated against the defect it exists to catch: the reference app's card
 * (#2d2d2d) on page (#222222) measures 1.16, which reads in a screenshot and
 * disappears on a phone in daylight. 1.25 rejects that pair and accepts a
 * genuinely legible dark step such as #343434 on #1c1c1c (1.37).
 */
export const SURFACE_SEPARATION = 1.25;

export function meetsAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? WCAG_AA_LARGE : WCAG_AA_BODY);
}

export function surfacesSeparated(a: string, b: string): boolean {
  return contrastRatio(a, b) >= SURFACE_SEPARATION;
}
