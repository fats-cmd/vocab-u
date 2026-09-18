import { useCallback, useEffect, useState } from 'react';
import { Dimensions, FlatList, Pressable, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import type { WordEntry } from '@vocab-u/core';
import { currentStreak, dayKey, weekStates, weekdayIndex } from '@vocab-u/core';
import { DayDot, Text } from '@/design/components';
import { entriesNearDifficulty } from '@/data/corpusRepo';
import { activeDayKeys, markSeen, savedIds, toggleSaved } from '@/data/userRepo';
import { useLearner } from '@/features/progress/learnerStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The feed — the root of the app, as in the reference.
 *
 * Words are drawn from the learner's measured band rather than at random, and
 * every card is marked seen so the catalogue and Progress have something to
 * show. There is no photography behind the text yet: rather than ship white type
 * on bare images, the feed uses surface tokens until CC0 art lands, at which
 * point `PhotoBackdrop` supplies the mandatory scrim.
 */
export default function FeedScreen() {
  const difficulty = useLearner((s) => s.difficulty);
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [favourites, setFavourites] = useState<Set<number>>(new Set());
  const [week, setWeek] = useState<ReturnType<typeof weekStates>>([]);
  const [streak, setStreak] = useState(0);

  const { height } = Dimensions.get('window');

  useEffect(() => {
    void (async () => {
      setEntries(await entriesNearDifficulty(difficulty, 0.2, 30));
      setFavourites(new Set(await savedIds('favourite')));
      const keys = await activeDayKeys();
      const now = Date.now();
      setStreak(currentStreak(keys, now));
      const todayIndex = weekdayIndex(now);
      const active = new Set<number>();
      for (let i = 0; i <= todayIndex; i += 1) {
        const at = now - (todayIndex - i) * 86_400_000;
        // dayKey() is local-midnight; toISOString() would be UTC and would put
        // the streak on the wrong day either side of midnight in most timezones.
        if (keys.has(dayKey(at))) active.add(i);
      }
      setWeek(weekStates(active, todayIndex));
    })();
  }, [difficulty]);

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as WordEntry | undefined;
    if (first) void markSeen(first.word.id, Date.now());
  }, []);

  const onFavourite = async (wordId: number) => {
    const nowSaved = await toggleSaved(wordId, 'favourite', Date.now());
    setFavourites((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(wordId);
      else next.delete(wordId);
      return next;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Streak strip. Future days are visibly not missed days. */}
      <View className="flex-row items-center gap-sm px-gutter pb-md">
        <Text variant="headline" display tone="accent">
          {streak}
        </Text>
        <View className="flex-1 flex-row justify-between">
          {week.map((state, i) => (
            <DayDot key={DAYS[i]} label={DAYS[i]!} state={state} />
          ))}
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.word.id)}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <WordCard
            entry={item}
            height={height * 0.72}
            favourite={favourites.has(item.word.id)}
            onFavourite={() => void onFavourite(item.word.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function WordCard({
  entry,
  height,
  favourite,
  onFavourite,
}: {
  entry: WordEntry;
  height: number;
  favourite: boolean;
  onFavourite: () => void;
}) {
  const { word, sense, examples, synonyms } = entry;

  return (
    <View
      style={{ height }}
      className="mx-gutter mb-lg justify-center gap-lg rounded-xl bg-surface-1 p-xl"
    >
      <View className="gap-sm">
        <Text variant="display1" display center>
          {word.lemma}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pronounce ${word.lemma}`}
          onPress={() => Speech.speak(word.lemma, { language: 'en-US' })}
          className="min-h-tap justify-center"
        >
          <Text variant="label" tone="secondary" center>
            {word.ipa ?? ''} 🔊
          </Text>
        </Pressable>

        <Text variant="headline" tone="secondary" center>
          ({word.pos}.) {sense.gloss}
        </Text>
      </View>

      {examples[0] ? (
        <Text variant="body" tone="muted" center>
          “{examples[0].text}”
        </Text>
      ) : null}

      {synonyms.length > 0 ? (
        <View className="flex-row justify-center gap-sm">
          {synonyms.map((s) => (
            <View key={s} className="rounded-pill bg-surface-3 px-md py-xs">
              <Text variant="caption">{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row justify-center gap-xl">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favourite ? 'Remove from favourites' : 'Add to favourites'}
          accessibilityState={{ selected: favourite }}
          onPress={onFavourite}
          className="min-h-tap min-w-tap items-center justify-center"
        >
          <Text variant="title" tone={favourite ? 'accent' : 'muted'}>
            {favourite ? '♥' : '♡'}
          </Text>
        </Pressable>
        <View className="items-center justify-center">
          <Text variant="caption" tone="muted">
            {word.cefr}
          </Text>
        </View>
      </View>
    </View>
  );
}
