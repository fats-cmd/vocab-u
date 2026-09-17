/**
 * Streak semantics.
 *
 * Pure, and therefore in the core rather than inside the component that draws
 * it. A day's state is not a colour decision — it is the difference between
 * telling someone they failed and telling them a day has not happened yet.
 */

export type DayState = 'done' | 'missed' | 'today' | 'future';

/** Local-midnight day key, `YYYY-MM-DD`. Streaks are counted in local days. */
export function dayKey(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Index within the Monday-first week, 0..6. */
export function weekdayIndex(at: number): number {
  return (new Date(at).getDay() + 6) % 7;
}

/**
 * The seven dots of the current week.
 *
 * `future` is never `missed`: the reference app renders Thursday-to-Sunday in
 * the same grey as a skipped Monday, so one slip looks like five failures.
 */
export function weekStates(activeDays: ReadonlySet<number>, todayIndex: number): DayState[] {
  return Array.from({ length: 7 }, (_, i) => {
    if (activeDays.has(i)) return 'done';
    if (i === todayIndex) return 'today';
    return i < todayIndex ? 'missed' : 'future';
  });
}

/**
 * Consecutive days met, counting back from today.
 *
 * Today not being done yet does not break the streak — it has not been missed
 * until the day ends. Counting it as a break is the single most demoralising
 * thing a streak can do, and it is wrong.
 */
export function currentStreak(activeKeys: ReadonlySet<string>, now: number): number {
  const DAY = 86_400_000;
  let streak = 0;
  let cursor = now;
  if (!activeKeys.has(dayKey(cursor))) cursor -= DAY; // today is still open
  while (activeKeys.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}
