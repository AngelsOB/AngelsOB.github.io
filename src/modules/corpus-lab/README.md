# corpus-lab — recipe corpus → flavour steering (quarantined WIP)

> **Canonical state, design decisions, numbers, and roadmap: [`docs/corpus-lab-build.md`](../../../docs/corpus-lab-build.md).** Read that first.

Self-contained module for the "median brew + flavour steering" project.

**The app does not import anything from here.** The dependency is one-way
(corpus-lab → app, never app → corpus-lab), so deleting this folder leaves the
builder completely untouched. We build and validate the cloud / recipe outputs in
isolation here, and only *promote* pieces into the app deliberately at integration
time (e.g. moving the malt lexicon into the data layer, wiring the steering engine
into the builder). Nothing here ships in the bundle until then.

## Layout
- `maltFlavor.ts` (+ test) — curated malt flavour lexicon: 9 flavour axes + intensity
  + body contributions + the aggregation math. Types are defined locally so the
  module has no app dependencies.
- `offline/` — Node data-prep (never bundled, never shipped):
  - `corpus.mjs` — streaming helpers over the raw corpus
  - `eda.mjs` — Phase 0 ground-truthing
  - `build-archetype-map.mjs` — name → archetype mapper (+ review file)
  - `out/` — committed, facts-only outputs (`archetype-map.json`, `archetype-map.review.tsv`)
- `raw/` — **gitignored** raw Brewer's Friend corpus (179 MB). Never shipped, never committed.

## Data posture
Raw member-submitted recipes never ship or get committed (recipe facts are largely
not copyrightable, but we don't republish individual recipes). Only derived
aggregates / synthesized blends / curated lexicons ever leave this module. See
`~/.claude/plans/i-found-this-crazy-noble-pumpkin.md`.

## Run
```
node src/modules/corpus-lab/offline/eda.mjs
node src/modules/corpus-lab/offline/build-archetype-map.mjs
npx vitest run src/modules/corpus-lab
```
