# PRD-008: Ingredient Reference Pages (Hops & Yeast)

> **Status:** Phase 1 (HOPS) shipped — index + detail + interactive compare tool +
> the **full SEO layer** (JSON-LD, sitemap, noindex-thin, breadcrumb, headings),
> all on a generic `src/modules/ingredients/` rig so yeast inherits it. As-built
> map + the yeast Phase 2 plan: **`docs/ingredient-pages-build.md`**. (Phase 2 = yeast.)
> **Created:** 2026-06-27
> **Depends on:** PRD-007 (Calculator Pages — the registry / JSON-LD / sidebar / hub pattern this clones), PRD-005 (SEO infrastructure)
> **Goal:** Give every hop and yeast strain its own indexable reference page, plus a browse/lookup index for each. Two payoffs at once: an **internal lookup utility** brewers (and we) actually want, and the **highest-leverage programmatic-SEO surface** we have — the yeast SERP is currently unowned.

---

## Context

Brewers — including us — routinely open the recipe builder *just to look up a hop or yeast's stats* (alpha acid, flavor, attenuation, substitutes). There is no standalone way to browse or look up an ingredient. This PRD adds one.

We already hold rich ingredient data and the engines to use it, all currently trapped inside the builder's hover preview:

- **222 hops** (`src/utils/presets.generated.hops.json`) with a 9-axis flavor vector, alpha/beta acid ranges, total oil, cohumulone, origin, category, and provenance flags.
- **524 yeast strains** (`src/utils/presets.generated.yeasts.json`, **currently uncommitted**) with attenuation point+range, temp range, flocculation, alcohol tolerance, lab product id, suited styles, **strainGroup cross-lab lineage** ("WLP001 = Wyeast 1056 = US-05"), and curated substitutes.
- Pure, server-safe matching engines: cosine `findSimilarHops()` for hops; `findStrainPeers()` + `resolveSubstitutes()` for yeast.

Per the Jun 2026 competitive/SEO audit: **yeast is an unowned SERP** (the web serves PDFs, image-charts, and forum threads — no modern structured per-strain reference), making it a genuine first-mover opportunity. **Hops are owned by beermaverick.com**, but co-rankable, and the lookup utility stands on its own regardless of ranking. Both are winnable on the `{ingredient} substitute` / `{A} vs {B}` / `{strain} equivalent` long-tail. This is the audit's **P0 (yeast) + P1 (hops)**.

## Goals

- A **shared, parameterized ingredient-reference module** — build the rig once, instantiate it for hops and yeast.
- Routes: `/hops` + `/hops/[slug]`, `/yeast` + `/yeast/[slug]`.
- **Index pages** = searchable / filterable lookup (the internal utility).
- **Detail pages** = **data-templated** from each ingredient record (NOT hand-authored), rendering its stats, its flavor/attenuation visual, and its computed substitutes/similar items.
- Full SEO: templated metadata, per-page JSON-LD, sitemap inclusion, a quality-bar `noindex` on thin entries, and internal linking from the builder.

## Non-Goals

- **No hand-written article per ingredient.** 222 + 524 = templated, not authored. (This is the one place we diverge from the calculators pattern, which has 7 hand-authored tools.)
- **No fermentable/grain pages** — that data is name + color + PPG + producer only; thin/padded-page bait. Explicitly deferred.
- **No new data sourcing for v1** — no hop oil-component breakdown (we only store *total* oil, no myrcene/humulene split), no "suited styles" for hops, no per-ingredient prose.
- **No "open the builder pre-seeded with this ingredient"** in v1 — the CTA links to `/recipes/new`; the pre-seed is a v2 nicety.
- Not a CMS — pages are generated at build time from the committed data files.

---

## Architecture — one template, two instances

A generic `src/modules/ingredients/` module, parameterized by an **`IngredientKind` config** so `/hops/*` and `/yeast/*` are thin instantiations:

```ts
interface IngredientKind<T> {
  basePath: "hops" | "yeast";
  label: string;                      // "Hops" / "Yeast"
  all: () => T[];                     // HOP_PRESETS / YEAST_PRESETS
  slugOf: (item: T) => string;        // deterministic slugify (+ collision handling)
  isIndexable: (item: T) => boolean;  // the quality bar
  StatsBlock: ComponentType<{ item: T }>;   // hops: acid/oil + radar; yeast: attenuation/temp/floc
  related: (item: T, lib: T[]) => RelatedItem[]; // hops: findSimilarHops; yeast: peers + substitutes
  meta: (item: T) => { title; description; keywords };  // templated metadata
  faq: (item: T, related) => { q; a }[];                // generated FAQ -> FAQPage JSON-LD
}
```

The route files (`app/hops/[slug]/page.tsx`, `app/yeast/[slug]/page.tsx`) pass the right config to shared `IngredientDetailPage` / `IngredientIndexPage` components. Same shell, two datasets.

