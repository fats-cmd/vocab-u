import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { type AnswerRecord, endHeadline } from '@vocab-u/core';
import { Button, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { useSession } from '@/features/practice/sessionStore';
import { useLearner } from '@/features/progress/learnerStore';

/**
 * Run summary.
 *
 * Three fixes from the reference app's equivalent, all structural:
 *  1. One headline, derived from the single end condition. It printed "Lives are
 *     up!" above "10/13 questions in 60s" — two endings at once.
 *  2. correct / missed / attempted, not a fraction whose denominator is itself a
 *     performance variable and so cannot be compared across runs.
 *  3. Play again as the primary action. Its only button was "See results", so
 *     every replay took a detour through the review list.
 */
export default function ResultsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { summary, start, reset } = useSession();
  // Replay draws from the same measured band as the original round.
  const difficulty = useLearner((s) => s.difficulty);

  if (!summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg, justifyContent: 'center' }}>
        <Text variant="body" tone="secondary" center>
          No round to summarise.
        </Text>
      </SafeAreaView>
    );
  }

  const { mode, endReason, correct, missed, attempted, accuracy, isPersonalBest, previousBest } =
    summary;

  const playAgain = async () => {
    reset();
    await start(mode.id, difficulty);
    router.replace(`/play/${mode.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.space.gutter, gap: t.space.xl }}>
        <View style={{ gap: t.space.sm, marginTop: t.space.xl }}>
          <Text variant="display2" display center>
            {endHeadline(mode, endReason)}
          </Text>
          {isPersonalBest ? (
            <Text variant="body" tone="accent" bold center>
              New personal best
            </Text>
          ) : previousBest !== null ? (
            <Text variant="body" tone="secondary" center>
              Your best is {previousBest}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: t.colors.surface1,
            borderRadius: t.radius.lg,
            padding: t.space.xl,
            gap: t.space.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Stat value={String(correct)} label="correct" tone="success" />
            <Stat value={String(missed)} label="missed" tone="danger" />
            <Stat value={String(attempted)} label="attempted" tone="secondary" />
          </View>
          <Text variant="label" tone="muted" center>
            {Math.round(accuracy * 100)}% accuracy
          </Text>
        </View>

        <View style={{ gap: t.space.md }}>
          <Text variant="label" tone="muted">
            {missed > 0 ? 'FIX THESE FIRST' : 'THIS ROUND'}
          </Text>
          {summary.answers.map((a, i) => (
            <View
              key={`${a.item.wordId}-${i}`}
              style={{
                flexDirection: 'row',
                gap: t.space.md,
                backgroundColor: t.colors.surface1,
                borderRadius: t.radius.md,
                padding: t.space.lg,
              }}
            >
              {/* Status carries a glyph as well as a colour. */}
              <Text variant="body" tone={a.correct ? 'success' : 'danger'} bold>
                {a.correct ? '✓' : '✕'}
              </Text>
              <View style={{ flex: 1, gap: t.space.xs }}>
                {/* Always lead with the word. For a meaning-match question the
                    correct option is a definition, so showing the option here
                    would headline the definition and bury the word. */}
                <Text variant="body" bold>
                  {a.item.lemma}
                </Text>
                <Text variant="caption" tone="secondary">
                  {captionFor(a.item)}
                </Text>
                {!a.correct && a.chosenIndex !== null ? (
                  <Text variant="caption" tone="muted">
                    You chose “{a.item.options[a.chosenIndex]}”
                  </Text>
                ) : null}
                {!a.correct && a.chosenIndex === null ? (
                  <Text variant="caption" tone="muted">
                    Ran out of time
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ padding: t.space.gutter, gap: t.space.md }}>
        <Button label="Play again" onPress={() => void playAgain()} />
        <Button
          label="Done"
          kind="ghost"
          onPress={() => {
            reset();
            router.replace('/(tabs)/practice');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * What to show under the headword, per question type.
 *
 * A synonym question's prompt *is* the headword, so using the prompt blindly
 * printed the word twice.
 */
function captionFor(item: AnswerRecord['item']): string {
  switch (item.type) {
    case 'meaning-match':
      return item.options[item.answerIndex] ?? '';
    case 'match-synonym':
      return `synonym: ${item.options[item.answerIndex] ?? ''}`;
    default:
      return item.prompt;
  }
}

function Stat({ value, label, tone }: { value: string; label: string; tone: 'success' | 'danger' | 'secondary' }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.space.xs }}>
      <Text variant="display2" display tone={tone}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
