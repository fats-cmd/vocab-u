import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';

// Day-state semantics live in @vocab-u/core, not here: which day counts as
// missed is a rule, not a colour. This file only draws the result.
import type { DayState } from '@vocab-u/core';

export function DayDot({ label, state }: { label: string; state: DayState }) {
  const t = useTheme();
  const fill: Record<DayState, string> = {
    done: t.colors.dayDone,
    missed: t.colors.dayMissed,
    today: 'transparent',
    future: t.colors.dayFuture,
  };

  return (
    <View style={{ alignItems: 'center', gap: t.space.xs }}>
      <Text variant="caption" tone={state === 'future' ? 'muted' : 'secondary'}>
        {label}
      </Text>
      <View
        accessibilityLabel={`${label}: ${state}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: fill[state],
          borderWidth: state === 'today' ? 2 : 0,
          borderColor: t.colors.dayToday,
          alignItems: 'center',
          justifyContent: 'center',
        }}
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

export type { DayState };
