/**
 * Enrichment — derives the continuous difficulty score that every selection
 * decision in the app depends on.
 *
 * The reference app rated a learner "Advanced" and then asked them "happens once
 * every year → annual". That is only possible if difficulty is not a property of
 * the data. Here it is, and it is computed once, at build time.
 */

import { cefrForDifficulty, type Register } from '@vocab-u/core';
import type { BuiltEntry, RawEntry } from '../types.ts';

export const WEIGHTS = {
  frequency: 0.65,
  morphology: 0.25,
  register: 0.1,
  /** Subtracted: a word with many senses is met more often and sticks sooner. */
  polysemyDiscount: 0.1,
} as const;

/**
 * Frequency anchors. The top few thousand words of English carry most of running
 * text and are all beginner vocabulary, so rarity has to rise steeply at the
 * common end — a plain log-over-max transform puts a rank-900 word in the middle
 * of the scale, which is how you end up asking an advanced learner to define
 * "annual".
 *
 * Calibrated so the curve crosses the CEFR band edges near the conventional
 * frequency anchors: 1k ≈ A1/A2, 2k ≈ A2/B1, 4k ≈ B1, 8k ≈ B2, 16k ≈ C1.
 */
const COMMON_RANK = 250;
const RARE_RANK = 160_000;
const RARITY_SPAN = Math.log2(RARE_RANK / COMMON_RANK);

const REGISTER_PENALTY: Record<Register, number> = {
  neutral: 0,
  informal: 0.3,
  formal: 0.5,
  technical: 1,
  archaic: 1,
};

/** Vowel-group syllable estimate. Good enough for a difficulty weight. */
export function countSyllables(lemma: string): number {
  const w = lemma.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 1;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Rarity on 0..1. A missing rank means "not in the frequency list", i.e. very rare. */
export function rarity(freqRank: number | null): number {
  if (freqRank === null) return 1;
  const clamped = Math.min(RARE_RANK, Math.max(COMMON_RANK, freqRank));
  return Math.min(1, Math.max(0, Math.log2(clamped / COMMON_RANK) / RARITY_SPAN));
}

/** Longer words with more syllables are harder to hold onto. */
export function morphComplexity(lemma: string, syllables: number): number {
  const bySyllable = Math.min(1, (syllables - 1) / 5);
  const byLength = Math.min(1, Math.max(0, lemma.length - 4) / 12);
  return 0.6 * bySyllable + 0.4 * byLength;
}

/**
 * A discount, not a penalty. One sense *in our corpus* is not evidence that a
 * word is monosemous in English — it is usually just evidence that we have not
 * imported its other senses yet, so a single-sense entry must sit at neutral
 * rather than at maximum difficulty.
 */
export function polysemyDiscount(senseCount: number): number {
  return Math.min(1, Math.max(0, (senseCount - 1) / 3));
}

export function difficultyOf(entry: RawEntry, syllables: number): number {
  const register = entry.senses[0]?.register ?? 'neutral';
  const score =
    WEIGHTS.frequency * rarity(entry.freqRank) +
    WEIGHTS.morphology * morphComplexity(entry.lemma, syllables) +
    WEIGHTS.register * REGISTER_PENALTY[register] -
    WEIGHTS.polysemyDiscount * polysemyDiscount(entry.senses.length);
  return Math.min(1, Math.max(0, Number(score.toFixed(4))));
}

export function enrich(entries: readonly RawEntry[]): BuiltEntry[] {
  return entries.map((entry) => {
    const syllables = countSyllables(entry.lemma);
    const difficulty = difficultyOf(entry, syllables);
    return { ...entry, syllables, difficulty, cefr: cefrForDifficulty(difficulty) };
  });
}
