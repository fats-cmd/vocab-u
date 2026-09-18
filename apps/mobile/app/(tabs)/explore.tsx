import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '@/design/components';
import { allTopics, type TopicWithCount } from '@/data/corpusRepo';
import { shelfCounts } from '@/data/userRepo';

/**
 * The topic catalogue.
 *
 * Structure follows the reference app, which gets the taxonomy genuinely right:
 * personal shelf first, then domain topics, then exam, origin and language cuts.
 * Three things it lacks are fixed here — every card shows its word count, every
 * shelf row shows how full it is, and every section carries a scope line,
 * because "Languages -> Spanish words" does not say whether it means loanwords
 * or Spanish vocabulary.
 */
const SECTION_TITLES: Record<string, string> = {
  'about-us': 'About ourselves',
  world: 'The world around us',
  domain: 'Fields and professions',
  test: 'By test',
  origin: 'By origin',
  language: 'Languages',
};

const SECTION_SCOPE: Record<string, string> = {
  'about-us': 'Words for people, feelings and bodies',
  world: 'Words for places, work and the natural world',
  domain: 'Vocabulary particular to a field',
  test: 'Words that recur on standardised tests',
  origin: 'English words grouped by the language they came from',
  language: 'Foreign words now used in everyday English',
};

const SECTION_ORDER = ['about-us', 'world', 'domain', 'test', 'origin', 'language'];

export default function ExploreScreen() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [shelf, setShelf] = useState<Record<string, number>>({});

  // Counts change whenever a word is saved elsewhere, so refresh on focus.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setTopics(await allTopics());
        setShelf(await shelfCounts());
      })();
    }, []),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TopicWithCount[]>();
    for (const topic of topics) {
      const list = map.get(topic.section) ?? [];
      list.push(topic);
      map.set(topic.section, list);
    }
    return map;
  }, [topics]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-xl p-gutter">
        <Text variant="display2" display>
          Explore
        </Text>

        {/* Your material before theirs. */}
        <View className="flex-row flex-wrap gap-md">
          <ShelfCard
            label="Favourites"
            count={shelf.favourite ?? 0}
            onPress={() => router.push('/list/favourites')}
          />
          <ShelfCard
            label="Collections"
            count={shelf.bookmark ?? 0}
            onPress={() => router.push('/list/collections')}
          />
          <ShelfCard
            label="Your own words"
            count={shelf.own ?? 0}
            onPress={() => router.push('/own-words')}
          />
          <ShelfCard
            label="History"
            count={shelf.history ?? 0}
            onPress={() => router.push('/list/history')}
          />
        </View>

        {SECTION_ORDER.filter((s) => grouped.has(s)).map((section) => (
          <View key={section} className="gap-md">
            <View className="gap-xs">
              <Text variant="headline" display>
                {SECTION_TITLES[section] ?? section}
              </Text>
              <Text variant="caption" tone="muted">
                {SECTION_SCOPE[section] ?? ''}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-md">
              {(grouped.get(section) ?? []).map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onPress={() => router.push(`/topic/${topic.id}`)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShelfCard({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} words`}
      onPress={onPress}
      className="grow basis-[45%] gap-xs rounded-md bg-surface-1 p-lg active:bg-surface-2"
    >
      <Text variant="body" bold>
        {label}
      </Text>
      <Text variant="caption" tone={count === 0 ? 'muted' : 'accent'}>
        {count === 0 ? 'Empty' : `${count} word${count === 1 ? '' : 's'}`}
      </Text>
    </Pressable>
  );
}

/**
 * The label size comes from the ramp, not from the grid it happens to sit in —
 * the reference app's 3-up cards silently use smaller type than its 2-up cards.
 */
function TopicCard({ topic, onPress }: { topic: TopicWithCount; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}, ${topic.wordCount} words. ${topic.scope}`}
      onPress={onPress}
      className="min-h-[96px] grow basis-[45%] justify-end gap-xs rounded-md bg-surface-1 p-lg active:bg-surface-2"
    >
      <Text variant="body" bold>
        {topic.title}
      </Text>
      <Text variant="caption" tone="muted">
        {topic.wordCount} word{topic.wordCount === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}
