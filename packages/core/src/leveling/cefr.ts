import { CEFR_ORDER, type Cefr } from '../schema/types.js';

/**
 * Upper bound of each band on the continuous 0..1 difficulty scale.
 * CEFR is a *label over bands of difficulty*, for display only — no selection
 * decision anywhere in the app branches on it.
 */
const BAND_MAX: Record<Cefr, number> = {
  A1: 0.17,
  A2: 0.33,
  B1: 0.5,
  B2: 0.67,
  C1: 0.83,
  C2: 1.0,
};

export function cefrForDifficulty(difficulty: number): Cefr {
  const d = Math.min(1, Math.max(0, difficulty));
  for (const band of CEFR_ORDER) {
    if (d <= BAND_MAX[band]) return band;
  }
  return 'C2';
}

export function bandRange(band: Cefr): { min: number; max: number } {
  const i = CEFR_ORDER.indexOf(band);
  const min = i === 0 ? 0 : BAND_MAX[CEFR_ORDER[i - 1]!];
  return { min, max: BAND_MAX[band] };
}

export function isTopBand(band: Cefr): boolean {
  return band === CEFR_ORDER[CEFR_ORDER.length - 1];
}

export function nextBand(band: Cefr): Cefr | null {
  const i = CEFR_ORDER.indexOf(band);
  return i < 0 || i === CEFR_ORDER.length - 1 ? null : CEFR_ORDER[i + 1]!;
}

/**
 * How far through the current band the learner is, 0..1.
 *
 * At the top band this is a *mastery* figure and there is deliberately no
 * "distance to next level" — the reference app showed "Points to next level: 0"
 * to a learner already at the ceiling, which is the bug this function exists to
 * make unrepresentable.
 */
export function bandProgress(difficulty: number): {
  band: Cefr;
  progress: number;
  next: Cefr | null;
  atCeiling: boolean;
} {
  const band = cefrForDifficulty(difficulty);
  const { min, max } = bandRange(band);
  const span = Math.max(1e-6, max - min);
  const progress = Math.min(1, Math.max(0, (difficulty - min) / span));
  return { band, progress, next: nextBand(band), atCeiling: isTopBand(band) };
}
