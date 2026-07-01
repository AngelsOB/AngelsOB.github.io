# Corpus Lab — "median brew + flavour steering" (build/handoff doc)

Canonical state doc for the recipe-corpus steering project. **Everything lives in the
contained module `src/modules/corpus-lab/`.** The app never imports from it (one-way
dependency lab → app), so it's safe to iterate in isolation and to delete with zero app
impact. Heavy offline builds are gated behind `BUILD_CLOUD=1` so the normal test suite
stays fast and CI-safe.

---

## 1. What we're building

Turn a Kaggle dump of ~180k Brewer's Friend homebrew recipes (ingredient-level: grain
bills, hop schedules, yeast) into a **"median brew + flavour steering"** engine:

> Pick a style → get a known-good starting recipe (the local "median brew") → push the
> flavour where you want it (hoppier / juicier / maltier / roastier / more body …) → get
> a real, brewable recipe out. **No LLM** — a flavour radar + sliders *are* the query, so
> the whole loop is deterministic and can't hallucinate.

Mechanism (one line):
`recipe → feature vector → cloud of 148k vectors → user sets a target point → k-NN local
average of the neighbourhood's TARGETS → synthesize one clean grain bill + hop schedule +
yeast → run through the app's real calculators → done.`

Two-level representation (important): we **generalise for the search** (flavour vectors,
yeast base-class) but **specify for the rebuild** (actual normalised hop names, modal
neighbour yeast). Search on the generalisation; reconstruct from the specifics.

Ultimate integration: a "start from a style" prefill + a steering panel in the real
builder. That's Phase 3; not started.

---

## 2. Hard constraints

### Legal / data posture
Recipe facts (ingredient lists, amounts, gravities) are largely **not copyrightable**
(US: facts + procedures; Feist). We derive **aggregates** and **synthesize blends**
(a local average is nobody's actual recipe) — we **never republish individual recipes**.
- Raw corpus and the full cloud are **gitignored**: `src/modules/corpus-lab/raw/` and
  `src/modules/corpus-lab/offline/out/cloud.ndjson`.
- Only **derived, facts-only** artifacts are committed (the maps, per-style summaries,
  the PCA viz sample).

### Containment
- All code under `src/modules/corpus-lab/`. **App imports nothing from here.** The lab
  imports *from* the app (allowed): `HopFlavorCalculationService`,
  `RecipeCalculationService`, `presets.generated.*.json`.
- `.mjs` offline scripts run under plain `node`. TS that needs app modules
  (`buildCloud.ts`) runs under `vitest` (no `tsx`/`ts-node` in the project).
- Heavy corpus builds are gated: `describe.runIf(!!process.env.BUILD_CLOUD && …)`.
- **One deliberate exception**: `app/api/lab/steering/route.ts` — a dev-only (404s
  outside `NODE_ENV !== "production"`) API route backing a manual test UI at
  `app/lab/steering-playground/`. It's the *only* file in `app/` that imports
  `RecipeSteeringService`/`loadCloud` as real runtime values; the playground page
  itself only imports **types** from the lab (erased at compile time, zero bundle
  impact) plus real app code (`HopFlavorRadar`-style radar, `getBjcpCategories`).
  Delete both paths and the exception is gone. Exists because there's no `tsx`/
  `ts-node` to run a standalone Node+TS server, and Next's own dev server is the
  path of least resistance for a click-around test harness with sliders + radars.

---

## 3. Phases & status

- **Phase 0 — EDA** ✅ done. Corpus shape known.
- **Phase 1 — pipeline + cloud** ✅ **done and validated.** Grain + yeast mappers, filter,
  per-recipe vectors, persisted cloud, per-style summaries, PCA map, k-NN purity tuning.
- **Phase 2 — steering engine** ✅ **done and validated against the real 148,775-record
  cloud** (see §10). `RecipeSteeringService.steer(query)` synthesizes a real recipe.
- **Phase 3 — builder UI** ⬅ **NEXT** (see §11). Start-from-style prefill + steering panel.

Phase 1's facts-only artifacts + code are already committed (in `e90f524`, despite the
generic "StylingUpdate" message — this doc previously said otherwise; that was stale).
Phase 2's code (this section) is **not yet committed**. Raw corpus and `cloud.ndjson`
stay gitignored throughout.

---

## 4. Module map

