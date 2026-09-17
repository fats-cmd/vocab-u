import { create } from 'zustand';
import {
  MODES,
  type GameItem,
  type ModeId,
  type SessionState,
  type SessionSummary,
  answer as applyAnswer,
  currentItem,
  ratingFromAnswer,
  schedule,
  startSession,
  summarise,
  tick as applyTick,
} from '@vocab-u/core';
import { buildItems } from './buildItems';
import { getCard, logReview, personalBest, recordActivity, recordBest, saveCard } from '@/data/userRepo';

const ROUND_SIZE = 30;
const ALL_TYPES = ['guess-word', 'meaning-match', 'fill-gap', 'match-synonym'] as const;

interface SessionStore {
  state: SessionState | null;
  summary: SessionSummary | null;
  loading: boolean;
  error: string | null;

  start: (modeId: ModeId, difficulty: number) => Promise<void>;
  answer: (chosenIndex: number | null) => Promise<void>;
  tick: () => void;
  finish: () => Promise<void>;
  reset: () => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  state: null,
  summary: null,
  loading: false,
  error: null,

  async start(modeId, difficulty) {
    set({ loading: true, error: null, summary: null, state: null });
    const mode = MODES[modeId];
    try {
      const items: GameItem[] = await buildItems({
        difficulty,
        count: mode.deckSize ?? ROUND_SIZE,
        types: [...ALL_TYPES],
        optionCount: mode.optionCount,
      });
      if (items.length === 0) {
        set({ loading: false, error: 'No questions available at your level yet.' });
        return;
      }
      set({ state: startSession(mode, items, Date.now()), loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not start the round.' });
    }
  },

  async answer(chosenIndex) {
    const current = get().state;
    if (!current) return;
    const item = currentItem(current);
    const now = Date.now();
    const next = applyAnswer(current, chosenIndex, now);
    set({ state: next });

    // Playing *is* reviewing: every answer schedules the word. There is no
    // separate flashcard mode to remember to visit.
    if (item) {
      const record = next.answers[next.answers.length - 1];
      if (record) {
        const rating = ratingFromAnswer(record.correct, record.elapsedMs, current.medianMs);
        const card = await getCard(item.wordId, now);
        await saveCard(schedule(card, rating, now));
        await logReview(item.wordId, rating, record.elapsedMs, now, current.mode.id);
      }
    }

    if (next.endedAt !== null) await get().finish();
  },

  tick() {
    const current = get().state;
    if (!current || current.endedAt !== null) return;
    const next = applyTick(current, Date.now());
    if (next !== current) {
      set({ state: next });
      if (next.endedAt !== null) void get().finish();
    }
  },

  async finish() {
    const current = get().state;
    if (!current || get().summary) return;
    const score =
      current.mode.endsOn === 'deck'
        ? Math.round((current.answers.filter((a) => a.correct).length / Math.max(1, current.answers.length)) * 100)
        : current.answers.filter((a) => a.correct).length;

    const previousBest = await personalBest(current.mode.id);
    const summary = summarise(current, previousBest);
    await recordBest(current.mode.id, score);
    await recordActivity(Date.now(), current.answers.length, Math.round(summary.durationMs / 1000));
    set({ summary });
  },

  reset() {
    set({ state: null, summary: null, error: null, loading: false });
  },
}));
