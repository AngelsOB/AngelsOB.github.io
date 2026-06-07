# Ingredient Data — Plan & Handoff

_Living doc for the ingredient-database work. Hops are done; yeast is the next real win. Last updated 2026-06-06._

## Where we are

- **Hops — DONE & committed.** 224 varieties (was 69). Every hop has facts (alpha/beta acids, total oil, cohumulone, origin) plus a 9-axis 0–5 flavor vector. Data: `src/utils/presets.generated.hops.json`, wired through `presets.ts` (`HOP_PRESETS`). Provenance per hop: `flavorSource` (`curated` | `derived`), `flavorConfidence`. Regression test: `src/utils/presets.hops.test.ts`.
- **Credits — DONE.** `CREDITS.md`, `/credits` page (linked in footer Legal), a data-sources FAQ entry. kasperg3 attributed under MIT.
- **Grain — minor reshape, kept.** Added `producer` + `productName` as first-class fields (parsed from "Vendor - Product"; `name` kept as the stable recipe key). Low value (grain was never a real gap — we were already ahead of competitors), but harmless and may power a cleaner picker display later.
- **Yeast — DONE (uncommitted, 2026-06-07).** 143 → **524 strains**, **516 enriched (98%)** with type/form/temp/floc/attenuation(range+midpoint)/alcohol-tolerance/pof/sta1 + provenance. Method = **hybrid**: open BeerJSON facts (BrewTarget `DefaultContent003/004`, upstream brewerwall) for ~373, manufacturer-page scrape (curl + agents, facts-or-null, cite URL) for the gap (231 applied, 214 high-confidence). Cleaned out wine/bacteria/distilling/pitch-variants/dupes.
  - **strainGroup (75 groups / 234 strains) + substitutes (144 strains) = from dmtaylor's "Yeast Master" chart** (cites suregork genomics + Mr. Malty). strainGroup = strict same-isolate (US-05 is its own strain; `1056=A07=Cali`; `WLP001=OYL-004`); substitutes = its `(NOT X)` cousins (US-05 subs = WLP001/1056/A07/Cali). 36/37 popular strains have guidance. Groups/sources in `docs/yeast-straingroups.md`.
  - **Legal reality (verified):** primary genomics (Gallone et al.) ANONYMIZE strains — the commercial crosswalk is community inference (suregork's "guesses"), not peer-reviewed fact. BeerMaverick independently corroborates ~54% of same-strain pairs. Kept generous coverage (corroborated-only would lose ~81% of subs). Defensible as facts compiled from many public sources in our own structure.
  - `YeastPreset` extended (both `presets.ts` + `domain/models/Presets.ts`); data in `presets.generated.yeasts.json`; test `presets.yeasts.test.ts` (8 pass). Working files in `docs/`: `yeast-master-list.json`, `yeast-scrape-todo.json`.
  - **Provenance is GPL-clean (verified):** open-data `source` = "BeerJSON culture data" (no BrewTarget/brewerwall name anywhere in shipped data/src/app/CREDITS); scraped = manufacturer URLs; descriptions are our-own.
  - **Remaining:** UI consumers (surface same-strain/substitutes/temp/floc/tolerance; packaging auto-default form→category; ferment-temp display; alc-tolerance flag); add dmtaylor+suregork to in-product `/credits`; commit; (paid product) ask dmtaylor + IP-lawyer glance on EU DB-right. YeastSection quick-picks already read the live DB.

## How we work together (what's worked)

1. **Evidence before building.** Measure, don't assert. We validated derived data against our curation, against BeerMaverick, and against grower descriptors *before* trusting any of it.
2. **Be honest about fuzzy metrics.** Flavor has no ground truth — we measured agreement against the *spread of sources* rather than pretending one is "correct."
3. **Never bulk-scrape a competitor's compiled DB** (Brew Codex, BeerMaverick). Use open/permissive datasets + manufacturer specs. Raw facts (numbers) aren't copyrightable; curated compilations and prose are.
4. **Don't invent. "idk" is fine** — leave a field null rather than fabricate it.
5. **Keep our differentiators** — e.g., don't replace good hand-curated data with worse "authoritative" data just because it's external.
6. **Track provenance + verify every step** (tsc + vitest after changes; a QA gate on derived data).
7. **Backward compatibility:** `name` is the recipe lookup key. ADD fields, don't rename — renaming forces stable IDs + a Firestore migration.
8. **Commit only when the user says so.**

## The proven playbook (reuse for yeast)

1. Find the best **permissive** source (MIT > GPL > unlicensed) + the primary publishers.
2. **Validate** the source against an independent reference before trusting it.
3. Import the **objective facts** wholesale; keep/curate the **subjective** stuff in-house.
4. For missing subjective data, **derive by modulating real measured data** (LLM signature-lift, anchored to house style, guard-railed so nothing unsupported is invented), then **QA-gate** it.
5. **Reconcile** against the trusted reference; adjust only where principled (use facts/descriptors as the tiebreaker, not "the other source wins").
6. Add a **regression test**, **attribution**, then **commit**.

---

## Yeast plan (the main event)

### Why
143 strains today, but with very thin fields (name, lab, attenuation only). Competitors carry 500+ with full attributes — and the bigger win is **enriching what we have** (temp/floc/type/tolerance) as much as adding strain count. You also want a **"similar / alternative yeasts"** feature — which is a separate, CURATED feature (see the strain-equivalence section below), not derived from the stat fields.

### Key insight (this is easier than hops)
**Yeast data is mostly OBJECTIVE** — attenuation, temperature range, flocculation, type, alcohol tolerance, and form are *published numbers/categories*, not subjective like hop flavor. So there's **no nebulous flavor-vector derivation** for the core data. (Optional later: an ester/flavor descriptor layer — that would be the only subjective part.)

### Sources (preference order)
- **BeerJSON `culture` schema (MIT)** — adopt its field names (we already aligned hops/grains to it). Fields: `type`, `form`, `producer`, `product_id`, `temperature_range`, `flocculation`, `attenuation_range`, `alcohol_tolerance`, `notes`, `best_for`, `max_reuse`, `pof` (phenolic off-flavor / STA1). Schema only — not bulk data.
- **BrewTarget BeerJSON culture files (~570 cultures, clean & structured)** — but **GPL-3**, so do NOT bundle verbatim. Use it as the **coverage checklist** ("which strains exist") and a cross-check, then **re-source the facts** (facts aren't copyrightable).
- **Lab/manufacturer pages (primary; facts are free to use):** White Labs, Wyeast, Fermentis/Lallemand, Imperial, Omega, Escarpment, Mangrove Jack's. They publish attenuation/temp/floc/tolerance directly. If a lab's site WAFs the fetcher, use `curl_cffi` with `impersonate="chrome"` (worked for BeerMaverick).
- Note: **kasperg3 is hops-only** — no yeast there.

### Schema — extend `YeastPreset`
Two definitions to update: `src/utils/presets.ts` and `src/modules/beta-builder/domain/models/Presets.ts`.
Current: `{ name, attenuationPercent?, category }`. Add (all optional, for backward-compat):
`type` (ale|lager|kveik|brett|wild|…), `form` (liquid|dry), `tempMinC` / `tempMaxC`, `flocculation` (low|med|high), `attenuationMin` / `attenuationMax`, `alcoholTolerance`, `producer` / `labProductId`, `pof`/`sta1` (bool), `description?`, `styles?`, **`strainGroup` (slug shared by all labs' versions of one strain) + `strainGroupLabel`**, plus `source` / `sourceConfidence`. Keep `name` as the stable key.

### Steps
1. Extend `YeastPreset` (both files) with the BeerJSON-aligned fields.
2. Build the strain list from BrewTarget's culture files (checklist), focused on the labs we already feature; re-source facts from the lab pages. Leave unknowns null.
3. Generate `src/utils/presets.generated.yeasts.json` (mirror the hops/grains generated-JSON pattern); wire into `presets.ts` (`YEAST_PRESETS`).
4. **Strain-equivalence ("same strain, other labs") feature** — the headline; see the dedicated section below. Assign `strainGroup`; this is CURATED lineage data, NOT computed from stats.
5. Add a vitest data-integrity test (mirror `presets.hops.test.ts`).
6. Attribution: add a yeast section to `CREDITS.md` + the `/credits` page. If BrewTarget's list informed coverage, note it (GPL — we re-sourced facts, didn't copy the file).
7. Verify (tsc + vitest), then commit on your go.

### Strain equivalence — the "same strain, other labs" feature (THE HEADLINE)
What you actually want (à la the BeerMaverick substitutions chart): group yeasts that are the **same underlying strain** sold under different labels — e.g. the "Chico" American ale strain = Fermentis **US-05** = White Labs **WLP001** = Wyeast **1056** = LalBrew **BRY-97** (≈) = CellarScience Cali; the Augustiner lager strain across labs; etc. This is **NOT** statistical similarity ("close on stats") — explicitly not wanted.

- **Data model:** `strainGroup` (slug, e.g. `chico`) + `strainGroupLabel` ("Chico / American Ale") on each yeast. All labs' versions of one strain share the slug; "same strain" = filter by it. Proprietary/unique strains are singletons (own slug or null).
- **CURATED lineage data, not computed.** Similar attenuation/temp does NOT imply the same strain.
- **"Same strain" ≠ "substitutable."** Source from *lineage* (which isolate it is), not by chaining substitution charts. BeerMaverick's chart is mostly *substitutability* — chaining its links over-merges (a quick test lumped Chico `WLP001/US-05/1056` together with Fuller's `WLP002/1968`, which are different strains). Use Mr. Malty's origin-grouped chart + genomics for the tight grouping.
- **Genomics is the ground truth where available:** Gallone et al. 2016 (Cell), "Domestication and Divergence of S. cerevisiae Beer Yeasts" (157 strains → a family tree / clades); the S. pastorianus Saaz-vs-Frohberg work for lagers. The universe is bounded — ~50–150 distinct homebrew-relevant strains sold as 500+ products; a few dozen famous groups (Chico, W-34/70, Weihenstephan wheat, Fuller's, Whitbread, Westmalle, Voss kveik…) cover most of it.
- **Sources (equivalence facts are widely published — compile our own table):** the **Mr. Malty yeast strain comparison chart** (Jamil Zainasheff — the canonical homebrew reference); the **BeerMaverick substitutions chart** you linked (~228 products, shape `Yeast | Brand | Substitutions`); lab lineage notes + the Milk-the-Funk wiki.
- **Method:** an LLM reliably knows the common equivalences (US-05 = WLP001 = 1056 = Chico, etc.) — LLM-assign `strainGroup` across our 143, then **validate against the published charts**. Be **conservative**: a wrong "same strain" claim is worse than none, so only group when a chart confirms it; leave uncertain/proprietary strains as singletons. (Same derive-then-validate discipline as hops, but the accuracy bar is higher — these are factual claims, not fuzzy vectors.)
- **UI:** on a yeast, show "Same strain, other labs: US-05, Wyeast 1056…"; optionally a substitutions chart page like BeerMaverick's.

### Gotchas
- **GPL trap:** don't paste BrewTarget's culture JSON into ours. Re-source the facts; use their list only as "what exists."
- **Backward compat:** `name` stays the key; recipes reference yeast by name.
- **Don't fabricate:** unpublished flocculation/temp → null.
- **`/tmp` is ephemeral:** the hop session's clones/caches (`/tmp/hopdb`, `/tmp/bmvenv` with curl_cffi, `/tmp/bm_cache`) won't survive — recreate the venv and re-clone as needed.

---

## Other deferred items
- **Similar-HOPS UI** — data is ready (cosine over the 9-axis vector). Needs UI design: a "similar to X" / substitutes list on the hop picker. Parked at your request.
- **Grain display polish** — optional: show `productName` + a `producer` badge in the fermentable picker / builder / viewer instead of the raw "Vendor - Product" string.
- **Review the 19 low-confidence derived hops** (mostly noble/English) — a quick human eyeball when convenient. The review sheet was generated at `/tmp/build/flavor_review.md` (ephemeral; regenerate if wanted).