| File | Purpose |
|---|---|
| `maltFlavor.ts` (+ `.test.ts`) | Curated malt lexicon: **9 flavour axes** + `intensity` + body contributions; `aggregateMaltFlavor` / `aggregateMaltBody`; `MALT_INTENSITY_LAMBDA=1.6`. Types are local (self-contained). 34 archetypes, book-validated (Mallett). |
| `offline/corpus.mjs` | Streaming helpers over the raw NDJSON-ish corpus (`streamRecords`, `parseLine`, `CORPUS_FILE`). |
| `offline/eda.mjs` | Phase 0 ground-truthing (counts, distinct ingredient strings, unit sanity). |
| `offline/build-archetype-map.mjs` | Grain name → malt-archetype mapper → `out/archetype-map.json` + review tsv. |
| `offline/build-yeast-map.mjs` | Yeast name → base class (`strainGroup`) + substitutes mapper → `out/yeast-map.json` + review. |
| `offline/filter-stats.mjs` | Recipe-filter analysis (composition by category, retention under policies). |
| `offline/buildCloud.ts` | **Pure vector logic**: `composition`, `passesFilter`, `parseHopAddition`, `recipeToVector` (reuses app `HopFlavorCalculationService`), `gristArchetypePct`. Also exports `HOP_FLAVOR_BY_LOWER` (hop name → flavour, lower-cased) and the `CorpusRecipe` type. |
| `offline/buildCloud.test.ts` | Unit tests (always run) + **gated** full-corpus validation → `out/style-summary.json`. |
| `offline/styleFamily.ts` (+ implicit tests via consumers) | Shared coarse style-family classifier `family(style)` — extracted from cloudViz/neighborPurity duplication; also used by the steering engine's soft style-gate. |
| `offline/cloudViz.test.ts` | **Gated**: persists the full cloud (`out/cloud.ndjson`, gitignored) + PCA → `out/cloud-viz.json`. |
| `offline/neighborPurity.test.ts` | **Gated**: k-NN style-purity analysis + **yeast-weight sweep**. |
| `out/*.json`, `*.review.tsv` | Committed facts-only artifacts (maps, style-summary, cloud-viz). |
| `raw/recipes_full.txt` | Gitignored raw corpus (179 MB). |
| `steering/featureSpace.ts` (+ `.test.ts`) | Pure cloud-math toolkit: `CloudRecord` type, 23-dim `continuousRow`/`computeStats`/`zScore`, yeast-vocab + multi-hot block builders, `weightedDistance2`, `kNearestByDistance`, `kernelWeights`. Mirrors the math already proven in `neighborPurity.test.ts`. |
| `steering/loadCloud.ts` | The only fs-touching piece of the steering engine — reads `cloud.ndjson` into `CloudRecord[]`. |
| `steering/reconstruction.ts` (+ `.test.ts`) | Neighbourhood-average → clean recipe. Grist: role-first two-phase (`ROLE_OF`/`pickRoleRepresentatives`/`pickGristBill`) over `ARCHETYPE_TO_PRESET_NAME` (malt archetype → real `FERMENTABLE_PRESETS` entry). Hops: name cleanup (`normalizeHopName`) + role/timing bucketing + variety-share + total-count capping + timing-checkpoint snapping (`bucketForAddition`/`reconstructHopSchedule`/`materializeHopSchedule`). Yeast: weighted vote (`pickModalYeastName`/`buildYeastFromPresetName`). Both `pickGristBill` and `reconstructHopSchedule` take an optional `flavorMatchWeight` (+ `maltTarget`/`hopTarget`) that blends each candidate's own curated flavour-match against popularity when picking a role/bucket's representative — see §6's "creative leeway." |
| `steering/RecipeSteeringService.ts` (+ `.test.ts`) | The orchestrator — `steer(query)`: style resolution (specific-style centroid, family fallback) + target overrides → k-NN → weighted average → reconstruct (creativity-weighted, see above) → mash-temp solver + reverse-ABV solver + IBU band/solver → style-fit signal + `styleNorms` (the matched centroid's own p25/p75 flavour range). Unit-tested on a small synthetic multi-cluster fixture. |
| `steering/RecipeSteeringService.realCloud.test.ts` | **Gated**: fires example queries against the real cloud and `console.log`s the synthesized recipes for eyeballing. |

---

## 5. The cloud representation

Each kept recipe → one feature vector:

**23 continuous dims (z-scored):**
- malt 9-axis — `aggregateMaltFlavor(grist)` from the lexicon (grain-only; non-malt skipped).
- hop 9-axis — the app's real `HopFlavorCalculationService.calculateCombinedFlavor`.
- scalars: `gravity=(og-1)*1000`, `ibu`, `srm`, `buGu`, `maltBody`.

**Yeast multi-hot block (NOT z-scored; scaled by weight `W≈3`):**
- Own base class = **1.0**. The base class is the preset's `strainGroup` — now the
  **canonical brewing name** (e.g. "Chico (American Ale)", "Kölsch (WLP029)"), not a lab
  code — or a `solo:` key when untagged. Each class from the preset's **substitutes +
  `strainGroupAliases`** (only those that resolve to a real preset/code — generic descriptor
  aliases don't resolve, so no false merges) = **0.5** (soft similarity — bridges the still-
  fragmented families, e.g. US-05 ↔ Chico (West Coast) ↔ Chico (American Ale)). Plus
  dedicated **`__brett` / `__lacto`** dims from yeast+`other` text. Vocab = top-40 + brett + lacto.
- Schema note: the yeast preset dropped `strainGroupLabel`; `strainGroup` is now the display
  name and `strainGroupAliases[]` holds the search names. `build-yeast-map.mjs` uses both.
- Weighted directly (not z-scored) so a class mismatch costs ~`W` — `W≈3` is the tuned
  sweet spot. **This is the knob**; re-tune via the purity sweep if the representation changes.

**Grist is handled as % of grist** (already in the data). Reconstruction uses grist
archetypes + actual normalised hop names + the modal neighbour yeast.

`cloud.ndjson` record: `{id, s(style), og, fg, abv, ibu, srm, mb, m[9], h[9], g(grist
archetype→%), hp([name,gpl,type,timeMin]), yc(own class), ys(sub classes), yn(yeast name),
srb, srl}`.

---

## 6. Locked design decisions (and why)

- **k-NN in flavour space; average TARGETS, not recipes.** Averaging raw recipes muddies
  the grist (kitchen-sink). Instead average the neighbourhood's flavour + stats + typical
  archetypes, then synthesize ONE clean bill. Small `k` + sharp kernel; neighbours weighted
  purely by distance — **not** by `rating` as originally specced (see §9: the field is
  98%+ zero, no real signal to weight by).
- **Grist reconstruction is role-first, two-phase — never a flat "blend every archetype,
  keep the top-N."** A role's vote can split across near-equivalent choices (base-pale vs
  pilsner vs maris-otter vs wheat-malt) and vanish from a flat top-N entirely even though
  "some base malt" was in ~100% of the neighbourhood — this is exactly how an early version
  came back with **zero base malt** and a majority-adjunct bill. Fix: (1) roll blended
  archetype% up to 6 functional roles (base/toasted/crystal/roasted/flaked/sugar) — a role
  total can't vanish to naming variance since it's summed before any specific choice is
  picked; (2) within each present role, pick whichever single archetype the neighbourhood
  most commonly reaches for (a weighted vote by neighbour, not by average volume
  contributed — a large one-off pour of an odd choice shouldn't outweigh what most
  neighbours actually use). See `reconstruction.ts`'s `pickGristBill`/`pickRoleRepresentatives`.
