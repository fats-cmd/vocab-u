import { describe, expect, it } from 'vitest';
import type { Card } from '../src/srs/fsrs';
import {
  CardState,
  DEFAULT_PARAMS,
  Rating,
  dueQueue,
  intervalFor,
  newCard,
  ratingFromAnswer,
  retrievability,
  schedule,
} from '../src/srs/fsrs';

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

describe('retrievability', () => {
  it('is 1 at zero elapsed time and decays monotonically', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 6);
    const a = retrievability(5, 10);
    const b = retrievability(20, 10);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });

  it('decays more slowly for a more stable card', () => {
    expect(retrievability(10, 30)).toBeGreaterThan(retrievability(10, 5));
  });
});

describe('intervalFor', () => {
  it('grows with stability and respects the maximum', () => {
    expect(intervalFor(10, DEFAULT_PARAMS)).toBeGreaterThan(intervalFor(2, DEFAULT_PARAMS));
    expect(intervalFor(1e9, DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.maximumInterval);
  });

  it('never schedules a card for today', () => {
    expect(intervalFor(0.01, DEFAULT_PARAMS)).toBeGreaterThanOrEqual(1);
  });
});

describe('schedule', () => {
  it('does not mutate the input card', () => {
    const card = newCard(1, T0);
    const before = { ...card };
    schedule(card, Rating.Good, T0);
    expect(card).toEqual(before);
  });

  it('moves a new card into review on a successful first answer', () => {
    const next = schedule(newCard(1, T0), Rating.Good, T0);
    expect(next.state).toBe(CardState.Review);
    expect(next.reps).toBe(1);
    expect(next.due).toBeGreaterThan(T0);
  });

  it('keeps a failed new card in learning, due within minutes', () => {
    const next = schedule(newCard(1, T0), Rating.Again, T0);
    expect(next.state).toBe(CardState.Learning);
    expect(next.due - T0).toBeLessThanOrEqual(10 * 60_000);
  });

  it('orders intervals Again < Hard < Good < Easy', () => {
    const base = schedule(newCard(1, T0), Rating.Good, T0);
    const later = T0 + 5 * DAY;
    const intervals = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map(
      (r) => schedule(base, r, later).due - later,
    );
    expect(intervals[0]).toBeLessThan(intervals[1]!);
    expect(intervals[1]).toBeLessThan(intervals[2]!);
    expect(intervals[2]).toBeLessThan(intervals[3]!);
  });

  it('counts a lapse and never raises stability on a failure', () => {
    const reviewed = schedule(newCard(1, T0), Rating.Good, T0);
    const lapsed = schedule(reviewed, Rating.Again, T0 + 5 * DAY);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe(CardState.Relearning);
    expect(lapsed.stability).toBeLessThanOrEqual(reviewed.stability);
  });

  it('keeps difficulty inside 1..10 under sustained failure and sustained ease', () => {
    let hard = schedule(newCard(1, T0), Rating.Again, T0);
    let easy = schedule(newCard(2, T0), Rating.Easy, T0);
    for (let i = 1; i <= 40; i += 1) {
      hard = schedule(hard, Rating.Again, T0 + i * DAY);
      easy = schedule(easy, Rating.Easy, T0 + i * DAY);
    }
    for (const c of [hard, easy]) {
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(10);
      expect(Number.isFinite(c.stability)).toBe(true);
    }
  });

  it('grows the interval across a run of successful reviews', () => {
    let card = schedule(newCard(1, T0), Rating.Good, T0);
    let previous = 0;
    for (let i = 0; i < 6; i += 1) {
      const now = card.due;
      const next = schedule(card, Rating.Good, now);
      const interval = next.due - now;
      expect(interval).toBeGreaterThan(previous);
      previous = interval;
      card = next;
    }
  });
});

describe('ratingFromAnswer', () => {
  it('maps a miss to Again regardless of speed', () => {
    expect(ratingFromAnswer(false, 100, 4000)).toBe(Rating.Again);
    expect(ratingFromAnswer(false, 99_000, 4000)).toBe(Rating.Again);
  });

  it('rates relative to the learner, not a constant', () => {
    expect(ratingFromAnswer(true, 1000, 4000)).toBe(Rating.Easy);
    expect(ratingFromAnswer(true, 1000, 1200)).toBe(Rating.Good);
    expect(ratingFromAnswer(true, 9000, 4000)).toBe(Rating.Hard);
  });

  it('never rewards a hinted answer', () => {
    expect(ratingFromAnswer(true, 10, 4000, true)).toBe(Rating.Hard);
  });
});

describe('dueQueue', () => {
  const card = (id: number, due: number, state = CardState.Review): Card => ({
    ...newCard(id, due),
    state,
    due,
  });

  it('returns only due, non-new cards, most overdue first', () => {
    const cards = [
      card(1, T0 - 1000),
      card(2, T0 - 50_000),
      card(3, T0 + 10_000),
      card(4, T0 - 10, CardState.New),
    ];
    expect(dueQueue(cards, T0, 10).map((c) => c.wordId)).toEqual([2, 1]);
  });

  it('respects the limit', () => {
    const cards = Array.from({ length: 50 }, (_, i) => card(i, T0 - i * 1000));
    expect(dueQueue(cards, T0, 7)).toHaveLength(7);
  });
});
