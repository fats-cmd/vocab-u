/**
 * Emit — writes the read-only corpus database.
 *
 * Uses node:sqlite so the pipeline has no native dependency to compile; a
 * contributor with Node installed can rebuild the corpus with no toolchain
 * beyond that.
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BuiltEntry, RawTopic } from '../types';

export const DDL = `
PRAGMA journal_mode = DELETE;

CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);

CREATE TABLE word (
  id         INTEGER PRIMARY KEY,
  lemma      TEXT NOT NULL,
  pos        TEXT NOT NULL,
  ipa        TEXT,
  syllables  INTEGER NOT NULL,
  freq_rank  INTEGER,
  cefr       TEXT NOT NULL,
  difficulty REAL NOT NULL,
  UNIQUE(lemma, pos)
);
CREATE INDEX word_difficulty ON word(difficulty);
CREATE INDEX word_cefr ON word(cefr);

CREATE TABLE sense (
  id       INTEGER PRIMARY KEY,
  word_id  INTEGER NOT NULL REFERENCES word(id),
  ord      INTEGER NOT NULL,
  gloss    TEXT NOT NULL,
  register TEXT NOT NULL
);
CREATE INDEX sense_word ON sense(word_id);

CREATE TABLE example (
  id       INTEGER PRIMARY KEY,
  sense_id INTEGER NOT NULL REFERENCES sense(id),
  text     TEXT NOT NULL,
  source   TEXT NOT NULL
);
CREATE INDEX example_sense ON example(sense_id);

CREATE TABLE relation (
  from_word_id INTEGER NOT NULL REFERENCES word(id),
  to_word_id   INTEGER NOT NULL REFERENCES word(id),
  kind         TEXT NOT NULL,
  strength     REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (from_word_id, to_word_id, kind)
);
CREATE INDEX relation_from ON relation(from_word_id, kind);

CREATE TABLE topic (
  id      INTEGER PRIMARY KEY,
  slug    TEXT NOT NULL UNIQUE,
  title   TEXT NOT NULL,
  section TEXT NOT NULL,
  scope   TEXT NOT NULL,
  ord     INTEGER NOT NULL
);

CREATE TABLE topic_word (
  topic_id INTEGER NOT NULL REFERENCES topic(id),
  word_id  INTEGER NOT NULL REFERENCES word(id),
  PRIMARY KEY (topic_id, word_id)
);
CREATE INDEX topic_word_word ON topic_word(word_id);

CREATE VIRTUAL TABLE word_fts USING fts5(lemma, gloss, content='');
`;

export interface EmitResult {
  path: string;
  words: number;
  senses: number;
  examples: number;
  relations: number;
  topics: number;
  droppedUnreviewed: number;
  sha256: string;
}

export function emit(
  entries: readonly BuiltEntry[],
  topics: readonly RawTopic[],
  outPath: string,
  corpusVersion: string,
): EmitResult {
  mkdirSync(dirname(outPath), { recursive: true });
  // The corpus is a build artifact: always rebuilt from scratch, never migrated.
  // A stale file left in place would merge two builds' schemas.
  rmSync(outPath, { force: true });
  rmSync(`${outPath}-journal`, { force: true });
  const db = new DatabaseSync(outPath);
  db.exec(DDL);

  const insertWord = db.prepare(
    `INSERT INTO word (id, lemma, pos, ipa, syllables, freq_rank, cefr, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSense = db.prepare(
    `INSERT INTO sense (id, word_id, ord, gloss, register) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertExample = db.prepare(
    `INSERT INTO example (sense_id, text, source) VALUES (?, ?, ?)`,
  );
  const insertRelation = db.prepare(
    `INSERT OR IGNORE INTO relation (from_word_id, to_word_id, kind, strength) VALUES (?, ?, ?, ?)`,
  );
  const insertTopic = db.prepare(
    `INSERT INTO topic (id, slug, title, section, scope, ord) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertTopicWord = db.prepare(
    `INSERT OR IGNORE INTO topic_word (topic_id, word_id) VALUES (?, ?)`,
  );
  const insertFts = db.prepare(`INSERT INTO word_fts (rowid, lemma, gloss) VALUES (?, ?, ?)`);
  const insertMeta = db.prepare(`INSERT INTO meta (k, v) VALUES (?, ?)`);

  const wordIds = new Map<string, number>();
  const topicIds = new Map<string, number>();

  db.exec('BEGIN');

  topics.forEach((topic, i) => {
    const id = i + 1;
    topicIds.set(topic.slug, id);
    insertTopic.run(id, topic.slug, topic.title, topic.section, topic.scope, topic.ord);
  });

  let senseId = 0;
  let examples = 0;
  let droppedUnreviewed = 0;

  entries.forEach((entry, i) => {
    const id = i + 1;
    wordIds.set(entry.lemma.toLowerCase(), id);
    insertWord.run(
      id,
      entry.lemma,
      entry.pos,
      entry.ipa,
      entry.syllables,
      entry.freqRank,
      entry.cefr,
      entry.difficulty,
    );
    insertFts.run(id, entry.lemma, entry.senses[0]?.gloss ?? '');

    entry.senses.forEach((sense, ord) => {
      senseId += 1;
      insertSense.run(senseId, id, ord, sense.gloss.trim(), sense.register ?? 'neutral');
      for (const example of sense.examples) {
        // The gate. Unreviewed generated text is counted, then dropped.
        if (!example.reviewed) {
          droppedUnreviewed += 1;
          continue;
        }
        insertExample.run(senseId, example.text.trim(), example.source);
        examples += 1;
      }
    });

    for (const slug of entry.topics) {
      const topicId = topicIds.get(slug);
      if (topicId !== undefined) insertTopicWord.run(topicId, id);
    }
  });

  let relations = 0;
  for (const entry of entries) {
    const from = wordIds.get(entry.lemma.toLowerCase());
    if (from === undefined) continue;
    const link = (lemmas: readonly string[], kind: string) => {
      for (const lemma of lemmas) {
        const to = wordIds.get(lemma.toLowerCase());
        if (to !== undefined && to !== from) {
          insertRelation.run(from, to, kind, 1.0);
          relations += 1;
        }
      }
    };
    link(entry.synonyms, 'synonym');
    link(entry.antonyms ?? [], 'antonym');
  }

  insertMeta.run('corpus_version', corpusVersion);
  insertMeta.run('word_count', String(entries.length));
  insertMeta.run('schema_version', '1');
  // Deliberately no build timestamp. The same inputs must produce the same
  // bytes: it is what lets CI verify the committed database really is what the
  // validation gate emits, and it is a precondition for the reproducible
  // Android builds F-Droid requires.

  db.exec('COMMIT');
  db.exec('VACUUM');
  db.close();

  const sha256 = createHash('sha256').update(readFileSync(outPath)).digest('hex');
  return {
    path: outPath,
    words: entries.length,
    senses: senseId,
    examples,
    relations,
    topics: topics.length,
    droppedUnreviewed,
    sha256,
  };
}
