import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { WordEntry } from '@vocab-u/core';
import { cardStatesFor, savedAmong, toggleSaved } from '@/data/userRepo';

/**
 * Loads a list of words together with their saved and study state.
 *
 * The state lookups are batched into one query each rather than one per row —
 * a topic with a hundred words would otherwise fire two hundred queries to
 * render a single screen.
 */
export function useWordList(load: () => Promise<WordEntry[]>) {
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [cardStates, setCardStates] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        const list = await load();
        if (cancelled) return;
        const ids = list.map((e) => e.word.id);
        const [savedIds, states] = await Promise.all([
          savedAmong(ids, 'favourite'),
          cardStatesFor(ids),
        ]);
        if (cancelled) return;
        setEntries(list);
        setSaved(savedIds);
        setCardStates(states);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const toggle = useCallback(async (wordId: number) => {
    const nowSaved = await toggleSaved(wordId, 'favourite', Date.now());
    setSaved((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(wordId);
      else next.delete(wordId);
      return next;
    });
  }, []);

  return { entries, saved, cardStates, loading, toggle };
}
