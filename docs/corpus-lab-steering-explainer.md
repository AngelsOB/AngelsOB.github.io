# Steering the Median Brew

*How ~180,000 homebrew recipes became a controllable recipe engine — and what it actually takes to turn retrieval into controllable generation, without an LLM.*

> Draft for the Learn section / portfolio. Plain markdown; styling comes later.

---

## What it does

You pick a beer style. You get a solid, brewable starting recipe — the "median brew" for that style. Then you steer it: drag a flavour wheel to say "more tropical," "less caramel," "roastier," and the recipe changes to match, while staying a real, plausible beer you could actually brew.

There is **no language model** anywhere in this. The flavour wheel *is* the query. Everything downstream is a retrieval-and-reconstruction pipeline over a large corpus of real recipes, run through the app's own brewing calculators so every number (OG, IBU, SRM, ABV, mash temperature) is real rather than hallucinated.

The interesting part isn't the beer. It's that this is a small, self-contained case study in a problem that shows up all over applied ML: **you have a retrieval system, and you need it to do controllable generation.** Those are not the same thing, and the gap between them is where all the work lives.

---

## The recipe cloud

The corpus is the Brewers Friend Kaggle dataset — roughly 180,000 ingredient-level homebrew recipes. After filtering (~149k kept), each recipe is embedded into a **23-dimensional feature space**:

- **9 malt-flavour axes** (grainy, biscuit, caramel, dark fruit, chocolate, coffee, roast, nutty, honey), computed from the grain bill via a hand-authored malt-flavour lexicon.
- **9 hop-flavour axes** (citrus, tropical, stone fruit, berry, floral, grassy, herbal, spice, resin/pine), computed from the hop schedule via the app's real hop-flavour model.
- **5 scalar axes**: gravity, IBU, SRM (color), a bitterness-to-gravity ratio, and a grist "body" signal.

Every dimension is **winsorized to its [p1, p99] range and then z-scored**, so a handful of garbage self-reported values (an OG parsed as 1.200, an IBU of 4,768) can't inflate the scale and flatten every real recipe to z ≈ 0. On the clipped data the standard deviation approximates the true spread, so every input ends up unit-variance: fair, granular, and outlier-proof. Yeast is handled separately as a sparse multi-hot block (strain group + substitutes), kept out of the flavour distance so a flavour push isn't diluted by strain.

A query is a **style plus optional flavour targets**. The pipeline:

1. Compute the **style centroid** — the average recipe of that style — as the starting point.
2. **Overlay** the user's flavour targets onto that centroid to get a query point.
3. **k-NN**: find the nearest real recipes to the query point.
4. **Reconstruct** one clean recipe from that neighbourhood — a grain bill (role by role), a hop schedule (bucket by bucket), a yeast.
5. Run it through the **real brewing calculators** and hand back a genuine, editable recipe.

That's the naive system. It produces plausible beers. It also has a subtle, fundamental problem.

---

## The core problem: retrieval is not controllable generation

Trace what a flavour target actually does in the naive pipeline. It moves the **query point** — i.e., it changes *which neighbourhood* you search. Then reconstruction rebuilds a recipe from that neighbourhood by **popularity vote** (the most-used malt per role, the most-used hop per bucket). The achieved flavour of the output is *whatever falls out of that vote.*

Nothing in that path ever looks at the target again. The output is never optimized toward what you asked for.

This is the whole thing in one sentence: **the target selects the neighbourhood, but never the recipe.** So the achieved flavour routinely misses the requested flavour, and — importantly — popularity-vote reconstruction is a regression-to-the-mean machine. Even when you steer the neighbourhood toward "berry," the *modal* choice pulls straight back toward the generic center of that neighbourhood.

Naming this precisely is what unlocked every fix. The system is a **retrieval** system being asked to do **controllable generation**, and the two goals — *realism* (only output things real brewers made) and *control* (hit the target) — are in genuine tension. In the naive version, realism wins every tie, by construction.

Everything below is the work of closing that gap without giving up the realism.

---

## Fix 1 — Close the loop (multi-candidate rerank)

The first move is to stop accepting the single popularity-vote output and instead **generate several candidates and select the best-aligned one.** This is best-of-N sampling / generate-and-rank, and it's what turns retrieval into *retrieval-augmented optimization*:

- Generate N reconstructions off the **same** neighbourhood (the expensive k-NN pass is done once and shared; only the cheap reconstruction repeats).
- Compute each candidate's **achieved flavour** by running it through the real flavour model.
- Keep the candidate whose achieved flavour is **closest to the request.**

Two design details that matter:

- **Candidate 0 is the deterministic baseline** — literally the old single-shot output. It's always in the pool, so the rerank can only ever match or beat the naive result, never regress.
- A **`wildness`** knob controls the scoring. Pushed axes are always weighted heavily; unpushed axes are weighted `(1 − wildness)`. At wildness 0 the recipe is rewarded for staying on-style everywhere you *didn't* push; at wildness 1 only the pushed axes matter and the rest may drift. This directly encodes the realism-vs-control dial as a user-facing setting.

