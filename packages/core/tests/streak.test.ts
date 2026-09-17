import { describe, expect, it } from 'vitest';
import { currentStreak, dayKey, weekStates, weekdayIndex } from '../src/progress/streak';

const DAY = 86_400_000;

describe('weekStates', () => {
  const WED = 2;

  it('never marks a future day as missed', () => {
    const states = weekStates(new Set([0, 1]), WED);
    expect(states).toEqual(['done', 'done', 'today', 'future', 'future', 'future', 'future']);
  });

  it('marks a skipped earlier day as missed', () => {
    expect(weekStates(new Set([0]), WED)).toEqual([
      'done', 'missed', 'today', 'future', 'future', 'future', 'future',
    ]);
  });

  it('shows today as done once the goal is met', () => {
    expect(weekStates(new Set([0, 1, 2]), WED)[WED]).toBe('done');
  });

  it('has no missed days on the last day of a perfect week', () => {
    const states = weekStates(new Set([0, 1, 2, 3, 4, 5]), 6);
    expect(states.includes('missed')).toBe(false);
  });
});

describe('weekdayIndex', () => {
  it('treats Monday as the first day of the week', () => {
    // 2024-01-01 was a Monday.
    expect(weekdayIndex(new Date('2024-01-01T12:00:00').getTime())).toBe(0);
    expect(weekdayIndex(new Date('2024-01-07T12:00:00').getTime())).toBe(6);
  });
});

describe('currentStreak', () => {
  const now = new Date('2024-03-15T10:00:00').getTime();
  const keys = (...offsets: number[]) => new Set(offsets.map((o) => dayKey(now - o * DAY)));

  it('counts consecutive days back from today', () => {
    expect(currentStreak(keys(0, 1, 2), now)).toBe(3);
  });

  it('does not break the streak because today is not done yet', () => {
    // Today is still open. Counting it as a break is wrong and demoralising.
    expect(currentStreak(keys(1, 2, 3), now)).toBe(3);
  });

  it('breaks on a genuinely skipped day', () => {
    expect(currentStreak(keys(0, 1, 3, 4), now)).toBe(2);
  });

  it('is zero with no activity at all', () => {
    expect(currentStreak(new Set(), now)).toBe(0);
  });

  it('is zero when the last activity was two days ago', () => {
    expect(currentStreak(keys(2, 3), now)).toBe(0);
  });
});
