# Vocab-U — Architecture

A free, open-source, offline-first vocabulary app for the community. No account, no
server, no tracking, no paywall. Modelled on the feature surface of the Monkey Taps
"Vocabulary" app (see `docs/REFERENCE_TEARDOWN.md`), with the defects in that app
treated as the specification for what we do differently.

---

## 1. Product shape

The reference app looks like a quiz app but is actually **a followable content feed
with games attached**. We keep that shape, because it is the right one: the feed
supplies daily surface area and the games supply retention.

```
                 ┌──────────────────────────────────────────┐
                 │                  FEED                    │  root screen
                 │  full-bleed word cards, vertical swipe   │
                 │  streak header · save · share            │
                 └───────────────┬──────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        │                        │                         │
 ┌──────▼───────┐       ┌────────▼────────┐       ┌────────▼────────┐
 │   EXPLORE    │       │    PRACTICE     │       │    PROGRESS     │
 │ taxonomy +   │       │ 4 game types ×  │       │ level, streak,  │
 │ personal     │       │ 3 modes + SRS   │       │ mastery, review │
 │ shelf        │       │ review session  │       │ queue           │
 └──────────────┘       └─────────────────┘       └─────────────────┘
```

Four things the reference app does not have, which are the reason to build this:

| | Reference app | Vocab-U |
|---|---|---|
| Scheduling | none — random draw | **FSRS spaced repetition**, per word, offline |
| Difficulty | ignores your measured level | items drawn from your level band ±1 |
| Level test | 30 fixed items | **adaptive staircase**, 12–18 items, same precision |
| Distractors | unmatched (`inept` / `daintiest` / `annual`) | POS-, length- and frequency-matched, semantically near |
| Data | unedited generated text, stressless IPA | reproducible pipeline over open datasets + review gate |
| Cost | premium tier | free, forever, no server to pay for |

---

## 2. Decision record (summary)

| # | Decision | Why |
|---|---|---|
| 1 | **Expo / React Native / TypeScript** | one codebase → iOS + Android + web PWA; largest contributor pool; EAS gives free CI builds for OSS |
| 2 | **No backend in v1** | zero hosting cost is what makes "free for the community" survivable; also zero privacy surface, and the app works on a plane |
| 3 | **SQLite corpus, bundled, read-only** | 40k words with FTS in ~25 MB; instant queries; no network |
| 4 | **Progress is a document, not a database** | progress is small and has no joins worth the name; SQLite bought a migration system, a platform backend, and on web a store that silently dropped every write (see ADR below) |
| 5 | **Corpus built by a pipeline, not hand-maintained** | `tools/corpus` compiles open datasets into `vocab.db`; the data is reviewable as a diff, reproducible, and license-clean |
| 6 | **Pure-TS domain core, no RN imports** | scheduler, scoring, item generation and the level test are unit-testable in plain Node and reusable by any future client |
| 7 | **OS share sheet, not per-network SDKs** | free, no SDK bloat, no tracking pixels, respects installed apps |
| 8 | **CC0 / public-domain imagery only** | share cards are published by users; we cannot ship licensing landmines |

Full ADRs in `docs/adr/`.

---

## 3. Repository layout

```
vocab-u/
├── apps/
│   └── mobile/               Expo app (iOS · Android · web)
│       ├── app/              expo-router file routes
│       ├── src/
│       │   ├── design/       tokens, theme, primitives
│       │   ├── features/     feed · explore · practice · progress · settings
│       │   ├── data/         SQLite gateways (corpus + user)
│       │   └── services/     tts, share, haptics, notifications
│       └── assets/
├── packages/
│   └── core/                 pure TypeScript domain — NO react, NO react-native
│       ├── src/
│       │   ├── srs/          FSRS scheduler
│       │   ├── leveling/     adaptive test, CEFR banding
│       │   ├── items/        distractor selection, game item generation
│       │   ├── session/      game modes (sprint / rush / perfection)
│       │   └── schema/       shared types + SQL DDL (single source of truth)
│       └── tests/
├── tools/
│   └── corpus/               dataset → vocab.db build pipeline
│       ├── src/stages/       fetch · normalise · enrich · band · validate · emit
│       └── data/             seed + curated overrides (human-reviewed)
├── docs/
└── .github/workflows/
```

`packages/core` importing anything from `react-native` is a CI failure. That boundary
is what keeps the rules of the app testable without a simulator.

---

## 4. Data architecture

Two databases. This separation is the most important structural decision in the app.

### 4.1 `vocab.db` — corpus (read-only, bundled, versioned)

Read-only is not incidental — it is what lets the same file work on every
platform, including web, where it is fetched and deserialised into memory.

