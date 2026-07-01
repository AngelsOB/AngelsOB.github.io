# Corpus Lab — hop names the resolver can't place yet

> **STATUS 2026-07-01 — addressed (needs a `build-hop-map.mjs` rebuild to take effect).**
> **A:** 13 new varieties added to `HOP_PRESETS` (African Queen, Southern Passion, Southern Promise, Southern Star, Jester, Bullion, Archer, Pioneer, Olicana, Barbe Rouge, Styrian Wolf, Medusa, Iunga) + Denali. Aliases added for the rest (they were renames/synonyms of hops we already have): Taiheke→Cascade, Super Alpha→Dr. Rudi, Idaho→Idaho 7, German Select→Spalter Select, Super Styrian(s)→Aurora, HBC 438→Sabro, ŽPČ→Saaz. Skipped: **Fortnight** (a commercial blend), **Hopshot** (a CO2 extract).
> **B:** generic Hallertau (Domestic/German/Hallertauer) → **Hallertau Mittelfrüh** aliased.
> **C:** `simco`→Simcoe, `mosiac`→Mosaic aliased.
> All alias/preset changes are live in `presets.generated.hops.json` + `build-hop-map.mjs`; **re-run `build-hop-map.mjs` against the corpus to regenerate `hop-map.json` and realize the ~99% resolution.**


Generated from `src/modules/corpus-lab/offline/out/hop-map.json` (built by
`build-hop-map.mjs`). After that map landed, **96.9%** of corpus hop additions
resolve to a real `HOP_PRESETS` entry (up from 85.4%). This file lists the
remaining ~3% so the hop-DB audit can close the gap. Counts are corpus usage
(occurrences across ~180k recipes). Full raw list: `out/hop-map.review.tsv`
(the "top UNRESOLVED" section).

**Do not need to touch these for the lab to work** — unresolved names fall back
to a de-noised string (10% AA, no flavour). This is purely upside: each hop
added below stops being invisible to the flavour search + gets a real alpha acid.

## A. Real hops missing from `HOP_PRESETS` (add with flavour + alpha)

Ordered by corpus usage. A flavour vector + `alphaAcidPercent` for each would
resolve it automatically on the next map rebuild.

| hop | uses | note |
|---|---|---|
| Denali | 711 | US, 2019 release |
| Southern Passion | 408 | ZA |
| Medusa | 359 | US (Neomexicanus) |
| African Queen | 232 | ZA |
| Taiheke | 225 | NZ name for Cascade — could alias instead |
| Jester | 220 | UK |
| Bullion | 211 | UK/US heritage |
| Archer | 188 | UK |
| Pioneer | 148 | UK |
| Southern Promise | 123 | ZA |
| Barbe Rouge | 117 | FR |
| Styrian Wolf | 111 | SI |
| Super Alpha | 102 | NZ |
| Super Styrians | 91 | SI (a.k.a. Styrian Bobek/Aurora) |
| Southern Star | 86 | ZA |
| Olicana | 85 | UK |
| German Select | 82 | DE |
| Fortnight | 80 | — |
| Idaho (Idaho 7?) | 77 | likely Idaho 7 — confirm |
| Iunga | 64 | — |
| HBC 438 / Hopshot / ŽPČ | ~245 | experimental IDs + a hop extract (Hopshot) — edge cases |

## B. Generic "Hallertau" — a mapping decision, not a missing hop (~6,100 uses)

`Domestic Hallertau` (5,032), generic `Hallertau` (582), `German Hallertau`
(398), `Hallertauer` (146). These name the Hallertau region, not a specific
variety, so the resolver leaves them null rather than guess.

Recommendation: alias generic Hallertau → **Hallertau Mittelfrüh** (the classic
noble default) in `build-hop-map.mjs`'s `ALIAS` table. It's the conventional
reading, and "Domestic/US Hallertau" is close enough in character. Needs a
yes/no — one line recovers ~6k uses. (Left out on purpose so it's a deliberate
call, not a silent assumption.)

## C. Typos we already have the hop for — fix via alias, no DB change (~190 uses)

Add to `build-hop-map.mjs`'s `ALIAS` (or widen the fuzzy pass):

- `simco` → **Simcoe** (711-family typo; too short for the current len≥6 fuzzy guard)
- `mosiac` → **Mosaic** (transposition = 2 edits, over the ≤1 fuzzy threshold)

Doing A + B + C would push resolution from 96.9% toward ~99%.
