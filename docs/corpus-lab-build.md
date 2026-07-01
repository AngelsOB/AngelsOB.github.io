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

---

## 3. Phases & status

- **Phase 0 — EDA** ✅ done. Corpus shape known.
- **Phase 1 — pipeline + cloud** ✅ **done and validated.** Grain + yeast mappers, filter,
  per-recipe vectors, persisted cloud, per-style summaries, PCA map, k-NN purity tuning.
- **Phase 2 — steering engine** ⬅ **NEXT** (see §10). Fire a query, synthesize a recipe.
- **Phase 3 — builder UI** — not started (start-from-style prefill + steering panel).

Nothing is committed yet — the whole milestone is uncommitted on the working branch.

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
| `offline/buildCloud.ts` | **Pure vector logic**: `composition`, `passesFilter`, `parseHopAddition`, `recipeToVector` (reuses app `HopFlavorCalculationService`), `gristArchetypePct`. |
| `offline/buildCloud.test.ts` | Unit tests (always run) + **gated** full-corpus validation → `out/style-summary.json`. |
| `offline/cloudViz.test.ts` | **Gated**: persists the full cloud (`out/cloud.ndjson`, gitignored) + PCA → `out/cloud-viz.json`. |
| `offline/neighborPurity.test.ts` | **Gated**: k-NN style-purity analysis + **yeast-weight sweep**. |
| `out/*.json`, `*.review.tsv` | Committed facts-only artifacts (maps, style-summary, cloud-viz). |
| `raw/recipes_full.txt` | Gitignored raw corpus (179 MB). |

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
  archetypes, then synthesize ONE clean bill. Small `k` + sharp kernel; average at the
  **archetype** level; weight neighbours by `rating`.
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
- **ABV is a user choice at build time**; the builder's existing reverse target-ABV solver
  materialises weights, so the corpus/outputs are purely proportional.
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

---

## 10. Next: Phase 2 — the steering engine

Build a pure, test-first `RecipeSteeringService` (in the lab module) that turns a target
into a synthesized recipe:

1. **Load the cloud** (`cloud.ndjson`) — vectors + grist(`g`) + hops(`hp`) + yeast(`yc/ys/yn`).
   Reconstruct the same feature vector (z-score continuous with stored/recomputed mean-std;
   yeast block weighted `W≈3`).
2. **Query** = a target point: chosen style + desired flavour (hop radar + malt radar) +
   ABV / IBU / SRM / body targets + optional locked ingredients + optional yeast.
   Optionally **soft-gate** to the style family.
3. **k-NN** to the target (weighted distance; kernel-weight by closeness; weight neighbours
   by `rating`). **Average the TARGETS** (flavour + stats + typical grist archetypes + modal
   hops-by-role + modal yeast) — do NOT sum raw ingredient lists.
4. **Synthesize one clean bill**: modal base malt + a few specialty archetypes at blended %,
   representative hop varieties per timing bucket, the modal neighbour yeast. Run it through
   the app's `RecipeCalculationService`; **ABV is user-set** → use the reverse target-ABV
   solver to materialise weights.
5. **Out-of-bounds / density signal**: distance to the k nearest = the style-fit meter.
   Default = snap toward the nearest real cluster (honest); an explicit "experimental" mode
   is the only place extrapolation is allowed; per-axis honesty ("got your tropical hops;
   nobody pairs that with this much roast, so I eased it").

Reuse: `RecipeCalculationService`, `matchBjcpStyle`/`getBjcpStyleSpec`, `HopFlavorCalculationService`.
Keep it in the contained module, test-first (Vitest), and validate by firing example queries
and eyeballing the synthesized recipes.

Then Phase 3: builder UI (start-from-style prefill + steering panel reusing `HopFlavorRadar`
+ a new malt radar + sliders + the style-fit meter + per-change rationale + ingredient locks).
