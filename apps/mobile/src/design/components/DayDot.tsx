import { View } from 'react-native';
import type { DayState } from '@vocab-u/core';
import { Text } from './Text';

// Day-state semantics live in @vocab-u/core, not here: which day counts as
// missed is a rule, not a colour. This file only draws the result.
export type { DayState };

/**
 * `future` is not `missed`.
 *
 * The reference app renders the rest of the week in the same grey as a skipped
 * Monday, so one slip looks like five failures. These four states are visually
 * distinct, and a token test asserts it.
 */
const FILL: Record<DayState, string> = {
  done: 'bg-day-done',
  missed: 'bg-day-missed',
  today: 'border-2 border-day-today',
  future: 'bg-day-future',
};

export function DayDot({ label, state }: { label: string; state: DayState }) {
  return (
    <View className="items-center gap-xs">
      <Text variant="caption" tone={state === 'future' ? 'muted' : 'secondary'}>
        {label}
      </Text>
      <View
        accessibilityLabel={`${label}: ${state}`}
        className={`h-[28px] w-[28px] items-center justify-center rounded-full ${FILL[state]}`}
      >
        {state === 'done' ? (
          <Text variant="caption" bold tone="inverse">
            ✓
          </Text>
        ) : null}
      </View>
    </View>
  );
}
