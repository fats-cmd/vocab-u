/**
 * The learner's entire local record, as one document.
 *
 * Why a document and not a database: the corpus is genuinely relational and
 * read-only, and SQLite suits it. Progress is not — it is a few thousand small
 * records with no joins worth the name, and holding it in SQLite bought a
 * migration system, a platform-specific storage backend, and (on web, where
 * expo-sqlite has no writable path at all) a store that silently dropped every
 * write.
 *
 * As a document it is one shape on every platform, it needs no migrations beyond
 * a version check, and — the reason it lives here rather than in the app — every
 * rule about it is a pure function with a test next to it.
 */

import type { Card } from '../srs/fsrs';
import { dayKey } from './streak';

export const USER_STATE_VERSION = 1;

/** Keeps the log from growing without bound on a device used for years. */
export const REVIEW_LOG_LIMIT = 5000;

export type SaveKind = 'favourite' | 'bookmark';

export interface ReviewLogEntry {
  wordId: number;
  rated: number;
  elapsedMs: number;
  reviewedAt: number;
  mode: string;
}

export interface OwnWord {
  id: number;
  lemma: string;
  pos: string | null;
  gloss: string;
  note: string | null;
  createdAt: number;
}

export interface Collection {
  id: number;
  name: string;
  createdAt: number;
  wordIds: number[];
}

export interface StoredLevel {
  theta: number;
  se: number;
  cefr: string;
  takenAt: number;
  items: number;
  correct: number;
}

export interface DayActivity {
  reviews: number;
  seconds: number;
}

export interface UserState {
  version: number;
  cards: Record<string, Card>;
  reviewLog: ReviewLogEntry[];
  saved: Record<SaveKind, Record<string, number>>;
  seen: Record<string, { firstAt: number; count: number }>;
  collections: Collection[];
  ownWords: OwnWord[];
  days: Record<string, DayActivity>;
  levels: StoredLevel[];
  kv: Record<string, string>;
  nextId: number;
}

export function emptyUserState(): UserState {
  return {
    version: USER_STATE_VERSION,
    cards: {},
    reviewLog: [],
    saved: { favourite: {}, bookmark: {} },
    seen: {},
    collections: [],
    ownWords: [],
    days: {},
    levels: [],
    kv: {},
    nextId: 1,
  };
}

/**
 * Accept whatever was on disk and return something usable.
 *
 * Never throws and never refuses to start: a learner with a corrupt file should
 * lose their history, not their app.
 */
export function reviveUserState(raw: unknown): UserState {
  const base = emptyUserState();
  if (typeof raw !== 'object' || raw === null) return base;
  const input = raw as Partial<UserState>;
  if (input.version !== USER_STATE_VERSION) return base;

  return {
    ...base,
    ...input,
    version: USER_STATE_VERSION,
    cards: input.cards ?? base.cards,
    reviewLog: Array.isArray(input.reviewLog) ? input.reviewLog : base.reviewLog,
    saved: {
      favourite: input.saved?.favourite ?? {},
      bookmark: input.saved?.bookmark ?? {},
    },
    seen: input.seen ?? base.seen,
    collections: Array.isArray(input.collections) ? input.collections : base.collections,
    ownWords: Array.isArray(input.ownWords) ? input.ownWords : base.ownWords,
    days: input.days ?? base.days,
    levels: Array.isArray(input.levels) ? input.levels : base.levels,
    kv: input.kv ?? base.kv,
    nextId: typeof input.nextId === 'number' ? input.nextId : base.nextId,
  };
}

/* ------------------------------------------------------------- cards ---- */

export function getCard(state: UserState, wordId: number): Card | null {
  return state.cards[String(wordId)] ?? null;
}

export function putCard(state: UserState, card: Card): UserState {
  return { ...state, cards: { ...state.cards, [String(card.wordId)]: card } };
}

export function appendReview(state: UserState, entry: ReviewLogEntry): UserState {
  const reviewLog = [...state.reviewLog, entry];
  return {
    ...state,
    reviewLog:
      reviewLog.length > REVIEW_LOG_LIMIT ? reviewLog.slice(-REVIEW_LOG_LIMIT) : reviewLog,
  };
}