- **Hop reconstruction needs three separate anti-spam guards, not just bucketing.**
  (1) Corpus hop names carry noise ("Cascade (7% AA)") that fragments into a fake second
  "variety" AND misses the real preset lookup (falls back to a generic 10% AA instead of
  Cascade's actual alpha acid) — `normalizeHopName` strips parenthetical/inline-AA noise
  before any grouping happens. (2) A 2nd variety within a bucket only earns its own line
  if it clears `minVarietyShare` (30%) of that bucket's usage — otherwise it's a corpus
  outlier, not a real blend, and folds into the dominant variety. (3) Total additions are
  capped to the neighbourhood's own average addition count (not "however many buckets
  happen to clear the presence threshold") — kept additions are ranked by bucket
  *presence* (how many neighbours use this timing role at all), not raw dose size, so a
  rare-but-large outlier can't crowd out a common one. Timings snap to canonical
  checkpoints (boil/mash: 0/10/15/30/45/60; whirlpool: 0/5/10/15/20/30) instead of raw
  weighted averages like "3min" or "57min".
- **Creative leeway: reconstruction blends flavour-match into the popularity vote,
  it doesn't just pick the most common ingredient.** The anti-spam guards above (role vote,
  variety-share) all rank candidates by neighbourhood popularity alone, which has a real
  failure mode the user caught by feel, not by a failing test: a flavour push either isn't
  strong enough to change who wins the vote (looks like "no effect") or is strong enough to
  land in a thin/noisy neighbourhood where the vote has nothing sane to converge on (looks
  like "destroyed the recipe"). Fix: `pickRoleRepresentatives`/`reconstructHopSchedule`'s
  per-bucket ranking now score each candidate as `(1-λ)·popularityShare + λ·flavourMatch`,
  where `flavourMatch` is that specific archetype/hop's own **already-curated** flavour
  vector (`maltFlavor.ts` / `HOP_PRESETS`) scored against only the axes the user explicitly
  pushed (`SteeringQuery.creativity` = λ, default **0.3**, unset target axes contribute
  nothing so a plain median-brew query is untouched). This re-ranks candidates already
  present in the neighbourhood — it never introduces an ingredient nobody nearby actually
  uses. λ=0.3 is deliberately conservative: a landslide-popular choice still wins even
  against a perfect-match long shot; only a fairly close contest gets tipped. **Gotcha found
  building this** (see §9): the pre-existing total-addition-count cap's tie-break used raw
  `gpl` (≈popularity-proportional), which could silently re-undo a flavour-match win from the
  per-bucket step — the cap's tie-break now uses each draft's own blended score instead.
