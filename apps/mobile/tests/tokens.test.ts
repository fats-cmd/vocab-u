/**
 * Contrast is a test, not a review comment.
 *
 * These assertions are the reason the defects in docs/REFERENCE_TEARDOWN.md
 * section C cannot reappear: a token change that breaks legibility fails CI.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, surfacesSeparated } from '@vocab-u/core';
import { palette, statusIcon, type ColorScheme } from '../src/design/tokens';

const schemes: ColorScheme[] = ['dark', 'light'];

describe.each(schemes)('%s theme', (scheme) => {
  const c = palette[scheme];

  it('keeps body text at AA on every text-bearing surface', () => {
    // `surface3` is excluded by design: it carries inactive controls and
    // dividers, never body text. See the comment on the token.
    for (const surface of [c.bg, c.surface1, c.surface2] as const) {
      for (const text of [c.textPrimary, c.textSecondary, c.textMuted] as const) {
        const ratio = contrastRatio(text, surface);
        expect(
          ratio,
          `${text} on ${surface} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('separates each surface step from the one below it', () => {
    const steps = [c.bg, c.surface1, c.surface2, c.surface3] as const;
    for (let i = 1; i < steps.length; i += 1) {
      expect(
        surfacesSeparated(steps[i]!, steps[i - 1]!),
        `${steps[i]} vs ${steps[i - 1]} is ${contrastRatio(steps[i]!, steps[i - 1]!).toFixed(2)}:1`,
      ).toBe(true);
    }
  });

  it('keeps ink legible on every filled control', () => {
    expect(meetsAA(c.accentInk, c.accent)).toBe(true);
    expect(meetsAA(c.successInk, c.success)).toBe(true);
    expect(meetsAA(c.dangerInk, c.danger)).toBe(true);
  });

  it('distinguishes a missed streak day from a future one', () => {
    // The reference app renders Thursday-to-Sunday identically to a missed
    // Monday. Future is not failure, and they must not share a colour.
    expect(c.dayMissed).not.toBe(c.dayFuture);
    expect(contrastRatio(c.dayMissed, c.dayFuture)).toBeGreaterThan(1.3);
  });

  it('distinguishes every streak day state from every other', () => {
    const states = { done: c.dayDone, missed: c.dayMissed, today: c.dayToday, future: c.dayFuture };
    const entries = Object.entries(states);
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [aName, a] = entries[i]!;
        const [bName, b] = entries[j]!;
        expect(contrastRatio(a, b), `${aName} vs ${bName}`).toBeGreaterThan(1.3);
      }
    }
  });

  it('keeps status colours legible as text on the page', () => {
    // Note what is deliberately NOT asserted here: contrast *between* success and
    // danger. Two semantic colours of similar luminance are fine and normal, and
    // a contrast ratio between them measures nothing useful for colour blindness.
    // The real fix is that correct/incorrect always carries a distinct icon shape
    // as well as a colour — see `statusIcon` below.
    expect(meetsAA(c.success, c.bg, true)).toBe(true);
    expect(meetsAA(c.danger, c.bg, true)).toBe(true);
  });

  it('pairs every status colour with a distinct shape, not colour alone', () => {
    expect(statusIcon.correct).not.toBe(statusIcon.incorrect);
    expect(Object.values(statusIcon).length).toBe(new Set(Object.values(statusIcon)).size);
  });
});

describe('scrim', () => {
  it('is defined for both schemes, so text can never sit on bare photography', () => {
    for (const scheme of schemes) {
      expect(palette[scheme].scrimTop).toMatch(/^rgba\(/);
      expect(palette[scheme].scrimBottom).toMatch(/^rgba\(/);
    }
  });
});
