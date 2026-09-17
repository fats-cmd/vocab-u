# Reference teardown — Monkey Taps "Vocabulary"

Analysis of 18 screenshots of the reference app, used as the source of requirements for
Vocab-U. Kept in the repo because each defect below maps to a decision in
`ARCHITECTURE.md`; when a contributor asks "why is it built this way", the answer is
usually here.

Nothing in this document is a criticism of shipping software — the app is well made and
its information architecture is better than most of the category. It is a list of the
specific places where a free, open alternative can be better.

## What the reference app gets right (and we keep)

1. **The feed is the root.** Full-bleed word cards on a vertical swipe, not a quiz menu.
   Daily surface area with near-zero friction.
2. **Topic taxonomy on four orthogonal axes** — domain, exam, etymology, source
   language. The **etymology axis** (Latin / Greek / Germanic / French roots) is the
   standout: morphological families give the best return per word learned, and almost
   nothing else in the category ships it.
3. **A personal shelf above the catalogue** — Favorites, Collections, Your own words,
   History. Your material before their material.
4. **Rules shown before a game starts**, with an honest time estimate.
5. **Muted content as a first-class setting** — ship broad, give people a mute.
6. **Word detail as a drag-up sheet** over the card: examples with the headword bolded,
   synonyms as chips.
7. **Share as a rendered image with a watermark** — the acquisition loop.

## Defects, by class

### A. Content data (the weakest layer)

| | Evidence | Our fix |
|---|---|---|
| A1 | `ɪn.tə.mət` for *intimate* — no stress mark at all | pipeline `validate` rejects IPA without primary stress |
| A2 | `ɪnˈsɜːrtɪˌtjuːd`, `ˈnegəˌtrɒn` — rhotic and non-rhotic markers in one transcription | single dialect (GA) enforced at build |
| A3 | "Liechtenstein is a quaint principality by Alpine bounds" — unedited generated text | `example.reviewed` gate; build refuses unreviewed rows |
| A4 | synonyms `duchy, realm` for *principality* — a duchy is ruled by a duke | relation strength + mutual-reachability check |
| A5 | two definition registers in one corpus (dictionary prose vs hand-simplified) | one register, ≤ 90 char gloss, enforced |
| A6 | distractors `inept` / `daintiest` / `annual` — unmatched POS and morphology | scored distractor selection, inflections hard-excluded |

### B. Product logic

| | Evidence | Our fix |
|---|---|---|
| B1 | rated *Advanced*, then served "Happens once every year → annual" | selection banded on measured ability, always |
| B2 | "Points to next level: 0" while at the top level, with "Keep learning to level up soon!" | result screen branches on top band |
| B3 | "Lives are up!" above "10/13 questions in 60s" — two end conditions | `Mode.endsOn` is single-valued; summary renders from it |
| B4 | `10/13` where 13 is itself a performance variable | report `correct · missed · attempted`, not a fraction |
| B5 | no "Play again" on a run summary — only "See results" | retry is the primary action on arcade modes |
| B6 | no personal best or comparison anywhere | best-per-mode stored in `kv`, shown before and after |
| B7 | no spaced repetition at all | FSRS, with games as the review surface |
| B8 | 30 fixed test items | adaptive staircase, 12–18 |
| B9 | progress exists in the feed (`0/5`) but on no topic card, shelf row or level screen | progress is a property of the data model, surfaced everywhere |
| B10 | mode names (Sprint / Rush / Perfection) carry no mechanic | rules render from the `Mode` config on the hub, not only in the intro |

### C. Interface

| | Evidence | Our fix |
|---|---|---|
| C1 | light-mode raster art on every dark screen; cream fields glare | theme-aware SVG, `currentColor` |
| C2 | white text on photos with no scrim | `<PhotoBackdrop>` cannot be used without one |
| C3 | headword dims with the background when the detail sheet opens | scrim applies to the photo layer only |
| C4 | streak strip renders future days identically to missed days | `DayDot` states: done / missed / today / future |
| C5 | empty state's only action is a 60px text link in the corner | `<EmptyState>` requires an `action` prop |
| C6 | ~⅓ dead space on mode intro, game over, empty state, gameplay | `<CenteredScreen>` 3-part grid |
| C7 | three typefaces (serif, sans, rounded script) | two roles, one ramp |
| C8 | type scale changes with grid density (2-up vs 3-up cards) | fixed ramp per card `size` |
| C9 | card surface barely separates from page surface | tokens spaced ≥ 6% luminance, CI-checked |
| C10 | black drop shadows on dark backgrounds read as smudges | elevation = surface lightness step |
| C11 | icon system mixes filled-with-outline and flat | one icon set, one weight |
| C12 | pencil icon for a multiple-choice ("guess") mode; pill-shaped "lives" with a `+` that contradicts "3 lives total" | icons chosen from mechanic, not flavour |
| C13 | `Share` row missing its chevron amid identical rows | list rows derive affordance from `kind` |
| C14 | two "Start" affordances on the mode intro | one primary action per screen |
| C15 | nav labels only the centre of three targets | all destinations labelled |

### D. Taxonomy

| | Evidence | Our fix |
|---|---|---|
| D1 | `French root` and `French words` share Eiffel-Tower art despite meaning different things (English words of French origin vs French loanwords) | distinct art per topic; `origin` and `language` sections visually differentiated |
| D2 | `Latin root` / `Greek root` near-identical classical-temple motifs | as above |
| D3 | `Business` under "The world around us" while `Office language` sits elsewhere | one topic, one home; overlaps merged |
| D4 | `Languages → Spanish words` scope undefined (loanwords? Spanish vocab?) | section subtitles state scope |
| D5 | no word counts on any topic card | counts and progress on every card |

### E. Privacy, licensing, platform

| | Evidence | Our fix |
|---|---|---|
| E1 | share sheet hardcodes Instagram / Facebook / WhatsApp SDK targets | OS share sheet |
| E2 | content moderation actions (Dislike, Report) mixed into the share destination grid | feedback lives in the detail menu |
| E3 | watermarked photos of specific artworks rendered into user-published images | CC0 / public domain imagery only |
| E4 | account + premium tier | no account, no tier, no server |
