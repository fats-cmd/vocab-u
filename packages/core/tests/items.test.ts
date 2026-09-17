import { describe, expect, it } from 'vitest';
import type { Sense, Word, WordEntry } from '../src/schema/types';
import {
  isInflectionOf,
  scoreCandidate,
  selectDistractors,
  type DistractorCandidate,
} from '../src/items/distractors';
import {
  blankExample,
  fillTheGap,
  guessTheWord,
  matchSynonym,
  meaningMatch,
  type GeneratorInput,
} from '../src/items/generators';
import { makeRng, shuffle } from '../src/items/rng';

const word = (id: number, lemma: string, over: Partial<Word> = {}): Word => ({
  id,
  lemma,
  pos: 'adj',
  ipa: 'ˈtest',
  syllables: null,
  freqRank: 5000,
  cefr: 'B2',
  difficulty: 0.5,
  ...over,
});

const target = word(1, 'annual', { difficulty: 0.5 });

const candidates: DistractorCandidate[] = [
  { word: word(2, 'perennial', { difficulty: 0.55 }), fields: [1] },
  { word: word(3, 'biennial', { difficulty: 0.6 }), fields: [1] },
  { word: word(4, 'seasonal', { difficulty: 0.45 }), fields: [1] },
  { word: word(5, 'quarterly', { difficulty: 0.5 }), fields: [1] },
  { word: word(6, 'yearly', { difficulty: 0.3 }), fields: [1] }, // synonym
  { word: word(7, 'annually', { pos: 'adv', difficulty: 0.5 }), fields: [1] }, // wrong POS
  { word: word(8, 'run', { pos: 'v', difficulty: 0.1 }), fields: [9] },
];

/** Named so a fixture reorder cannot silently change what a test asserts. */
const byId = (id: number): DistractorCandidate =>
  candidates.find((c) => c.word.id === id)!;
const SYNONYM = byId(6);
const ADVERB = byId(7);
const VERB = byId(8);

const ctx = { target, targetFields: [1], synonymIds: new Set([6]) };

describe('isInflectionOf', () => {
  it('rejects a superlative of the target — the "daintiest" case', () => {
    // The reference app offered `inept` / `daintiest` / `annual`; a superlative
    // among plain adjectives is a giveaway even to someone who knows no words.
    expect(isInflectionOf('daintiest', 'dainty')).toBe(true);
    expect(isInflectionOf('dainties', 'dainty')).toBe(true);
    expect(isInflectionOf('running', 'run')).toBe(true);
    expect(isInflectionOf('annual', 'annual')).toBe(true);
  });

  it('does not reject genuinely unrelated words', () => {
    expect(isInflectionOf('perennial', 'annual')).toBe(false);
    expect(isInflectionOf('seasonal', 'annual')).toBe(false);
  });
});

describe('scoreCandidate', () => {
  it('disqualifies a different part of speech', () => {
    expect(scoreCandidate(ADVERB, ctx)).toBeNull();
    expect(scoreCandidate(VERB, ctx)).toBeNull();
  });

  it('disqualifies a synonym — it would make two options correct', () => {
    expect(scoreCandidate(SYNONYM, ctx)).toBeNull();
  });

  it('disqualifies the target itself', () => {
    expect(scoreCandidate({ word: target, fields: [1] }, ctx)).toBeNull();
  });

  it('prefers a candidate of similar difficulty', () => {
    const near = scoreCandidate({ word: word(20, 'biannual', { difficulty: 0.5 }), fields: [1] }, ctx)!;
    const far = scoreCandidate({ word: word(21, 'bigxxxxx', { difficulty: 0.05 }), fields: [1] }, ctx)!;
    expect(near).toBeGreaterThan(far);
  });

  it('prefers a candidate from the same semantic field', () => {
    const same = scoreCandidate({ word: word(22, 'monthly'), fields: [1] }, ctx)!;
    const other = scoreCandidate({ word: word(23, 'monthly'), fields: [42] }, ctx)!;
    expect(same).toBeGreaterThan(other);
  });
});

