/**
 * Corpus queries. The only place that reads vocab.db.
 *
 * Screens call these; they never see SQL. That boundary is what lets the domain
 * core stay pure and what makes the app contributable without everyone learning
 * the schema.
 */

import type { DistractorCandidate } from '@vocab-u/core';
import type { Cefr, Pos, Register, Topic, WordEntry } from '@vocab-u/core';
import { openCorpus } from './db';

interface WordRow {
  id: number;
  lemma: string;
  pos: Pos;
  ipa: string | null;
  syllables: number;
  freq_rank: number | null;
  cefr: Cefr;
  difficulty: number;
}

interface EntryRow extends WordRow {
  sense_id: number;
  gloss: string;
  register: Register;
}

const toEntry = (row: EntryRow, examples: WordEntry['examples'], synonyms: string[]): WordEntry => ({
  word: {
    id: row.id,
    lemma: row.lemma,
    pos: row.pos,
    ipa: row.ipa,
    syllables: String(row.syllables),
    freqRank: row.freq_rank,
    cefr: row.cefr,
    difficulty: row.difficulty,
  },
  sense: { id: row.sense_id, wordId: row.id, ord: 0, gloss: row.gloss, register: row.register },
  examples,
  synonyms,
});

const ENTRY_SELECT = `
  SELECT w.id, w.lemma, w.pos, w.ipa, w.syllables, w.freq_rank, w.cefr, w.difficulty,
         s.id AS sense_id, s.gloss, s.register
  FROM word w
  JOIN sense s ON s.word_id = w.id AND s.ord = 0
`;

async function hydrate(rows: EntryRow[]): Promise<WordEntry[]> {
  if (rows.length === 0) return [];
  const db = await openCorpus();
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');

  const examples = await db.getAllAsync<{ sense_id: number; text: string; source: string; id: number }>(
    `SELECT e.id, e.sense_id, e.text, e.source FROM example e
     JOIN sense s ON s.id = e.sense_id WHERE s.word_id IN (${marks})`,
    ids,
  );
  const synonyms = await db.getAllAsync<{ from_word_id: number; lemma: string }>(
    `SELECT r.from_word_id, w.lemma FROM relation r
     JOIN word w ON w.id = r.to_word_id
     WHERE r.kind = 'synonym' AND r.from_word_id IN (${marks})`,
    ids,
  );

  return rows.map((row) =>
    toEntry(
      row,
      examples
        .filter((e) => e.sense_id === row.sense_id)
        // Everything in the database is reviewed — the build gate dropped the
        // rest — so this flag is always true here. It is kept on the type so the
        // generators cannot be fed unreviewed text from any other source.
        .map((e) => ({ id: e.id, senseId: e.sense_id, text: e.text, source: e.source, reviewed: true })),
      synonyms.filter((s) => s.from_word_id === row.id).map((s) => s.lemma),
    ),
  );
}

export async function entryById(wordId: number): Promise<WordEntry | null> {
  const db = await openCorpus();
  const row = await db.getFirstAsync<EntryRow>(`${ENTRY_SELECT} WHERE w.id = ?`, [wordId]);
  if (!row) return null;
  return (await hydrate([row]))[0] ?? null;
}

/**
 * Words near a learner's ability. `band` is a half-width in difficulty units.
 *
 * This is the query that fixes the reference app's worst product bug: an
 * Advanced learner being asked to define *annual*. Selection is banded on
 * measured ability, always.
 */
