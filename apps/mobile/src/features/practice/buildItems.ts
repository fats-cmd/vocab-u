/**
 * Turns corpus rows into game questions.
 *
 * The only place that joins the data layer to the item generators. Note that it
 * asks for more entries than it needs and tolerates generators returning null:
 * a generator that cannot build a *good* question returns nothing, and padding
 * the round with a bad question is worse than a shorter round.
 */

import {
  GENERATORS,
  type GameItem,
  type GameType,
  type Rng,
  makeRng,
  shuffle,
} from '@vocab-u/core';
import {
  distractorPool,
  entriesNearDifficulty,
  glossesFor,
  synonymIdsFor,
  topicIdsFor,
} from '@/data/corpusRepo';

export interface BuildOptions {
  /** The learner's measured ability, 0..1. Items are drawn from this band. */
  difficulty: number;
  /** Half-width of the band. Widened automatically if the corpus is thin. */
  band?: number;
  count: number;
  types: GameType[];
  optionCount: number;
  seed?: number;
  excludeWordIds?: number[];
}

/**
 * Widening steps. A narrow band gives well-targeted questions; if the corpus
 * cannot fill a round at that width we widen rather than serve the learner
 * something far outside their level — which is precisely the failure mode of
 * asking an advanced learner to define *annual*.
 */
const BANDS = [0.08, 0.15, 0.25, 0.4, 1];

export async function buildItems(options: BuildOptions): Promise<GameItem[]> {
  const rng: Rng = makeRng(options.seed ?? Date.now());
  const wanted = options.count;
  const collected: GameItem[] = [];
  const used = new Set<number>(options.excludeWordIds ?? []);

  for (const band of BANDS) {
    if (collected.length >= wanted) break;
    if (options.band !== undefined && band < options.band) continue;

    const entries = await entriesNearDifficulty(
      options.difficulty,
      band,
      (wanted - collected.length) * 3,
      [...used],
    );

    for (const entry of entries) {
      if (collected.length >= wanted) break;
      if (used.has(entry.word.id)) continue;

      const [pool, synonymIds, fields] = await Promise.all([
        distractorPool(entry.word.pos, entry.word.difficulty, entry.word.id),
        synonymIdsFor(entry.word.id),
        topicIdsFor(entry.word.id),
      ]);

      const glossMap = await glossesFor(pool.map((p) => p.word.id));
      const input = {
        entry,
        pool,
        synonymIds,
        fields,
        optionCount: options.optionCount,
        rng,
      };

      // Try the requested game types in a random order, and take the first that
      // the corpus can actually support for this word.
      for (const type of shuffle(options.types, rng)) {
        const item = GENERATORS[type](input, (id) => glossMap.get(id) ?? null);
        if (item) {
          collected.push(item);
          used.add(entry.word.id);
          break;
        }
      }
    }
  }

  return collected;
}
