import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ARCADE_MODES, MODES, type Mode, type ModeId } from '@vocab-u/core';
import { Text } from '@/design/components';
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-xl p-gutter">
        <View className="gap-xs">
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

        <View className="gap-md">
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
  mode: Mode;
  badge?: string;
  best: number | null;
  bestUnit: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mode.label}. ${mode.tagline}`}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      className={`gap-sm rounded-lg bg-surface-1 p-lg active:bg-surface-2 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row items-center gap-sm">
        <Text variant="headline" display className="flex-1">
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

      <View className="mt-xs flex-row gap-md">
        {mode.rules.map((rule) => (
          <Text key={rule} variant="caption" tone="muted" className="flex-1">
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
