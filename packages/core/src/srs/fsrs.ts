/**
 * FSRS (Free Spaced Repetition Scheduler) v4.5.
 *
 * Chosen over SM-2 because it models stability and difficulty separately, which
 * gives materially better retention per review, and because its weights are
 * published under a free licence. Everything here is pure: no clock, no I/O.
 * `now` is always passed in so tests are deterministic.
 */

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface Card {
  wordId: number;
  state: CardState;
  /** epoch ms */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface FsrsParams {
  w: readonly number[];
  /** Target probability of recall at review time. */
  requestRetention: number;
  /** Days. Caps runaway intervals so a word never vanishes for a decade. */
  maximumInterval: number;
}

/** FSRS-4.5 default weights, from the published optimiser. */
export const DEFAULT_W: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const DEFAULT_PARAMS: FsrsParams = {
  w: DEFAULT_W,
  requestRetention: 0.9,
  maximumInterval: 365 * 4,
};

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY_MS = 86_400_000;

const clampDifficulty = (d: number): number => Math.min(10, Math.max(1, d));

/** Probability the learner still recalls the item after `elapsedDays`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Days until retrievability decays to `requestRetention`. */
export function intervalFor(stability: number, p: FsrsParams): number {
  const raw = (stability / FACTOR) * (Math.pow(p.requestRetention, 1 / DECAY) - 1);
  return Math.min(p.maximumInterval, Math.max(1, Math.round(raw)));
}

function initialStability(rating: Rating, p: FsrsParams): number {
  return Math.max(0.1, p.w[rating - 1] ?? 1);
}

function initialDifficulty(rating: Rating, p: FsrsParams): number {
  return clampDifficulty((p.w[4] ?? 5) - (rating - 3) * (p.w[5] ?? 1));
}

function nextDifficulty(d: number, rating: Rating, p: FsrsParams): number {
  const delta = d - (p.w[6] ?? 1) * (rating - 3);
  // Mean reversion toward the difficulty of an "Easy" first answer, so a single
  // bad day does not permanently mark a word as hard.
  const reverted = (p.w[7] ?? 0) * initialDifficulty(Rating.Easy, p) + (1 - (p.w[7] ?? 0)) * delta;
  return clampDifficulty(reverted);
}

function stabilityOnRecall(
  d: number,
  s: number,
  r: number,
  rating: Rating,
  p: FsrsParams,
): number {
  const hardPenalty = rating === Rating.Hard ? (p.w[15] ?? 1) : 1;
  const easyBonus = rating === Rating.Easy ? (p.w[16] ?? 1) : 1;
  const growth =
    Math.exp(p.w[8] ?? 0) *
    (11 - d) *
    Math.pow(s, -(p.w[9] ?? 0)) *
    (Math.exp((1 - r) * (p.w[10] ?? 0)) - 1) *
    hardPenalty *
    easyBonus;
  return s * (1 + growth);
}

function stabilityOnLapse(d: number, s: number, r: number, p: FsrsParams): number {
  const next =
    (p.w[11] ?? 1) *
    Math.pow(d, -(p.w[12] ?? 0)) *
    (Math.pow(s + 1, p.w[13] ?? 0) - 1) *
    Math.exp((1 - r) * (p.w[14] ?? 0));
  // Forgetting must never increase stability.
  return Math.min(next, s);
}

export function newCard(wordId: number, now: number): Card {
  return {
    wordId,
    state: CardState.New,
    due: now,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

/**
 * Apply a review. Returns a new card; the input is never mutated.
 *
 * Learning and relearning steps are deliberately short (1m / 10m) so that a
 * missed word comes back inside the same practice session rather than tomorrow.
 */
export function schedule(
  card: Card,
  rating: Rating,
  now: number,
  params: FsrsParams = DEFAULT_PARAMS,
): Card {
  const p = params;
  const elapsedDays =
    card.lastReview === null ? 0 : Math.max(0, (now - card.lastReview) / DAY_MS);

  let { stability, difficulty } = card;
  let state = card.state;
  let lapses = card.lapses;

  if (card.state === CardState.New) {
    stability = initialStability(rating, p);
    difficulty = initialDifficulty(rating, p);
    state = rating === Rating.Again ? CardState.Learning : CardState.Review;
  } else {
    const r = retrievability(elapsedDays, card.stability);
    difficulty = nextDifficulty(card.difficulty, rating, p);
    if (rating === Rating.Again) {
      stability = stabilityOnLapse(card.difficulty, card.stability, r, p);
      lapses += 1;
      state = CardState.Relearning;
    } else {
      stability = stabilityOnRecall(card.difficulty, card.stability, r, rating, p);
      state = CardState.Review;
    }
  }

  let due: number;
  if (state === CardState.Learning || state === CardState.Relearning) {
    due = now + (rating === Rating.Again ? 60_000 : 600_000);
  } else {
    due = now + intervalFor(stability, p) * DAY_MS;
  }

  return {
    wordId: card.wordId,
    state,
    due,
    stability,
    difficulty,
    reps: card.reps + 1,
    lapses,
    lastReview: now,
  };
}

/**
 * Map a game outcome onto a rating, so that *playing is reviewing*. There is no
 * separate flashcard mode the user has to remember to visit.
 *
 * `medianMs` is the learner's own rolling median answer time, so "fast" is
 * relative to them and not to a hardcoded constant.
 */
export function ratingFromAnswer(
  correct: boolean,
  elapsedMs: number,
  medianMs: number,
  usedHint = false,
): Rating {
  if (!correct) return Rating.Again;
  if (usedHint) return Rating.Hard;
  if (elapsedMs <= medianMs * 0.6) return Rating.Easy;
  if (elapsedMs >= medianMs * 1.8) return Rating.Hard;
  return Rating.Good;
}

/** Due cards, most overdue first. New cards are excluded — they are introduced separately. */
export function dueQueue(cards: readonly Card[], now: number, limit: number): Card[] {
  return cards
    .filter((c) => c.state !== CardState.New && c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}
