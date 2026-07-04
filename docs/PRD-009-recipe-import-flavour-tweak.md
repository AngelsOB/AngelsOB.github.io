# PRD-009: Recipe Import & Flavour Tweak (Corpus Lab "Restyle")

> **Status:** Draft
> **Created:** 2026-07-03
> **Depends on:** Corpus Lab steering module (`src/modules/corpus-lab/`, Phase 1+2 — the k-NN cloud, the malt/hop flavour models, and the residual-correction operators; currently uncommitted). Optionally reuses the existing BeerXML import path (`BeerXmlImport.ts`) and the app `Recipe` model.
> **Goal:** Let the Corpus Lab take a *specific* recipe someone already has — theirs, a shared one, a curated starter — and make the *smallest* set of ingredient changes that nudges it toward a flavour they describe, while keeping it a real, brewable beer. Hand back a **diff**, not a fresh recipe.

---

## Context

The steering engine (`RecipeSteeringService.steer()`) is a **generator**. It walks *toward* a target starting from a style prototype:

```
style centroid → k-NN neighbourhood → reconstruct a recipe from scratch → correct → solve
```

The output owes nothing to any specific input recipe. That is exactly right for its job — "show me the median hazy IPA, leaning tropical" — but it means there is no way to bring your *own* recipe into the lab and nudge it. If you handed `steer()` your pale ale and asked for "a touch more tropical," it would discard your recipe entirely and rebuild the median tropical-ish beer of that style. You would lose the thing that made it *yours*.

The feature this PRD describes flips the anchor. Stated as a one-liner, in the same spirit as the steering module's "retrieval is not controllable generation":

> **Generation is not editing.** `steer()` answers *"what's a beer like this style, nudged this way?"* Restyle answers *"what's the smallest change to **this** beer that nudges it this way?"*

That is a **counterfactual edit** — a minimal perturbation under a flavour constraint — not generation. The objective changes from "minimize distance to the neighbourhood" to "minimize distance to the user's original recipe, subject to hitting the requested flavour delta." Same flavour model, opposite anchor.

The good news, established by an audit of the current code, is that this is a **reweighting of pieces that already exist**, not a second engine. Most of the hard machinery — the forward flavour model, the correction operators, the featurization logic, the plausibility scoring, the solvers — is already built and can be pointed at a new anchor.

## Goals

- Ingest an arbitrary `Recipe` (app model) and place it in the Corpus Lab's flavour space — its 9 malt axes, 9 hop axes, and core stats — reusing the same classification the cloud was built from.
- Let a user express a **relative** flavour tweak ("a bit more tropical," "less caramel") against *their* recipe's current profile, not an absolute style target.
- Produce a minimally-edited recipe that moves the requested axes while leaving everything else as close to the original as possible, and that stays brewable and plausible (a real beer someone could brew).
- Return the result as a **human-readable diff** ("bumped Citra 40 g → 60 g; added a 15 g Galaxy dry hop") rather than an opaque new recipe.
- **Degrade gracefully.** A slight tweak is the sweet spot; a large ask ("turn my pale ale into a stout") is no longer a tweak, and the tool should say so and offer to regenerate via `steer()` instead of quietly rewriting the whole recipe.
- Stay entirely local — no LLM, no API calls, no external data — like the rest of Corpus Lab.

## Non-Goals

- **Full regeneration.** That is what `steer()` already does; Restyle explicitly preserves the input. When the ask is too big to be an edit, it hands off to `steer()`, it does not become it.
- **A general recipe editor.** The builder already edits recipes by hand. Restyle only makes flavour-directed edits; it is not a UI for arbitrary changes.
- **Sensory validation / scoring.** The flavour model is a coordinate system, not a lab instrument (inherited caveat from the steering module). Restyle does not grade a recipe or claim tasting-panel truth.
- **A curated substitution database.** "What can I swap for Citra" is a real feature, but Restyle sources allowable edits from the corpus (what real similar recipes do), not a hand-authored swap table. A dedicated substitution model is a future PRD.
- **Retargeting arbitrary numeric stats.** Scope is flavour tweaks (malt/hop axes) plus the dials `steer()` already supports (ABV, IBU, SRM as optional secondary asks). It is not a general "solve my recipe to these 12 numbers" tool.
- **An LLM interpreting free text.** The flavour wheel *is* the query, same as the rest of the lab. "A bit more tropical" is a drag on an axis, not a parsed sentence.

