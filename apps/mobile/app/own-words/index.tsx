import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, EmptyState, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { MIN_TAP } from '@/design/tokens';
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
  const t = useTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.md,
          paddingHorizontal: t.space.gutter,
          paddingVertical: t.space.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={{ minWidth: MIN_TAP, minHeight: MIN_TAP, justifyContent: 'center' }}
        >
          <Text variant="headline">←</Text>
        </Pressable>
        <Text variant="headline" display style={{ flex: 1 }}>
          Your own words
        </Text>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: t.space.gutter, gap: t.space.sm }}
        ListHeaderComponent={
          <Text variant="caption" tone="muted" style={{ paddingBottom: t.space.md }}>
            {words.length} word{words.length === 1 ? '' : 's'} · stored only on this device
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.lemma}. ${item.gloss}. Long press to delete.`}
            onLongPress={() => remove(item)}
            style={{
              backgroundColor: t.colors.surface1,
              borderRadius: t.radius.md,
              padding: t.space.lg,
              gap: t.space.xs,
            }}
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

      <View style={{ padding: t.space.gutter }}>
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

  const field = {
    backgroundColor: t.colors.surface1,
    borderRadius: t.radius.md,
    padding: t.space.lg,
    minHeight: MIN_TAP,
    color: t.colors.textPrimary,
    fontSize: t.type.body.fontSize,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: t.space.gutter, gap: t.space.lg }}>
        <Text variant="title" display>
          Add a word
        </Text>

        <View style={{ gap: t.space.sm }}>
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
            style={field}
            accessibilityLabel="Word"
          />
        </View>

        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="secondary">
            What it means
          </Text>
          <TextInput
            value={gloss}
            onChangeText={setGloss}
            placeholder="The smell of rain on dry earth"
            placeholderTextColor={t.colors.textMuted}
            style={field}
            accessibilityLabel="What it means"
          />
        </View>

        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="secondary">
            Note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Where you ran into it"
            placeholderTextColor={t.colors.textMuted}
            style={field}
            accessibilityLabel="Note"
          />
        </View>

        <Text variant="caption" tone="muted">
          Saved on this device only. Nothing is uploaded.
        </Text>
      </View>

      <View style={{ padding: t.space.gutter, gap: t.space.md }}>
        <Button label="Save" onPress={() => void save()} disabled={!canSave} loading={saving} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}
