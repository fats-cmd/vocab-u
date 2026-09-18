import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * The corpus database: read-only, shipped as an asset, replaced wholesale on a
 * content update.
 *
 * The learner's progress deliberately does NOT live here — see `userRepo`, which
 * keeps it as a document. Content updates must not be able to touch progress,
 * and on web expo-sqlite has no writable path at all: OPFS fails with
 * `xFileControl`, a second database silently shadows the first, and DDL against
 * a deserialised one does not take. A read-only corpus sidesteps all of it.
 */

const CORPUS_DB = 'vocab.db';

/**
 * Memoised as a *promise*, not as a resolved handle.
 *
 * Several screens call this at once on first paint. Caching the handle only
 * after it resolves lets two callers both miss the cache and open the corpus
 * twice, which on web is an error rather than a waste.
 */
let corpusPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Open the corpus on native: copy the bundled asset into the SQLite directory
 * once, then open it as a normal database file.
 *
 * `user.db` is never touched here. A content update must not be able to reach
 * anyone's review history — that is the whole reason the two files are separate.
 */
async function openCorpusNative(): Promise<SQLite.SQLiteDatabase> {
  const dir = new Directory(Paths.document, 'SQLite');
  if (!dir.exists) dir.create({ intermediates: true });

  const asset = Asset.fromModule(require('../../assets/corpus/vocab.db'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Corpus asset has no local URI');

  const bundled = new File(asset.localUri);
  const installed = new File(dir, CORPUS_DB);

  // Size is a cheap, sufficient staleness check: the pipeline rebuilds the whole
  // file every time, so two builds with different content differ in bytes.
  if (!installed.exists || installed.size !== bundled.size) {
    if (installed.exists) installed.delete();
    bundled.copy(installed);
  }

  return SQLite.openDatabaseAsync(CORPUS_DB);
}

/**
 * Open the corpus on web by loading its bytes straight into SQLite.
 *
 * The file-copy path cannot be used here: expo-file-system's Directory/File API
 * is not implemented on web and throws `validatePath is not a function`. Fetching
 * the asset and deserialising it is both simpler and a better fit — the corpus is
 * read-only, so an in-memory database loses nothing, and the browser caches the
 * asset for us.
 */
async function openCorpusWeb(): Promise<SQLite.SQLiteDatabase> {
  const asset = Asset.fromModule(require('../../assets/corpus/vocab.db'));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Corpus asset has no URI');

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not fetch the corpus: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return SQLite.deserializeDatabaseAsync(bytes);
}

export function openCorpus(): Promise<SQLite.SQLiteDatabase> {
  corpusPromise ??= (Platform.OS === 'web' ? openCorpusWeb() : openCorpusNative()).catch((e) => {
    // Do not cache a failed open, or the app can never recover from a transient
    // one without a restart.
    corpusPromise = null;
    throw e;
  });
  return corpusPromise;
}

const USER_BYTES_KEY = 'user.db';

