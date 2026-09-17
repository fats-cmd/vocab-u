/**
 * Game modes are configuration, not code paths.
 *
 * Two consequences. First, the practice hub can render each mode's rules without
 * the learner having to open it — the reference app's Sprint / Rush / Perfection
 * are pure flavour, and the rules exist only inside the intro screen. Second, a
 * run has exactly one reason it ended: `endsOn`. The reference app showed
 * "Lives are up!" above "10/13 questions in 60s", which are two different
 * endings reported at once.
 */

export type ModeId = 'sprint' | 'rush' | 'perfection' | 'review';

export type EndCondition = 'time' | 'lives' | 'deck';

export interface Mode {
  id: ModeId;
  label: string;
  /** One line, shown on the hub tile — states the mechanic, not a mood. */
  tagline: string;
  timeLimitMs: number | null;
  lives: number | null;
  deckSize: number | null;
  endsOn: EndCondition;
  optionCount: number;
  /** Rules rendered on both the hub tile and the intro screen, from one source. */
  rules: string[];
}

export const MODES: Record<ModeId, Mode> = {
  sprint: {
    id: 'sprint',
    label: 'Sprint',
    tagline: '60 seconds, unlimited mistakes',
    timeLimitMs: 60_000,
    lives: null,
    deckSize: null,
    endsOn: 'time',
    optionCount: 4,
    rules: ['Answer as many as you can', '60 seconds on the clock', 'Mistakes do not end the run'],
  },
  rush: {
    id: 'rush',
    label: 'Rush',
    tagline: '60 seconds, 3 lives — whichever runs out first',
    timeLimitMs: 60_000,
    lives: 3,
    endsOn: 'lives',
    deckSize: null,
    optionCount: 4,
    rules: ['Answer as many as you can', '3 lives', '60 seconds on the clock'],
  },
  perfection: {
    id: 'perfection',
    label: 'Perfection',
    tagline: 'No clock. 3 lives. How far can you go?',
    timeLimitMs: null,
    lives: 3,
    deckSize: null,
    endsOn: 'lives',
    optionCount: 4,
    rules: ['Answer as many as you can', '3 lives', 'Take as long as you like'],
  },
  review: {
    id: 'review',
    label: 'Review',
    tagline: 'The words you are about to forget',
    timeLimitMs: null,
    lives: null,
    deckSize: 20,
    endsOn: 'deck',
    optionCount: 4,
    rules: [
      'Scheduled by how close you are to forgetting',
      'No clock, no lives',
      'Finishes when the deck is done',
    ],
  },
};

export const ARCADE_MODES: ModeId[] = ['sprint', 'rush', 'perfection'];

/** Headline for the summary screen. Derived from the mode's single end condition. */
export function endHeadline(mode: Mode, reason: EndCondition): string {
  switch (reason) {
    case 'time':
      return "Time's up!";
    case 'lives':
      return mode.lives === 1 ? 'One mistake was all it took' : 'Lives are up!';
    case 'deck':
      return 'Deck complete!';
  }
}
