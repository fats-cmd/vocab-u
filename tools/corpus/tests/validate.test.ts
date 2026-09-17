import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enrich } from '../src/stages/enrich.ts';
import { errorsOf, validate } from '../src/stages/validate.ts';
import type { RawEntry } from '../src/types.ts';

const base: RawEntry = {
  lemma: 'annual',
  pos: 'adj',
  ipa: 'ˈænjuəl',
  freqRank: 3200,
  senses: [
    {
      gloss: 'Happening once every year',
      register: 'neutral',
      examples: [
        { text: 'The company publishes an annual report.', source: 'curated', reviewed: true },
      ],
    },
  ],
  synonyms: [],
  topics: ['business'],
  source: 'curated',
};

const entry = (over: Partial<RawEntry>): RawEntry => ({ ...base, ...over });
const rulesFor = (entries: RawEntry[]): string[] =>
  errorsOf(validate(enrich(entries))).map((p) => p.rule);

describe('the gate accepts clean data', () => {
  it('passes a well-formed entry', () => {
    expect(rulesFor([base])).toEqual([]);
  });

  it('passes the shipped seed corpus', () => {
    const entries = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'data/seed/entries.json'), 'utf8'),
    ) as RawEntry[];
    expect(errorsOf(validate(enrich(entries)))).toEqual([]);
  });
});

describe('IPA rules — the reference app’s transcriptions', () => {
  it('rejects a multisyllabic word with no primary stress', () => {
    // The reference app showed `ɪn.tə.mət` for *intimate*.
    const rules = rulesFor([entry({ lemma: 'intimate', ipa: 'ɪn.tə.mət' })]);
    expect(rules).toContain('ipa-no-stress');
  });

  it('rejects a transcription mixing rhotic and non-rhotic markers', () => {
    // `ɪnˈsɜːrtɪˌtjuːd` for *incertitude* — British NURSE and yod beside a rhotic r.
    const rules = rulesFor([entry({ lemma: 'incertitude', ipa: 'ɪnˈsɜːrtɪˌtjuːd' })]);
    expect(rules.filter((r) => r === 'ipa-mixed-dialect').length).toBeGreaterThanOrEqual(2);
  });

  it('rejects the British LOT vowel in a General American corpus', () => {
    // `ˈnegəˌtrɒn` for *negatron*.
    expect(rulesFor([entry({ lemma: 'negatron', ipa: 'ˈnɛɡəˌtrɒn' })])).toContain(
      'ipa-mixed-dialect',
    );
  });

  it('rejects two primary stresses in one word', () => {
    expect(rulesFor([entry({ ipa: 'ˈænˈjuəl' })])).toContain('ipa-multiple-primary');
  });

  it('rejects a missing transcription', () => {
    expect(rulesFor([entry({ ipa: null })])).toContain('ipa-missing');
  });

  it('allows a monosyllable without a stress mark', () => {
    expect(rulesFor([entry({ lemma: 'calm', pos: 'adj', ipa: 'kɑm', senses: [
      { gloss: 'Free from disturbance', register: 'neutral',
        examples: [{ text: 'The sea was calm all day.', source: 'curated', reviewed: true }] },
    ] })])).toEqual([]);
  });
});

describe('gloss rules', () => {
  it('rejects a gloss longer than the limit', () => {
    expect(
      rulesFor([entry({ senses: [{ ...base.senses[0]!, gloss: 'A'.repeat(120) }] })]),
    ).toContain('gloss-too-long');
  });

  it('rejects a gloss that defines the word with itself', () => {
    expect(
      rulesFor([entry({ senses: [{ ...base.senses[0]!, gloss: 'Occurring on an annual basis' }] })]),
    ).toContain('gloss-circular');
  });

  it('rejects sentence punctuation, keeping one register across the corpus', () => {
    expect(
      rulesFor([entry({ senses: [{ ...base.senses[0]!, gloss: 'Happening once every year.' }] })]),
    ).toContain('gloss-trailing-period');
  });
});

describe('example rules', () => {
  it('rejects an example that never uses its own headword', () => {
    const rules = rulesFor([
      entry({
        senses: [
          {
            ...base.senses[0]!,
            examples: [{ text: 'It happens every twelve months.', source: 'x', reviewed: true }],
          },
        ],
      }),
    ]);
    expect(rules).toContain('example-missing-headword');
  });

  it('accepts an inflection of the headword', () => {
    expect(
      rulesFor([
        entry({
          senses: [
            {
              ...base.senses[0]!,
              examples: [
                { text: 'The report is published annually.', source: 'x', reviewed: true },
              ],
            },
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it('rejects a sense whose only examples are unreviewed', () => {
    // "Liechtenstein is a quaint principality by Alpine bounds."
    const rules = rulesFor([
      entry({
        senses: [
          {
            ...base.senses[0]!,
            examples: [{ text: 'An annual thing by yearly bounds.', source: 'llm', reviewed: false }],
          },
        ],
      }),
    ]);
    expect(rules).toContain('example-none-reviewed');
  });
});

describe('relation rules', () => {
  const yearly: RawEntry = {
    ...base,
    lemma: 'yearly',
    ipa: 'ˈjɪrli',
    freqRank: 6000,
    senses: [
      {
        gloss: 'Occurring once a year',
        register: 'neutral',
        examples: [{ text: 'A yearly subscription renews in March.', source: 'c', reviewed: true }],
      },
    ],
  };

  it('accepts a mutually declared synonym pair', () => {
    expect(
      rulesFor([entry({ synonyms: ['yearly'] }), { ...yearly, synonyms: ['annual'] }]),
    ).toEqual([]);
  });

  it('rejects a one-way synonym claim', () => {
    // `duchy` offered as a synonym of `principality` but never the reverse.
    expect(rulesFor([entry({ synonyms: ['yearly'] }), yearly])).toContain('synonym-not-mutual');
  });

  it('rejects a synonym that is not in the corpus', () => {
    expect(rulesFor([entry({ synonyms: ['nonexistent'] })])).toContain('synonym-dangling');
  });

  it('rejects a synonym of a different part of speech', () => {
    const adverb: RawEntry = { ...yearly, lemma: 'yearly', pos: 'adv', synonyms: ['annual'] };
    expect(rulesFor([entry({ synonyms: ['yearly'] }), adverb])).toContain('synonym-pos-mismatch');
  });
});

describe('duplicate detection', () => {
  it('rejects the same lemma and part of speech twice', () => {
    expect(rulesFor([base, base])).toContain('duplicate-entry');
  });

  it('allows the same lemma under a different part of speech', () => {
    const noun: RawEntry = {
      ...base,
      pos: 'n',
      senses: [
        {
          gloss: 'A plant that lives for one season',
          register: 'technical',
          examples: [{ text: 'Plant annuals after the last frost.', source: 'c', reviewed: true }],
        },
      ],
    };
    expect(rulesFor([base, noun])).toEqual([]);
  });
});
