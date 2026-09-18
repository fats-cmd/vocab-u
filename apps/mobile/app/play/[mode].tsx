import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MODES, type ModeId, currentItem, timeRemainingMs } from '@vocab-u/core';
import { Button, Text } from '@/design/components';
import { useSession } from '@/features/practice/sessionStore';
import { useLearner } from '@/features/progress/learnerStore';

export default function PlayScreen() {
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
      <SafeAreaView className="flex-1 justify-center bg-bg">
        <Text variant="body" tone="secondary" center>
          Building your round…
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !state) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-bg">
        <View className="gap-lg px-gutter">
          <Text variant="title" display center>
            Not enough words yet
          </Text>
          <Text variant="body" tone="secondary" center>
            {error ?? 'Something went wrong building this round.'}
          </Text>
          <Button label="Back" kind="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const item = currentItem(state);
  if (!item) return <SafeAreaView className="flex-1 bg-bg" />;

  const remaining = timeRemainingMs(state, Date.now());
  const answered = state.answers.length;
  const lowTime = remaining !== null && remaining < 10_000;

  const onChoose = (index: number) => {
    void Haptics.selectionAsync();
    void answer(index);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      {/* Status bar: progress carries a number, not just a bar. */}
      <View className="flex-row items-center gap-lg p-gutter">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quit round"
          onPress={() => router.back()}
          hitSlop={12}
          className="min-h-tap min-w-tap justify-center"
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
          <Text variant="label" tone={lowTime ? 'danger' : 'secondary'} bold>
            {Math.ceil(remaining / 1000)}s
          </Text>
        ) : null}
      </View>

      {/* Prompt and options share the height; no dead third of the screen. */}
      <View className="flex-[4] items-center justify-center px-gutter">
        <View className="w-full gap-sm rounded-lg bg-surface-1 p-xl">
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

      <View className="flex-[5] justify-center gap-md px-gutter">
        {item.options.map((option, index) => (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={option}
            onPress={() => onChoose(index)}
            // Elevation is a surface step, never a shadow: a black drop shadow on
            // a dark background reads as a smudge.
            className="min-h-[60px] items-center justify-center rounded-md bg-surface-2 px-lg active:bg-surface-3"
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