---

## Design

### The reframe, concretely

Two entry points share the back half of one pipeline:

```
steer(query):        centroid + target  → k-NN neighbourhood → RECONSTRUCT bill → correct → solve → result
restyle(recipe, Δ):  featurize(recipe)  → counterfactual k-NN → EDIT bill in place → correct → surgical-solve → diff
                                           └── new ──────────┘   └── corrections reused as the edit engine ──┘
```

The correction operators (`correctMaltGristToward`, `correctHopScheduleToward`) become the **edit engine**. The neighbourhood's role changes from "the thing we rebuild from" to "the thing we diff against to find allowable edits." Everything downstream of the edit — brewability enforcement, the solvers, the `styleFit` plausibility signal, the result assembly — is shared logic invoked more conservatively.

**Both features coexist — Restyle is purely additive.** `steer()` is not modified; Restyle is a new entry point plus new helpers (`featurize`, the counterfactual k-NN, the delta-target handling, the diff types). The *only* shared code it extends rather than merely calls is the pair of correction operators — a new *reduce* direction and delta targets — and those extensions are **opt-in and default-off, so the generate path stays byte-identical**, the same discipline the rest of the module already follows (a reduce step only fires on a negative delta, which `steer()` never produces, and is gated regardless). There is **one cloud and one flavour model**: the two features are two query modes over the same substrate, not two models to keep in sync. They also **compose** — generate a base template with `steer()`, then pass that `Recipe` straight to `restyle()` to tweak it.

### What we reuse (the leverage)

| Piece | Today's role | Restyle role | Change needed |
|-------|-------------|--------------|---------------|
| `aggregateMaltFlavor`, `hopFlavorCalculationService.calculateCombinedFlavor` | Score a reconstructed bill | Score the import + every edited variant | **None** — it already scores any recipe |
| `correctMaltGristToward` / `correctHopScheduleToward` | Close a residual gap on a reconstructed bill | The core minimal-edit operator on the imported bill | Add a *reduce* direction; accept a delta target (see below) |
| `sanctioned` param on the corrections | Ingredients the neighbourhood used | The tiered edit menu (own bill → counterfactual neighbours → DB) | **None** — swap the set in, no signature change |
| `prevalence` param on the corrections | Bias toward common in-style grains | Bias toward the recipe's *own* ingredients (Tier-1 conservatism) | **None** — feed it the import's own bill |
| `enforceGristBrewability` | Guarantee a mashable reconstructed grist | Guarantee edits stay mashable | **None** |
| `styleFit` / `weightedDistance2` / baseline ratio | "How far from the dense region is this query" | "Is the edited recipe still near real beer" (guardrail) | **None** — reused as a post-edit check |
| Solvers (`calculateWeightsFromPercentsAndABV`, `solveHopsForTargetIBU`, `solveMashTemp`) | Re-derive weights/IBU/mash from scratch | Optionally re-solve **only** the dimensions the user retargeted | Invoke surgically, not always-on |
| `SteeringResult` fields (`axisMax`, `axisDialMax`, `styleNorms`) | Scale the radars, show the style "box" | Same — show the import against its style's norms | **None** |

The strongest single reuse: the correction functions already take `(existingBill, target, sanctioned, prevalence)` and greedily, boundedly nudge a bill gentlest-ingredient-first without inventing anything outside `sanctioned`. That *is* "change a few ingredients to hit a slight tweak." We are largely re-purposing an operator that already exists, not writing a new one.

### New component 1 — recipe featurization

`featurize(recipe: Recipe): { row: number[]; malt: MaltFlavorProfile; hop: HopFlavorProfile; ... }` — turn an arbitrary app `Recipe` into the same 23-dim point + flavour profiles the cloud uses.

The hop side is nearly free: hop flavour already maps by name via `HOP_FLAVOR_BY_LOWER`, and `hopFlavorCalculationService` computes the combined profile from a schedule.