It is a build artifact, never committed: a checked-in database could carry
content that never passed the validation gate, which would make the gate
decorative. `apps/mobile/scripts/ensure-corpus.cjs` builds it from Metro's config
on the first bundle, so clone-install-run works on every platform with no
separate step to remember.


Shipped as an asset, opened read-only, replaced wholesale on content updates.

```sql
CREATE TABLE word (
  id           INTEGER PRIMARY KEY,
  lemma        TEXT NOT NULL,
  pos          TEXT NOT NULL,          -- n | v | adj | adv
  ipa          TEXT,                   -- single dialect, stress marks REQUIRED
  syllables    TEXT,
  freq_rank    INTEGER,                -- from open frequency list; NULL = rare
  cefr         TEXT,                   -- A1..C2, derived, see §4.3
  difficulty   REAL NOT NULL,          -- 0..1, continuous, used for matching
  UNIQUE(lemma, pos)
);

CREATE TABLE sense (
  id           INTEGER PRIMARY KEY,
  word_id      INTEGER NOT NULL REFERENCES word(id),
  ord          INTEGER NOT NULL,       -- 0 = primary
  gloss        TEXT NOT NULL,          -- ONE register, plain-language, <= 90 chars
  register     TEXT                    -- formal | informal | technical | archaic
);

CREATE TABLE example (
  id           INTEGER PRIMARY KEY,
  sense_id     INTEGER NOT NULL REFERENCES sense(id),
  text         TEXT NOT NULL,
  source       TEXT NOT NULL,          -- corpus id | 'curated'  (NEVER unreviewed AI)
  reviewed     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE relation (                -- synonym / antonym / root-of
  from_word_id INTEGER NOT NULL REFERENCES word(id),
  to_word_id   INTEGER NOT NULL REFERENCES word(id),
  kind         TEXT NOT NULL,
  strength     REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE topic (
  id       INTEGER PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  title    TEXT NOT NULL,
  section  TEXT NOT NULL,              -- about-us | world | test | origin | language
  ord      INTEGER NOT NULL
);
CREATE TABLE topic_word (topic_id INTEGER, word_id INTEGER, PRIMARY KEY(topic_id, word_id));

CREATE VIRTUAL TABLE word_fts USING fts5(lemma, gloss, content='');
```

Every row in `example` carries `reviewed`. **Unreviewed generated text never reaches a
user.** That flag is the answer to "Liechtenstein is a quaint principality by Alpine
bounds."

### 4.2 The user document — progress (read-write, local, never overwritten)

Progress is **not** a database. It is one JSON document, held in memory and
persisted on change:

```ts
interface UserState {
  version: number;
  cards:       Record<wordId, Card>;        // FSRS state per word
  reviewLog:   ReviewLogEntry[];            // append-only, capped at 5000
  saved:       { favourite: …; bookmark: … };
  seen:        Record<wordId, { firstAt; count }>;
  collections: Collection[];
  ownWords:    OwnWord[];
  days:        Record<dayKey, { reviews; seconds }>;
  levels:      StoredLevel[];
  kv:          Record<string, string>;      // personal bests, settings
  nextId:      number;
}
```

Stored as `user-state.json` in the documents directory on native, and in
IndexedDB on web.

**Why not SQLite.** It was SQLite first, and that was wrong twice over. The small
reason: this data has no joins worth the name, so SQL bought a migration system
and a schema for no query it actually needed. The large reason: **expo-sqlite has
no writable path on web at all.** Verified in a browser, not assumed —

- opening a database by name uses OPFS, which throws `xFileControl` / `xLock`
  and loses every write;
- opening a second database silently shadows the first, so the corpus's own
  tables vanish with `no such table: word`;
- `CREATE TABLE` against a deserialised database does not take effect, so
  migrations cannot run there either.

The symptom was the worst kind: the app looked fine and quietly discarded
everything the learner did.

As a document it is one shape on every platform, needs no migrations beyond a
version check, and — the reason it lives in `packages/core` — every rule about it
is a pure function with a test beside it. `reviveUserState` never throws: a
corrupt file costs someone their history, never their app.

**The separation still holds, and matters as much as before.** A corpus update
ships a new `vocab.db` and cannot touch `user-state.json`.

### 4.3 Difficulty and CEFR banding

`difficulty ∈ [0,1]` is derived at build time and is the number every selection
decision uses. CEFR is a *label over bands of it*, for display only.

```
difficulty = 0.65·rarity(freq_rank)        -- rarer   → harder
           + 0.25·morph_complexity          -- syllables and length
           + 0.10·register_penalty          -- archaic/technical → harder
           − 0.10·polysemy_discount         -- many senses → met more often
```

`rarity` is log2 over rank, anchored at rank 250 and 160 000, so it rises steeply
at the common end. A plain `log(rank)/log(max)` puts a rank-900 word at the middle
of the scale, which is exactly how an advanced learner ends up being asked to
define *annual*.

