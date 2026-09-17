/**
 * Session runner — a pure reducer. No timers, no clock reads: the caller passes
 * `now` and the reducer decides whether the run is over. That makes every rule
 * in here testable without a simulator or a fake clock library.
 */

import type { GameItem } from '../items/generators.js';
import { Rating, ratingFromAnswer } from '../srs/fsrs.js';
import type { EndCondition, Mode } from './modes.js';

export interface AnswerRecord {
  item: GameItem;
  chosenIndex: number | null;
  correct: boolean;
  elapsedMs: number;
  rating: Rating;
}

export interface SessionState {
  mode: Mode;
  items: GameItem[];
  index: number;
  answers: AnswerRecord[];
  livesLeft: number | null;
  startedAt: number;
  questionStartedAt: number;
  endedAt: number | null;
  endReason: EndCondition | null;
  /** Rolling median answer time, seeded from history; drives Easy/Hard ratings. */
  medianMs: number;
}

export interface SessionSummary {
  mode: Mode;
  endReason: EndCondition;
  correct: number;
  missed: number;
  attempted: number;
  durationMs: number;
  accuracy: number;
  /** Words to surface on the results screen, missed first. */
  answers: AnswerRecord[];
  isPersonalBest: boolean;
  previousBest: number | null;
}

export function startSession(
  mode: Mode,
  items: GameItem[],
  now: number,
  medianMs = 4000,
): SessionState {
  return {
    mode,
    items,
    index: 0,
    answers: [],
    livesLeft: mode.lives,
    startedAt: now,
    questionStartedAt: now,
    endedAt: null,
    endReason: null,
    medianMs,
  };
}

export function currentItem(state: SessionState): GameItem | null {
  return state.items[state.index] ?? null;
}

export function timeRemainingMs(state: SessionState, now: number): number | null {
  if (state.mode.timeLimitMs === null) return null;
  return Math.max(0, state.mode.timeLimitMs - (now - state.startedAt));
}

function endedReason(state: SessionState, now: number): EndCondition | null {
  // Time is checked for every timed mode, even when `endsOn` is lives: a mode may
  // have both limits, but only one of them is what the summary reports.
  if (state.mode.timeLimitMs !== null && now - state.startedAt >= state.mode.timeLimitMs) {
    return 'time';
  }
  if (state.livesLeft !== null && state.livesLeft <= 0) return 'lives';
  if (state.index >= state.items.length) return 'deck';
  return null;
}

/** `chosenIndex === null` means the question timed out or was skipped. */
export function answer(state: SessionState, chosenIndex: number | null, now: number): SessionState {
  const item = currentItem(state);
  if (item === null || state.endedAt !== null) return state;

  const elapsedMs = now - state.questionStartedAt;
  const correct = chosenIndex !== null && chosenIndex === item.answerIndex;
  const rating = ratingFromAnswer(correct, elapsedMs, state.medianMs);

  const answers = [...state.answers, { item, chosenIndex, correct, elapsedMs, rating }];
  const livesLeft = state.livesLeft === null ? null : correct ? state.livesLeft : state.livesLeft - 1;
  const index = state.index + 1;

  // Median of the last 20 answers, so "fast" stays relative to this learner.
  const recent = answers.slice(-20).map((a) => a.elapsedMs).sort((a, b) => a - b);
  const medianMs = recent.length ? recent[Math.floor(recent.length / 2)]! : state.medianMs;

  const next: SessionState = {
    ...state,
    answers,
    livesLeft,
    index,
    questionStartedAt: now,
    medianMs,
  };

  const reason = endedReason(next, now);
  return reason === null ? next : { ...next, endedAt: now, endReason: reason };
}

/** Call on a timer tick so timed modes end without the learner touching anything. */
export function tick(state: SessionState, now: number): SessionState {
  if (state.endedAt !== null) return state;
  const reason = endedReason(state, now);
  return reason === null ? state : { ...state, endedAt: now, endReason: reason };
}

export function summarise(state: SessionState, previousBest: number | null): SessionSummary {
  const correct = state.answers.filter((a) => a.correct).length;
  const attempted = state.answers.length;
  const endReason = state.endReason ?? 'deck';
  const score = state.mode.endsOn === 'deck' ? Math.round((correct / Math.max(1, attempted)) * 100) : correct;
  return {
    mode: state.mode,
    endReason,
    correct,
    missed: attempted - correct,
    attempted,
    durationMs: (state.endedAt ?? state.startedAt) - state.startedAt,
    accuracy: attempted === 0 ? 0 : correct / attempted,
    // Missed words first: the results screen exists to fix mistakes, not to rank.
    answers: [...state.answers].sort((a, b) => Number(a.correct) - Number(b.correct)),
    isPersonalBest: previousBest === null ? attempted > 0 : score > previousBest,
    previousBest,
  };
}