The malt side is the **real new dependency**, and the honest sizing matters. The cloud maps a fermentable name → archetype via a **static `archetype-map.json`** keyed by *corpus* ingredient strings, generated offline by the `classify()` keyword/colour rules in `build-archetype-map.mjs`. An imported recipe's preset names only partly overlap that map. So the work is one of:

- **(a)** Port `classify()` into a runtime TS module so any ingredient name can be classified on the fly, **or**
- **(b)** Pre-run `classify()` over the app's fermentable presets and ship an extended static map.

`(a)` is preferred (handles user-typed and BeerXML-imported names too). Either way this is *reuse of proven logic* — `classify()` already classified ~149k recipes' worth of free-text names — but it is not literally callable at runtime today. Do **not** lean on `reconstruction.archetypeForPresetName`; it only covers the ~34 canonical presets the generator emits.

### New component 2 — relative (delta) targets

The target is a delta from the import's own achieved profile, not an absolute value overlaid on a centroid (which is what `buildQueryRow` does today):

```
requestedProfile = featurize(recipe).flavour  // start from where the recipe actually is
requestedProfile[axis] += Δ                    // "a bit more tropical" holds the rest fixed
```

Unpushed axes carry the recipe's *current* value as their target, so the edit engine is rewarded for leaving them alone. This is the mechanism that makes "hold everything else" a first-class property rather than a hope.

### New component 3 — the minimal-edit engine

The corrections become the edit engine with three changes:

1. **A reduce direction.** Both corrections today only *add* a donor to close a deficit (`target − achieved > 0`); "less caramel" has no path. Reducing or removing an ingredient (and renormalising while staying above the diastatic-base floor) is genuinely new.
2. **Explicit parsimony.** Today "few grains touched" is an *implicit* side effect of the greedy ladder. Make it an objective: prefer one change over three, prefer re-proportioning an existing ingredient over introducing a new one, and cap the number of touched ingredients for a "slight" tweak. This cap is the **preservation-vs-reach dial** (see Risks).
3. **Prevalence from the import's own bill.** Feeding the existing `prevalence` param the recipe's own ingredients makes the correction *prefer bumping what's already there* — most of Tier-1 conservatism for free.

### New component 4 — the counterfactual-neighbour edit menu

This is the interesting new use of the cloud, and the source of the `sanctioned` set. Instead of "find a neighbourhood to reconstruct from," find the import's **counterfactual neighbours**: real recipes near it but *higher on the axis being pushed*. The **difference** between the import and those neighbours is the allowable-edit menu — "beers like yours that are more tropical lean harder on Citra and add a small Galaxy dry hop." That is k-NN *along the target gradient*, and the diff (not a reconstruction) is the output.

It gives a clean escalation ladder, mirroring the "escalate only as needed" pattern already used at the ingredient and neighbourhood levels:

- **Tier 1 (most conservative):** re-proportion only the recipe's own ingredients. Zero new ingredients. (You have Citra + Cascade → lean on the Citra.)
- **Tier 2:** introduce ingredients the counterfactual neighbours use. Grounded, plausible additions.
- **Tier 3:** the whole ingredient DB. Unconstrained; only if the user explicitly opts in.

Escalate a rung only when the gentler one cannot reach the requested delta (probed the same way the adaptive style gate probes reachability today).

### Preserve, don't re-derive (surgical solve)

`steer()` re-derives grain weights from an ABV target and re-solves IBU from scratch. For an import that is wrong — it would blow away the brewer's chosen batch size, absolute weights, and bitterness. Restyle preserves absolute quantities and invokes the solvers **only** on dimensions the user explicitly retargeted (e.g. if they also asked for a specific IBU). Untouched dimensions keep the brewer's numbers exactly.

### Output — a diff, not a recipe

The natural output of a minimal-edit pipeline is a changelog. `RestyleResult` carries the edited recipe *and* a structured, human-readable list of edits:

