import { describe, expect, it } from 'vitest';
import { MODES, endHeadline } from '../src/session/modes';
import { answer, currentItem, startSession, summarise, tick, timeRemainingMs } from '../src/session/runner';
import type { GameItem } from '../src/items/generators';
import { Rating } from '../src/srs/fsrs';

const T0 = 1_700_000_000_000;

const item = (id: number): GameItem => ({
  type: 'guess-word',
  wordId: id,
  lemma: `word${id}`,
  prompt: `definition ${id}`,
  hint: null,
  options: ['a', 'b', 'c', 'd'],
  answerIndex: 0,
  difficulty: 0.5,
});

const deck = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1));

describe('mode configuration', () => {
  it('gives every mode exactly one end condition', () => {
    for (const mode of Object.values(MODES)) {
      expect(['time', 'lives', 'deck']).toContain(mode.endsOn);
      expect(mode.rules.length).toBeGreaterThan(0);
      expect(mode.tagline.length).toBeGreaterThan(0);
    }
  });

  it('states the mechanic on the tagline, so the hub needs no intro screen', () => {
    expect(MODES.sprint.tagline).toMatch(/60 seconds/);
    expect(MODES.perfection.tagline).toMatch(/3 lives/i);
  });
});

describe('session runner', () => {
  it('advances through the deck and records answers', () => {
    let s = startSession(MODES.review, deck(3), T0);
    expect(currentItem(s)?.wordId).toBe(1);
    s = answer(s, 0, T0 + 1000);
    expect(s.answers[0]!.correct).toBe(true);
    expect(currentItem(s)?.wordId).toBe(2);
  });

  it('treats a null choice as a miss', () => {
    let s = startSession(MODES.review, deck(2), T0);
    s = answer(s, null, T0 + 9000);
    expect(s.answers[0]!.correct).toBe(false);
    expect(s.answers[0]!.rating).toBe(Rating.Again);
  });

  it('ends a lives mode on lives, and reports only that reason', () => {
    // The reference app printed "Lives are up!" above "10/13 questions in 60s".
    let s = startSession(MODES.perfection, deck(20), T0);
    for (let i = 0; i < 3; i += 1) s = answer(s, 1, T0 + (i + 1) * 1000);
    expect(s.endReason).toBe('lives');
    expect(s.livesLeft).toBe(0);
    expect(endHeadline(MODES.perfection, s.endReason!)).toBe('Lives are up!');
  });

  it('ends a timed mode on time without any further input', () => {
    let s = startSession(MODES.sprint, deck(50), T0);
    s = tick(s, T0 + 60_001);
    expect(s.endReason).toBe('time');
    expect(endHeadline(MODES.sprint, 'time')).toBe("Time's up!");
  });

  it('ends a deck mode when the deck runs out', () => {
    let s = startSession(MODES.review, deck(2), T0);
    s = answer(s, 0, T0 + 1000);
    s = answer(s, 0, T0 + 2000);
    expect(s.endReason).toBe('deck');
  });

  it('reports time as the reason when a timed lives-mode runs out the clock first', () => {
    let s = startSession(MODES.rush, deck(50), T0);
    s = answer(s, 0, T0 + 1000); // correct, keeps all lives
    s = tick(s, T0 + 60_001);
    expect(s.endReason).toBe('time');
  });

  it('ignores answers after the run has ended', () => {
    let s = startSession(MODES.sprint, deck(5), T0);
    s = tick(s, T0 + 60_001);
    const after = answer(s, 0, T0 + 61_000);
    expect(after.answers).toHaveLength(0);
  });

  it('counts down the clock and floors at zero', () => {
    const s = startSession(MODES.sprint, deck(5), T0);
    expect(timeRemainingMs(s, T0 + 10_000)).toBe(50_000);
    expect(timeRemainingMs(s, T0 + 99_000)).toBe(0);
    expect(timeRemainingMs(startSession(MODES.perfection, deck(5), T0), T0)).toBeNull();
  });
});

describe('summary', () => {
  it('reports correct, missed and attempted rather than an ambiguous fraction', () => {
    // `10/13` in the reference app had a denominator that was itself a
    // performance variable, so no two runs were comparable.
    let s = startSession(MODES.perfection, deck(20), T0);
    for (let i = 0; i < 10; i += 1) s = answer(s, 0, T0 + i * 500);
    for (let i = 0; i < 3; i += 1) s = answer(s, 1, T0 + 6000 + i * 500);
    const sum = summarise(s, null);
    expect(sum.correct).toBe(10);
    expect(sum.missed).toBe(3);
    expect(sum.attempted).toBe(13);
    expect(sum.accuracy).toBeCloseTo(10 / 13, 6);
    expect(sum.endReason).toBe('lives');
  });

  it('puts missed words first — the results screen exists to fix mistakes', () => {
    let s = startSession(MODES.review, deck(4), T0);
    s = answer(s, 0, T0 + 500);
    s = answer(s, 1, T0 + 1000);
    s = answer(s, 0, T0 + 1500);
    s = answer(s, 1, T0 + 2000);
    const order = summarise(s, null).answers.map((a) => a.correct);
    expect(order).toEqual([false, false, true, true]);
  });

  it('flags a personal best against the previous one', () => {
    let s = startSession(MODES.sprint, deck(10), T0);
    for (let i = 0; i < 6; i += 1) s = answer(s, 0, T0 + i * 500);
    expect(summarise(s, 4).isPersonalBest).toBe(true);
    expect(summarise(s, 9).isPersonalBest).toBe(false);
    expect(summarise(s, 6).isPersonalBest).toBe(false);
    expect(summarise(s, null).isPersonalBest).toBe(true);
  });

  it('does not call a scoreless first run a personal best', () => {
    // Congratulating someone who got nothing right reads as mockery.
    let s = startSession(MODES.perfection, deck(10), T0);
    for (let i = 0; i < 3; i += 1) s = answer(s, 1, T0 + i * 500);
    expect(summarise(s, null).correct).toBe(0);
    expect(summarise(s, null).isPersonalBest).toBe(false);
  });
});
