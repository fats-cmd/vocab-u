import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Two databases, and the separation matters more than anything else in this file.
 *
 *  - `vocab.db`  read-only corpus, shipped as an asset, replaced wholesale on a
 *                content update.
 *  - `user.db`   the learner's progress, created on device, never overwritten.
 *
 * Content updates must not be able to touch progress. Keeping them in one file
 * means every corpus release risks someone's review history.
 */

const CORPUS_DB = 'vocab.db';
const USER_DB = 'user.db';

let corpus: SQLite.SQLiteDatabase | null = null;
let user: SQLite.SQLiteDatabase | null = null;

/**
 * Copy the bundled corpus into the SQLite directory on first launch, and replace
 * it when the app ships a newer build.
 *
 * `user.db` is never touched here. A content update must not be able to reach
 * anyone's review history — that is the whole reason the two files are separate.
 */
async function ensureCorpusInstalled(): Promise<void> {
  const dir = new Directory(Paths.document, 'SQLite');
  if (!dir.exists) dir.create({ intermediates: true });

  const asset = Asset.fromModule(require('../../assets/corpus/vocab.db'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Corpus asset has no local URI');

  const bundled = new File(asset.localUri);
  const installed = new File(dir, CORPUS_DB);

  // Size is a cheap, sufficient staleness check: the pipeline rebuilds the whole
  // file every time, so two builds with different content differ in bytes.
  if (installed.exists && installed.size === bundled.size) return;
  if (installed.exists) installed.delete();

  bundled.copy(installed);
}

export async function openCorpus(): Promise<SQLite.SQLiteDatabase> {
  if (corpus) return corpus;
  await ensureCorpusInstalled();
  corpus = await SQLite.openDatabaseAsync(CORPUS_DB);
  return corpus;
}

/** Schema for the writable database. Additive migrations only. */
const USER_MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS card (
    word_id     INTEGER PRIMARY KEY,
    state       INTEGER NOT NULL DEFAULT 0,
    due         INTEGER NOT NULL,
    stability   REAL    NOT NULL DEFAULT 0,
    difficulty  REAL    NOT NULL DEFAULT 0,
    reps        INTEGER NOT NULL DEFAULT 0,
    lapses      INTEGER NOT NULL DEFAULT 0,
    last_review INTEGER
  );
  CREATE INDEX IF NOT EXISTS card_due ON card(due);

  CREATE TABLE IF NOT EXISTS review_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id     INTEGER NOT NULL,
    rated       INTEGER NOT NULL,
    elapsed_ms  INTEGER NOT NULL,
    reviewed_at INTEGER NOT NULL,
    mode        TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS review_log_word ON review_log(word_id);

  CREATE TABLE IF NOT EXISTS saved (
    word_id INTEGER NOT NULL,
    kind    TEXT    NOT NULL,
    at      INTEGER NOT NULL,
    PRIMARY KEY (word_id, kind)
  );

  CREATE TABLE IF NOT EXISTS seen (
    word_id  INTEGER PRIMARY KEY,
    first_at INTEGER NOT NULL,
    count    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS collection (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collection_word (
    collection_id INTEGER NOT NULL,
    word_id       INTEGER NOT NULL,
    PRIMARY KEY (collection_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS own_word (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lemma      TEXT    NOT NULL,
    pos        TEXT,
    gloss      TEXT    NOT NULL,
    note       TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS day_activity (
    day      TEXT    PRIMARY KEY,
    reviews  INTEGER NOT NULL DEFAULT 0,
    seconds  INTEGER NOT NULL DEFAULT 0,
    goal_met INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS level_result (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    taken_at INTEGER NOT NULL,
    theta    REAL    NOT NULL,
    se       REAL    NOT NULL,
    cefr     TEXT    NOT NULL,
    items    INTEGER NOT NULL,
    correct  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `,
];

export async function openUser(): Promise<SQLite.SQLiteDatabase> {
  if (user) return user;
  user = await SQLite.openDatabaseAsync(USER_DB);
  await user.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await user.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const applied = row?.user_version ?? 0;
  for (let i = applied; i < USER_MIGRATIONS.length; i += 1) {
    await user.execAsync(USER_MIGRATIONS[i]!);
  }
  if (applied < USER_MIGRATIONS.length) {
    await user.execAsync(`PRAGMA user_version = ${USER_MIGRATIONS.length}`);
  }
  return user;
}

/** Test seam: lets a harness inject in-memory databases. */
export function __setDatabases(
  c: SQLite.SQLiteDatabase | null,
  u: SQLite.SQLiteDatabase | null,
): void {
  corpus = c;
  user = u;
}
