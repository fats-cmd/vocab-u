/**
 * Corpus build.
 *
 *   load ──► enrich ──► validate ──► emit
 *
 * Validation is a gate, not a report: any error and nothing is written. That is
 * what keeps a stressless transcription or an unreviewed example sentence from
 * reaching a learner, which is the single largest quality gap in the app this
 * project is modelled on.
 *
 * Run with:  pnpm corpus:build
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { enrich } from './stages/enrich';
import { errorsOf, validate } from './stages/validate';
import { emit } from './stages/emit';
import type { RawEntry, RawTopic } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const CORPUS_VERSION = '0.1.0';

const read = <T>(relative: string): T =>
  JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;

function main(): void {
  const outPath = process.env.CORPUS_OUT ?? join(root, 'out', 'vocab.db');

  // --- load -----------------------------------------------------------------
  // Today this is the curated seed. As dataset importers land (Open English
  // WordNet, CMUdict, frequency lists) they append here and the later stages do
  // not change — that is the whole point of the stage boundary.
  const entries = read<RawEntry[]>('data/seed/entries.json');
  const topics = read<RawTopic[]>('data/seed/topics.json');
  console.log(`load      ${entries.length} entries, ${topics.length} topics`);

  // --- enrich ---------------------------------------------------------------
  const built = enrich(entries);
  const byBand = built.reduce<Record<string, number>>((acc, e) => {
    acc[e.cefr] = (acc[e.cefr] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `enrich    difficulty ${Math.min(...built.map((b) => b.difficulty)).toFixed(2)}` +
      `..${Math.max(...built.map((b) => b.difficulty)).toFixed(2)}  ` +
      Object.entries(byBand)
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join(' '),
  );

  // --- validate -------------------------------------------------------------
  const problems = validate(built);
  const errors = errorsOf(problems);
  const warnings = problems.filter((p) => p.severity === 'warning');

  for (const w of warnings) console.warn(`  warn  ${w.rule}  ${w.lemma}: ${w.detail}`);
  for (const e of errors) console.error(`  ERROR ${e.rule}  ${e.lemma}: ${e.detail}`);

  if (errors.length > 0) {
    console.error(
      `\nvalidate  FAILED with ${errors.length} error(s). Nothing written.\n` +
        `Every rule here is a content defect we refuse to ship. Fix the data, not the rule.`,
    );
    process.exit(1);
  }
  console.log(`validate  passed (${warnings.length} warning(s))`);

  // --- emit -----------------------------------------------------------------
  const result = emit(built, topics, outPath, CORPUS_VERSION);
  console.log(
    `emit      ${result.words} words · ${result.senses} senses · ${result.examples} examples · ` +
      `${result.relations} relations · ${result.topics} topics`,
  );
  if (result.droppedUnreviewed > 0) {
    console.log(`          dropped ${result.droppedUnreviewed} unreviewed example(s) at the gate`);
  }
  console.log(`          ${result.path}`);
  console.log(`          sha256 ${result.sha256}`);

  writeFileSync(
    join(root, 'out', 'manifest.json'),
    `${JSON.stringify({ ...result, corpusVersion: CORPUS_VERSION }, null, 2)}\n`,
  );
}

main();