export async function entriesNearDifficulty(
  difficulty: number,
  band: number,
  limit: number,
  excludeIds: readonly number[] = [],
): Promise<WordEntry[]> {
  const db = await openCorpus();
  const marks = excludeIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE ABS(w.difficulty - ?) <= ?
     ${excludeIds.length ? `AND w.id NOT IN (${marks})` : ''}
     ORDER BY ABS(w.difficulty - ?) ASC, RANDOM()
     LIMIT ?`,
    [difficulty, band, ...excludeIds, difficulty, limit],
  );
  return hydrate(rows);
}

/** Candidate distractors: same part of speech, near in difficulty. */
export async function distractorPool(
  pos: Pos,
  difficulty: number,
  excludeWordId: number,
  limit = 40,
): Promise<DistractorCandidate[]> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<WordRow & { topics: string | null }>(
    `SELECT w.*, GROUP_CONCAT(tw.topic_id) AS topics
     FROM word w
     LEFT JOIN topic_word tw ON tw.word_id = w.id
     WHERE w.pos = ? AND w.id != ?
     GROUP BY w.id
     ORDER BY ABS(w.difficulty - ?) ASC
     LIMIT ?`,
    [pos, excludeWordId, difficulty, limit],
  );
  return rows.map((r) => ({
    word: {
      id: r.id,
      lemma: r.lemma,
      pos: r.pos,
      ipa: r.ipa,
      syllables: String(r.syllables),
      freqRank: r.freq_rank,
      cefr: r.cefr,
      difficulty: r.difficulty,
    },
    fields: r.topics ? r.topics.split(',').map(Number) : [],
  }));
}

export async function glossesFor(wordIds: readonly number[]): Promise<Map<number, string>> {
  if (wordIds.length === 0) return new Map();
  const db = await openCorpus();
  const marks = wordIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ word_id: number; gloss: string }>(
    `SELECT word_id, gloss FROM sense WHERE ord = 0 AND word_id IN (${marks})`,
    [...wordIds],
  );
  return new Map(rows.map((r) => [r.word_id, r.gloss]));
}

export async function topicIdsFor(wordId: number): Promise<number[]> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<{ topic_id: number }>(
    'SELECT topic_id FROM topic_word WHERE word_id = ?',
    [wordId],
  );
  return rows.map((r) => r.topic_id);
}

export async function synonymIdsFor(wordId: number): Promise<Set<number>> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<{ to_word_id: number }>(
    "SELECT to_word_id FROM relation WHERE kind = 'synonym' AND from_word_id = ?",
    [wordId],
  );
  return new Set(rows.map((r) => r.to_word_id));
}

export interface TopicWithCount extends Topic {
  scope: string;
  wordCount: number;
}

/**
 * Topics with their word counts. The reference app shows no count and no
 * progress on any of its twenty-plus topic cards, so browsing has no memory.
 */
export async function allTopics(): Promise<TopicWithCount[]> {
  const db = await openCorpus();
  return db.getAllAsync<TopicWithCount>(
    `SELECT t.id, t.slug, t.title, t.section, t.scope, t.ord,
            COUNT(tw.word_id) AS wordCount
     FROM topic t
     LEFT JOIN topic_word tw ON tw.topic_id = t.id
     GROUP BY t.id
     ORDER BY t.section, t.ord`,
  );
}

export async function entriesInTopic(topicId: number, limit = 100): Promise<WordEntry[]> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     JOIN topic_word tw ON tw.word_id = w.id
     WHERE tw.topic_id = ?
     ORDER BY w.difficulty ASC
     LIMIT ?`,
    [topicId, limit],
  );
  return hydrate(rows);
}

export async function search(query: string, limit = 30): Promise<WordEntry[]> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE w.lemma LIKE ? ESCAPE '\\'
     ORDER BY w.freq_rank IS NULL, w.freq_rank ASC
     LIMIT ?`,
    [`${query.replace(/[%_\\]/g, '\\$&')}%`, limit],
  );
  return hydrate(rows);
}

export async function corpusMeta(): Promise<Record<string, string>> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<{ k: string; v: string }>('SELECT k, v FROM meta');
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}

/**
 * The item bank for the adaptive level test: one row per word, spread across the
 * whole difficulty range.
 *
 * Deliberately cheap — the test needs only an id and a difficulty to choose the
 * next question, and the question itself is built on demand once chosen. Loading
 * full entries for a bank the test will sample 15 items from would be waste.
 */
export async function levelTestPool(): Promise<Array<{ wordId: number; difficulty: number }>> {
  const db = await openCorpus();
  const rows = await db.getAllAsync<{ id: number; difficulty: number }>(
    'SELECT id, difficulty FROM word ORDER BY difficulty ASC',
  );
  return rows.map((r) => ({ wordId: r.id, difficulty: r.difficulty }));
}
