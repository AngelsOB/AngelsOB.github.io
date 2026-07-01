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
  - `build-archetype-map.mjs` / `build-yeast-map.mjs` — name → archetype/yeast-class mappers
  - `buildCloud.ts` — pure recipe → feature-vector logic; `cloudViz.test.ts` persists the
    cloud (gated); `neighborPurity.test.ts` tunes/validates k-NN (gated)
  - `styleFamily.ts` — shared coarse style-family classifier
  - `out/` — committed, facts-only outputs (maps, style-summary, cloud-viz)
- `steering/` — Phase 2, the "median brew + flavour steering" engine (pure, test-first):
  - `featureSpace.ts` — cloud-math toolkit (z-scoring, yeast multi-hot, k-NN, kernel weights)
  - `loadCloud.ts` — the only fs-touching piece (reads `cloud.ndjson`)
  - `reconstruction.ts` — blended archetype%/hops/yeast → a real, clean recipe's ingredients
  - `RecipeSteeringService.ts` — orchestrator: `steer(query)` → synthesized recipe +
    style-fit signal. `RecipeSteeringService.realCloud.test.ts` (gated) fires example
    queries against the real cloud for eyeballing.
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

# fire example steering queries against the real cloud (needs cloud.ndjson — see docs/corpus-lab-build.md §8)
BUILD_CLOUD=1 npx vitest run src/modules/corpus-lab/steering/RecipeSteeringService.realCloud.test.ts
```
