import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ARCADE_MODES, MODES, type ModeId } from '@vocab-u/core';
import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { useLearner } from '@/features/progress/learnerStore';
import { dueCount, personalBest } from '@/data/userRepo';

/**
 * The practice hub.
 *
 * Every tile states its own rules and its own mechanic. The reference app's
 * Sprint / Rush / Perfection are pure flavour — you cannot tell which is timed
 * without opening each one — and no tile anywhere shows a personal best to play
 * against. Both come straight off the `Mode` config, so they cannot drift.
 */
export default function PracticeScreen() {
  const t = useTheme();
  const router = useRouter();
  const label = useLearner((s) => s.label);
  const [due, setDue] = useState(0);
  const [bests, setBests] = useState<Partial<Record<ModeId, number | null>>>({});

  useEffect(() => {
    void (async () => {
      setDue(await dueCount(Date.now()));
      const entries = await Promise.all(
        [...ARCADE_MODES, 'review' as const].map(async (m) => [m, await personalBest(m)] as const),
      );
      setBests(Object.fromEntries(entries));
    })();
  }, []);

  const open = (mode: ModeId) => router.push(`/play/${mode}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.space.gutter, gap: t.space.xl }}>
        <View style={{ gap: t.space.xs }}>
          <Text variant="display2" display>
            Practice
          </Text>
          <Text variant="body" tone="secondary">
            Questions are drawn at your level — {label}
          </Text>
        </View>

        {/* Review first: it is the only mode that knows what you are forgetting. */}
        <ModeCard
          mode={MODES.review}
          badge={due > 0 ? `${due} due` : 'Nothing due'}
          best={bests.review ?? null}
          bestUnit="%"
          disabled={due === 0}
          onPress={() => open('review')}
        />

        <View style={{ gap: t.space.md }}>
          <Text variant="label" tone="muted">
            ARCADE
          </Text>
          {ARCADE_MODES.map((id) => (
            <ModeCard
              key={id}
              mode={MODES[id]}
              best={bests[id] ?? null}
              bestUnit=" correct"
              onPress={() => open(id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard({
  mode,
  badge,
  best,
  bestUnit,
  disabled = false,
  onPress,
}: {
  mode: (typeof MODES)[ModeId];
  badge?: string;
  best: number | null;
  bestUnit: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mode.label}. ${mode.tagline}`}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface1,
        borderRadius: t.radius.lg,
        padding: t.space.lg,
        gap: t.space.sm,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Text variant="headline" display style={{ flex: 1 }}>
          {mode.label}
        </Text>
        {badge ? (
          <Text variant="caption" tone="accent" bold>
            {badge}
          </Text>
        ) : null}
      </View>

      {/* The mechanic, on the tile. No need to open the mode to learn the rules. */}
      <Text variant="body" tone="secondary">
        {mode.tagline}
      </Text>

      <View style={{ flexDirection: 'row', gap: t.space.md, marginTop: t.space.xs }}>
        {mode.rules.map((rule) => (
          <Text key={rule} variant="caption" tone="muted" style={{ flex: 1 }}>
            {rule}
          </Text>
        ))}
      </View>

      {best !== null ? (
        <Text variant="caption" tone="accent">
          Your best: {best}
          {bestUnit}
        </Text>
      ) : null}
    </Pressable>
  );
}
