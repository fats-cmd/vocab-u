import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, EmptyState, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { addOwnWord, deleteOwnWord, listOwnWords, type OwnWord } from '@/data/userRepo';

/**
 * Words the learner adds themselves.
 *
 * The reference app's version of this screen is the clearest single UX failure
 * in the whole set: an empty state whose only affordance is a 60px text link in
 * the top-right corner. An empty state exists to convert into first use, so here
 * the action is the largest thing on it — and `EmptyState` requires an action
 * prop, so the other version cannot be built.
 */
export default function OwnWordsScreen() {
  const router = useRouter();
  const [words, setWords] = useState<OwnWord[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setWords(await listOwnWords());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const remove = (word: OwnWord) =>
    Alert.alert('Delete this word?', `“${word.lemma}” will be removed from your own words.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteOwnWord(word.id).then(refresh),
      },
    ]);

  if (adding) {
    return <AddForm onDone={() => { setAdding(false); void refresh(); }} onCancel={() => setAdding(false)} />;
  }

  if (!loading && words.length === 0) {
    return (
      <EmptyState
        title="No words of your own yet"
        body="Add a word you keep forgetting. It stays on this device — nothing is uploaded, and no one else can see it."
        action={{ label: 'Add your first word', onPress: () => setAdding(true) }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center gap-md px-gutter py-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          className="min-h-tap min-w-tap justify-center"
        >
          <Text variant="headline">←</Text>
        </Pressable>
        <Text variant="headline" display className="flex-1">
          Your own words
        </Text>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="gap-sm p-gutter"
        ListHeaderComponent={
          <Text variant="caption" tone="muted" className="pb-md">
            {words.length} word{words.length === 1 ? '' : 's'} · stored only on this device
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.lemma}. ${item.gloss}. Long press to delete.`}
            onLongPress={() => remove(item)}
            className="gap-xs rounded-md bg-surface-1 p-lg"
          >
            <Text variant="body" bold>
              {item.lemma}
              {item.pos ? ` (${item.pos}.)` : ''}
            </Text>
            <Text variant="caption" tone="secondary">
              {item.gloss}
            </Text>
            {item.note ? (
              <Text variant="caption" tone="muted">
                {item.note}
              </Text>
            ) : null}
          </Pressable>
        )}
      />

      <View className="p-gutter">
        <Button label="Add a word" onPress={() => setAdding(true)} />
      </View>
    </SafeAreaView>
  );
}

function AddForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTheme();
  const [lemma, setLemma] = useState('');
  const [gloss, setGloss] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = lemma.trim().length > 0 && gloss.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await addOwnWord(lemma, gloss, null, note.trim() || null, Date.now());
    onDone();
  };

  // TextInput cannot take every style from a class (placeholder colour and the
  // text colour itself are props), so this one keeps the theme object.
  const field = 'min-h-tap rounded-md bg-surface-1 p-lg text-body text-ink';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-1 gap-lg p-gutter">
        <Text variant="title" display>
          Add a word
        </Text>

        <View className="gap-sm">
          <Text variant="label" tone="secondary">
            Word
          </Text>
          <TextInput
            value={lemma}
            onChangeText={setLemma}
            autoFocus
            autoCapitalize="none"
            placeholder="e.g. petrichor"
            placeholderTextColor={t.colors.textMuted}
            className={field}
            accessibilityLabel="Word"
          />
        </View>

        <View className="gap-sm">
          <Text variant="label" tone="secondary">
            What it means
          </Text>
          <TextInput
            value={gloss}
            onChangeText={setGloss}
            placeholder="The smell of rain on dry earth"
            placeholderTextColor={t.colors.textMuted}
            className={field}
            accessibilityLabel="What it means"
          />
        </View>

        <View className="gap-sm">
          <Text variant="label" tone="secondary">
            Note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Where you ran into it"
            placeholderTextColor={t.colors.textMuted}
            className={field}
            accessibilityLabel="Note"
          />
        </View>

        <Text variant="caption" tone="muted">
          Saved on this device only. Nothing is uploaded.
        </Text>
      </View>

      <View className="gap-md p-gutter">
        <Button label="Save" onPress={() => void save()} disabled={!canSave} loading={saving} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}
