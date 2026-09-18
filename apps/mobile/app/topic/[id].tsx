import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, Text } from '@/design/components';
import { entriesInTopic, topicById, type TopicWithCount } from '@/data/corpusRepo';
import { useWordList } from '@/features/words/useWordList';
import { WordListRow } from '@/features/words/WordListRow';
import { ScreenHeader } from '@/features/words/ScreenHeader';

export default function TopicScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topicId = Number(id);

  const [topic, setTopic] = useState<TopicWithCount | null>(null);
  const load = useCallback(() => entriesInTopic(topicId), [topicId]);
  const { entries, saved, cardStates, loading, toggle } = useWordList(load);

  useEffect(() => {
    void (async () => setTopic(await topicById(topicId)))();
  }, [topicId]);

  const studied = entries.filter((e) => (cardStates.get(e.word.id) ?? 0) > 0).length;

  if (!loading && entries.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        body="This topic has no words in the current corpus. Adding some is a good first contribution."
        action={{ label: 'Back to Explore', onPress: () => router.back() }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title={topic?.title ?? 'Topic'} onBack={() => router.back()} />

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.word.id)}
        contentContainerClassName="gap-sm p-gutter"
        ListHeaderComponent={
          <View className="gap-sm pb-lg">
            {topic ? (
              <Text variant="body" tone="secondary">
                {topic.scope}
              </Text>
            ) : null}
            {/* Progress on the list itself, not only in the feed. */}
            <Text variant="caption" tone="muted">
              {studied} of {entries.length} started
            </Text>
          </View>
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

      <View className="p-gutter">
        <Button label="Practise this topic" onPress={() => router.push('/(tabs)/practice')} />
      </View>
    </SafeAreaView>
  );
}
