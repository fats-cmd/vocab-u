import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { allTopics, type TopicWithCount } from '@/data/corpusRepo';
import { shelfCounts } from '@/data/userRepo';

/**
 * The topic catalogue.
 *
 * Structure follows the reference app, which gets the taxonomy genuinely right:
 * personal shelf first, then domain topics, then exam, origin and language cuts.
 * Three things it lacks are fixed here:
 *
 *  - every card shows its word count, so browsing has some idea of size;
 *  - every shelf row shows how full it is;
 *  - every section carries a scope line, because "Languages -> Spanish words"
 *    does not say whether it means loanwords or Spanish vocabulary.
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
  const t = useTheme();
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [shelf, setShelf] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      setTopics(await allTopics());
      setShelf(await shelfCounts());
    })();
  }, []);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.space.gutter, gap: t.space.xl }}>
        <Text variant="display2" display>
          Explore
        </Text>

        {/* Your material before theirs. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.md }}>
          <ShelfCard label="Favourites" count={shelf.favourite ?? 0} />
          <ShelfCard label="Collections" count={shelf.bookmark ?? 0} />
          <ShelfCard label="Your own words" count={shelf.own ?? 0} />
          <ShelfCard label="History" count={shelf.history ?? 0} />
        </View>

        {SECTION_ORDER.filter((s) => grouped.has(s)).map((section) => (
          <View key={section} style={{ gap: t.space.md }}>
            <View style={{ gap: t.space.xs }}>
              <Text variant="headline" display>
                {SECTION_TITLES[section] ?? section}
              </Text>
              <Text variant="caption" tone="muted">
                {SECTION_SCOPE[section] ?? ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.md }}>
              {(grouped.get(section) ?? []).map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShelfCard({ label, count }: { label: string; count: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} words`}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: '45%',
        padding: t.space.lg,
        borderRadius: t.radius.md,
        gap: t.space.xs,
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface1,
      })}
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
 * The label size comes from the ramp by `size`, not from the grid it happens to
 * sit in — the reference app's 3-up cards silently use smaller type than its
 * 2-up cards.
 */
function TopicCard({ topic }: { topic: TopicWithCount }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}, ${topic.wordCount} words. ${topic.scope}`}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: '45%',
        minHeight: 96,
        padding: t.space.lg,
        borderRadius: t.radius.md,
        justifyContent: 'flex-end',
        gap: t.space.xs,
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface1,
      })}
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
