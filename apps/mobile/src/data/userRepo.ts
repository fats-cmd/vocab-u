/**
 * The learner's progress. The only module that reads or writes user data.
 *
 * Backed by a single document rather than a database. The corpus is genuinely
 * relational and read-only, so SQLite suits it; progress is a few thousand small
 * records with no joins worth the name, and putting it in SQLite bought a
 * migration system, a platform-specific backend, and — on web, where expo-sqlite
 * has no writable path at all — a store that silently dropped every write.
 *
 * Every rule about the document is a pure function in @vocab-u/core with a test
 * beside it. This module is the thin part: hold it in memory, persist it, and
 * keep the async API the screens already call.
 */

import {
  type Card,
  CardState,
  type OwnWord,
  type Rating,
  type SaveKind,
  type StoredLevel,
  type UserState,
  activeDayKeys as activeDayKeysOf,
  addLevel,
  addOwnWord as addOwnWordTo,
  appendReview,
  dueQueue,
  emptyUserState,
  getCard as getCardFrom,
  latestLevel as latestLevelOf,
  markSeen as markSeenIn,
  newCard,
  personalBest as personalBestOf,
  putCard,
  recordActivity as recordActivityIn,
  recordBest as recordBestIn,
  removeOwnWord,
  reviveUserState,
  savedIds as savedIdsOf,
  seenIds as seenIdsOf,
  setValue as setValueIn,
  toggleSaved as toggleSavedIn,
} from '@vocab-u/core';
import { readUserDocument, writeUserDocument } from './userStorage';

export type { OwnWord, SaveKind, StoredLevel };

let state: UserState | null = null;
let loading: Promise<UserState> | null = null;

async function load(): Promise<UserState> {
  if (state) return state;
  // Memoise the in-flight load, not just the result: several screens read on
  // first paint, and two concurrent loads would each start from disk and the
  // slower one would overwrite the faster one's writes.
  loading ??= (async () => {
    const raw = await readUserDocument();
    let parsed: unknown = null;
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null; // Truncated write from a hard kill. Start clean.
      }
    }
    state = reviveUserState(parsed);
    return state;
  })();
  return loading;
}

const PERSIST_DEBOUNCE_MS = 300;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (state) await writeUserDocument(JSON.stringify(state));
}

/**
 * Apply a change and schedule a save.
 *
 * Every mutation goes through here, so persistence cannot be forgotten at a call
 * site. Debounced because a practice round writes a card and a log entry per
 * answer.
 */
async function update(change: (current: UserState) => UserState): Promise<void> {
  state = change(await load());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), PERSIST_DEBOUNCE_MS);
}

// The debounce loses its last window if the app goes away mid-wait. `pagehide`
// fires where `beforeunload` does not, notably a mobile browser backgrounding.
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('pagehide', () => void flush());
  globalThis.addEventListener('visibilitychange', () => {
    if (globalThis.document?.visibilityState === 'hidden') void flush();
  });
}

/* -------------------------------------------------------------- cards --- */

export async function getCard(wordId: number, now: number): Promise<Card> {
  return getCardFrom(await load(), wordId) ?? newCard(wordId, now);
}

export async function saveCard(card: Card): Promise<void> {
  await update((s) => putCard(s, card));
}

export async function logReview(
  wordId: number,
  rating: Rating,
  elapsedMs: number,
  at: number,
  mode: string,
): Promise<void> {
  await update((s) => appendReview(s, { wordId, rated: rating, elapsedMs, reviewedAt: at, mode }));
}

export async function dueCards(now: number, limit: number): Promise<Card[]> {
  return dueQueue(Object.values((await load()).cards), now, limit);
}

export async function dueCount(now: number): Promise<number> {
  const cards = Object.values((await load()).cards);
  return cards.filter((c) => c.state !== CardState.New && c.due <= now).length;
}

export async function cardStatesFor(wordIds: readonly number[]): Promise<Map<number, number>> {
  const s = await load();
  const out = new Map<number, number>();
  for (const id of wordIds) {
    const card = s.cards[String(id)];
    if (card) out.set(id, card.state);
  }
  return out;
}

/* ------------------------------------------------------- saved material -- */

export async function toggleSaved(wordId: number, kind: SaveKind, now: number): Promise<boolean> {
  const result = toggleSavedIn(await load(), wordId, kind, now);
  await update(() => result.state);
  return result.saved;
}

export async function savedIds(kind: SaveKind): Promise<number[]> {
  return savedIdsOf(await load(), kind);
}

export async function savedAmong(
  wordIds: readonly number[],
  kind: SaveKind,
): Promise<Set<number>> {
  const s = await load();
  return new Set(wordIds.filter((id) => s.saved[kind][String(id)] !== undefined));
}

export async function shelfCounts(): Promise<Record<string, number>> {
  const s = await load();
  return {
    favourite: Object.keys(s.saved.favourite).length,
    bookmark: Object.keys(s.saved.bookmark).length,
    history: Object.keys(s.seen).length,
    own: s.ownWords.length,
  };
}

export async function markSeen(wordId: number, now: number): Promise<void> {
  await update((s) => markSeenIn(s, wordId, now));
}

export async function seenIds(limit = 200): Promise<number[]> {
  return seenIdsOf(await load(), limit);
}

/* ---------------------------------------------------- activity + streak -- */

export async function recordActivity(now: number, reviews: number, seconds: number): Promise<void> {
  await update((s) => recordActivityIn(s, now, reviews, seconds));
}

export async function activeDayKeys(): Promise<Set<string>> {
  return activeDayKeysOf(await load());
}

/* -------------------------------------------------------------- level --- */

export async function saveLevel(result: StoredLevel): Promise<void> {
  await update((s) => addLevel(s, result));
}

export async function latestLevel(): Promise<StoredLevel | null> {
  return latestLevelOf(await load());
}

/* ---------------------------------------------------------- own words --- */

export async function listOwnWords(): Promise<OwnWord[]> {
  return (await load()).ownWords;
}

export async function addOwnWord(
  lemma: string,
  gloss: string,
  pos: string | null,
  note: string | null,
  now: number,
): Promise<void> {
  await update((s) =>
    addOwnWordTo(s, { lemma: lemma.trim(), gloss: gloss.trim(), pos, note, createdAt: now }),
  );
}

export async function deleteOwnWord(id: number): Promise<void> {
  await update((s) => removeOwnWord(s, id));
}

/* ------------------------------------------------- key/value and bests --- */

export async function getValue(key: string): Promise<string | null> {
  return (await load()).kv[key] ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  await update((s) => setValueIn(s, key, value));
}

export async function personalBest(mode: string): Promise<number | null> {
  return personalBestOf(await load(), mode);
}

export async function recordBest(mode: string, score: number): Promise<boolean> {
  const result = recordBestIn(await load(), mode, score);
  if (result.isBest) await update(() => result.state);
  return result.isBest;
}

/** Test seam. */
export function __resetUserState(): void {
  state = null;
  loading = null;
}