The candidates differ because reconstruction has a seeded exploration parameter — each alternate samples different (but still neighbourhood-sanctioned) ingredients. So the diversity is real, and every candidate is still realism-constrained.

Measured effect: **~15–27% reduction** in mean pushed-axis error versus the single-shot baseline.

---

## Fix 2 — The move retrieval structurally can't make (residual correction)

The rerank has a hard ceiling. It varies *which* ingredient fills a role, but a role's *fraction* is fixed by the neighbourhood average, and malt flavour is fraction-driven. If the whole neighbourhood only uses a little caramel malt, no reroll can produce a caramel-forward beer — there's simply no candidate with enough of it.

So after reranking, a bounded **residual correction** closes the reachable part of the remaining gap by *using more* of the grain (or hop) that drives the deficit axis. It's greedy, bounded, and it **never invents an ingredient** — it only reaches for grains real neighbours actually used.

The correction is also where a real piece of **domain knowledge** got encoded, principled-ly. The first version reached for the *densest* lever — to add honey flavour it grabbed honey malt, to add caramel it grabbed crystal — which is mathematically efficient and completely wrong for how brewers work. A brewer adds the *least-assertive* grain that does the job, and only reaches for a big specialty malt when they have to. So the correction climbs an **intensity-ordered ladder** — base → munich → crystal → roast — taking the gentlest grain that still moves the axis and escalating only when it's maxed or saturated.

That single change fixed a lot: a honey push now leans on vienna and munich, with honey malt appearing only as a 2–4% trace at the extreme, instead of a slab of honey malt in a beer that should never contain it.

(There's a nice bug in here worth keeping for the write-up: because each step rescales the whole grain bill, a grain that "maxed out" would drop back under its cap and get re-used, so the escalation *thrashed* on gentle grains and never climbed — cratering the reachability of some axes. The fix is a per-axis "exhausted" set: once you climb past a grain, you don't return to it. Monotonic escalation.)

---

## Fix 3 — Search the subspaces, not their intersection (split neighbourhoods)

Pushing *both* malt and hop hard exposes a curse-of-dimensionality problem. Roasty malt is common (stouts). Tropical hops are common (IPAs). Roasty-**and**-tropical together is almost nonexistent — the *joint* distribution is far sparser than either marginal. So the single joint query point drifts into a corner of the cloud almost no real recipe occupies, and reconstruction ends up averaging weird outliers.

The fix is to **search a separate neighbourhood for each bill**: the grain from real recipes with your *malt* profile, the hops from real recipes with your *hop* profile — each dense — and each grounded at the style centroid on the *other's* dimensions. The malt↔hop correlation only "breaks" exactly when you deliberately ask for a combination real brewers don't make, which is the whole point of steering. When you don't push, both neighbourhoods collapse back to the same style neighbourhood and the correlation is preserved.

---

## Fix 4 — Variation as a feature (the reroll pool)

Closing the loop created a new problem: the rerank *converges*. It returns the single best-aligned recipe, so hitting "Another take" re-found the same winner and showed almost no variation.

But the 16 candidates it builds every time are diverse and *all* well-aligned — the system was computing plenty of good variety and throwing 15 of them away. So "Another take" now rotates through the **top-N near-best** candidates, seeded by a take counter (reproducible per seed). The first result is still the true best; rerolls surface the other, equally-on-target recipes.

This is also where a good product instinct beat the math: the goal isn't to always return the single optimum. **The occasional "off" roll is character** — it's what lets a brewer find something they wouldn't have thought of, and it's what keeps the tool from feeling deterministic. Variety is a feature, not noise to be minimized.

---

## Fix 5 — The crystal investigation (a debugging case study)

This is the most instructive part, because the first three hypotheses were all wrong, and each was killed by measurement rather than argument.

**Symptom:** crystal malt kept showing up in hazy IPAs, where modern brewers don't use it. It felt deal-breaking.

**Wrong hypothesis 1 — the correction is adding it.** Ruled out: crystal appeared *at rest*, with no push, and the correction only runs on pushed axes. Measured with the correction toggled off; crystal still there.

**Wrong hypothesis 2 — the reconstruction over-includes a rare grain.** Ruled out by going to the corpus: 60% of the corpus's *American* IPAs genuinely use crystal (the dataset is 2010s homebrew, a crystal-forward era), and our reconstruction was faithfully tracking that — while correctly dropping crystal for hazies and pilsners. The reconstruction was behaving.

**The actual cause — neighbourhood pollution.** The default gate "searched the whole cloud" and only soft-biased toward the style. So a hazy's k-NN neighbourhood was only **15 of 40 records actually hazy** — the other 25 were crystal-heavy American IPAs sitting nearby in flavour space, bleeding their crystal into the hazy reconstruction.

That produced two fixes, which together form the "escalate only as needed" ladder at the *neighbourhood* level to match the one we already had at the *ingredient* level:

- **Adaptive style gate.** Stay strict — the exact BJCP style — by default, and widen a rung (style → family → whole cloud) *only when a push genuinely can't be hit in-style* (probed by measuring how far the corrected bill still sits from the target). At rest, nothing is pushed, so it never widens. A hazy is now built from a **40/40 hazy** neighbourhood. Roast on a hazy correctly widens the grain search (hazies have no roast) while keeping the hop search pure.

