/**
 * Game item generation. Four game types, one shape.
 *
 * Every generator returns `null` rather than a degraded question when the corpus
 * cannot support a good one (too few matched distractors, no usable example).
 * A missing question is recoverable; a broken question teaches the wrong answer.
 */

import type { WordEntry, Word } from '../schema/types.js';
import { type DistractorCandidate, selectDistractors } from './distractors.js';
import { type Rng, shuffle } from './rng.js';

export type GameType = 'guess-word' | 'meaning-match' | 'fill-gap' | 'match-synonym';

export interface GameItem {
  type: GameType;
  wordId: number;
  /** What the learner reads. */
  prompt: string;
  /** Secondary line, e.g. the part of speech. Optional by design. */
  hint: string | null;
  options: string[];
  answerIndex: number;
  difficulty: number;
}

export interface GeneratorInput {
  entry: WordEntry;
  pool: readonly DistractorCandidate[];
  synonymIds: ReadonlySet<number>;
  fields: readonly number[];
  optionCount: number;
  rng: Rng;
}

function buildOptions(
  correct: string,
  distractors: readonly string[],
  rng: Rng,
): { options: string[]; answerIndex: number } {
  const options = shuffle([correct, ...distractors], rng);
  return { options, answerIndex: options.indexOf(correct) };
}

function distractorWords(input: GeneratorInput, count: number): Word[] {
  return selectDistractors(
    input.pool,
    {
      target: input.entry.word,
      targetFields: input.fields,
      synonymIds: input.synonymIds,
    },
    count,
    input.rng,
  );
}

/** Definition shown, pick the word. */
export function guessTheWord(input: GeneratorInput): GameItem | null {
  const need = input.optionCount - 1;
  const distractors = distractorWords(input, need);
  if (distractors.length < need) return null;
  const { options, answerIndex } = buildOptions(
    input.entry.word.lemma,
    distractors.map((d) => d.lemma),
    input.rng,
  );
  return {
    type: 'guess-word',
    wordId: input.entry.word.id,
    prompt: input.entry.sense.gloss,
    hint: `(${input.entry.word.pos}.)`,
    options,
    answerIndex,
    difficulty: input.entry.word.difficulty,
  };
}

/**
 * Word shown, pick the definition. Needs the *glosses* of the distractors, which
 * the caller supplies — the generator never reaches into the database itself.
 */
export function meaningMatch(
  input: GeneratorInput,
  glossOf: (wordId: number) => string | null,
): GameItem | null {
  const need = input.optionCount - 1;
  const distractors = distractorWords(input, need)
    .map((w) => glossOf(w.id))
    .filter((g): g is string => g !== null && g !== input.entry.sense.gloss);
  if (distractors.length < need) return null;
  const { options, answerIndex } = buildOptions(
    input.entry.sense.gloss,
    distractors.slice(0, need),
    input.rng,
  );
  return {
    type: 'meaning-match',
    wordId: input.entry.word.id,
    prompt: input.entry.word.lemma,
    hint: input.entry.word.ipa,
    options,
    answerIndex,
    difficulty: input.entry.word.difficulty,
  };
}

const BLANK = '–––––';

/** Redact every inflection of the headword from its own example sentence. */
export function blankExample(text: string, lemma: string): string | null {
  const stem = lemma.replace(/(e|y)$/i, '');
  if (stem.length < 3) return null;
  const pattern = new RegExp(`\\b${stem}\\w*\\b`, 'gi');
  if (!pattern.test(text)) return null;
  return text.replace(new RegExp(`\\b${stem}\\w*\\b`, 'gi'), BLANK);
}

/** Sentence with the word removed, pick the word that fits. */
export function fillTheGap(input: GeneratorInput): GameItem | null {
  const example = input.entry.examples.find((e) => e.reviewed);
  if (!example) return null;
  const prompt = blankExample(example.text, input.entry.word.lemma);
  if (prompt === null) return null;

  const need = input.optionCount - 1;
  const distractors = distractorWords(input, need);
  if (distractors.length < need) return null;
  const { options, answerIndex } = buildOptions(
    input.entry.word.lemma,
    distractors.map((d) => d.lemma),
    input.rng,
  );
  return {
    type: 'fill-gap',
    wordId: input.entry.word.id,
    prompt,
    hint: input.entry.sense.gloss,
    options,
    answerIndex,
    difficulty: input.entry.word.difficulty,
  };
}

/** Word shown, pick its synonym. Requires a real synonym to exist. */
export function matchSynonym(input: GeneratorInput): GameItem | null {
  const synonym = input.entry.synonyms[0];
  if (!synonym) return null;
  const need = input.optionCount - 1;
  const distractors = distractorWords(input, need);
  if (distractors.length < need) return null;
  const { options, answerIndex } = buildOptions(
    synonym,
    distractors.map((d) => d.lemma),
    input.rng,
  );
  return {
    type: 'match-synonym',
    wordId: input.entry.word.id,
    prompt: input.entry.word.lemma,
    hint: `(${input.entry.word.pos}.) synonym?`,
    options,
    answerIndex,
    difficulty: input.entry.word.difficulty,
  };
}

export const GENERATORS: Record<
  GameType,
  (input: GeneratorInput, glossOf: (id: number) => string | null) => GameItem | null
> = {
  'guess-word': (i) => guessTheWord(i),
  'meaning-match': (i, g) => meaningMatch(i, g),
  'fill-gap': (i) => fillTheGap(i),
  'match-synonym': (i) => matchSynonym(i),
};
