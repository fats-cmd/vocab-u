/**
 * Byte storage for the web build's user database.
 *
 * expo-sqlite's web backend stores databases in OPFS through a worker, and that
 * path fails in this app with `xFileControl`/`xLock` errors — every write is lost
 * silently, which is worse than failing loudly. So on web the user database is
 * held in memory and its bytes are parked here instead.
 *
 * IndexedDB directly, with no dependency: one store, one key, one blob.
 */

const DB_NAME = 'vocab-u';
const STORE = 'kv';
const VERSION = 1;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openIdb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function loadBytes(key: string): Promise<Uint8Array | null> {
  try {
    const value = await transact<unknown>('readonly', (store) => store.get(key));
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  } catch {
    // A private window, blocked storage, or a quota refusal. The app still works
    // for this session; it just will not remember anything.
    return null;
  }
}

export async function saveBytes(key: string, bytes: Uint8Array): Promise<boolean> {
  try {
    await transact('readwrite', (store) => store.put(bytes, key));
    return true;
  } catch {
    return false;
  }
}