- **Style resolution prefers the specific BJCP style over the coarse family — the family
  is a k-NN soft-gate, not a synthesis target.** `family()` is a 10-bucket classifier
  built for the Phase-1 purity sweep. Using it as the "median brew" starting point too
  meant any two BJCP styles sharing a bucket (Munich Helles / Czech Pale Lager / American
  Lager are all `family="Lager"`; Black/Belgian/Brown IPA are all `family="IPA"`) got the
  *identical* centroid — and thus the identical recipe — whenever the user didn't push an
  explicit flavour override. Fix: resolve each cloud record's own BJCP code once (per
  unique raw style string — ~180 of them over 149k records, so the fuzzy-match cost is
  trivial), try a centroid from records matching the query's *specific* code first, and
  only fall back to the family median when there are under 30 matching records to trust.
  `styleGate: "strict"` restricts to whichever level the centroid actually came from.
- **ABV/OG/FG are outputs of ingredients+process, never an independent target to "learn"
  from the corpus.** OG is fully determined by grain %, weight, and efficiency — a
  neighbourhood's raw self-reported ABV carries no information beyond what the
  reconstructed grain bill already encodes, and self-reported homebrew numbers are noisy.
  The default ABV target (when the user doesn't set one) is the style's own **BJCP
  guideline midpoint** — real, authoritative data already in the app — falling back to the
  corpus average only when a style doesn't resolve to a BJCP code at all. This moved some
  styles a lot (Czech Pale Lager 5.2%→3.5%, Belgian IPA 5.9%→7.8%) — the corpus's
  self-reported average was genuinely off for those, not just noisy-but-close.
- **Mash schedule can't be reconstructed from data (it isn't in the corpus at all — see
  §9) but it doesn't have to stay a flat hardcoded guess either.** Apparent attenuation
  `(OG-FG)/(OG-1)` *is* a real outcome in the data, and the kinetic model
  (`RecipeCalculationService`) is already the forward map from mash temp → attenuation
  given yeast. Inverting it — bisect a single-infusion 60-min mash temp so the model
  reproduces the neighbourhood's own average apparent attenuation, given our reconstructed
  yeast — recovers a real signal from an outcome instead of guessing at the process
  directly. Only depends on yeast + mash steps, never fermentables, so it's independent of
  (doesn't need to iterate with) the ABV/grain-weight solve. See `solveMashTemp`.
- **Malt flavour is authored per-archetype, not derived from recipe data** (recipes have
  amounts, not taste). Validated against Mallett's *Malt: A Practical Guide*. `intensity`
  coefficients make a few % of roast dominate 80% base. **Coffee split from roast**
  (roasted barley = coffee anchor; black malt = acrid roast). **Toffee NOT split** (no
  clean standalone anchor — it's caramel+biscuit+nutty). **Body** = FG + a grist body
  signal (dextrine/oats/wheat add; rice/sugar thin) — this is where no-flavour grains live.
- **Grain mapper:** 99.9% of usage mapped; corpus names are `Country - Product` and map
  ~1:1 to archetypes. Facets = archetype + origin + colour.
- **Filter policy:** keep `All Grain`/`BIAB`, `extract ≤5%`, `adjunct ≤20%`, `unknown ≤15%`
  → **148,775 recipes (83%)**. Extract → drop the *recipe* (not reconstructable);
  adjunct/fruit → drop the *ingredient*, keep the grain bill; sugar/lactose → keep (builder
  supports them).
- **Yeast = one-hot/multi-hot base class, NOT trait features.** User's call, and correct:
  yeast isn't a steering dial the user turns. Collapse on `strainGroup`; the substitutes
  multi-hot gives soft similarity for free. Reconstruct from the **modal neighbour yeast**.
- **Sours = a style-layer problem, not a vector problem** (measured: Brett/Lacto dims
  didn't move sour purity — souring often isn't in the data and sours span the whole flavour
  space). Handle via the style label (start-from-style + gate).
- **Style gating is soft/optional, not always-hard.** The point of steering is to let users
  push past the style line on purpose; adjacent-style neighbours are *correct* (we match
  flavour, not label). Default = bias to style **family** + a density/style-fit meter that
  relaxes when they steer out of bounds. A hard "stay in style" toggle is available.
- **No LLM** anywhere in the core loop.

---

## 7. Key numbers (validation)

- Parsed **179,455** recipes (0 parse errors); **148,775 kept** by the filter.
- Grain mapper: **99.9%** of usage mapped, top-300 names = 94%.
- Yeast mapper: **83%** matched (high+medium), 230 base classes, top-30 cover 75%.
- Cloud: 23 continuous dims + ~42 yeast dims. PCA: PC1 24% var (hop↔malt), PC2 17% (pale↔dark).
- k-NN purity (vector-only, harsh; random baseline ≈10%): overall **~46% at W=3**.
  Yeast weight closed the yeast-driven bleed: **Belgian 27→51%, Lager 39→49%, Wheat 54→60%**;
  IPA ~57%, Stout ~71% held (no fragmentation of clean-ale/roast families).

---

## 8. How to run

Prereq: raw corpus at `src/modules/corpus-lab/raw/recipes_full.txt` (gitignored; from the
Kaggle "Homebrew Beer Recipes" dataset, the ingredient-level JSON-per-line file).

```
# offline .mjs (plain node)
node src/modules/corpus-lab/offline/eda.mjs
node src/modules/corpus-lab/offline/build-archetype-map.mjs
node src/modules/corpus-lab/offline/build-yeast-map.mjs
node src/modules/corpus-lab/offline/filter-stats.mjs

# heavy builds (gated) — persist cloud + viz, run purity/tuning
BUILD_CLOUD=1 npx vitest run src/modules/corpus-lab/offline/cloudViz.test.ts
BUILD_CLOUD=1 npx vitest run src/modules/corpus-lab/offline/neighborPurity.test.ts

# fire example steering queries against the real cloud, print synthesized recipes
BUILD_CLOUD=1 npx vitest run src/modules/corpus-lab/steering/RecipeSteeringService.realCloud.test.ts

# unit tests (fast, always run)
npx vitest run src/modules/corpus-lab
```

Order to (re)build from scratch: archetype-map → yeast-map → cloudViz (needs both maps) →
purity. `cloud.ndjson` must exist before the purity test.

---

## 9. Gotchas

- Raw data + `cloud.ndjson` are gitignored → regenerate from raw when needed.
- `.mjs` can't import app TS → cloud vector logic is TS (`buildCloud.ts`), run via vitest.
- The gated tests skip without `BUILD_CLOUD` (keeps the normal suite fast; CI-safe when raw
  data is absent).
- Malt magnitudes read low (compressed) — `LAMBDA=1.6` is a first-pass dial; the radar UI is
  the real tuning target, later. Separation (what k-NN uses) is what matters, and it's good.
- Yeast `strainGroup` tags are incomplete (US-05 has none; only 228/524 tagged). The
  substitutes multi-hot is what bridges the gaps — keep it.
- **The corpus's `rating`/`num rating` fields are unusably sparse** (checked directly:
  98.1% of 179,455 records have `rating: 0`, mean `num rating` is 0.02). The original spec's
  "weight neighbours by rating" (§6) had to be dropped — the steering engine weights purely
  by a distance kernel (`kernelWeights` in `featureSpace.ts`), same as the purity sweep
  already did. Not a Phase 1 bug — the data just doesn't support it.
- **Hop-name casing is a real gotcha, not a style choice**: `HOP_FLAVOR_BY_LOWER` (buildCloud.ts)
  is keyed lower-case because corpus names vary in case, but `HopFlavorCalculationService
  .calculateCombinedFlavor` looks up `hopFlavors.get(hop.name)` with **no case normalisation**.
  `reconstruction.ts`'s `materializeHopSchedule` deliberately upgrades hop names to their
  properly-cased `HOP_PRESETS` form for a nicer recipe — so anything that re-derives a hop
  flavour profile from the synthesized `recipe.hops` (e.g. the steering engine's "achieved
  flavour" readout) must lower-case the names again first, or every lookup silently misses
  and the flavour comes back all-zero. Bit us once; fixed in `RecipeSteeringService.steer()`.
- **Gravity-points units, not `(og-1)`**: the cloud's continuous-feature layout uses
  `gravityPoints = (og-1)*1000` (see `featureSpace.continuousRow`), matching the rest of the
  app's GU convention. Converting a *target ABV* into that same dim for query construction
  needs the same `*1000` — the first pass missed it, producing a ~1000x-too-small gravity
  value that also corrupted the derived `buGu` dim and blew up k-NN distance for any
  ABV-targeted query (caught by firing a real "Russian Imperial Stout, ABV 10.5%" query and
  noticing `styleFit.meanNeighborDistance` was 3000x the baseline — see the comment in
  `RecipeSteeringService.buildQueryRow`). Exactly why the spec asked for real example
  queries, not just synthetic-fixture unit tests.
- **A "which candidate wins" tie-break can silently override an earlier ranking decision
  if it uses a different metric.** Building the creativity/flavour-match blend (§6),
  `reconstructHopSchedule`'s per-bucket step correctly re-ranked by blended score — but the
  *separate*, pre-existing total-addition-count cap downstream still broke ties by raw `gpl`,
  which is popularity-proportional by construction. Result: a flavour-matched hop could win
  its own bucket's ranking and still lose the final cap to the popular runner-up it had just
  beaten, silently reproducing the exact "the push did nothing" bug the feature was built to
  fix. Only surfaced because a dedicated unit test asserted on the *actual output hop*, not
  just "did the function throw" — the synthetic-fixture regression suite alone (which mostly
  asserts shape/count) would have stayed green. Fixed by carrying the blended score through
  to the cap's tie-break too. General lesson: when two ranking/trimming steps touch the same
  candidates, check they agree on what "better" means, not just that each is locally correct.
- **The corpus has NO mash-temperature/duration field at all** (checked directly — full raw
  field list is `method, style, batch, og, fg, abv, ibu, color, "ph mash", fermentables,
  hops, other, yeast`; "ph mash" is a pH reading, almost always `-1`/unrecorded). "What mash
  schedule do the neighbours use" is unanswerable from this dataset — not a Phase 1 gap,
  the source data genuinely doesn't have it. The mash-temp solver (§6) works around this by
  inferring a plausible mash temp from attenuation *outcomes* instead of needing the
  schedule directly.

---

## 10. Phase 2 — the steering engine (done)

`RecipeSteeringService.steer(query)` in `steering/RecipeSteeringService.ts`. Constructed with
an already-loaded `CloudRecord[]` (`loadCloud()` is the one fs-touching piece); everything
else is pure and unit-tested on a small synthetic multi-cluster fixture
(`RecipeSteeringService.test.ts`), then validated against the real 148,775-record cloud
(`RecipeSteeringService.realCloud.test.ts`, gated).

**Flow**: `matchBjcpStyle` resolves the style to a BJCP code → try a centroid from cloud
records matching that *specific* code first (≥30 records to trust it), falling back to the
coarse `family()` median only when there's too little specific-style data → that centroid
(mean of the 23 continuous dims + a soft-blended yeast vector) is the "median brew" starting
point → explicit `target.hop`/`target.malt` axes overlay onto (replace) the centroid's
values at those indices only → `target.abv` also nudges the centroid's gravity dim (roughly,
via an assumed 75% attenuation) purely to bias *which neighbours get found*; the real ABV is
hit exactly later → k-NN (weighted distance, same formula as `neighborPurity.test.ts`) over
the whole cloud (or restricted to whichever level — style or family — the centroid actually
came from, under `styleGate: "strict"`) → Gaussian-kernel neighbour weights → **average the
neighbourhood's targets**: blended grist archetype%, hop additions bucketed by role/timing, a
weighted vote on yeast preset name — never raw ingredient sums.

**Synthesis**: `reconstruction.ts` rolls the blended archetype% up to 6 functional roles
(base/toasted/crystal/roasted/flaked/sugar — see §6 for why this is two-phase, not a flat
blend) and picks each present role's most-commonly-used archetype via
`ARCHETYPE_TO_PRESET_NAME`, a hand-verified table where every one of the 34 malt-lexicon
archetypes + sugar/honey-sugar/lactose maps to a real `FERMENTABLE_PRESETS` entry (asserted
by `unmappedArchetypes()` in a test, so a future preset rename fails loudly, not silently).
Archetypes with no role and anything under `minPct` are dropped and renormalised, with a
note. Hops are bucketed into bittering/flavor/aroma/first-wort/whirlpool/dry-hop/mash by
type+time (names normalised first — see §6/§9), a bucket only survives if enough of the
*weighted* neighbourhood actually uses it (`presenceThreshold`), a 2nd variety only earns
its own line above `minVarietyShare`, and the total addition count is capped to the
neighbourhood's own average (ranked by bucket presence, then by blended score — see below —
not dose size). Timings snap to canonical checkpoints. Yeast is a weighted vote on the
neighbourhood's `yn` (preset name), looked up in the real `YEAST_PRESETS` for actual
attenuation — or an explicit `yeastName` override wins outright for the final recipe (and
also re-steers the k-NN query itself, if the cloud has class data for that preset).

