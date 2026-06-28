# Ingredient Reference Pages — Build Notes (PRD-008)

> **Status:** Phase 1 (HOPS) shipped. Phase 2 (yeast) is the next instantiation
> of the same rig. See `docs/PRD-008-ingredient-pages.md` for the original plan.

A generic module, `src/modules/ingredients/`, parameterized per ingredient
"kind". Hops are the first instance; yeast slots into the same shape. The whole
section is **statically generated**, renders as **crawlable HTML**, and ships the
**full SEO layer** (JSON-LD, sitemap, noindex-thin, breadcrumb, headings) on the
generic templates — so yeast inherits it. See the **SEO** section below.

---

## Routes (`app/hops/`)

| File | What it is |
|---|---|
| `layout.tsx` | Wraps the section in `IngredientShell` (masthead on index only; each page owns its own body+sidebar grid). |
| `page.tsx` | `/hops` index — renders `HopIndexClient` + a bottom SEO blurb. |
| `[slug]/page.tsx` | `/hops/[slug]` — `dynamicParams=false`, `generateStaticParams` over `hopSlugs`, templated `generateMetadata` from `hopMeta`, renders `HopDetailBody`. |
| `compare/page.tsx` | `/hops/compare` — static metadata, renders `HopCompareClient`. |

Cloned from the `app/calculators/[slug]` pattern (registry → static params →
templated metadata → shared shell).

---

## Generic pieces (reuse for yeast verbatim)

`src/modules/ingredients/`:

- **`slugify.ts`** — deterministic `slugify()` + `buildSlugIndex()` (collision →
  `-origin` suffix, then `-N`). NOT `generateShareSlug` (that adds randomness).
  Unit-tested in `slugify.test.ts` (incl. a guard over all real hops).
- **`catalog.ts`** — `createCatalog(items, {baseName, disambiguator})` → stable
  `slugOf` / `bySlug` / `slugs`. The single source of truth for URLs; shared by
  the index, the detail route's `generateStaticParams`, and (later) the sitemap.
- **`types.ts`** — `IngredientRow` (flat, serializable card data: name, group,
  accent, stats, optional `chart`, optional `summary`, keywords), `IngredientGroup`,
  `IngredientSection`, `IngredientMeta`, `IngredientFaqItem`, `IngredientStat`.
- **`IngredientShell.tsx`** — masthead (index only) + max-width gutter. Does NOT
  render a sidebar; each page lays out its own `header (full-width) → body | sidebar`
  grid so the sticky sidebar lines up with the page's visualizer.
- **`IngredientMasthead.tsx`** — the index hero `<h1>` (marker-box title);
  kicker/blurb render only if non-empty.
- **`IngredientIndexClient.tsx`** — search box + category filter chips + responsive
  card grid (grouped when unfiltered). Kind-agnostic: renders flat `IngredientRow[]`.
  Accepts an optional `renderCard(row)` (kind owns the card) and `toolbar` slot.
- **`IngredientSidebar.tsx`** — the shared sticky **accordion** sidebar (categories
  → rows with a per-item color dot). A floating "Compare" checkbox toggle decides
  click behavior: **nav** (row is a `<Link>`) vs **compare** (row calls
  `onPickCompare`, or seeds the compare tool via `compareSeed`). Accepts
  `getRowHoverProps(slug)` + `hoverPortal` for a dwell preview. Starts fully
  collapsed; no internal scroll (scrolls with the page when a big category opens).
  Expand animates via framer-motion (snappy 160ms easeOut, no spring).
- **`IngredientDetailHeader.tsx`** — breadcrumb (`crumbs={[Home, Hops]}` + the
  page title) → H1 → lede. Pairs with the BreadcrumbList JSON-LD.
- **`IngredientStatGrid.tsx`** — responsive grid of centered stat cells.
- **`IngredientFaqList.tsx`** — compact `<dl>` for the generated FAQ (terse, factual).
- **`jsonLd.ts`** — `ingredientDetailJsonLd` (DefinedTerm + BreadcrumbList + FAQPage)
  and `ingredientIndexJsonLd` (ItemList + BreadcrumbList). Kind passes the strings.
- **`MiniRadar.tsx`** — tiny label-free radar polygon (pure SVG) for hop cards.
  *Hop-shaped; yeast has no radar — skip it for yeast.*

## Hop-specific pieces (build yeast equivalents)

`src/modules/ingredients/hops/`:

- **`hopKind.ts`** — the pure data layer (no React): `hopCatalog`, `hopSlugs`,
  `getHop`, `hopRows` (cards), `hopGroups` (filter chips), `hopSidebarCategories`
  (accordion data, incl. per-hop color), `hopMeta`, `hopFaq`, `hopCompareSummary`
  (the verdict), flavor helpers (`hopFlavorSummary`, `hopFlavorBreakdown`,
  `hopAccent`, `dominantAxis`), `HOP_SECTION`. Reuses `findSimilarHops`, the hop
  formatters, `groupHops`, `getCountryFlag`/`BREWING_ORIGINS`.
- **`HopIndexClient.tsx`** — wraps `IngredientIndexClient`; supplies `renderCard`
  (the morph card) + a browse-style "Compare" select toolbar + floating bar (→
  `/hops/compare?hops=…`). Bundles `HOP_PRESETS` for the morph card.
- **`HopMorphCard.tsx`** — the index card. Rest = mini radar + name + alpha/beta;
  a ~570ms dwell expands an overlay IN PLACE (grows from center, radar enlarges,
  acid stats + linked substitute chips blur in) on `springSupersoft`. Whole card
  navigates; substitute chips `stopPropagation` to their own hop. Honors compare
  select mode (checkbox + water outline).
