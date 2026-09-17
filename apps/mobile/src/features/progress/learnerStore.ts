import { create } from 'zustand';
import { CEFR_LABEL, type Cefr, cefrForDifficulty, toDifficulty } from '@vocab-u/core';
import { latestLevel } from '@/data/userRepo';

/**
 * The learner's measured ability. Every question the app asks is drawn from this
 * number, so it is loaded once at startup and kept in one place.
 */
interface LearnerStore {
  /** 0..1 on the corpus difficulty scale. */
  difficulty: number;
  cefr: Cefr;
  label: string;
  /** Null until they have taken the test — the app still works, just untargeted. */
  takenAt: number | null;
  lastScore: { correct: number; items: number } | null;
  load: () => Promise<void>;
  setFromTheta: (theta: number) => void;
}

/** Mid-scale until measured: neither insulting nor impossible. */
const DEFAULT_DIFFICULTY = 0.45;

export const useLearner = create<LearnerStore>((set) => ({
  difficulty: DEFAULT_DIFFICULTY,
  cefr: cefrForDifficulty(DEFAULT_DIFFICULTY),
  label: CEFR_LABEL[cefrForDifficulty(DEFAULT_DIFFICULTY)],
  takenAt: null,
  lastScore: null,

  async load() {
    const stored = await latestLevel();
    if (!stored) return;
    const difficulty = toDifficulty(stored.theta);
    const cefr = cefrForDifficulty(difficulty);
    set({
      difficulty,
      cefr,
      label: CEFR_LABEL[cefr],
      takenAt: stored.takenAt,
      lastScore: { correct: stored.correct, items: stored.items },
    });
  },

  setFromTheta(theta) {
    const difficulty = toDifficulty(theta);
    const cefr = cefrForDifficulty(difficulty);
    set({ difficulty, cefr, label: CEFR_LABEL[cefr] });
  },
}));
