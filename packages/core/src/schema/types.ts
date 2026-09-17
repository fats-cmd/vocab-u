/**
 * Shared domain types. Single source of truth for both the app and the corpus
 * pipeline — if a column changes here, the pipeline and the repositories both
 * fail to typecheck, which is the point.
 */

export type Pos = 'n' | 'v' | 'adj' | 'adv';

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_ORDER: readonly Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Display names. The top band must never be described in terms of a "next level". */
export const CEFR_LABEL: Record<Cefr, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
  C1: 'Advanced',
  C2: 'Mastery',
};

export type Register = 'neutral' | 'formal' | 'informal' | 'technical' | 'archaic';

export interface Word {
  id: number;
  lemma: string;
  pos: Pos;
  /** Single dialect (General American), primary stress mark required. */
  ipa: string | null;
  syllables: string | null;
  /** 1 = most frequent. null = outside the frequency list (treated as very rare). */
  freqRank: number | null;
  cefr: Cefr;
  /** Continuous 0..1. Every selection decision uses this, not `cefr`. */
  difficulty: number;
}

export interface Sense {
  id: number;
  wordId: number;
  ord: number;
  gloss: string;
  register: Register;
}

export interface Example {
  id: number;
  senseId: number;
  text: string;
  source: string;
  /** Unreviewed rows never reach a user. Enforced at build time. */
  reviewed: boolean;
}

export type RelationKind = 'synonym' | 'antonym' | 'root';

export interface Relation {
  fromWordId: number;
  toWordId: number;
  kind: RelationKind;
  strength: number;
}

export type TopicSection = 'about-us' | 'world' | 'domain' | 'test' | 'origin' | 'language';

export interface Topic {
  id: number;
  slug: string;
  title: string;
  section: TopicSection;
  ord: number;
}

/** A word joined to its primary sense — what the feed and the games actually consume. */
export interface WordEntry {
  word: Word;
  sense: Sense;
  examples: Example[];
  synonyms: string[];
}
