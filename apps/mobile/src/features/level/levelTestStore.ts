import { create } from 'zustand';
import {
  type GameItem,
  type LevelResult,
  type TestItem,
  type TestState,
  finishTest,
  isComplete,
  makeRng,
  recordResponse,
  retireItem,
  selectNextItem,
  startTest,
} from '@vocab-u/core';
import { levelTestPool } from '@/data/corpusRepo';
import { buildItemForWord } from '@/features/practice/buildItems';
import { latestLevel, saveLevel } from '@/data/userRepo';

/**
 * Drives the adaptive level test.
 *
 * All the decisions — what to ask next, when to stop, what the result means —
 * live in @vocab-u/core and are unit-tested there. This store only supplies the
 * corpus and persists the outcome.
 */

const OPTION_COUNT = 4;

type Phase = 'intro' | 'asking' | 'done';

interface LevelTestStore {
  phase: Phase;
  test: TestState | null;
  pool: TestItem[];
  item: GameItem | null;
  result: LevelResult | null;
  loading: boolean;
  error: string | null;

  /** Shown on the intro screen so the learner knows what they are retaking. */
  previous: { cefr: string; correct: number; items: number } | null;

  begin: () => Promise<void>;
  answer: (chosenIndex: number) => Promise<void>;
  reset: () => void;
  loadPrevious: () => Promise<void>;
}

/**
 * Pick the next item and build its question, skipping items the corpus cannot
 * ask fairly. Each skipped item is marked seen so the selector does not keep
 * returning it.
 */
async function nextQuestion(
  pool: TestItem[],
  state: TestState,
  rng: ReturnType<typeof makeRng>,
): Promise<{ item: GameItem; testItem: TestItem; state: TestState } | null> {
  let working = state;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const testItem = selectNextItem(pool, working.theta, working.seen);
    if (!testItem) return null;

    const item = await buildItemForWord(testItem.wordId, OPTION_COUNT, rng);
    if (item) return { item, testItem, state: working };

    // Unaskable: retire it for this run without recording a response, since a
    // question that was never asked is not evidence about anyone's ability.
    working = retireItem(working, testItem.wordId);
  }
  return null;
}

export const useLevelTest = create<LevelTestStore>((set, get) => ({
  phase: 'intro',
  test: null,
  pool: [],
  item: null,
  result: null,
  loading: false,
  error: null,
  previous: null,

  async loadPrevious() {
    const stored = await latestLevel();
    if (stored) {
      set({ previous: { cefr: stored.cefr, correct: stored.correct, items: stored.items } });
    }
  },

  async begin() {
    set({ loading: true, error: null, result: null });
    try {
      const pool = await levelTestPool();
      if (pool.length < 12) {
        set({ loading: false, error: 'The corpus is too small to measure a level yet.' });
        return;
      }

      const stored = await latestLevel();
      // Starting from the last result converges faster; a first-timer starts at
      // the middle of the scale.
      const state = startTest(stored?.theta ?? null);
      const rng = makeRng(Date.now());
      const next = await nextQuestion(pool, state, rng);
      if (!next) {
        set({ loading: false, error: 'Could not build a question from the corpus.' });
        return;
      }

      set({
        phase: 'asking',
        pool,
        test: next.state,
        item: next.item,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not start the test.' });
    }
  },

  async answer(chosenIndex) {
    const { test, item, pool } = get();
    if (!test || !item) return;

    const testItem: TestItem = { wordId: item.wordId, difficulty: item.difficulty };
    const next = recordResponse(test, testItem, chosenIndex === item.answerIndex);

    if (isComplete(next)) {
      const result = finishTest(next);
      await saveLevel({
        theta: result.theta,
        se: result.se,
        cefr: result.cefr,
        takenAt: Date.now(),
        items: result.itemsAsked,
        correct: result.correct,
      });
      set({ phase: 'done', test: next, result, item: null });
      return;
    }

    set({ test: next, loading: true });
    const rng = makeRng(Date.now());
    const following = await nextQuestion(pool, next, rng);

    if (!following) {
      // Ran out of askable items. Stop and report what we measured rather than
      // pretending the test was cut short for a reason the learner caused.
      const result = finishTest(next);
      await saveLevel({
        theta: result.theta,
        se: result.se,
        cefr: result.cefr,
        takenAt: Date.now(),
        items: result.itemsAsked,
        correct: result.correct,
      });
      set({ phase: 'done', result, item: null, loading: false });
      return;
    }

    set({ test: following.state, item: following.item, loading: false });
  },

  reset() {
    set({ phase: 'intro', test: null, pool: [], item: null, result: null, error: null, loading: false });
  },
}));