Polysemy is a **discount, not a penalty**. One sense *in our corpus* is not
evidence that a word is monosemous in English — usually it just means we have not
imported the others yet, so a single-sense entry sits at neutral rather than at
maximum difficulty. Getting this backwards compresses the whole corpus into two
bands.

Implementation and calibration tests: `tools/corpus/src/stages/enrich.ts`.

This is the fix for the reference app's worst product bug — being rated *Advanced* and
then served *annual*. Item selection is `|item.difficulty − learner.theta| < ε`, always.

---

## 5. Domain core (`packages/core`)

### 5.1 Scheduler — FSRS

FSRS v4 over SM-2: better retention per review, and it is free-software with published
weights. Interface:

```ts
schedule(card: Card, rating: Rating, now: number, params?: FsrsParams): Card
dueQueue(cards: Card[], now: number, limit: number): Card[]
```

Ratings map onto game outcomes so that *playing is reviewing* — a correct fast answer
is `Good`, a correct slow answer is `Hard`, a miss is `Again`. There is no separate
"flashcard mode" the user must remember to visit; the games are the review system.

### 5.2 Distractor selection — the quality fix

Given a target sense, a good distractor is close enough to be tempting and far enough
to be wrong. Candidates are scored and the top-k sampled:

```
score = 1.0·same_pos            (hard requirement, not a weight)
      + 0.8·difficulty_proximity
      + 0.6·length_proximity
      + 0.5·shares_semantic_field
      − 1.0·is_synonym_of_target      (would make two answers correct)
      − 0.7·is_inflection_of_target   (kills "daintiest" as an option)
```

`is_synonym_of_target` as a hard negative matters: without it, a generator will
eventually produce a question with two right answers.

### 5.3 Adaptive level test

Staircase over `difficulty`, with a Rasch-style ability estimate:

1. start at `theta` = last result, or 0.5 for a new user
2. present the item nearest `theta` not yet seen
3. update `theta` by `±k/√n` on correct/incorrect
4. stop when `SE(theta) < 0.18` or 18 items, floor of 12

12–18 items instead of 30, and — unlike the reference app — the result screen branches
on the top band: at C2 there is no "points to next level", there is "top band reached,
here is your mastery percentage instead".

### 5.4 Game modes

Modes are a config object, not a code path. This is what lets the practice hub show
the rules without opening each mode:

```ts
type Mode = {
  id: 'sprint' | 'rush' | 'perfection' | 'review';
  timeLimitMs: number | null;
  lives: number | null;
  endsOn: 'time' | 'lives' | 'deck';   // ← single, unambiguous end condition
  label: string; rules: string[];
};
```

`endsOn` is the fix for "Lives are up! / 10/13 questions in 60s" — a run has exactly
one reason it ended, and the summary screen renders from it.

---

## 6. App architecture (`apps/mobile`)

```
UI (screens)
   │ hooks
Feature stores  ── zustand, one per feature, no global god-store
   │
Repositories    ── data/corpusRepo.ts · data/userRepo.ts   (the ONLY SQL in the app)
   │
SQLite (expo-sqlite)     +     packages/core (pure functions, no I/O)
```

Rules that keep it contributable:

- **No SQL outside `src/data`.** Screens call repositories. All corpus SQL is in
  `corpusRepo`; all progress access is in `userRepo`, which owns the only mutable
  copy of the user document and is the only place that persists it.
- **No business rules in components.** Scoring, scheduling and selection live in `core`.
- **Every screen renders from a store**, so screens are testable with a seeded store.
- **Design tokens only** — no literal colours or pixel values in feature code.
  Styling is NativeWind classes (`bg-surface-1`, `p-lg`, `rounded-pill`), and the
  values behind them come from `src/design/theme.json` — the same file
  `useTheme()` reads. `global.css` is generated from it, and CI fails if that
  file is stale, so a class and a style object cannot disagree about what
  `surface-1` means. `useTheme()` remains for the cases a class cannot reach:
  React Navigation options, `placeholderTextColor`, and animated values.

### 6.1 Navigation

`expo-router`, tabs at root:

```
app/
  (tabs)/index.tsx        Feed          ← root, matches the reference app's shape
  (tabs)/explore.tsx      Explore
  (tabs)/practice.tsx     Practice hub
  (tabs)/progress.tsx     Progress        ← new: the reference app has no such place
  word/[id].tsx           Word detail sheet
  play/[mode].tsx         Game session
  play/results.tsx        Session summary
  level-test/index.tsx    Adaptive test
  settings/*
```

