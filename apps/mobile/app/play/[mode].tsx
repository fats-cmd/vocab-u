import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MODES, type ModeId, currentItem, timeRemainingMs } from '@vocab-u/core';
import { Button, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { useSession } from '@/features/practice/sessionStore';
import { useLearner } from '@/features/progress/learnerStore';
import { MIN_TAP } from '@/design/tokens';

export default function PlayScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode: string }>();
  const modeId = (params.mode ?? 'sprint') as ModeId;
  const mode = MODES[modeId] ?? MODES.sprint;

  const difficulty = useLearner((s) => s.difficulty);
  const { state, summary, loading, error, start, answer, tick } = useSession();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start(modeId, difficulty);
    // Deliberately no cleanup here. This screen unmounts as it hands over to the
    // results screen, and resetting on unmount wiped the summary the results
    // screen exists to show — the run ended and the learner was told there was
    // "No round to summarise". The session is cleared when a new round starts
    // and when the learner leaves the results screen.
  }, [modeId, difficulty, start]);

  // Timed modes end on their own; the reducer decides, this only supplies `now`.
  useEffect(() => {
    if (mode.timeLimitMs === null) return;
    const handle = setInterval(tick, 250);
    return () => clearInterval(handle);
  }, [mode.timeLimitMs, tick]);

  useEffect(() => {
    if (summary) router.replace('/play/results');
  }, [summary, router]);

  if (loading || (!state && !error)) {
    return (
      <Screen>
        <Text variant="body" tone="secondary" center>
          Building your round…
        </Text>
      </Screen>
    );
  }

  if (error || !state) {
    return (
      <Screen>
        <View style={{ gap: t.space.lg, paddingHorizontal: t.space.gutter }}>
          <Text variant="title" display center>
            Not enough words yet
          </Text>
          <Text variant="body" tone="secondary" center>
            {error ?? 'Something went wrong building this round.'}
          </Text>
          <Button label="Back" kind="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const item = currentItem(state);
  if (!item) return <Screen />;

  const remaining = timeRemainingMs(state, Date.now());
  const answered = state.answers.length;

  const onChoose = (index: number) => {
    void Haptics.selectionAsync();
    void answer(index);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      {/* Status bar: progress carries a number, not just a bar. */}
      <View style={[styles.status, { padding: t.space.gutter, gap: t.space.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quit round"
          onPress={() => router.back()}
          hitSlop={12}
          style={{ minWidth: MIN_TAP, minHeight: MIN_TAP, justifyContent: 'center' }}
        >
          <Text variant="headline">✕</Text>
        </Pressable>

        <Text variant="label" tone="secondary">
          {answered + 1}
          {mode.deckSize ? ` / ${state.items.length}` : ''}
        </Text>

        {state.livesLeft !== null ? (
          <Text variant="label" tone={state.livesLeft <= 1 ? 'danger' : 'secondary'}>
            {'♥'.repeat(Math.max(0, state.livesLeft))}
          </Text>
        ) : null}

        {remaining !== null ? (
          <Text variant="label" tone={remaining < 10_000 ? 'danger' : 'secondary'} bold>
            {Math.ceil(remaining / 1000)}s
          </Text>
        ) : null}
      </View>

      {/* Prompt and options share the height; no dead third of the screen. */}
      <View style={[styles.prompt, { paddingHorizontal: t.space.gutter }]}>
        <View
          style={{
            backgroundColor: t.colors.surface1,
            borderRadius: t.radius.lg,
            padding: t.space.xl,
            width: '100%',
            gap: t.space.sm,
          }}
        >
          <Text variant="caption" tone="muted">
            {promptLabel(item.type)}
          </Text>
          <Text variant="title" display>
            {item.prompt}
          </Text>
          {item.hint ? (
            <Text variant="label" tone="secondary">
              {item.hint}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.options, { paddingHorizontal: t.space.gutter, gap: t.space.md }]}>
        {item.options.map((option, index) => (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={option}
            onPress={() => onChoose(index)}
            style={({ pressed }) => ({
              minHeight: MIN_TAP + 12,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: t.space.lg,
              borderRadius: t.radius.md,
              // Elevation is a surface step, never a shadow: a black drop shadow
              // on a dark background reads as a smudge.
              backgroundColor: pressed ? t.colors.surface3 : t.colors.surface2,
            })}
          >
            <Text variant="body" bold center>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function promptLabel(type: string): string {
  switch (type) {
    case 'guess-word':
      return 'Which word means this?';
    case 'meaning-match':
      return 'What does this mean?';
    case 'fill-gap':
      return 'Fill the gap';
    case 'match-synonym':
      return 'Pick the closest synonym';
    default:
      return '';
  }
}

function Screen({ children }: { children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.colors.bg, justifyContent: 'center' }}
      edges={['top', 'bottom']}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center' },
  prompt: { flex: 4, justifyContent: 'center', alignItems: 'center' },
  options: { flex: 5, justifyContent: 'center' },
});
