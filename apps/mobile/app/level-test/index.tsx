import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CEFR_LABEL, CEFR_ORDER, DEFAULT_TEST_CONFIG, type Cefr } from '@vocab-u/core';
import { Button, CenteredScreen, Text } from '@/design/components';
import { useLevelTest } from '@/features/level/levelTestStore';
import { useLearner } from '@/features/progress/learnerStore';

export default function LevelTestScreen() {
  const { phase, loadPrevious, reset } = useLevelTest();

  useEffect(() => {
    void loadPrevious();
    return () => reset();
  }, [loadPrevious, reset]);

  if (phase === 'intro') return <Intro />;
  if (phase === 'asking') return <Asking />;
  return <Result />;
}

/* ---------------------------------------------------------------- intro -- */

function Intro() {
  const router = useRouter();
  const { previous, begin, loading, error } = useLevelTest();

  const { minItems, maxItems } = DEFAULT_TEST_CONFIG;

  return (
    <CenteredScreen
      art={
        <Text variant="display1" display tone="accent">
          ◎
        </Text>
      }
      action={
        <Button
          label={previous ? 'Retake the test' : 'Start the test'}
          onPress={() => void begin()}
          loading={loading}
        />
      }
      secondaryAction={<Button label="Not now" kind="ghost" onPress={() => router.back()} />}
    >
      <View className="w-full gap-lg">
        <Text variant="title" display center>
          Vocabulary level test
        </Text>

        {previous ? (
          <View className="flex-row gap-md">
            <Tile label="Last score" value={`${previous.correct}/${previous.items}`} />
            <Tile label="Current level" value={CEFR_LABEL[previous.cefr as Cefr] ?? previous.cefr} />
          </View>
        ) : null}

        <View className="gap-sm">
          <Bullet text="Finds your level by asking what you are least sure about" />
          <Bullet text={`Adapts as you go — usually ${minItems}–${maxItems} questions, 2–3 minutes`} />
          <Bullet text="Sets the difficulty of every question the app asks you afterwards" />
        </View>

        {error ? (
          <Text variant="label" tone="danger" center>
            {error}
          </Text>
        ) : null}
      </View>
    </CenteredScreen>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row gap-md">
      <Text variant="body" tone="accent">
        •
      </Text>
      <Text variant="body" tone="secondary" className="flex-1">
        {text}
      </Text>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-xs rounded-md bg-surface-1 p-lg">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="headline" display>
        {value}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- asking -- */

function Asking() {
  const router = useRouter();
  const { test, item, answer, loading } = useLevelTest();

  if (!test || !item) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-bg">
        <Text variant="body" tone="secondary" center>
          Choosing your next question…
        </Text>
      </SafeAreaView>
    );
  }

  const asked = test.responses.length;
  const { minItems, maxItems } = test.config;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-lg p-gutter">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave the test"
          onPress={() => router.back()}
          hitSlop={12}
          className="min-h-tap min-w-tap justify-center"
        >
          <Text variant="headline">✕</Text>
        </Pressable>

        <View className="flex-1 gap-xs">
          {/* An adaptive test has no fixed length, so showing "5 / 30" would be a
              lie. It shows the question number and the range it is working in. */}
          <Text variant="label" tone="secondary">
            Question {asked + 1}
          </Text>
          <View className="h-[4px] overflow-hidden rounded-sm bg-surface-2">
            <View
              className="h-full bg-accent"
              style={{ width: `${Math.min(100, (asked / maxItems) * 100)}%` }}
            />
          </View>
          <Text variant="caption" tone="muted">
            {asked < minItems
              ? `at least ${minItems - asked} more`
              : 'finishing as soon as the result is confident'}
          </Text>
        </View>
      </View>

      <View className="flex-[4] justify-center px-gutter">
        <View className="gap-sm rounded-lg bg-surface-1 p-xl">
          <Text variant="caption" tone="muted">
            {item.type === 'guess-word' ? 'Which word means this?' : 'What does this mean?'}
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
            disabled={loading}
            onPress={() => {
              void Haptics.selectionAsync();
              void answer(index);
            }}
            className={`min-h-[60px] items-center justify-center rounded-md bg-surface-2 px-lg active:bg-surface-3 ${
              loading ? 'opacity-50' : ''
            }`}
          >
            <Text variant="body" bold center>
              {option}
            </Text>
          </Pressable>
        ))}

        {/* No feedback per question, deliberately: telling someone they were
            wrong mid-test changes how they answer the rest of it. */}
      </View>
    </SafeAreaView>
  );
}

/* --------------------------------------------------------------- result -- */

function Result() {
  const router = useRouter();
  const { result, reset } = useLevelTest();
  const setFromTheta = useLearner((s) => s.setFromTheta);
  const reloadLearner = useLearner((s) => s.load);

  useEffect(() => {
    if (result) {
      setFromTheta(result.theta);
      void reloadLearner();
    }
  }, [result, setFromTheta, reloadLearner]);

  if (!result) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-xl p-gutter">
        <View className="mt-xl gap-sm">
          <Text variant="label" tone="muted" center>
            YOUR VOCABULARY LEVEL
          </Text>
          <Text variant="display1" display center>
            {CEFR_LABEL[result.cefr]}
          </Text>

          {/*
            The fix for the reference app's headline bug. It told a learner at the
            top of its ladder "Points to next level: 0" and "Keep learning to
            level up soon!" — a promise it had no way to keep. At the ceiling
            there is no next band, so the screen says something true instead.
          */}
          {result.atCeiling ? (
            <Text variant="body" tone="secondary" center>
              That is the top band. You are {Math.round(result.bandProgress * 100)}% of the way
              through the hardest words in the corpus — there is no level above this one.
            </Text>
          ) : (
            <Text variant="body" tone="secondary" center>
              {Math.round(result.bandProgress * 100)}% of the way to{' '}
              {CEFR_LABEL[result.nextBand!]}
            </Text>
          )}
        </View>

        <Ladder current={result.cefr} />

        <View className="flex-row gap-md">
          <Tile label="Correct" value={`${result.correct}/${result.itemsAsked}`} />
          <Tile label="Questions used" value={String(result.itemsAsked)} />
        </View>

        <Text variant="caption" tone="muted" center>
          Every question the app asks you from now on is drawn from this level.
        </Text>
      </ScrollView>

      <View className="gap-md p-gutter">
        <Button
          label="Start practising"
          onPress={() => {
            reset();
            router.replace('/(tabs)/practice');
          }}
        />
        <Button
          label="Done"
          kind="ghost"
          onPress={() => {
            reset();
            router.replace('/(tabs)/progress');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/** The band ladder, hardest at the top, matching how levels are usually drawn. */
function Ladder({ current }: { current: Cefr }) {
  const bands = [...CEFR_ORDER].reverse();

  return (
    <View className="gap-sm">
      {bands.map((band) => {
        const active = band === current;
        return (
          <View
            key={band}
            className={`flex-row items-center gap-md rounded-md p-md ${
              active ? 'bg-surface-2' : ''
            }`}
          >
            <View
              className={`h-[12px] w-[12px] rounded-full ${
                active ? 'bg-accent' : 'bg-surface-3'
              }`}
            />
            <Text variant="body" bold={active} tone={active ? 'primary' : 'muted'}>
              {CEFR_LABEL[band]}
            </Text>
            {active ? (
              <Text variant="caption" tone="accent" bold>
                YOU
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
