# Corpus sources and their terms

The compiled `vocab.db` is a derivative of the sources below and carries their
obligations. This file is shipped inside the app under *Settings → Open source
licences*.

**A dataset whose terms are unclear does not go in.** There is no "probably fine" tier.

## Currently compiled in

| Source | What it provides | Licence | Attribution required |
|---|---|---|---|
| Vocab-U curated seed (`data/seed/`) | all 51 seed entries: glosses, examples, IPA, topics | CC BY-SA 4.0 | yes — "Vocab-U contributors" |

## Planned, with terms verified before import

| Source | What it will provide | Licence | Notes |
|---|---|---|---|
| Open English WordNet | senses, synonym and antonym relations, POS | CC BY 4.0 | attribution in-app; the successor to Princeton WordNet |
| CMUdict | US English pronunciation → IPA | BSD-2-Clause | ARPABET; converted to IPA at build time |
| wordfreq / SUBTLEX-derived lists | `freq_rank` | MIT (tool) / CC BY-SA (data) | per-list terms differ — record each one here before importing |

## Rules for adding a source

1. Record it in the table above **before** writing the importer, with a link to the
   licence text and the exact attribution string it demands.
2. Share-alike sources (CC BY-SA) infect the compiled corpus. That is accepted for
   this project — the corpus is CC BY-SA and the app is GPL — but it must be stated,
   not discovered later.
3. No source that forbids commercial use. "Free for the community" has to include a
   community member who wants to sell a fork, or the licence is not free.
4. No scraped dictionary content. Definitions are copyrightable, and "it was on the
   web" is not a licence.
