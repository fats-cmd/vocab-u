/**
 * Validation — the gate.
 *
 * Every rule here is a defect observed in the reference app, turned into a build
 * failure. This stage does not produce a report for someone to read later; an
 * error fails `pnpm corpus:build` and therefore fails CI.
 */

import type { BuiltEntry, Problem } from '../types.ts';

export const MAX_GLOSS = 90;

/** Symbols that do not belong in a General American transcription. */
const NON_GA = [
  { symbol: 'ɒ', note: 'British LOT vowel; General American uses ɑ' },
  { symbol: 'ɜː', note: 'non-rhotic NURSE; General American uses ɝ' },
  { symbol: 'tjuː', note: 'British yod; General American uses tuː' },
  { symbol: 'djuː', note: 'British yod; General American uses duː' },
  { symbol: 'ɪə', note: 'non-rhotic NEAR; General American uses ɪr' },
  { symbol: 'eə', note: 'non-rhotic SQUARE; General American uses ɛr' },
  { symbol: 'ʊə', note: 'non-rhotic CURE; General American uses ʊr' },
];

const PRIMARY_STRESS = 'ˈ';

/** Every inflection of the headword, for checking an example contains its own word. */
export function mentionsHeadword(text: string, lemma: string): boolean {
  const stem = lemma.toLowerCase().replace(/(e|y)$/i, '');
  if (stem.length < 3) return new RegExp(`\\b${lemma}\\b`, 'i').test(text);
  return new RegExp(`\\b${stem}\\w*\\b`, 'i').test(text);
}

export function validate(entries: readonly BuiltEntry[]): Problem[] {
  const problems: Problem[] = [];
  const err = (rule: string, lemma: string, detail: string) =>
    problems.push({ severity: 'error', rule, lemma, detail });
  const warn = (rule: string, lemma: string, detail: string) =>
    problems.push({ severity: 'warning', rule, lemma, detail });

  const seen = new Set<string>();
  const byLemma = new Map<string, BuiltEntry>();
  for (const e of entries) byLemma.set(e.lemma.toLowerCase(), e);

  for (const entry of entries) {
    const key = `${entry.lemma.toLowerCase()}:${entry.pos}`;
    if (seen.has(key)) err('duplicate-entry', entry.lemma, `${key} appears more than once`);
    seen.add(key);

    // --- IPA -------------------------------------------------------------
    if (entry.ipa === null || entry.ipa.trim() === '') {
      err('ipa-missing', entry.lemma, 'no transcription');
    } else {
      const ipa = entry.ipa;
      if (entry.syllables > 1 && !ipa.includes(PRIMARY_STRESS)) {
        // `ɪn.tə.mət` for *intimate* — no stress mark at all.
        err('ipa-no-stress', entry.lemma, `"${ipa}" has no primary stress mark (ˈ)`);
      }
      for (const { symbol, note } of NON_GA) {
        if (ipa.includes(symbol)) {
          // `ɪnˈsɜːrtɪˌtjuːd` mixed rhotic and non-rhotic markers in one word.
          err('ipa-mixed-dialect', entry.lemma, `"${ipa}" contains ${symbol} — ${note}`);
        }
      }
      if ((ipa.match(new RegExp(PRIMARY_STRESS, 'g')) ?? []).length > 1) {
        err('ipa-multiple-primary', entry.lemma, `"${ipa}" has more than one primary stress`);
      }
      if (/[a-zA-Z]/.test(ipa.replace(/[aeioubdfghjklmnprstvwzɡ]/g, ''))) {
        warn('ipa-suspicious', entry.lemma, `"${ipa}" contains unexpected Latin letters`);
      }
    }

    // --- Senses ----------------------------------------------------------
    if (entry.senses.length === 0) err('sense-missing', entry.lemma, 'no senses');
    for (const sense of entry.senses) {
      const gloss = sense.gloss.trim();
      if (gloss.length === 0) err('gloss-empty', entry.lemma, 'empty gloss');
      if (gloss.length > MAX_GLOSS) {
        // Two registers in one corpus: dictionary prose next to plain language.
        err('gloss-too-long', entry.lemma, `${gloss.length} chars (max ${MAX_GLOSS}): "${gloss}"`);
      }
      if (/\.$/.test(gloss)) {
        err('gloss-trailing-period', entry.lemma, `"${gloss}" — glosses are phrases, not sentences`);
      }
      if (gloss.length > 0 && gloss[0] !== gloss[0]!.toUpperCase()) {
        warn('gloss-lowercase', entry.lemma, `"${gloss}" does not start with a capital`);
      }
      if (new RegExp(`\\b${entry.lemma}\\b`, 'i').test(gloss)) {
        err('gloss-circular', entry.lemma, `"${gloss}" defines the word with itself`);
      }

      // --- Examples ------------------------------------------------------
      for (const example of sense.examples) {
        if (!mentionsHeadword(example.text, entry.lemma)) {
          err('example-missing-headword', entry.lemma, `"${example.text}" does not use the word`);
        }
        if (!/[.!?]$/.test(example.text.trim())) {
          err('example-unpunctuated', entry.lemma, `"${example.text}" is not a complete sentence`);
        }
        if (example.text.trim().split(/\s+/).length < 4) {
          warn('example-too-short', entry.lemma, `"${example.text}" gives little context`);
        }
      }
      if (sense.examples.filter((e) => e.reviewed).length === 0) {
        // "Liechtenstein is a quaint principality by Alpine bounds."
        err('example-none-reviewed', entry.lemma, 'no human-reviewed example');
      }
    }

    // --- Relations -------------------------------------------------------
    for (const synonym of entry.synonyms) {
      const other = byLemma.get(synonym.toLowerCase());
      if (!other) {
        err('synonym-dangling', entry.lemma, `synonym "${synonym}" is not in the corpus`);
        continue;
      }
      if (other.pos !== entry.pos) {
        err('synonym-pos-mismatch', entry.lemma, `"${synonym}" is a different part of speech`);
      }
      if (!other.synonyms.some((s) => s.toLowerCase() === entry.lemma.toLowerCase())) {
        // `duchy` offered as a synonym of `principality` but not the reverse.
        err('synonym-not-mutual', entry.lemma, `"${synonym}" does not list "${entry.lemma}" back`);
      }
    }

    if (entry.topics.length === 0) {
      warn('topic-missing', entry.lemma, 'belongs to no topic, so it is unreachable by browsing');
    }
  }

  return problems;
}

export const errorsOf = (problems: readonly Problem[]): Problem[] =>
  problems.filter((p) => p.severity === 'error');
