import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CEFR_LABEL, bandProgress, currentStreak } from '@vocab-u/core';
import { Button, Text } from '@/design/components';
import { activeDayKeys, dueCount, shelfCounts } from '@/data/userRepo';
import { useLearner } from '@/features/progress/learnerStore';

/**
 * Progress — a place the reference app has no equivalent of.
 *
 * It measures a level and then never shows accumulation anywhere: not on topic
 * cards, not on the shelf, not after a run. This screen is where the review
 * queue, the streak and the level all become visible in one place.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const { difficulty, cefr, takenAt, lastScore, load } = useLearner();
  const [due, setDue] = useState(0);
  const [streak, setStreak] = useState(0);
  const [shelf, setShelf] = useState<Record<string, number>>({});

  // Refetch on focus, not just on mount: coming back from the level test or a
  // practice round must show the new numbers, and this screen is where someone
  // looks precisely *because* they just finished something.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const now = Date.now();
        await load();
        setDue(await dueCount(now));
        setStreak(currentStreak(await activeDayKeys(), now));
        setShelf(await shelfCounts());
      })();
    }, [load]),
  );

  const band = bandProgress(difficulty);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-xl p-gutter">
        <Text variant="display2" display>
          Progress
        </Text>

        {/* Level. At the top band there is no "points to next level" — there is
            no next level, and claiming otherwise is the reference app's bug. */}
        <View className="gap-md rounded-lg bg-surface-1 p-xl">
          <Text variant="label" tone="muted">
            YOUR LEVEL
          </Text>
          <Text variant="display2" display>
            {CEFR_LABEL[cefr]}
          </Text>

          {band.atCeiling ? (
            <Text variant="body" tone="secondary">
              Top band reached. You are {Math.round(band.progress * 100)}% of the way through the
              hardest words in the corpus.
            </Text>
          ) : (
            <Text variant="body" tone="secondary">
              {Math.round(band.progress * 100)}% of the way to {CEFR_LABEL[band.next!]}
            </Text>
          )}

          {takenAt === null ? (
            <Text variant="caption" tone="muted">
              Not measured yet — questions are drawn from the middle of the range until you take
              the test.
            </Text>
          ) : lastScore ? (
            <Text variant="caption" tone="muted">
              Last test: {lastScore.correct} of {lastScore.items} correct
            </Text>
          ) : null}

          <Button
            label={takenAt === null ? 'Take the level test' : 'Retake the level test'}
            kind="secondary"
            onPress={() => router.push('/level-test')}
          />
        </View>

        <View className="flex-row gap-md">
          <Metric label="Day streak" value={String(streak)} />
          <Metric label="Due now" value={String(due)} tone={due > 0 ? 'accent' : 'muted'} />
          <Metric label="Words seen" value={String(shelf.history ?? 0)} />
        </View>

        <View className="gap-md">
          <Text variant="label" tone="muted">
            SAVED
          </Text>
          <View className="flex-row gap-md">
            <Metric label="Favourites" value={String(shelf.favourite ?? 0)} />
            <Metric label="Collections" value={String(shelf.bookmark ?? 0)} />
            <Metric label="Your words" value={String(shelf.own ?? 0)} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'accent' | 'muted';
}) {
  return (
    <View className="flex-1 items-center gap-xs rounded-md bg-surface-1 p-lg">
      <Text variant="title" display tone={tone}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" center>
        {label}
      </Text>
    </View>
  );
}