```typescript
type RecipeEdit =
  | { kind: "adjust"; ingredient: string; from: Amount; to: Amount; reason: string }
  | { kind: "add";    ingredient: string; amount: Amount;            reason: string }
  | { kind: "remove"; ingredient: string;                            reason: string };

type RestyleResult = {
  recipe: Recipe;                 // the edited recipe, ready for the builder
  edits: RecipeEdit[];            // the diff, for the UI to render as a changelog
  requestedFlavor / achievedFlavor / styleNorms / axisMax / styleFit  // reused from SteeringResult
  tooLargeForTweak?: boolean;     // graceful-degradation flag → offer steer() instead
  notes: string[];
};
```

Presenting the result as "here's what we changed and why" is both better UX for "tweak my beer" and a faithful reflection of what the engine actually did.

### Entry point (signature sketch)

```typescript
// alongside steer(query) on RecipeSteeringService
restyle(
  recipe: Recipe,
  tweak: {
    malt?: Partial<MaltFlavorProfile>;   // deltas, e.g. { caramel: -1.2 }
    hop?:  Partial<HopFlavorProfile>;    // deltas, e.g. { tropical: +1.5 }
    abv?: number; ibu?: number; srm?: number;   // optional absolute secondary asks
  },
  opts?: {
    editBudget?: number;        // max ingredients touched (the preservation dial); default small
    sanctionTier?: 1 | 2 | 3;   // own bill / counterfactual neighbours / whole DB; default 1→escalate
    style?: string;             // override the auto-matched style used for norms + neighbours
  },
): RestyleResult
```

Style is auto-resolved from the recipe via `matchBjcpStyle` (for the style norms and the counterfactual neighbourhood), overridable when the recipe is mislabelled or unlabelled.

---

## Implementation Plan

### Phase 0 — Featurize & reflect (no editing yet)

The low-risk wedge. Build `featurize(recipe)` (port `classify()`, reuse the hop path) and **display the imported recipe's flavour on the existing radars**, next to its matched style's `styleNorms` box. No edits. This:

- validates the featurizer against real recipes (the one genuinely new dependency), before anything is built on top of it;
- reuses the whole `styleNorms` / `axisMax` / `axisDialMax` display already returned by `steer()`;
- is independently useful ("here's what your recipe tastes like vs a typical example of its style").

Ship a `featurize.test.ts` that round-trips known recipes (a canonical stout scores high roast/coffee; a hazy scores tropical/citrus, ~zero caramel).

### Phase 1 — Tier-1 edit engine (own ingredients only)

- Delta targets (New component 2).
- Extend the corrections with the *reduce* direction and explicit parsimony (New component 3), `sanctioned` = the recipe's own ingredients, `prevalence` = the recipe's own bill.
- Surgical solve (preserve untouched quantities).
- `RestyleResult` + the diff.
- Graceful-degradation flag when Tier-1 cannot reach the delta within the edit budget.

Tests: a tweak moves the pushed axis toward the request while non-pushed axes stay within ε and ≤ `editBudget` ingredients change; brewability invariant holds; a locked/absolute IBU is preserved.

### Phase 2 — Counterfactual-neighbour edits (Tiers 2–3)

- The counterfactual k-NN (New component 4) supplying the Tier-2 `sanctioned` menu.
- Reachability-probed escalation Tier 1 → 2 → 3.
- The `styleFit` plausibility guardrail applied post-edit (flag edits that leave the dense region).

### Phase 3 — UI & product surface

- Wire into the Corpus Lab studio (`src/modules/corpus-lab/ui/`) and/or an "import & tweak" flow that can consume a `Recipe` from: an existing saved recipe, the existing BeerXML import path, or a curated starter set.
- Render the diff as a changelog; render the before/after on the radars.
- Graceful degradation: when `tooLargeForTweak`, surface "this is a rebuild, not a tweak" and offer the `steer()` path.
- Hand-off to the builder (the studio already hands recipes to the builder — reuse that).

---

## Data Quality & Maintenance

