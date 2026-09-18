import { describe, expect, it } from 'vitest';
import {
  REVIEW_LOG_LIMIT,
  USER_STATE_VERSION,
  activeDayKeys,
  addLevel,
  addOwnWord,
  appendReview,
  emptyUserState,
  getCard,
  isSaved,
  latestLevel,
  markSeen,
  personalBest,
  putCard,
  recordActivity,
  recordBest,
  removeOwnWord,
  reviveUserState,
  savedIds,
  seenIds,
  setValue,
  toggleSaved,
} from '../src/progress/userState';
import { newCard } from '../src/srs/fsrs';
import { currentStreak, dayKey } from '../src/progress/streak';

const T0 = new Date('2024-03-15T10:00:00').getTime();
const DAY = 86_400_000;

describe('reviveUserState', () => {
  it('accepts a document it wrote itself', () => {
    const state = markSeen(emptyUserState(), 7, T0);
    expect(reviveUserState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('never throws on junk, and starts clean instead', () => {
    for (const junk of [null, undefined, 42, 'nope', [], {}, { version: 999 }]) {
      const revived = reviveUserState(junk);
      expect(revived.version).toBe(USER_STATE_VERSION);
      expect(revived.cards).toEqual({});
    }
  });

  it('fills in fields a partial document is missing', () => {
    const revived = reviveUserState({ version: USER_STATE_VERSION, cards: { '1': newCard(1, T0) } });
    expect(revived.saved.favourite).toEqual({});
    expect(revived.reviewLog).toEqual([]);
    expect(revived.nextId).toBe(1);
  });

  it('discards a document from a future version rather than misreading it', () => {
    expect(reviveUserState({ version: 2, cards: { '1': newCard(1, T0) } }).cards).toEqual({});
  });
});

describe('cards', () => {
  it('round-trips a card', () => {
    const card = newCard(12, T0);
    const state = putCard(emptyUserState(), card);
    expect(getCard(state, 12)).toEqual(card);
    expect(getCard(state, 99)).toBeNull();
  });

  it('does not mutate the state it is given', () => {
    const state = emptyUserState();
    putCard(state, newCard(1, T0));
    expect(Object.keys(state.cards)).toHaveLength(0);
  });
});

describe('review log', () => {
  const entry = (i: number) => ({ wordId: i, rated: 3, elapsedMs: 100, reviewedAt: T0 + i, mode: 'sprint' });

  it('appends in order', () => {
    let state = emptyUserState();
    state = appendReview(state, entry(1));
    state = appendReview(state, entry(2));
    expect(state.reviewLog.map((r) => r.wordId)).toEqual([1, 2]);
  });

  it('caps growth, keeping the most recent entries', () => {
    let state = emptyUserState();
    for (let i = 0; i < REVIEW_LOG_LIMIT + 50; i += 1) state = appendReview(state, entry(i));
    expect(state.reviewLog).toHaveLength(REVIEW_LOG_LIMIT);
    expect(state.reviewLog[state.reviewLog.length - 1]!.wordId).toBe(REVIEW_LOG_LIMIT + 49);
  });
});

describe('saved', () => {
  it('toggles on and off', () => {
    let state = emptyUserState();
    const on = toggleSaved(state, 5, 'favourite', T0);
    expect(on.saved).toBe(true);
    expect(isSaved(on.state, 5, 'favourite')).toBe(true);

    const off = toggleSaved(on.state, 5, 'favourite', T0);
    expect(off.saved).toBe(false);
    expect(isSaved(off.state, 5, 'favourite')).toBe(false);
  });

  it('keeps the two kinds independent', () => {
    const { state } = toggleSaved(emptyUserState(), 5, 'favourite', T0);
    expect(isSaved(state, 5, 'bookmark')).toBe(false);
  });

  it('lists most recently saved first', () => {
    let state = emptyUserState();
    state = toggleSaved(state, 1, 'favourite', T0).state;
    state = toggleSaved(state, 2, 'favourite', T0 + 1000).state;
    state = toggleSaved(state, 3, 'favourite', T0 + 500).state;
    expect(savedIds(state, 'favourite')).toEqual([2, 3, 1]);
  });
});

describe('seen', () => {
  it('records first sighting and counts repeats', () => {
    let state = markSeen(emptyUserState(), 4, T0);
    state = markSeen(state, 4, T0 + 5000);
    expect(state.seen['4']).toEqual({ firstAt: T0, count: 2 });
  });

  it('lists most recently met first and respects the limit', () => {
    let state = emptyUserState();
    state = markSeen(state, 1, T0);
    state = markSeen(state, 2, T0 + 1000);
    expect(seenIds(state)).toEqual([2, 1]);
    expect(seenIds(state, 1)).toEqual([2]);
  });
});

describe('activity and streak', () => {
  it('accumulates within a day', () => {
    let state = recordActivity(emptyUserState(), T0, 5, 60);
    state = recordActivity(state, T0 + 3600_000, 3, 30);
    expect(state.days[dayKey(T0)]).toEqual({ reviews: 8, seconds: 90 });
  });

  it('feeds the streak calculation', () => {
    let state = emptyUserState();
    for (const offset of [0, 1, 2]) state = recordActivity(state, T0 - offset * DAY, 1, 10);
    expect(currentStreak(activeDayKeys(state), T0)).toBe(3);
  });

  it('excludes a day with no reviews from the streak', () => {
    const state = recordActivity(emptyUserState(), T0, 0, 30);
    expect(activeDayKeys(state).size).toBe(0);
  });
});

describe('own words', () => {
  it('assigns ids that do not collide after a delete', () => {
    let state = addOwnWord(emptyUserState(), {
      lemma: 'petrichor', pos: null, gloss: 'Smell of rain', note: null, createdAt: T0,
    });
    const firstId = state.ownWords[0]!.id;
    state = removeOwnWord(state, firstId);
    state = addOwnWord(state, {
      lemma: 'susurrus', pos: null, gloss: 'A whisper', note: null, createdAt: T0,
    });
    expect(state.ownWords[0]!.id).not.toBe(firstId);
    expect(state.ownWords).toHaveLength(1);
  });

  it('puts the newest first', () => {
    let state = addOwnWord(emptyUserState(), { lemma: 'a', pos: null, gloss: 'x', note: null, createdAt: T0 });
    state = addOwnWord(state, { lemma: 'b', pos: null, gloss: 'y', note: null, createdAt: T0 + 1 });
    expect(state.ownWords.map((w) => w.lemma)).toEqual(['b', 'a']);
  });
});

describe('levels', () => {
  const level = (takenAt: number, cefr: string) => ({ theta: 1, se: 0.4, cefr, takenAt, items: 14, correct: 9 });

  it('returns the most recent by time, not by insertion order', () => {
    let state = addLevel(emptyUserState(), level(T0, 'B1'));
    state = addLevel(state, level(T0 - DAY, 'A2'));
    expect(latestLevel(state)?.cefr).toBe('B1');
  });

  it('is null before any test', () => {
    expect(latestLevel(emptyUserState())).toBeNull();
  });
});

describe('personal bests', () => {
  it('records a first score', () => {
    const { state, isBest } = recordBest(emptyUserState(), 'sprint', 12);
    expect(isBest).toBe(true);
    expect(personalBest(state, 'sprint')).toBe(12);
  });

  it('keeps the higher score and reports no new best', () => {
    const first = recordBest(emptyUserState(), 'sprint', 12).state;
    const { state, isBest } = recordBest(first, 'sprint', 9);
    expect(isBest).toBe(false);
    expect(personalBest(state, 'sprint')).toBe(12);
  });

  it('does not treat an equal score as a new best', () => {
    const first = recordBest(emptyUserState(), 'sprint', 12).state;
    expect(recordBest(first, 'sprint', 12).isBest).toBe(false);
  });

  it('keeps modes separate', () => {
    const state = recordBest(emptyUserState(), 'sprint', 12).state;
    expect(personalBest(state, 'rush')).toBeNull();
  });

  it('stores arbitrary values too', () => {
    expect(setValue(emptyUserState(), 'theme', 'dark').kv.theme).toBe('dark');
  });
});
