# Vocab-U

A free, open-source vocabulary app. No account, no server, no tracking, no paywall,
no ads. It works on a plane.

> **Status: milestone 1–2.** The domain core, the corpus pipeline and a playable
> app are built and tested; the web build deploys. Still to come: the adaptive
> level test screen, topic drill-down, collections, your own words, share cards
> and CC0 artwork. See [the build order](docs/ARCHITECTURE.md#10-build-order).

## Why another vocabulary app

Because the good ones are closed, and the open ones are flashcard decks. This one
is modelled on the feature surface of a well-made commercial app — a followable
word feed with games attached — and then fixes the things that app gets wrong:

- **It knows how hard a word is.** Every word carries a continuous difficulty score
  derived at build time, and every question is drawn from your measured band. You
  will not be rated *Advanced* and then asked what *annual* means.
- **Playing is reviewing.** Answers feed an FSRS scheduler, so the games *are* the
  spaced-repetition system. There is no flashcard mode to remember to visit.
- **The level test adapts.** 12–18 questions instead of 30, for the same precision.
- **Questions are fair.** Distractors match the answer's part of speech, length and
  difficulty band; synonyms and inflections of the answer are excluded outright.
- **Content defects fail the build.** A transcription with no stress mark, a
  one-way synonym, an unreviewed generated example sentence — all CI failures.

## Getting started

Requires **Node 22+** and **pnpm 10+** (`corepack enable` gets you pnpm).

```bash
pnpm install
pnpm mobile      # Expo dev server: press w for web, a/i for a device
pnpm test        # 149 tests
```

The corpus is compiled from the datasets rather than committed, so a fresh clone
has no word database. You do not have to remember that: Metro builds it on the
first bundle, whichever platform you start. `pnpm bootstrap` does the same thing
up front if you would rather see it happen.

To produce the deployable web build:

```bash
pnpm --filter @vocab-u/mobile export:web   # -> apps/mobile/dist, a static PWA
```

The corpus build prints its own quality report and refuses to emit a database if
any validation rule fails. Try breaking one — change an IPA transcription in
`tools/corpus/data/seed/entries.json` to remove its `ˈ` — and watch it stop.

## Layout

| Path | What it is |
|---|---|
| `packages/core` | Pure TypeScript domain: scheduler, level test, item generation, session rules. No React, no React Native. Fully unit-tested. |
| `tools/corpus` | The dataset → `vocab.db` build pipeline, including the validation gate. |
| `apps/mobile` | The Expo app (iOS, Android and web from one codebase). |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Reference teardown](docs/REFERENCE_TEARDOWN.md) |

There is exactly **one** app, in `apps/mobile`. It builds for iOS, Android and web
from that single codebase, so a second Expo project anywhere in the tree is a
mistake rather than a second target. Everything is one pnpm workspace — the globs
in `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `tools/*`) are the whole of it,
and a directory outside them is invisible to `pnpm install` and to CI.

## CI and deployment

The workflows are in [`ci/workflows/`](ci/README.md) with a one-line command to
move them into `.github/workflows/`. They are parked there only because the token
that created this branch lacks GitHub's `workflow` scope.

Deployment is a static export to GitHub Pages — no server, no database, no bill.
Android builds produce an APK artifact per tag; F-Droid packaging and the iOS
build come in milestone 5.

## Contributing

Three ways in, in rough order of how easy they are to start:

1. **Content.** Add or correct words in `tools/corpus/data/seed/`. The validator
   tells you exactly what is wrong, so you cannot land a bad entry by accident.
   This is the highest-value contribution — content is the weak layer in every app
   in this category, including the ones people pay for.
2. **Core.** Anything in `packages/core` is a pure function with a test next to it.
   No simulator needed, no device, no emulator.
3. **App.** Screens, design system, platform work.

Three rules that keep the codebase contributable: **no SQL outside `src/data`**,
**no business rules inside components**, and **no literal colours or sizes in a
screen** — styling is NativeWind classes whose values come from
`apps/mobile/src/design/theme.json`, which is also what the WCAG contrast tests
assert against.

### Generated content policy

LLM assistance may *draft* example sentences into `tools/corpus/data/drafts/`. A
draft becomes shippable only through a pull request in which a human sets
`reviewed: true`. The build refuses to emit anything else. This exists because the
app we studied ships sentences like *"Liechtenstein is a quaint principality by
Alpine bounds"* — plausible, fluent, and not English.

## Licence

GPL-3.0-or-later for the code, CC BY-SA 4.0 for curated content and docs, and
source-inherited terms for the compiled corpus. Details and reasoning in
[LICENSE.md](LICENSE.md); per-source terms in
[tools/corpus/LICENSES.md](tools/corpus/LICENSES.md).
