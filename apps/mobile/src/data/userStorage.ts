import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { loadBytes, saveBytes } from './webPersistence';

/**
 * Where the learner's document lives.
 *
 * A JSON file on native, IndexedDB on web. Both are wrapped so a failure is
 * survivable: a read that fails returns null and the app starts clean, and a
 * write that fails leaves the session working in memory. Storage being
 * unavailable should cost someone their history, never their app.
 */

const FILE_NAME = 'user-state.json';
const WEB_KEY = 'user-state';

export async function readUserDocument(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const bytes = await loadBytes(WEB_KEY);
      return bytes && bytes.byteLength > 0 ? new TextDecoder().decode(bytes) : null;
    }
    const file = new File(Paths.document, FILE_NAME);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

export async function writeUserDocument(json: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return await saveBytes(WEB_KEY, new TextEncoder().encode(json));
    }
    const dir = new Directory(Paths.document);
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) file.create();
    file.write(json);
    return true;
  } catch {
    return false;
  }
}