Four tabs, all labelled. The reference app's three-target nav with two unlabelled icons
buries Favorites, Collections, History and Own words inside Explore; we give saved
material its own home under Progress and label every destination.

---

## 7. Design system — the fixes, encoded

The teardown produced a list of visual defects. Each becomes a token or a primitive so
it cannot recur:

| Defect in reference | Encoded fix |
|---|---|
| light-mode art on dark screens | illustrations are **theme-aware SVG** with `currentColor` fills; no raster art in chrome |
| text on photos with no scrim | `<PhotoBackdrop>` primitive **always** renders a bottom-up gradient scrim; there is no way to place text on a photo without it |
| headword dims when the sheet opens | scrim is applied to the photo layer only; the headword sits above it |
| three typefaces | two roles: `display` (serif) and `text` (sans). One ramp, 7 steps |
| type scale changes with grid density | `<TopicCard>` takes `size`, and the label ramp is fixed per size |
| card bg barely separates from page bg | `surface` tokens are spaced ≥ 6% luminance apart and contrast-checked in CI |
| missed vs future streak days identical | `DayDot` has four states: `done · missed · today · future`, each visually distinct |
| empty state with no CTA | `<EmptyState>` **requires** an `action` prop |
| ~⅓ of each full screen dead | `<CenteredScreen>` distributes art/copy/CTA on a 3-part grid |
| black shadows on dark bg | elevation is a surface-lightness step, never a drop shadow, in dark theme |

Contrast is a test, not a review comment: `packages/core` ships a WCAG contrast
assertion and CI fails on any token pair below 4.5:1 for body text.

---

## 8. Content pipeline (`tools/corpus`)

```
 fetch ──► normalise ──► enrich ──► band ──► validate ──► emit
   │           │            │         │          │          │
 open      one lemma+POS   IPA     difficulty  REJECTS   vocab.db
 datasets  per row, one    stress   + CEFR     bad rows  + checksum
           dialect         marks               loudly    + LICENSES.md
```

Sources (all permissively licensed, all recorded in `LICENSES.md` with their terms):

- **Open English WordNet** — senses, synonyms, antonyms, POS
- **CMUdict → IPA** — pronunciation with stress, single dialect (GA)
- **Open frequency lists** (e.g. SUBTLEX-derived / wordfreq) — `freq_rank`
- **Curated overrides** in `tools/corpus/data/overrides/` — human-written glosses and
  examples that beat the dataset, applied last, tracked in git

The `validate` stage is a gate, not a report. It fails the build on:

- IPA missing a primary stress mark, or mixing dialect markers (`ɜːr` + `tjuː`)
- a gloss over 90 chars, or in a different register band than its siblings
- a synonym pair that is not mutually reachable
- an example that does not contain an inflection of its headword
- any `example.reviewed = 0` reaching the emit stage

Those five rules are precisely the reference app's content defects, turned into CI.

**Generated content policy:** LLM assistance is allowed to *draft* example sentences
into `data/drafts/`. A draft becomes shippable only through a PR where a human sets
`reviewed = 1`. The build refuses to emit anything else.

---

## 9. Free-forever operations

| Concern | Answer |
|---|---|
| Hosting | none — there is no server |
| Android | GitHub Actions → unsigned APK artifact per tag; **F-Droid** via reproducible build metadata; Play Store optional |
| iOS | EAS free tier build; TestFlight; App Store listing is the one unavoidable $99/yr, community-funded or skipped |
| Web | `expo export -p web` → static PWA on GitHub Pages, zero cost, installable, offline via service worker |
| Updates | content ships as a new `vocab.db` in an app release; `user.db` untouched |
| Analytics | none. No SDK, no crash reporter phoning home by default |
| i18n | strings in `apps/mobile/src/i18n/*.json`, community-translatable; the corpus is English-target from day one but the UI is not |

### Licensing

- Code: **GPL-3.0-or-later** — keeps forks open, F-Droid-friendly
- Corpus build output: inherits source dataset terms, enumerated per-source in
  `LICENSES.md`
- Curated content and docs: **CC BY-SA 4.0**
- Imagery: **CC0 / public domain only**, because users publish share cards

---

## 10. Build order

**M1 — spine.** Workspace, design tokens, corpus schema, pipeline emitting a seed DB,
feed screen reading real words, save/favourite. *Shippable as a word-a-day app.*

**M2 — practice.** Four item generators, three modes, session runner, results screen,
FSRS wired so playing schedules. *Shippable as a trainer.*

**M3 — measure.** Adaptive level test, progress tab, streak with correct day states,
review queue.

**M4 — breadth.** Explore taxonomy incl. etymology roots, collections, own words,
search, share cards, TTS.

**M5 — community.** i18n, F-Droid metadata, contributor docs, corpus contribution
workflow, optional sync behind the interface reserved in M1.
