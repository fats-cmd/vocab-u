/**
 * Copies the compiled corpus into the app's asset folder.
 *
 * The corpus is a build artifact, not a checked-in binary, so neither it nor its
 * directory exists in a fresh clone — the folder has to be created, not assumed.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'tools/corpus/out/vocab.db');
const target = join(root, 'apps/mobile/assets/corpus/vocab.db');

if (!existsSync(source)) {
  console.error(
    `No corpus at ${source}\nRun "pnpm corpus:build" first — the corpus is compiled, not committed.`,
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`corpus -> ${target}`);
