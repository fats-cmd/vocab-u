/**
 * Distractor selection.
 *
 * The reference app offered `inept` / `daintiest` / `annual` for "happens once
 * every year": three options of unmatched part of speech and morphology, one of
 * them a superlative, answerable without knowing any of the words. A good
 * distractor is close enough to be tempting and far enough to be unambiguously
 * wrong — this module is the difference between a vocabulary test and a
 * process-of-elimination puzzle.
 */

import type { Word } from '../schema/types.js';
import { type Rng, shuffle } from './rng.js';

export interface DistractorCandidate {
  word: Word;
  /** Topic/semantic-field ids the candidate belongs to. */
  fields: readonly number[];
}

export interface DistractorContext {
  target: Word;
  targetFields: readonly number[];
  /** Word ids that are synonyms of the target — hard-excluded. */
  synonymIds: ReadonlySet<number>;
}

export const WEIGHTS = {
  difficultyProximity: 0.8,
  lengthProximity: 0.6,
  sharedField: 0.5,
} as const;

/** Same lemma root with a different inflection — e.g. `dainty` / `daintiest`. */
export function isInflectionOf(candidate: string, target: string): boolean {
  const a = candidate.toLowerCase();
  const b = target.toLowerCase();
  if (a === b) return true;
  const stem = (s: string) =>
    s.replace(/(iest|ier|ing|edly|ed|es|s|ly|ness|est|er)$/i, '').replace(/i$/, 'y');
  const sa = stem(a);
  const sb = stem(b);
  if (sa.length < 3 || sb.length < 3) return false;
  return sa === sb || sa.startsWith(sb) || sb.startsWith(sa);
}

/**
 * Score a candidate. Returns null for candidates that are disqualified outright
 * rather than merely poor — matching part of speech is a requirement, not a
 * preference, and a synonym of the target would make two options correct.
 */
export function scoreCandidate(
  candidate: DistractorCandidate,
  ctx: DistractorContext,
): number | null {
  const { word } = candidate;
  if (word.id === ctx.target.id) return null;
  if (word.pos !== ctx.target.pos) return null;
  if (ctx.synonymIds.has(word.id)) return null;
  if (isInflectionOf(word.lemma, ctx.target.lemma)) return null;

  const difficultyProximity = 1 - Math.min(1, Math.abs(word.difficulty - ctx.target.difficulty) / 0.3);
  const lengthProximity =
    1 - Math.min(1, Math.abs(word.lemma.length - ctx.target.lemma.length) / 8);
  const sharedField = candidate.fields.some((f) => ctx.targetFields.includes(f)) ? 1 : 0;

  return (
    WEIGHTS.difficultyProximity * difficultyProximity +
    WEIGHTS.lengthProximity * lengthProximity +
    WEIGHTS.sharedField * sharedField
  );
}

/**
 * Pick `count` distractors. The top candidates are sampled rather than taken
 * outright, so the same word does not produce an identical question every time
 * while the pool stays high quality.
 */
export function selectDistractors(
  pool: readonly DistractorCandidate[],
  ctx: DistractorContext,
  count: number,
  rng: Rng,
): Word[] {
  const scored: Array<{ word: Word; score: number }> = [];
  for (const candidate of pool) {
    const score = scoreCandidate(candidate, ctx);
    if (score !== null) scored.push({ word: candidate.word, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const shortlist = scored.slice(0, Math.max(count * 3, count));
  return shuffle(shortlist, rng)
    .slice(0, count)
    .map((s) => s.word);
}