- **`HopDetailBody.tsx`** (server) — header + origin (full-width) → `body | sidebar`
  grid. Body: flavor radar + 9-axis breakdown, acid/oil grid, "What to substitute
  for X" linked cards, terse FAQ, CTA. H1 = bare hop name. NO provenance card.
- **`HopRadarPanel.tsx`** — client wrapper around `HopFlavorRadar` for the detail page.
- **`HopCompareClient.tsx`** — the compare tool. Slots (chip → builder `HopPresetModal`
  to swap/add, up to 6) full-width; then `radar+legend | stats | sidebar`. Overlaid
  `HopFlavorRadar` with a custom HS legend (hover-highlight via the radar's
  `activeIndex` prop), side-by-side stat table (h-scrolls), `hopCompareSummary`
  verdict. Shareable via `?hops=citra,mosaic` (URL written on user actions only —
  never from an effect, which races StrictMode's double-read).
- **`HopSidebar.tsx`** — client wrapper: `IngredientSidebar` + the builder's
  `useHopHoverPreview` dwell panel wired onto each row (`cursor-right` placement
  flips left at the edge). Detail page and compare page both route through it.

---

## Cross-cutting

- **Nav** (`HSHeader.tsx`): a "Reference" dropdown (Hops, Learn). Yeast slots in
  beside Hops in Phase 2.
- **`HopFlavorRadar.tsx`** gained a backward-compatible `activeIndex?: number|null`
  prop (external highlight control) — used by the compare legend. All other usages
  fall back to internal hover state.
- **Copy** follows the data-not-prose rule (see memory): templated meta is fine,
  on-page prose is minimal, one short FAQ, no duplicated meta-as-paragraph.

## SEO (done — generic, so yeast inherits it)

- **Per-page JSON-LD** via `jsonLd.ts` — detail: DefinedTerm + BreadcrumbList +
  FAQPage; index: ItemList (indexable subset) + BreadcrumbList. (Global
  Organization/WebSite still come from the root layout.)
- **Sitemap** (`app/sitemap.ts`) — `/hops` + one route per **indexable** hop.
- **Quality gate / noindex** — `isHopIndexable` (alpha range + flavor that isn't
  low-confidence). Failing hops (~14) get `robots:{index:false,follow:true}` in
  `generateMetadata` and stay out of the sitemap + the index ItemList. The
  `/hops/compare` tool is also `noindex` (utility, thin).
- **Headings** — H1 (name) + section `<h2>`s (`HSEyebrow as="h2"`): Flavor profile,
  "What to substitute for X", Common questions. Index = H1 + a `<h2>` per category.
- **Crawlable, not pixels** — radar `<text>`, HTML stats/breakdown; dense internal
  links (index → all details, detail → substitutes).
- **Declined:** pre-rendered `/hops/compare/[a]-vs-[b]` pages (24k near-dupes = thin
  bulk without coverage).

---

## Phase 2 — Yeast (next)

The rig is built; yeast is mostly instantiation. Plan:

1. **Commit `src/utils/presets.generated.yeasts.json`** (currently uncommitted — see
   `project_ingredient_data_expansion`). `YeastPreset` is already in `models/Presets.ts`.
2. **`yeast/yeastKind.ts`** — mirror `hopKind`: catalog (disambiguate by lab),
   rows (attenuation + temp + lab, NO `chart`), groups + sidebar categories by **lab**
   (or strain group), `yeastMeta`, `yeastFaq` (lead with the cross-lab equivalence /
   "{strain} equivalent" query), section. Reuse `findStrainPeers` + `resolveSubstitutes`
   from `builder/components/builder/yeastDetails.ts`.
3. **`YeastDetailBody`** — NO radar. Attenuation gauge (point+range), temp-range bar,
   flocculation, alcohol tolerance, lab product id, **cross-lab equivalence** (from
   `strainGroup` — the unowned-SERP wedge, surface prominently), suited styles
   (~51% coverage, omit gracefully), substitutes (~27%, omit gracefully).
4. **`YeastIndexClient`** — reuse `IngredientIndexClient`; a simpler card (no morph
   radar needed, or a small attenuation/temp readout). `IngredientRow.chart` is
   optional, so the generic card already handles its absence.
5. **`YeastSidebar`** — reuse `IngredientSidebar`; if a yeast dwell preview exists
   (`useYeastHoverPreview` in `yeastDetails.ts`), wire it like `HopSidebar`.
6. **`YeastCompareClient`** (optional) — compare strains side by side (attenuation/temp
   table; cross-lab equivalence). No radar overlay.
7. **Routes** `app/yeast/{layout,page,[slug]/page,compare?/page}.tsx` — thin, pass the
   yeast config. Add **Yeast** to the Reference dropdown.
8. **SEO is inherited** — reuse `ingredientDetailJsonLd`/`ingredientIndexJsonLd`,
   `IngredientDetailHeader` (breadcrumb), `HSEyebrow as="h2"`. Yeast just needs to
   provide `yeastFaq`, `yeastMeta`, `isYeastIndexable`, `indexableYeastItems`, then
   add a `noindex` branch in its `generateMetadata` + a `yeastRoutes` block in
   `app/sitemap.ts` (mirror the hop wiring exactly).

## Deferred / declined

- **Builder hop-hover → detail-page links** (Phase 3 internal-linking polish).
- **Pre-rendered `/hops/compare/[a]-vs-[b]` pages — declined** (24k near-duplicates =
  thin bulk without coverage). The interactive compare tool stays, `noindex`.

The rest of the original "Phase 3 SEO" (JSON-LD, sitemap, noindex-thin, headings,
breadcrumb) **shipped** with the hop pages — see the SEO section above.
