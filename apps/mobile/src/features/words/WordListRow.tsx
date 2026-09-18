import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CardState, type WordEntry } from '@vocab-u/core';
import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { MIN_TAP } from '@/design/tokens';

/**
 * One word in a list.
 *
 * Carries its study state, so a list is never just names — the reference app
 * shows no progress anywhere outside its feed, which makes every catalogue it
 * has a place with no memory of what you did there.
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
  const t = useTheme();
  const router = useRouter();
  const { word, sense } = entry;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${word.lemma}. ${sense.gloss}`}
      onPress={() => router.push(`/word/${word.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        padding: t.space.lg,
        borderRadius: t.radius.md,
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface1,
      })}
    >
      <View style={{ flex: 1, gap: t.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
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
        style={{ minWidth: MIN_TAP, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}
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
  const t = useTheme();
  if (state === undefined || state === CardState.New) return null;

  const label =
    state === CardState.Review ? 'learned' : state === CardState.Relearning ? 'relearning' : 'learning';
  const tone = state === CardState.Review ? 'success' : 'warning';

  return (
    <View
      style={{
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        backgroundColor: t.colors.surface3,
      }}
    >
      <Text variant="caption" tone={tone === 'success' ? 'success' : 'accent'}>
        {label}
      </Text>
    </View>
  );
}
