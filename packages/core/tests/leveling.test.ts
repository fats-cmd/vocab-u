import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  estimateTheta,
  finishTest,
  information,
  isComplete,
  pCorrect,
  recordResponse,
  selectNextItem,
  startTest,
  THETA_MAX,
  THETA_MIN,
  toDifficulty,
  toLogit,
  type TestItem,
} from '../src/leveling/adaptive';
import { bandProgress, cefrForDifficulty, isTopBand, nextBand } from '../src/leveling/cefr';

const pool: TestItem[] = Array.from({ length: 200 }, (_, i) => ({
  wordId: i + 1,
  difficulty: i / 199,
}));

/** A simulated learner of known ability, answering by the Rasch model. */
function simulate(trueDifficulty: number, seed = 7) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let state = startTest(null);
  while (!isComplete(state)) {
    const item = selectNextItem(pool, state.theta, state.seen);
    if (!item) break;
    const p = pCorrect(toLogit(trueDifficulty), toLogit(item.difficulty));
    state = recordResponse(state, item, rand() < p);
  }
  return finishTest(state);
}

describe('cefr banding', () => {
  it('orders bands by difficulty', () => {
    expect(cefrForDifficulty(0.05)).toBe('A1');
    expect(cefrForDifficulty(0.4)).toBe('B1');
    expect(cefrForDifficulty(0.75)).toBe('C1');
    expect(cefrForDifficulty(0.95)).toBe('C2');
  });

  it('clamps out-of-range input instead of throwing', () => {
    expect(cefrForDifficulty(-5)).toBe('A1');
    expect(cefrForDifficulty(99)).toBe('C2');
  });

  it('reports no next band at the ceiling — the reference app bug', () => {
    // "Points to next level: 0" was shown to a learner already at the top level.
    // At the ceiling there is no next band, and progress is mastery instead.
    const top = bandProgress(0.95);
    expect(top.atCeiling).toBe(true);
    expect(top.next).toBeNull();
    expect(nextBand('C2')).toBeNull();
    expect(isTopBand('C2')).toBe(true);

    const mid = bandProgress(0.4);
    expect(mid.atCeiling).toBe(false);
    expect(mid.next).toBe('B2');
  });

  it('keeps band progress inside 0..1 across the whole scale', () => {
    for (let d = 0; d <= 1.0001; d += 0.01) {
      const { progress } = bandProgress(d);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('item response model', () => {
  it('gives even odds when ability matches difficulty', () => {
    expect(pCorrect(0, 0)).toBeCloseTo(0.5, 6);
  });

  it('maximises information where the learner is closest to 50/50', () => {
    expect(information(0, 0)).toBeGreaterThan(information(0, 2));
    expect(information(0, 0)).toBeGreaterThan(information(0, -2));
  });

  it('round-trips difficulty through the logit scale', () => {
    for (const d of [0, 0.25, 0.5, 0.75, 1]) {
      expect(toDifficulty(toLogit(d))).toBeCloseTo(d, 6);
    }
  });
});

describe('theta estimation', () => {
  it('returns a neutral estimate with no responses', () => {
    expect(estimateTheta([])).toBe(0);
  });

  it('extrapolates beyond the hardest item when nothing was missed', () => {
    const responses = pool.slice(100, 110).map((item) => ({ item, correct: true }));
    expect(estimateTheta(responses)).toBeGreaterThan(toLogit(pool[109]!.difficulty));
  });

  it('extrapolates below the easiest item when everything was missed', () => {
    const responses = pool.slice(40, 50).map((item) => ({ item, correct: false }));
    expect(estimateTheta(responses)).toBeLessThan(toLogit(pool[40]!.difficulty));
  });

  it('clamps rather than diverging when the learner is off the end of the scale', () => {
    const floor = estimateTheta(pool.slice(0, 5).map((item) => ({ item, correct: false })));
    const ceiling = estimateTheta(pool.slice(-5).map((item) => ({ item, correct: true })));
    expect(floor).toBe(THETA_MIN);
    expect(ceiling).toBe(THETA_MAX);
  });

  it('rises as more answers are correct', () => {
    const items = pool.slice(80, 90);
    const few = estimateTheta(items.map((item, i) => ({ item, correct: i < 3 })));
    const many = estimateTheta(items.map((item, i) => ({ item, correct: i < 8 })));
    expect(many).toBeGreaterThan(few);
  });
});

describe('adaptive test', () => {
  it('never asks the same item twice', () => {
    let state = startTest(null);
    const asked: number[] = [];
    while (!isComplete(state)) {
      const item = selectNextItem(pool, state.theta, state.seen)!;
      asked.push(item.wordId);
      state = recordResponse(state, item, true);
    }
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('stops within the configured item budget', () => {
    const result = simulate(0.5);
    expect(result.itemsAsked).toBeGreaterThanOrEqual(DEFAULT_TEST_CONFIG.minItems);
    expect(result.itemsAsked).toBeLessThanOrEqual(DEFAULT_TEST_CONFIG.maxItems);
  });

  it('recovers a learner’s true level, and ranks learners correctly', () => {
    const low = simulate(0.2, 11);
    const mid = simulate(0.5, 12);
    const high = simulate(0.85, 13);
    expect(low.difficulty).toBeLessThan(mid.difficulty);
    expect(mid.difficulty).toBeLessThan(high.difficulty);
    expect(Math.abs(mid.difficulty - 0.5)).toBeLessThan(0.2);
  });

  it('places a top-scoring learner at the ceiling with no next band', () => {
    const result = simulate(0.99, 21);
    expect(result.cefr).toBe('C2');
    expect(result.atCeiling).toBe(true);
    expect(result.nextBand).toBeNull();
  });

  it('uses fewer items than the 30-item fixed form it replaces', () => {
    expect(simulate(0.5).itemsAsked).toBeLessThan(30);
  });
});
