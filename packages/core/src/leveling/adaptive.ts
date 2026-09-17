/**
 * Adaptive vocabulary level test.
 *
 * A Rasch (1-parameter logistic) computerised adaptive test. Reaches the
 * precision of a 30-item fixed form in 12-18 items by always asking the question
 * the learner is closest to 50/50 on — the item that carries the most
 * information about their ability.
 *
 * Ability `theta` lives on a logit scale (roughly -4..+4). Item difficulty in
 * the corpus lives on 0..1, so the two are converted at the boundary.
 */

import { cefrForDifficulty, bandProgress } from './cefr';
import type { Cefr } from '../schema/types';

/** Logistic slope. 1.0 = standard Rasch. */
const SLOPE = 1.0;
/** Maps corpus difficulty 0..1 onto the logit scale. */
const LOGIT_SPAN = 8;

export const THETA_MIN = -4;
export const THETA_MAX = 4;

export interface TestConfig {
  minItems: number;
  maxItems: number;
  /** Stop once the standard error of the ability estimate falls below this. */
  seThreshold: number;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  minItems: 12,
  maxItems: 18,
  seThreshold: 0.52,
};

export interface TestItem {
  wordId: number;
  /** Corpus difficulty, 0..1. */
  difficulty: number;
}

export interface Response {
  item: TestItem;
  correct: boolean;
}

export const toLogit = (difficulty: number): number => (difficulty - 0.5) * LOGIT_SPAN;
export const toDifficulty = (theta: number): number =>
  Math.min(1, Math.max(0, theta / LOGIT_SPAN + 0.5));

/** Probability of a correct answer. */
export function pCorrect(theta: number, difficultyLogit: number): number {
  return 1 / (1 + Math.exp(-SLOPE * (theta - difficultyLogit)));
}

/** Fisher information an item carries at a given ability. Maximised when p = 0.5. */
export function information(theta: number, difficultyLogit: number): number {
  const p = pCorrect(theta, difficultyLogit);
  return SLOPE * SLOPE * p * (1 - p);
}

/**
 * Maximum-likelihood ability estimate by Newton-Raphson.
 *
 * With an all-correct or all-incorrect response pattern the MLE diverges, so we
 * fall back to a step beyond the most extreme item attempted — which is the
 * honest reading of "we did not find their ceiling".
 */
export function estimateTheta(responses: readonly Response[]): number {
  if (responses.length === 0) return 0;

  const allCorrect = responses.every((r) => r.correct);
  const allWrong = responses.every((r) => !r.correct);
  if (allCorrect || allWrong) {
    const logits = responses.map((r) => toLogit(r.item.difficulty));
    return allCorrect
      ? Math.min(THETA_MAX, Math.max(...logits) + 1)
      : Math.max(THETA_MIN, Math.min(...logits) - 1);
  }

  let theta = 0;
  for (let iter = 0; iter < 30; iter += 1) {
    let firstDeriv = 0;
    let secondDeriv = 0;
    for (const r of responses) {
      const b = toLogit(r.item.difficulty);
      const p = pCorrect(theta, b);
      firstDeriv += SLOPE * ((r.correct ? 1 : 0) - p);
      secondDeriv -= SLOPE * SLOPE * p * (1 - p);
    }
    if (Math.abs(secondDeriv) < 1e-9) break;
    const step = firstDeriv / secondDeriv;
    theta -= step;
    theta = Math.min(THETA_MAX, Math.max(THETA_MIN, theta));
    if (Math.abs(step) < 1e-5) break;
  }
  return theta;
}

export function standardError(theta: number, responses: readonly Response[]): number {
  const info = responses.reduce((sum, r) => sum + information(theta, toLogit(r.item.difficulty)), 0);
  return info <= 0 ? Infinity : 1 / Math.sqrt(info);
}

/** The most informative unseen item — the one nearest the current ability estimate. */
export function selectNextItem(
  pool: readonly TestItem[],
  theta: number,
  seen: ReadonlySet<number>,
): TestItem | null {
  let best: TestItem | null = null;
  let bestInfo = -Infinity;
  for (const item of pool) {
    if (seen.has(item.wordId)) continue;
    const info = information(theta, toLogit(item.difficulty));
    if (info > bestInfo) {
      bestInfo = info;
      best = item;
    }
  }
  return best;
}

export interface TestState {
  responses: Response[];
  theta: number;
  se: number;
  seen: Set<number>;
  config: TestConfig;
}

export function startTest(
  priorTheta: number | null,
  config: TestConfig = DEFAULT_TEST_CONFIG,
): TestState {
  return {
    responses: [],
    theta: priorTheta ?? 0,
    se: Infinity,
    seen: new Set(),
    config,
  };
}

export function recordResponse(state: TestState, item: TestItem, correct: boolean): TestState {
  const responses = [...state.responses, { item, correct }];
  const theta = estimateTheta(responses);
  const seen = new Set(state.seen);
  seen.add(item.wordId);
  return { ...state, responses, theta, se: standardError(theta, responses), seen };
}

export function isComplete(state: TestState): boolean {
  const n = state.responses.length;
  if (n >= state.config.maxItems) return true;
  if (n < state.config.minItems) return false;
  return state.se < state.config.seThreshold;
}

export interface LevelResult {
  theta: number;
  se: number;
  difficulty: number;
  cefr: Cefr;
  /** 0..1 through the current band. At the ceiling this is mastery, not distance. */
  bandProgress: number;
  nextBand: Cefr | null;
  atCeiling: boolean;
  itemsAsked: number;
  correct: number;
}

export function finishTest(state: TestState): LevelResult {
  const difficulty = toDifficulty(state.theta);
  const { band, progress, next, atCeiling } = bandProgress(difficulty);
  return {
    theta: state.theta,
    se: state.se,
    difficulty,
    cefr: band,
    bandProgress: progress,
    nextBand: next,
    atCeiling,
    itemsAsked: state.responses.length,
    correct: state.responses.filter((r) => r.correct).length,
  };
}

