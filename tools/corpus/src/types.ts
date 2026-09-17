import type { Pos, Register, TopicSection } from '@vocab-u/core';

/** A row as it exists in a source dataset or a curated override file. */
export interface RawEntry {
  lemma: string;
  pos: Pos;
  ipa: string | null;
  freqRank: number | null;
  senses: RawSense[];
  synonyms: string[];
  antonyms?: string[];
  topics: string[];
  /** Where this row came from. Used for attribution and for the licence report. */
  source: string;
}

export interface RawSense {
  gloss: string;
  register?: Register;
  examples: RawExample[];
}

export interface RawExample {
  text: string;
  source: string;
  /**
   * Unreviewed rows are carried through the pipeline so they can be counted and
   * reported, and then dropped at the emit stage. They never reach a learner.
   */
  reviewed: boolean;
}

export interface RawTopic {
  slug: string;
  title: string;
  section: TopicSection;
  /** One line stating the scope, so `Languages → Spanish words` is unambiguous. */
  scope: string;
  ord: number;
}

/** An entry after enrichment, ready for validation and emit. */
export interface BuiltEntry extends RawEntry {
  syllables: number;
  difficulty: number;
  cefr: string;
}

export interface Problem {
  severity: 'error' | 'warning';
  rule: string;
  lemma: string;
  detail: string;
}