**Creativity (`SteeringQuery.creativity`, default 0.3)**: both grist-role and hop-bucket
representative picks are, by default, a *pure popularity vote* — whatever the neighbourhood
uses most. That's exactly right for "give me a good recipe" but fights "let me push a
deliberate, slightly unusual choice" — a push either isn't strong enough to flip the vote
(reads as "no effect") or is strong enough to land in a thin neighbourhood with nothing sane
to vote for (reads as "wrecked recipe"). `creativity` (λ) blends each candidate's own
already-curated flavour vector (`maltFlavor.ts` archetypes / `HOP_PRESETS`) into the vote,
scored only against axes the user explicitly pushed: `score = (1-λ)·popularityShare +
λ·flavourMatch`. λ=0 is the original pure-popularity behaviour exactly; the 0.3 default is
deliberately conservative (only close contests flip); it only ever re-ranks ingredients
already present in the neighbourhood, never invents one. See §6 and §9 for the tie-break trap
this surfaced.

**Style norms** (`SteeringResult.styleNorms`): alongside the mean (the centroid), each
centroid computation now also captures the **25th/75th percentile** per flavour axis across
the same record set — the "box" the matched style (or, if too thin, its family/global
fallback — `styleNorms.level` says which) typically occupies, independent of whatever this
particular query asked for. Percentiles, not mean±std, because flavour axes are zero-heavy/
skewed and a symmetric band can imply a nonsensical negative lower bound. Cheap: the specific-
style/family levels compute it from whichever record set they already gather; the global
level is precomputed once in the constructor. The playground renders it as a grey reference
band underneath the requested/achieved polygons on both radars.

