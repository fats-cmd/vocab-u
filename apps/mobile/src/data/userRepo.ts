/**
 * Progress queries. The only place that writes user.db.
 *
 * Note what is absent: any network call, any identifier, any analytics event.
 * Everything a learner does stays on their device, which is what makes "free"
 * sustainable — there is nothing to host and nothing to breach.
 */

import { type Card, CardState, type Rating, dayKey, newCard } from '@vocab-u/core';
import { openUser } from './db';

interface CardRow {
  word_id: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  last_review: number | null;
}

const toCard = (r: CardRow): Card => ({
  wordId: r.word_id,
  state: r.state as CardState,
  due: r.due,
  stability: r.stability,
  difficulty: r.difficulty,
  reps: r.reps,
  lapses: r.lapses,
  lastReview: r.last_review,
});

export async function getCard(wordId: number, now: number): Promise<Card> {
  const db = await openUser();
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM card WHERE word_id = ?', [wordId]);
  return row ? toCard(row) : newCard(wordId, now);
}

export async function saveCard(card: Card): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    `INSERT INTO card (word_id, state, due, stability, difficulty, reps, lapses, last_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(word_id) DO UPDATE SET
       state = excluded.state, due = excluded.due, stability = excluded.stability,
       difficulty = excluded.difficulty, reps = excluded.reps, lapses = excluded.lapses,
       last_review = excluded.last_review`,
    [
      card.wordId,
      card.state,
      card.due,
      card.stability,
      card.difficulty,
      card.reps,
      card.lapses,
      card.lastReview,
    ],
  );
}

/**
 * Append-only. This is what lets FSRS parameters be re-optimised on-device
 * later, with no server: the data needed to fit the model is already here.
 */
export async function logReview(
  wordId: number,
  rating: Rating,
  elapsedMs: number,
  at: number,
  mode: string,
): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    'INSERT INTO review_log (word_id, rated, elapsed_ms, reviewed_at, mode) VALUES (?, ?, ?, ?, ?)',
    [wordId, rating, elapsedMs, at, mode],
  );
}

export async function dueCards(now: number, limit: number): Promise<Card[]> {
  const db = await openUser();
  const rows = await db.getAllAsync<CardRow>(
    'SELECT * FROM card WHERE state != ? AND due <= ? ORDER BY due ASC LIMIT ?',
    [CardState.New, now, limit],
  );
  return rows.map(toCard);
}

export async function dueCount(now: number): Promise<number> {
  const db = await openUser();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM card WHERE state != ? AND due <= ?',
    [CardState.New, now],
  );
  return row?.n ?? 0;
}

// --- saved material ---------------------------------------------------------

export type SaveKind = 'favourite' | 'bookmark';

export async function toggleSaved(wordId: number, kind: SaveKind, now: number): Promise<boolean> {
  const db = await openUser();
  const existing = await db.getFirstAsync<{ word_id: number }>(
    'SELECT word_id FROM saved WHERE word_id = ? AND kind = ?',
    [wordId, kind],
  );
  if (existing) {
    await db.runAsync('DELETE FROM saved WHERE word_id = ? AND kind = ?', [wordId, kind]);
    return false;
  }
  await db.runAsync('INSERT INTO saved (word_id, kind, at) VALUES (?, ?, ?)', [wordId, kind, now]);
  return true;
}

export async function savedIds(kind: SaveKind): Promise<number[]> {
  const db = await openUser();
  const rows = await db.getAllAsync<{ word_id: number }>(
    'SELECT word_id FROM saved WHERE kind = ? ORDER BY at DESC',
    [kind],
  );
  return rows.map((r) => r.word_id);
}

/** Counts for the personal shelf. The reference app's shelf shows none. */
export async function shelfCounts(): Promise<Record<string, number>> {
  const db = await openUser();
  const saved = await db.getAllAsync<{ kind: string; n: number }>(
    'SELECT kind, COUNT(*) AS n FROM saved GROUP BY kind',
  );
  const seen = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM seen');
  const own = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM own_word');
  return {
    ...Object.fromEntries(saved.map((s) => [s.kind, s.n])),
    history: seen?.n ?? 0,
    own: own?.n ?? 0,
  };
}

export async function markSeen(wordId: number, now: number): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    `INSERT INTO seen (word_id, first_at, count) VALUES (?, ?, 1)
     ON CONFLICT(word_id) DO UPDATE SET count = count + 1`,
    [wordId, now],
  );
}

/** Per-topic progress, so every topic card can show how far in you are. */
export async function seenCountByTopic(): Promise<Map<number, number>> {
  const db = await openUser();
  const rows = await db.getAllAsync<{ word_id: number }>('SELECT word_id FROM seen');
  // Topic membership lives in the corpus, so the join happens in the feature
  // layer; this returns the raw set the caller intersects.
  return new Map(rows.map((r) => [r.word_id, 1]));
}

// --- activity and streak ----------------------------------------------------

export async function recordActivity(now: number, reviews: number, seconds: number): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    `INSERT INTO day_activity (day, reviews, seconds, goal_met) VALUES (?, ?, ?, 0)
     ON CONFLICT(day) DO UPDATE SET reviews = reviews + ?, seconds = seconds + ?`,
    [dayKey(now), reviews, seconds, reviews, seconds],
  );
}

export async function activeDayKeys(): Promise<Set<string>> {
  const db = await openUser();
  const rows = await db.getAllAsync<{ day: string }>(
    'SELECT day FROM day_activity WHERE reviews > 0',
  );
  return new Set(rows.map((r) => r.day));
}

// --- level ------------------------------------------------------------------

export interface StoredLevel {
  theta: number;
  se: number;
  cefr: string;
  takenAt: number;
  items: number;
  correct: number;
}

export async function saveLevel(result: StoredLevel): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    'INSERT INTO level_result (taken_at, theta, se, cefr, items, correct) VALUES (?, ?, ?, ?, ?, ?)',
    [result.takenAt, result.theta, result.se, result.cefr, result.items, result.correct],
  );
}

export async function latestLevel(): Promise<StoredLevel | null> {
  const db = await openUser();
  const row = await db.getFirstAsync<{
    taken_at: number; theta: number; se: number; cefr: string; items: number; correct: number;
  }>('SELECT * FROM level_result ORDER BY taken_at DESC LIMIT 1');
  return row
    ? { theta: row.theta, se: row.se, cefr: row.cefr, takenAt: row.taken_at, items: row.items, correct: row.correct }
    : null;
}

// --- key/value (personal bests, settings) -----------------------------------

export async function getValue(key: string): Promise<string | null> {
  const db = await openUser();
  const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', [key]);
  return row?.v ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const db = await openUser();
  await db.runAsync(
    'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
    [key, value],
  );
}

/** Personal best per mode. The reference app offers nothing to play against. */
export const bestKey = (mode: string) => `best:${mode}`;

export async function personalBest(mode: string): Promise<number | null> {
  const raw = await getValue(bestKey(mode));
  return raw === null ? null : Number(raw);
}

export async function recordBest(mode: string, score: number): Promise<boolean> {
  const current = await personalBest(mode);
  if (current !== null && score <= current) return false;
  await setValue(bestKey(mode), String(score));
  return true;
}