---

## What we reuse (the reason this is mostly assembly)

| Piece | File | Use |
|---|---|---|
| Hop data + type | `src/utils/presets.generated.hops.json`, `HopPreset` in `src/utils/presets.ts` | The records |
| Hop grouping | `groupHops()` in `src/modules/recipe/data/hopPresets.ts` | Index category buckets |
| Hop matching + formatters (**pure, server-safe**) | `src/modules/builder/components/builder/hopDetails.ts` | `findSimilarHops()` (cosine 75% + alpha 17% + oil 8%), `hasHopDetails()`, `formatAlphaRange/BetaRange/OilTotal/Cohumulone/AlphaBetaRatio` |
| Flavor radar (**emits crawlable `<text>`, not canvas**) | `src/components/HopFlavorRadar.tsx` | The per-hop visual; can overlay hop vs its similars |
| Yeast data | `src/utils/presets.generated.yeasts.json` (**commit first**), `YeastPreset` | The records |
| Yeast matching | `src/modules/builder/components/builder/yeastDetails.ts` | `findStrainPeers()` (same strain, other labs), `resolveSubstitutes()` |
| Page pattern (clone target) | `app/calculators/[slug]/page.tsx` + `src/modules/calculators/{calculatorsMeta.ts, jsonLd.ts, CalculatorFeature.tsx, RelatedLinks.tsx, CalculatorsSidebar.tsx}` + `app/calculators/{layout.tsx, page.tsx}` | Registry → `generateStaticParams` + `dynamicParams=false` → templated `generateMetadata` → inline JSON-LD → shared shell + persistent sidebar + hub index |
| JSON-LD helper | `breadcrumbJsonLd()` + `BASE_URL` in `src/utils/seo.ts` | Reused verbatim |
| Sitemap / robots | `app/sitemap.ts` (maps `calculatorSlugs`, `allLearnRoutes`), `app/robots.ts` | Add ingredient blocks |

## What's new (small)

1. **Deterministic `slugify()`** — `generateShareSlug` (`src/modules/sharing/slugUtils.ts`) appends a random 4-char suffix → unusable for stable URLs. Write a plain slugify (its first half, minus the suffix) **+ collision handling** for duplicate names.
2. **`src/modules/ingredients/`** — the generic module (the `IngredientKind` config, `IngredientDetailPage`, `IngredientIndexPage`, the per-kind `StatsBlock`s, the JSON-LD builder).
3. **Four routes** — `app/hops/{page,layout,[slug]/page}.tsx`, `app/yeast/{page,layout,[slug]/page}.tsx` (thin; pass config).
4. **Per-ingredient JSON-LD** — `DefinedTerm` (or `Product`) + `BreadcrumbList` + a `FAQPage` generated from the data ("What can I substitute for Citra?" → top similar; "What is US-05's attenuation?" → the stat).
5. **`sitemap.ts`** — add `hopRoutes` / `yeastRoutes` `.map` blocks (mirroring `calculatorRoutes`), gated on `isIndexable`.
6. **Internal link** — the builder hop hover "similar hops" chips → link to `/hops/[slug]`; same for yeast.

---

## Page specs

### Index — `/hops`, `/yeast`
The lookup tool. A client search box (filter by name) + a filter (hops: by **category** or **origin**; yeast: by **lab** or **strain group**) + a responsive grid of cards. Each card: name, key stat (hops: alpha range + dominant flavor + origin flag; yeast: attenuation + temp + lab), linking to the detail page. Shows **all** items (good as a utility). `ItemList` + `BreadcrumbList` JSON-LD (only over the indexable subset). Persistent section masthead + layout, cloned from `app/calculators/layout.tsx`.

### Detail — `/hops/[slug]`
Templated from the `HopPreset`:
- **H1** "{Name} hops" + eyebrow (category).
- **Flavor radar** (`HopFlavorRadar`) — overlaying the hop vs its top similars; **rendered with crawlable text labels** + a one-line derived description ("citrus-forward, with pine and tropical").
- **Acid / oil grid** (2×2+): alpha range, beta range, α:β ratio, cohumulone, total oil — via the existing formatters.
- **Origin** (flag + country) + **category**.
- **Provenance badge** — `flavorSource` (curated/derived) + `flavorConfidence`. A trust signal competitors don't show; aligns with copy-authenticity rules.
- **Similar hops** — `findSimilarHops()` chips/cards, each linking to its own `/hops/[slug]` (dense internal linking).
- **CTA** — "Build a recipe with {Name}" → `/recipes/new` (v1).
- **Generated FAQ** → FAQPage JSON-LD.

