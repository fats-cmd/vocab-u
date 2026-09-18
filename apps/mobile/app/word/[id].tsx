import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { CardState, type WordEntry } from '@vocab-u/core';
import { Text } from '@/design/components';
import { entryById } from '@/data/corpusRepo';
import { getCard, markSeen, savedAmong, toggleSaved } from '@/data/userRepo';
import { ScreenHeader } from '@/features/words/ScreenHeader';

export default function WordScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wordId = Number(id);

  const [entry, setEntry] = useState<WordEntry | null>(null);
  const [favourite, setFavourite] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [card, setCard] = useState<{ state: number; due: number; reps: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const loaded = await entryById(wordId);
      setEntry(loaded);
      if (!loaded) return;
      await markSeen(wordId, Date.now());
      const [fav, mark] = await Promise.all([
        savedAmong([wordId], 'favourite'),
        savedAmong([wordId], 'bookmark'),
      ]);
      setFavourite(fav.has(wordId));
      setBookmarked(mark.has(wordId));
      const c = await getCard(wordId, Date.now());
      setCard({ state: c.state, due: c.due, reps: c.reps });
    })();
  }, [wordId]);

  if (!entry) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-bg">
        <Text variant="body" tone="secondary" center>
          Loading…
        </Text>
      </SafeAreaView>
    );
  }

  const { word, sense, examples, synonyms } = entry;

  /**
   * The OS share sheet, not a grid of hardcoded networks.
   *
   * The reference app bundles Instagram, Facebook and WhatsApp SDKs and offers
   * nothing else — no Telegram, no Signal, no email. This costs nothing, needs
   * no SDK, carries no tracking, and offers exactly the apps the person has.
   */
  const share = () =>
    void Share.share({
      message: `${word.lemma} — (${word.pos}.) ${sense.gloss}${
        examples[0] ? `\n\n“${examples[0].text}”` : ''
      }`,
    });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title="" onBack={() => router.back()} />

      <ScrollView contentContainerClassName="gap-xl p-gutter">
        <View className="items-center gap-sm">
          <Text variant="display1" display center>
            {word.lemma}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pronounce ${word.lemma}`}
            onPress={() => Speech.speak(word.lemma, { language: 'en-US' })}
            className="min-h-tap justify-center"
          >
            <Text variant="body" tone="secondary">
              {word.ipa ?? ''} 🔊
            </Text>
          </Pressable>

          <Text variant="headline" tone="secondary" center>
            ({word.pos}.) {sense.gloss}
          </Text>

          <View className="flex-row gap-sm">
            <Chip label={word.cefr} />
            {word.freqRank ? <Chip label={`#${word.freqRank} most common`} /> : <Chip label="rare" />}
          </View>
        </View>

        <View className="flex-row justify-center gap-xl">
          <Action
            glyph={favourite ? '♥' : '♡'}
            label="Favourite"
            active={favourite}
            onPress={async () => setFavourite(await toggleSaved(wordId, 'favourite', Date.now()))}
          />
          <Action
            glyph={bookmarked ? '◼' : '◻'}
            label="Collection"
            active={bookmarked}
            onPress={async () => setBookmarked(await toggleSaved(wordId, 'bookmark', Date.now()))}
          />
          <Action glyph="↗" label="Share" active={false} onPress={share} />
        </View>

        {examples.length > 0 ? (
          <Section title="Examples">
            {examples.map((example, i) => (
              <View key={example.id} className="flex-row gap-md">
                <Text variant="body" tone="muted">
                  {i + 1}.
                </Text>
                <Text variant="body" className="flex-1">
                  {example.text}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {synonyms.length > 0 ? (
          <Section title="Synonyms">
            <View className="flex-row flex-wrap gap-sm">
              {synonyms.map((s) => (
                <Chip key={s} label={s} />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Your own history with this word. The reference app never shows it. */}
        <Section title="Your progress">
          {card === null || card.state === CardState.New ? (
            <Text variant="body" tone="secondary">
              You have not been tested on this word yet.
            </Text>
          ) : (
            <Text variant="body" tone="secondary">
              Seen in {card.reps} question{card.reps === 1 ? '' : 's'}. Next review{' '}
              {formatDue(card.due)}.
            </Text>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDue(due: number): string {
  const days = Math.round((due - Date.now()) / 86_400_000);
  if (days <= 0) return 'now';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  return `in ${Math.round(days / 30)} months`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-md">
      <Text variant="label" tone="muted">
        {title.toUpperCase()}
      </Text>
      <View className="gap-md rounded-lg bg-surface-1 p-lg">{children}</View>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View className="rounded-pill bg-surface-3 px-md py-xs">
      <Text variant="caption">{label}</Text>
    </View>
  );
}

/** Labelled, because an unlabelled icon rail is a guessing game. */
function Action({
  glyph,
  label,
  active,
  onPress,
}: {
  glyph: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-tap min-w-tap items-center gap-xs"
    >
      <Text variant="title" tone={active ? 'accent' : 'secondary'}>
        {glyph}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}