**Then a second, deeper data problem surfaced** when the same crystal showed up in *American Light Lagers* — a style that is 100% locked and has thousands of records, so pollution couldn't explain it. Going to the corpus again: of the recipes literally labeled "American Light Lager," only **a third are actually pale** (≤4 SRM, 4% crystal); the other two-thirds run 4–12 SRM with 32–73% crystal — mislabeled ambers. The style *average* was being computed over garbage.

- **BJCP data-quality filter.** Before averaging a style, drop records that violate the style's own color spec — a "light lager" over ~4 SRM is, by definition, not one. It reuses the BJCP style guidelines the app already loads, with a multiplicative edge buffer (`[lo × 0.5, hi × 1.3]`) so the buffer scales with how variable a style is and the filter accommodates real style drift rather than hard-locking. Light-lager crystal went **5% → 0%**, with the mislabeled two-thirds filtered out of the average.

The lesson from this whole arc: **corpus labels are noisy, so validate against domain ground-truth (the style specs), not the labels.** That's a very real ML-on-messy-data problem, and it fell straight out of asking "wait — is the average I'm computing even clean?"

---

## The evidence (ablation)

None of the above is worth anything if it doesn't beat the naive baseline, so there's a gated benchmark that sweeps naive → full across seven styles, measured against the corpus itself:

- **Off-style grain %** — share of the grain bill in ingredients used by <10% of the style's real recipes (the crystal-in-hazy problem). Lower is better.
- **In-band %** — fraction of the 18 flavour axes whose achieved value sits inside the style's real p10–p90 range (representativeness). Higher is better.
- **Alignment error** — normalized RMS of achieved-vs-requested on the pushed axes (hitting the target). Lower is better.

```
variant          off-style%   in-band%   alignErr
naive                1.1%        75%      0.188
+adaptiveGate        0.3%        99%      0.161
+rerank              0.3%        99%      0.175
+correction          0.3%        99%      0.088
full(+split)         0.3%        99%      0.088
```

Read it as an ablation, because each row isolates what one layer earns:

- **Adaptive gate** is the *in-style* win: off-style 1.1% → 0.3%, representativeness 75% → 99%. It also improves alignment, because staying in-style keeps the neighbourhood on-target.
- **Correction** is the *alignment* win: 0.175 → 0.088, roughly halved. This is what makes a push actually land.
- **Rerank** is ~neutral on alignment — very slightly worse — because the reroll pool deliberately trades a sliver of best-alignment for *variety*. That's the character tradeoff, chosen on purpose; its value is variation plus being the substrate the correction rides on.
- **Split** is neutral *here* — it earns its keep on the conflicting-push cases (roasty + tropical) this sweep doesn't stress.

So: **gate = in-style, correction = on-target, rerank = character, split = the weird combos.** Every piece pulls its weight, and the one measured "cost" is exactly the design decision made on purpose.

---

## What's honest about it

- **There are no human ratings.** "Best" is measured against the corpus, not against tasters. Representativeness and alignment are proxies; a formal evaluation would need blind sensory panels.
- **The corpus has a vintage.** It's 2010s homebrew, so its "American IPA" is more crystal-forward than a modern one. The system faithfully reflects its data; matching *modern* taste would require a bias layer on top, which is opinion, not data.
- **The flavour model is a coordinate system, not a validated sensory model.** Its job is to make similar beers land near each other (stouts cluster away from pales), not to be spectroscopically correct. Some of any "miss" is measurement noise in the model, not the recipe.
- **The occasional off roll is intentional.** A native minority (e.g., the ~17% of real hazies that do use a little crystal) will still surface sometimes. That's character, and removing it entirely would make the tool feel sterile.

---

## What transfers (for the ML reader)

Strip out the beer and this is a compact tour of moves that generalize:

1. **Name the problem precisely.** "Retrieval vs controllable generation" was the sentence that unlocked every fix. Most of the value was in the diagnosis, not the code.
2. **Close the loop.** A retrieval system becomes controllable by generating candidates, scoring them against the target, and selecting — best-of-N, not one-shot. Keep the deterministic baseline in the pool so you can only improve.
3. **Encode domain knowledge as structure, not rules.** The intensity ladder *is* the brewer's hierarchy, expressed as a sort order, not a pile of if-statements.
4. **Debug by measurement, not intuition.** Three confident hypotheses about the crystal were all wrong; each died to a five-minute query against the data. Being wrong fast and cheaply is the skill.
5. **Trust ground-truth over labels.** Corpus labels were a third reliable; the style specs were the real signal. Ask whether the average you're computing is even clean.
6. **Ablate everything.** The sweep turned "we think this helps" into "here is exactly what each piece earns," including the one thing that trades alignment for variety on purpose.
7. **Hold the tension honestly.** Realism vs control, alignment vs variety, data-fidelity vs modern taste — these don't get "solved," they get dialed, and the dials became `wildness`, the reroll pool, and the BJCP buffer.