- **Featurizer accuracy on app/user ingredient names.** `classify()` was tuned on corpus strings; app preset names and user-typed names differ. Keep the offline review-file habit: dump the classification of the app's own fermentable presets and eyeball the low-confidence calls. An unmatched malt silently scores zero flavour (same defensive behaviour as elsewhere) — acceptable, but track the unmatched rate.
- **The flavour model is a coordinate system, not sensory truth** (inherited). A tweak that "lands" means the model's axis moved as asked, not that a taster would agree. Some of any miss is model fuzz, not a bad edit.
- **Edit distance is a proxy for "few changes."** Minimising touched-ingredient count and total shifted fraction is a stand-in for a brewer's sense of "you barely changed my recipe." It is a good proxy, not the real thing; revisit if edits feel disproportionate.
- **Corpus vintage** (inherited). The counterfactual neighbours reflect 2010s homebrew, so "how brewers get more tropical" is period-flavoured (more crystal-adjacent than a modern brewer might do). Faithful to the data; a modern-taste bias layer is opinion, kept separate.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Featurizer misclassifies imported malts, so the "before" profile is wrong and every edit is off | Medium | High | Phase 0 exists precisely to validate this before building on it; round-trip tests on canonical recipes; offline review file over the app's presets; track unmatched rate |
| Preservation-vs-reach: a big ask quietly rewrites the whole recipe and stops feeling like *their* recipe | Medium | High | The `editBudget` cap is a hard dial; `tooLargeForTweak` degrades to an explicit "this is a rebuild" hand-off to `steer()` rather than silently over-editing |
| Edits feel wrong to experienced brewers ("why did it add *that*") | Medium | Medium | Tier-1 (own ingredients) is the conservative default; the diff always states a reason; Tier-2 additions are corpus-sanctioned (what real similar recipes do), never invented |
| The *reduce* direction breaks brewability (strips too much base, un-mashable grist) | Low | Medium | Route every edited grist through the existing `enforceGristBrewability` floor, same as reconstruction |
| Counterfactual k-NN per edit is slow (full-cloud pass) | Low | Medium | The neighbourhood is computed once per tweak and shared across passes, exactly as `steer()` shares its k-NN; cache per (recipe fingerprint, style) |
| Scope creep into a general recipe editor | Medium | Low | Non-Goals are explicit; Restyle only makes flavour-directed edits and hands off everything else to the builder |

## Success Criteria

- **Featurizer round-trips.** Canonical recipes score as expected (stout → high roast/coffee; hazy → tropical/citrus, ~0 caramel), within a documented tolerance, under test.
- **Slight tweaks land and stay contained.** For a small delta, the pushed axis moves at least a defined fraction of the request, non-pushed axes stay within ε of the original, and no more than `editBudget` ingredients change — verified in tests, not by eye.
- **Preservation holds.** Untouched dimensions (batch size, absolute weights, IBU when not retargeted) come out byte-identical to the import.
- **Brewability invariant.** Every edited recipe still passes the diastatic-base floor and adjunct caps.
- **Graceful degradation fires.** An over-large ask sets `tooLargeForTweak` and offers `steer()` instead of silently rewriting.
- **The diff is legible.** Every result renders as a short, reason-annotated changelog a brewer can read.
- **Local-only.** No API calls, no LLM, no external fetches — consistent with the rest of Corpus Lab.

---

## Future Considerations

- **Substitution intelligence** (separate PRD): "what can I swap for Citra" as a first-class corpus-derived model, feeding Tier-2 with substitution-aware edits.
- **Multi-tweak sequences / undo:** treat a session as a chain of small edits ("more tropical," then "a little less bitter"), each a diff on the last, with the preservation anchor updating between steps.
- **"Explain why" depth:** surface the counterfactual neighbours behind an edit ("recipes like yours that are more tropical, N of them, use…") as an evidence panel.
- **Steer → tweak in one flow:** generate a median brew with `steer()`, then let the user tweak *that* output with Restyle — the two entry points composing on the same result object.
- **AI assistant tie-in (PRD-003):** if the conversational assistant ships, "make it a bit more tropical" in chat could resolve to a `restyle()` call, with the wheel drag and the sentence being two front-ends to the same engine.
- **Learn-section writeup:** "generation is not editing" is a clean companion piece to the existing "retrieval is not controllable generation" explainer — the same discipline (name the problem, reuse the machinery, hold the tension) applied to a second problem.

---

*Last updated: July 2026*