### Detail — `/yeast/[slug]`
Templated from the `YeastPreset`:
- **H1** "{Name}" + lab + form.
- **Attenuation** gauge (point + range), **temp range** bar, **flocculation**, **alcohol tolerance**, **lab product id** (e.g. WLP001).
- **Cross-lab equivalence** — from `strainGroup` ("WLP001 = Wyeast 1056 = US-05"). This is the unowned-SERP wedge; surface it prominently.
- **Suited styles** (`styles[]`, ~51% coverage — omit gracefully when absent).
- **Substitutes** — `resolveSubstitutes()` (~27% coverage — omit gracefully).
- **CTA** + generated FAQ ("WLP001 vs 1056 vs US-05", "{strain} attenuation").

---

## Quality bar (the SEO guardrail)

The index page shows **everything** (it's a utility). But only the **rich** records go in the sitemap and get indexed; thin ones get `robots: { index: false }`:

- **Hops:** require `flavor` (`hasHopDetails`) + a full acid/oil block. ~207 of 222 qualify; the ~15 thin ones are noindex.
- **Yeast:** require attenuation + temp + flocculation. The ~half lacking `styles[]`/`substitutes[]` still qualify on core stats — just omit those sections.

A smaller, uniformly-excellent indexed set protects the whole domain from the 2025/26 site-wide quality discount. **Drip, don't dump** — release in batches, watch GSC indexation, don't ship 700+ pages on one young-domain day.

---

## SEO requirements

- **Crawlable data, not pixels** — the radar and all stats render as HTML/`<text>` + structured data, never canvas-only (the radar already does this — preserve it).
- **JSON-LD** per detail page: `DefinedTerm`/`Product` + `BreadcrumbList` + `FAQPage`; per index page: `ItemList` + `BreadcrumbList`.
- **Sitemap** segmented by section; thin/noindexed URLs excluded.
- **Internal linking / hub-and-spoke** — hop↔similar-hop, yeast↔strain-peers, both ← the builder hover; ideally style hubs (PRD future) link down to ingredient spokes.
- **Long-tail target** is the **substitute / equivalence / comparison** query family, not bare entity terms — that's where volume + weak competition are.

---

## Build phases

- **Phase 1 — the lookup utility (hops). ~1 day.** `slugify` + collision handling; the generic module + hop config; `/hops` index (search/filter) + `/hops/[slug]` (data + radar + similar). **Ships the thing we want.**
- **Phase 2 — yeast. ~0.5 day** (the rig exists). Commit `presets.generated.yeasts.json`; add the yeast config + `StatsBlock`; `/yeast` index + `/yeast/[slug]` (peers + substitutes + cross-lab equivalence).
- **Phase 3 — SEO polish. ~0.5 day.** JSON-LD, sitemap blocks, noindex-thin, the builder hover→detail links.
- **Phase 4 — later, not now.** `/hops/compare/[a]-vs-[b]` + `/yeast/compare`; "open in builder pre-seeded"; the "what our brewers measured" overlay (gated on corpus size); suited-styles / oil-breakdown / notes data enrichment.

---

## Dependencies & gotchas

- **Yeast dataset is uncommitted** — commit `presets.generated.yeasts.json` before Phase 2 (it exists in the working tree).
- **No deterministic slugify exists** — `generateShareSlug` adds randomness. Write a stable one + decide collision policy (e.g. duplicate "Cascade" US vs NZ → `cascade` / `cascade-nz`).
- **`app/sitemap.ts` hardcodes** `calculatorSlugs` + `allLearnRoutes` — new sections are silently absent until `.map` blocks are added.
- **`RelatedLinks.resolve()`** only knows calculators + learnNav — extend it (or generalize to a registry) if cross-linking ingredient pages into related cards.
- **Hop data gaps:** no `styles`, `notes` empty, oil is *total only* (no myrcene/humulene). v1 page is data + radar + substitutes — fine (beermaverick is mostly tables too).
- **Yeast data gaps:** 0 descriptions; `styles[]` 51%, `substitutes[]` 27% — omit missing sections gracefully.
- **`robots.ts`** needs no change (hops/yeast are public); thin entries use per-page `robots:{index:false}` in `generateMetadata`.

---

## Open decisions

1. **Hops index grouping:** by **category** (what `groupHops` does today) or by **origin country**?
2. **Slug collisions:** disambiguation rule for duplicate ingredient names.
3. **Yeast detail emphasis:** lead with **attenuation** (the stat brewers want) or the **cross-lab equivalence** (the unowned-SERP wedge)?

## Success metrics

- **Internal (immediate):** we (and brewers) look up a hop/yeast at `/hops` or `/yeast` without creating a throwaway recipe.
- **SEO (12–18 mo):** indexed hop + yeast pages ranking on the `{ingredient} substitute` / `{strain} equivalent` long-tail; the yeast first-mover captured before an incumbent locks the SERP. Realistic ceiling: low-thousands → low-tens-of-thousands monthly organic sessions (not beermaverick scale).
