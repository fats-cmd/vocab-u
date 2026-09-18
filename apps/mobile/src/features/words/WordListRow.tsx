import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CardState, type WordEntry } from '@vocab-u/core';
import { Text } from '@/design/components';

/**
 * One word in a list.
 *
 * Carries its study state, so a list is never just names — the reference app
 * shows no progress outside its feed, which makes every catalogue it has a place
 * with no memory of what you did there.
 */
export function WordListRow({
  entry,
  saved,
  cardState,
  onToggleSave,
}: {
  entry: WordEntry;
  saved: boolean;
  cardState: number | undefined;
  onToggleSave: () => void;
}) {
  const router = useRouter();
  const { word, sense } = entry;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${word.lemma}. ${sense.gloss}`}
      onPress={() => router.push(`/word/${word.id}`)}
      className="flex-row items-center gap-md rounded-md bg-surface-1 p-lg active:bg-surface-2"
    >
      <View className="flex-1 gap-xs">
        <View className="flex-row items-center gap-sm">
          <Text variant="body" bold>
            {word.lemma}
          </Text>
          <StudyBadge state={cardState} />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          ({word.pos}.) {sense.gloss}
        </Text>
      </View>

      <Text variant="caption" tone="muted">
        {word.cefr}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? `Remove ${word.lemma} from favourites` : `Save ${word.lemma}`}
        accessibilityState={{ selected: saved }}
        onPress={onToggleSave}
        hitSlop={8}
        className="min-h-tap min-w-tap items-center justify-center"
      >
        <Text variant="headline" tone={saved ? 'accent' : 'muted'}>
          {saved ? '♥' : '♡'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

/** Never colour alone: each state has its own word. */
function StudyBadge({ state }: { state: number | undefined }) {
  if (state === undefined || state === CardState.New) return null;

  const learned = state === CardState.Review;
  const label = learned ? 'learned' : state === CardState.Relearning ? 'relearning' : 'learning';

  return (
    <View className="rounded-pill bg-surface-3 px-sm py-[2px]">
      <Text variant="caption" tone={learned ? 'success' : 'accent'}>
        {label}
      </Text>
    </View>
  );
}
