import { useCallback } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, Text } from '@/design/components';
import { entriesByIds } from '@/data/corpusRepo';
import { savedIds, seenIds } from '@/data/userRepo';
import { useWordList } from '@/features/words/useWordList';
import { WordListRow } from '@/features/words/WordListRow';
import { ScreenHeader } from '@/features/words/ScreenHeader';

type ListKind = 'favourites' | 'collections' | 'history';

/**
 * The saved-material lists. One screen, three sources.
 *
 * Every empty state here routes somewhere that fills it — `EmptyState` requires
 * an action, so an empty list whose only affordance is a corner link cannot be
 * built.
 */
const CONFIG: Record<
  ListKind,
  { title: string; empty: string; body: string; cta: string; to: string; load: () => Promise<number[]> }
> = {
  favourites: {
    title: 'Favourites',
    empty: 'No favourites yet',
    body: 'Tap the heart on any word to keep it here.',
    cta: 'Browse the feed',
    to: '/(tabs)',
    load: () => savedIds('favourite'),
  },
  collections: {
    title: 'Collections',
    empty: 'Nothing saved yet',
    body: 'Bookmark a word to build a set you can practise on its own.',
    cta: 'Explore topics',
    to: '/(tabs)/explore',
    load: () => savedIds('bookmark'),
  },
  history: {
    title: 'History',
    empty: 'No history yet',
    body: 'Words you have seen show up here, most recent first.',
    cta: 'Browse the feed',
    to: '/(tabs)',
    load: () => seenIds(),
  },
};

export default function ListScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const config = CONFIG[(kind as ListKind) in CONFIG ? (kind as ListKind) : 'favourites'];

  const load = useCallback(async () => entriesByIds(await config.load()), [config]);
  const { entries, saved, cardStates, loading, toggle } = useWordList(load);

  if (!loading && entries.length === 0) {
    return (
      <EmptyState
        title={config.empty}
        body={config.body}
        action={{ label: config.cta, onPress: () => router.replace(config.to as never) }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title={config.title} onBack={() => router.back()} />
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.word.id)}
        contentContainerClassName="gap-sm p-gutter"
        ListHeaderComponent={
          <Text variant="caption" tone="muted" className="pb-md">
            {entries.length} word{entries.length === 1 ? '' : 's'}
          </Text>
        }
        renderItem={({ item }) => (
          <WordListRow
            entry={item}
            saved={saved.has(item.word.id)}
            cardState={cardStates.get(item.word.id)}
            onToggleSave={() => void toggle(item.word.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}