/* ------------------------------------------------------------- saved ---- */

export function isSaved(state: UserState, wordId: number, kind: SaveKind): boolean {
  return state.saved[kind][String(wordId)] !== undefined;
}

/** Returns the new state and whether the word is now saved. */
export function toggleSaved(
  state: UserState,
  wordId: number,
  kind: SaveKind,
  now: number,
): { state: UserState; saved: boolean } {
  const key = String(wordId);
  const current = { ...state.saved[kind] };
  const wasSaved = current[key] !== undefined;
  if (wasSaved) delete current[key];
  else current[key] = now;
  return {
    state: { ...state, saved: { ...state.saved, [kind]: current } },
    saved: !wasSaved,
  };
}

/** Saved word ids, most recently saved first. */
export function savedIds(state: UserState, kind: SaveKind): number[] {
  return Object.entries(state.saved[kind])
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => Number(id));
}

/* -------------------------------------------------------------- seen ---- */

export function markSeen(state: UserState, wordId: number, now: number): UserState {
  const key = String(wordId);
  const existing = state.seen[key];
  return {
    ...state,
    seen: {
      ...state.seen,
      [key]: existing
        ? { firstAt: existing.firstAt, count: existing.count + 1 }
        : { firstAt: now, count: 1 },
    },
  };
}

/** Words met, most recently first met first. */
export function seenIds(state: UserState, limit = 200): number[] {
  return Object.entries(state.seen)
    .sort((a, b) => b[1].firstAt - a[1].firstAt)
    .slice(0, limit)
    .map(([id]) => Number(id));
}

/* ---------------------------------------------------------- activity ---- */

export function recordActivity(
  state: UserState,
  now: number,
  reviews: number,
  seconds: number,
): UserState {
  const key = dayKey(now);
  const existing = state.days[key] ?? { reviews: 0, seconds: 0 };
  return {
    ...state,
    days: {
      ...state.days,
      [key]: { reviews: existing.reviews + reviews, seconds: existing.seconds + seconds },
    },
  };
}

/** Day keys with any activity — what the streak is computed from. */
export function activeDayKeys(state: UserState): Set<string> {
  return new Set(Object.entries(state.days).filter(([, d]) => d.reviews > 0).map(([k]) => k));
}

/* ----------------------------------------------------------- own words -- */

export function addOwnWord(
  state: UserState,
  word: Omit<OwnWord, 'id'>,
): UserState {
  return {
    ...state,
    ownWords: [{ ...word, id: state.nextId }, ...state.ownWords],
    nextId: state.nextId + 1,
  };
}

export function removeOwnWord(state: UserState, id: number): UserState {
  return { ...state, ownWords: state.ownWords.filter((w) => w.id !== id) };
}

/* -------------------------------------------------------------- level --- */

export function addLevel(state: UserState, level: StoredLevel): UserState {
  return { ...state, levels: [...state.levels, level] };
}

export function latestLevel(state: UserState): StoredLevel | null {
  if (state.levels.length === 0) return null;
  return state.levels.reduce((best, l) => (l.takenAt > best.takenAt ? l : best));
}

/* ----------------------------------------------------------------- kv --- */

export function setValue(state: UserState, key: string, value: string): UserState {
  return { ...state, kv: { ...state.kv, [key]: value } };
}

export const bestKey = (mode: string) => `best:${mode}`;

export function personalBest(state: UserState, mode: string): number | null {
  const raw = state.kv[bestKey(mode)];
  return raw === undefined ? null : Number(raw);
}

/** Records a new best only if it beats the old one. */
export function recordBest(
  state: UserState,
  mode: string,
  score: number,
): { state: UserState; isBest: boolean } {
  const current = personalBest(state, mode);
  if (current !== null && score <= current) return { state, isBest: false };
  return { state: setValue(state, bestKey(mode), String(score)), isBest: true };
}