**Solvers** (three, all bisection/closed-form against the real calculators, never hand-rolled
formulas):
- **ABV** — `FermentableCalculationService.calculateWeightsFromPercentsAndABV`, an existing
  exact (non-bisection) inversion; no change needed, it already composed. The *target* it
  solves toward defaults to the style's BJCP guideline midpoint, not a corpus average (§6).
- **Mash temperature** — new. Bisects a single-infusion 60-min mash temp (within
  62.5-72.5°C, mirroring `RecipeCalculationService`'s own "brewer's window") so the kinetic
  attenuation model reproduces the neighbourhood's own average apparent attenuation, given
  the reconstructed yeast. Runs *before* the ABV solve and is fully independent of it (only
  reads yeast + mash steps, never fermentables) — no iteration between the two needed.
- **IBU** — new. Hop-grams aren't perfectly linear in a uniform scale factor once dry hops
  are in the mix (humulinone extraction saturates — see `@/calculators/ibu`), so
  `solveHopsForTargetIBU` bisects a scale factor against the real
  `RecipeCalculationService.calculate(...).ibu` (not a hand-rolled OG/boilGravity
  re-derivation) until it converges. Only runs at all when the user gives an explicit
  `target.ibu` — with no explicit ask, the naturally-reconstructed hop bill's IBU is
  accepted as-is unless it falls outside a tolerance band around the neighbourhood's own
  average IBU, in which case it's nudged to the nearest band edge (not pinpoint-solved to
  the average itself — that number is only an approximation).