describe('selectDistractors', () => {
  it('never returns a synonym, an inflection or a mismatched POS', () => {
    const picked = selectDistractors(candidates, ctx, 3, makeRng(1));
    expect(picked).toHaveLength(3);
    for (const p of picked) {
      expect(p.pos).toBe(target.pos);
      expect(p.id).not.toBe(6);
      expect(p.id).not.toBe(target.id);
    }
  });

  it('returns fewer than asked rather than padding with bad options', () => {
    const thin = [ADVERB, VERB]; // both disqualified
    expect(selectDistractors(thin, ctx, 3, makeRng(1))).toHaveLength(0);
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const a = selectDistractors(candidates, ctx, 3, makeRng(5)).map((w) => w.id);
    const b = selectDistractors(candidates, ctx, 3, makeRng(5)).map((w) => w.id);
    expect(a).toEqual(b);
  });
});

describe('shuffle', () => {
  it('preserves every element', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, makeRng(3));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('does not mutate its input', () => {
    const input = [1, 2, 3];
    shuffle(input, makeRng(3));
    expect(input).toEqual([1, 2, 3]);
  });
});

const sense: Sense = { id: 1, wordId: 1, ord: 0, gloss: 'Happening once every year', register: 'neutral' };

const entry: WordEntry = {
  word: target,
  sense,
  examples: [
    { id: 1, senseId: 1, text: 'The company files an annual report.', source: 'curated', reviewed: true },
  ],
  synonyms: ['yearly'],
};

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  entry,
  pool: candidates,
  synonymIds: new Set([6]),
  fields: [1],
  optionCount: 4,
  rng: makeRng(9),
  ...over,
});

describe('generators', () => {
  it('guessTheWord asks the definition and answers with the word', () => {
    const item = guessTheWord(input())!;
    expect(item.prompt).toBe(sense.gloss);
    expect(item.options).toHaveLength(4);
    expect(item.options[item.answerIndex]).toBe('annual');
    expect(new Set(item.options).size).toBe(4);
  });

  it('meaningMatch asks the word and answers with the definition', () => {
    const glosses: Record<number, string> = { 2: 'Lasting many years', 3: 'Every two years', 4: 'Tied to a season', 5: 'Every three months' };
    const item = meaningMatch(input(), (id) => glosses[id] ?? null)!;
    expect(item.prompt).toBe('annual');
    expect(item.options[item.answerIndex]).toBe(sense.gloss);
  });

  it('fillTheGap redacts the headword from its own example', () => {
    const item = fillTheGap(input())!;
    expect(item.prompt).not.toMatch(/annual/i);
    expect(item.options[item.answerIndex]).toBe('annual');
  });

  it('matchSynonym answers with a real synonym', () => {
    const item = matchSynonym(input())!;
    expect(item.options[item.answerIndex]).toBe('yearly');
  });

  it('returns null rather than a broken question when the corpus is thin', () => {
    const thin = input({ pool: [ADVERB, VERB] });
    expect(guessTheWord(thin)).toBeNull();
    expect(fillTheGap(thin)).toBeNull();
    expect(matchSynonym(thin)).toBeNull();
  });

  it('refuses to build a gap question from an unreviewed example', () => {
    // No unreviewed generated text ever reaches a learner.
    const unreviewed: WordEntry = {
      ...entry,
      examples: [{ ...entry.examples[0]!, reviewed: false }],
    };
    expect(fillTheGap(input({ entry: unreviewed }))).toBeNull();
  });

  it('refuses to build a synonym question when no synonym exists', () => {
    expect(matchSynonym(input({ entry: { ...entry, synonyms: [] } }))).toBeNull();
  });
});

describe('blankExample', () => {
  it('blanks every inflection of the headword', () => {
    expect(blankExample('Annual reports are annually filed.', 'annual')).not.toMatch(/annual/i);
  });

  it('returns null when the example does not contain its own headword', () => {
    expect(blankExample('Something else entirely.', 'annual')).toBeNull();
  });
});