**Style-fit signal**: self-calibrating, not a hardcoded threshold. `getBaselineDistance(k)`
samples the cloud once (median distance-to-k-th-neighbour over ~200 points against an ~8000-point
subsample) as "how dense is it normally around here", cached per-`k`. A query's own mean
neighbour distance vs that baseline (×1.5) sets `styleFit.inBounds`. Validated live: a
"push tropical" IPA query reads in-bounds; asking a Saison to be roast-and-chocolate-forward
(a style/flavour combination the corpus essentially doesn't contain) correctly reads
out-of-bounds with a note.

**Scoped out, deliberately**: `target.body` biases the k-NN query point (it's one of the 23
dims) but doesn't drive its own post-hoc solver. Rating-weighted neighbours got dropped
entirely (§9 — the data doesn't support it). Per-axis "eased it" rationale strings (the
original spec's idea) aren't built — `notes: string[]` carries coarse diagnostics today; a
real per-axis comparison is `requestedFlavor` vs `achievedFlavor`, already returned, just not
turned into prose. A live "should we bias toward BJCP guideline targets or toward what the
corpus's actual submitters enjoy brewing" tension was raised and deliberately not resolved —
staying BJCP-anchored for now (more defensible, more explainable, immune to a possibly
skewed self-selected sample) but worth revisiting if it starts feeling like it's fighting
what people actually want to drink.

Reused, not duplicated: `RecipeCalculationService`, `FermentableCalculationService`,
`VolumeCalculationService`, `HopFlavorCalculationService`, `matchBjcpStyle`, `getBjcpStyleSpec`,
`FERMENTABLE_PRESETS`/`HOP_PRESETS`/`YEAST_PRESETS`. Several real bugs (gravity-units, hop-name
casing, vote-splitting, identical recipes across same-family styles) only surfaced by firing
real queries against the real cloud, never the synthetic-fixture unit tests alone — see §9.

A manual test surface exists for all of this: `app/lab/steering-playground/` (dev-only,
sliders + radars + a results panel, backed by `app/api/lab/steering/` — see §2's containment
exception). Not Phase 3 — no builder integration, no persistence, just a fast way to fire a
query and eyeball the recipe without editing test files.

---

## 11. Next: Phase 3 — builder UI

Start-from-style prefill + a steering panel reusing `HopFlavorRadar` + a new malt radar +
sliders + the style-fit meter + per-change rationale (turn `requestedFlavor`/`achievedFlavor`
into the "got your tropical hops; eased the roast" prose the original spec wanted) +
ingredient locks. Not started. `styleNorms` (§10) already gives the radar's "what's typical
for this style" reference band for free — the playground (`FlavorRadar` series ordering:
norm band first/behind, then requested/achieved) is the pattern to port over, not something
Phase 3 needs to re-derive. A `creativity` slider (§6/§10) is likewise ready to expose
directly; the playground's default (0.3, unlabelled beyond a one-line caption) is a starting
point, not a validated UX — Phase 3 should watch whether real users even want to touch it
before promoting it beyond an "advanced" control.

One real architectural question Phase 3 needs to answer first: `loadCloud()` is Node-`fs`-only
(reads a 69 MB gitignored file) — that's fine for offline scripts and Vitest, but the browser
can't do that. The dev playground (§10) already demonstrates one option — a server API route
that runs the steering engine server-side and returns just the synthesized recipe, with a
module-level cached `RecipeSteeringService` instance so only the first request pays the
load cost — but it's a throwaway dev route, not a decision that Phase 3's real integration is
locked into that approach. Other options still on the table: a precomputed/reduced index
shipped at build time (the full cloud is overkill if the UI only ever needs k-NN against a
coarser summary); or keep the full engine server-only behind a *real* (rate-limited,
production-safe) API route rather than the playground's dev-only one. Either way, the
containment boundary flexes at the API layer, not by importing the lab module into client code.
