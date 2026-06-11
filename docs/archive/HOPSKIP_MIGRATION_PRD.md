# HopSkip Migration PRD — Section-by-section migration with permanent classic quarantine

## Context

HopSkip (HS) is the new default UI at `/`. The classic UI lives at `/betabuilder/*`. Today the HS recipe builder, modals, learn articles, and read-only viewer still **wrap classic React components from `src/modules/beta-builder/presentation/components/` and `src/modules/sharing/` inside HS chrome**, with a 700-line override stylesheet ([src/modules/hopskip/styles/overrides.css](src/modules/hopskip/styles/overrides.css)) trying to retarget every classic surface to look HS.

The override approach has hit its ceiling:

- Every styling pass surfaces new edge cases (gradient backgrounds, inline `style={{}}` attributes, multi-class selectors, `::before` pseudo-elements). The override file keeps growing.
- Tailwind utility classes baked into classic components (`text-3xl`, `rounded-2xl`, `font-extrabold`, etc.) are very hard to defeat from CSS without `!important` on every redeclared property.
- Inline `style={{}}` attributes in classic JSX have higher specificity than any class selector — we can only beat them where we explicitly redeclare with `!important`, and only for properties we anticipated.
- HS also has **feature gaps** — there's no HS-native browse page, public recipe viewer, user profile, recipe-compare, brew session page, or version history viewer. Those URLs currently route through classic chrome with classic content, which is the source of "the recipes don't open / display correctly" issues.

The decision:

1. **Stop adding to the override stylesheet.** Migrate every user-facing classic surface to a native HS component built from HS primitives.
2. **Don't delete `/betabuilder/`. Quarantine it.** It costs nothing to keep, it's the permanent side-by-side reference for verifying each migration, it covers any feature gap discovered mid-migration, and it's easy to delete later in a single PR if we ever decide to. Quarantine via clear labels (READMEs, JSDoc `@deprecated`, in-UI banner).
3. **Section-by-section vertical slices.** Each builder section migration (Fermentables, Mash, Water, etc.) includes its own modals and sub-components. No more "modals first" sequencing — each section is its own little world.
4. **Reuse the data layer unchanged.** Same Zustand store, same `useRecipeCalculations` hook, same Firestore repos, same pure calc functions, same BJCP specs. Only the JSX + styling is new.

## Goals

1. Every active HS route renders entirely from HS-native React components — no override CSS needed once a surface has its HS replacement.
2. Feature parity with classic at the page level. Every URL classic offers, HS offers natively.
3. Section-by-section quality upgrades, each as an independent vertical slice that can ship alone.
4. `/betabuilder/*` remains accessible indefinitely as a labeled, deprecated reference. No deletion is scheduled.

## Non-goals

- Changing brewing math, calculations, or domain models.
- Changing auth, Firestore wiring, label uploading, sharing/publishing, or any other backend integration.
- Reworking the URL structure further (HS at `/`, classic at `/betabuilder/` stays).
- A new visual design — HS rules are already specified in [HOPSKIP_PRD.md](HOPSKIP_PRD.md). This PRD is execution, not design.
- Deletion of `/betabuilder/` or classic source. (Always optional later, never required.)

## Architecture & principles

1. **One source of truth per active surface.** Each HS-native component lives in `src/modules/hopskip/components/<area>/`. No CSS overrides for any surface that has an HS-native equivalent.
2. **Reuse the data layer.** HS components import the same `useRecipeStore` actions, the same `useRecipeCalculations` hook, the same pure calc functions, the same BJCP specs. Only the JSX + styling is new.
3. **Built from HS primitives.** Every HS component uses `HSCard`, `HSButton`, `HSPill`, `HSEyebrow`, `HSScriptNote`, `HSIngredientDot`, `HSActionMenu`, `HSCardLift`, etc. No raw Tailwind sizing utilities (`text-xs`, `rounded-md`, `p-4`). Sizing comes from inline `hsTokens.*` style declarations or HS utility classes. For card-tile UIs that link somewhere, wrap with `<HSCardLift>` to inherit hover lift + cursor-follow CTA + counter-rotation without re-implementing the behaviour per consumer.
4. **Vertical slices.** Each migration unit includes its section/page shell + its specific modals + its specific sub-components. No "shared primitives first" sequencing — primitives like `HSModal` fall out naturally from the first vertical that needs them.
5. **Mechanical swap-in.** Each new HS component matches the classic counterpart's prop API (or a deliberate subset) so the import-swap is a one-line change.
6. **Classic stays quarantined.** While a phase is in flight (or forever), the matching classic surface stays accessible at `/betabuilder/*` for side-by-side comparison.
7. **Naming convention: `OLD_` prefix on classic, no prefix on new.** When a section migrates, the classic file + function is renamed with an `OLD_` prefix (e.g., `OLD_FermentableSection`) and the new HS section drops its `HS` prefix (e.g., `HSFermentableSection` → `FermentableSection`). The active component is the canonical name; the deprecated one literally shouts "OLD" at the top of every grep and IDE search. **Design-system primitives keep their `HS` prefix** (`HSCard`, `HSButton`, `HSModal`, `HSPill`, `HSEyebrow`, etc.) — they're part of the design system, not a feature surface. **Feature components drop the prefix** (`FermentableSection`, future `MashSection` / `HopSection` / `WaterSection`, plus their bespoke modals like `FermentablePresetModal`). The `@deprecated` JSDoc tag is no longer needed once a file's name carries the `OLD_` prefix — the rename + folder location + eslint rule are three layers of signal. See [Phase 2.1's renames](#21--fermentables-first-slice-lands-hsmodal) for the canonical example.

## Target folder layout

```
src/modules/hopskip/
├── components/
│   ├── (existing primitives + chrome — HSCard, HSButton, HSHeader, etc.)
│   ├── HSActionMenu.tsx, HSCardLift.tsx, useCursorFollowCard.ts (NEW — landed in Phase 1.1, reused by 1.2/1.4/2.x)
│   ├── HSLearnArticle.tsx, HSLearnNav.tsx, HSFormulaCallout.tsx, HSBuilderMockups.tsx (already exist)
│   ├── HopSkipBuilder.tsx, HopSkipHomeContent.tsx, etc. (already exist)
│   ├── builder/         ← Phase 2 — HSBrewSheetSection (2.5a ✅ + 2.5b ✅ + polish ✅); FermentableSection (2.1 ✅); MashSection (2.2 ✅); FermentationSection (2.3 ✅); HopSection (2.8 ✅); YeastSection (2.6 ✅). 2.4/2.7 to follow.
│   ├── modals/          ← HSModal primitive (keeps HS prefix) + FermentablePresetModal + CustomFermentableModal (2.1 ✅) + MashStepModal (2.2 ✅) + FermentationStepModal (2.3 ✅) + HopPresetModal + CustomHopModal (2.8 ✅) + YeastPresetModal + CustomYeastModal (2.6 ✅). Future per-section modals land here without HS prefix.
│   ├── calculators/     ← Phase 3 ✅ — ResultGauge + Segmented + CalculatorEmbed + AbvCalculator + BoilOffCalculator + DilutionCalculator + IbuCalculator + CarbonationCalculator + HydrometerCorrectionCalculator + StrikeTempCalculator
│   └── public/          ← Phase 1 — HSBrowsePage + HSBrowseCard live here (1.1 ✅); HSPublicRecipeShell/HSForkButton/HSRatingStars/useForkRecipe (1.2 ✅); HSCompareRecipesPage (1.3 ✅); HSUserProfile (1.4 ✅). BrewSession deferred to 2.5b; VersionHistory ⏳ NOT STARTED (1.6).
└── styles/
    ├── tokens.css       (stays forever)
    └── overrides.css    (shrinks as native components replace classic; eventually can be deleted)
```

---

# Phase 0 — Free wins + quarantine labeling

**Status:** ✅ Done.
**Effort: 1 focused session.**

Things where HS is fighting itself, source code is classic-but-rendered-HS, or where labels would prevent future confusion. Most of these are one-file edits. See the [Phase 0 retrospective](#phase-0-retrospective--lessons-for-phases-14) for what scope changed mid-execution and what to apply to subsequent phases.

## 0.1 — HS chrome on `/r/`, `/browse`, `/u/`

**Status:** Done. ✅

[ClientShell.tsx](app/ClientShell.tsx) previously treated `/r/`, `/browse`, `/browse/*`, `/u/*` as classic routes (full classic NavBar + Footer chrome). The inner content stays classic Tailwind, but the outer chrome is HS — at least the user navigates inside HS.

**Action taken:** Dropped those exclusions from the `isClassic` check. Only `/betabuilder/*` keeps classic chrome.

**Known visual side effect:** `/browse` now shows HS-styled header + classic-styled community cards + HS-styled footer. Visually mismatched but technically correct. Closes when Phase 1.1 (HSBrowsePage) ships — see retrospective.

**Effort:** S.

## 0.2 — Strip dead inline classic styles from learn articles

**Status:** Done. ✅ 65 Bitter inline declarations removed across all 14 articles.

The actual scope (revised after executing):

- ✅ **Bitter font (65 occurrences across 14 articles)** — `style={{ fontFamily: "'Bitter', serif" }}` and `style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}` on h2/h3 headings. Dead because `.learn-prose h2, .learn-prose h3 { font-family: var(--hs-font-display) !important }` in [overrides.css](src/modules/hopskip/styles/overrides.css) already wins the cascade.
- ❌ **Shadows Into Light** — initially thought to be dead but actually NOT. The Shadows declarations are nested in multi-property `style={{}}` objects on callout-caption divs (color, fontFamily, fontSize, background, borderTop). The `.hs-theme [style*="Shadows Into Light"]` attribute selector in overrides.css uses the `style="…Shadows…"` substring as a SELECTOR HOOK to apply HS script font. Removing the inline font-family would remove the hook, and the captions would render in body font. Defer to Phase 4 (article body rewrite).
- ❌ **`style={{ color: "var(--coral-500)" }}`** — does not exist. All `coral-500` references in articles are inside Tailwind `className` strings (`className="text-[var(--coral-500)] hover:underline"`), not inline styles. Skip.

**Also out of scope for Phase 0.2 but worth noting:** [app/privacy/page.tsx](app/privacy/page.tsx) and [app/terms/page.tsx](app/terms/page.tsx) carry 4 more Bitter inline declarations. The PRD scoped 0.2 to `/learn/` only; these are a candidate for a small follow-up cleanup but not blocking.

**Effort:** S.

## 0.3 — Audit `overrides.css` for dead rules

**Status:** Done. ✅ Conservative shrink: 1,160 → 1,159 lines.

After Phase 0.1 and 0.2 ship, walk through [overrides.css](src/modules/hopskip/styles/overrides.css) and remove rules that target patterns no longer present in any active HS route.

**Lesson from executing:** the realistic shrink is small. The `.hs-theme [style*="Bitter"]` and `.hs-theme [style*="Shadows Into Light"]` remap rules still serve `/privacy/`, `/terms/`, and article callout captions — they cannot be deleted. The only verifiable dead rule was `.hs-theme [style*="Rock Salt"]` (no HS source uses inline Rock Salt). Most other rules retarget classic structure that's still rendered by classic components inside HS chrome — they only become dead as those components are replaced phase-by-phase. Expect overrides.css to shrink in chunks during Phases 1–4, not in Phase 0.

**Effort:** S.

## 0.4 — Quarantine labeling

Make it unambiguous that classic is dead-code-on-life-support.

**Done in Phase 0:**

- ✅ **READMEs.** Deprecation banner README in [app/betabuilder/](app/betabuilder/README.md), [src/modules/sharing/](src/modules/sharing/README.md), [src/modules/learn/](src/modules/learn/README.md), and [src/views/](src/views/README.md); prepended a deprecation block to the existing [src/modules/beta-builder/README.md](src/modules/beta-builder/README.md) that **explicitly calls out the partial deprecation** — only `presentation/components/` is quarantined; `domain/`, `presentation/stores/`, `presentation/hooks/` are REUSED by HS and stay first-class. The `src/modules/learn/` README also calls out that `docsConfig.ts` stays active.
- ✅ **In-UI deprecation banner** on classic routes. Added inside the `isClassic` branch of [ClientShell.tsx](app/ClientShell.tsx) above `<NavBar />`. Uses `var(--hs-ink)` / `var(--hs-cream)` with fallback hex values for the case where HS tokens aren't loaded.
- ✅ **HSHeader Classic-link copy.** [HSHeader.tsx](src/modules/hopskip/components/HSHeader.tsx) now reads "Classic (legacy) ↺" so the next-click destination is obvious.

**Deferred to per-phase landing (NEW guidance — learned in Phase 0):**

- 🔁 **JSDoc `@deprecated` tags** on the default exports of each classic file. Originally proposed as a Phase 0 sweep, but applying it broadly in Phase 0 would mark dozens of legitimate imports that HS itself currently makes (the HS builder wraps classic sections from `src/modules/beta-builder/presentation/components/`; `app/r/[slug]/page.tsx`, `app/browse/page.tsx`, `app/u/[userId]/page.tsx` import `src/modules/sharing/*`; the 6 calculator learn articles import classic widgets from `src/components/`). The IDE strikethrough would scream "broken" on working code.

  Each phase's per-slice work adds the `@deprecated` tag to the specific file(s) it just replaced. Tag format:
  ```ts
  /** @deprecated Classic UI. Migrating to HS — see HOPSKIP_MIGRATION_PRD.md. */
  export default function FermentableSection() { ... }
  ```

- 🔁 **ESLint `no-restricted-imports` rule** blocking imports from `src/modules/beta-builder/presentation/components/`, `src/modules/sharing/`, classic widget files in `src/components/`, and the classic learn modules from any file outside `app/betabuilder/`. Same reasoning as above — applying broadly in Phase 0 would fail lint on legitimate code. The rule grows incrementally as each replacement ships. By end of Phase 4, it covers everything except `docsConfig.ts` and the data + calculation layer.

**Effort:** S (for the Phase 0 portion).

---

# Phase 1 — Missing HS-native pages (full feature parity)

**Effort: 3–4 focused sessions.** Phase 1.1 ✅. Phase 1.2 chrome ✅ (inner read-only deferred to Phase 2 sections — until each builder tab gets an HS-native display-only equivalent, public viewers still show classic editable cells inside HS chrome). Phase 1.3 ✅ (mean-recipe + a few detail sub-views deferred). Phase 1.4 ✅. **Phase 1.5 closed** — subsumed into Phase 2.5a (display) ✅ + Phase 2.5b (Brew Mode wiring) ✅. Brewers can now record a brew day natively in HS at `/recipes/[id]?tab=brewsheet&session=<id>`; the classic `/betabuilder/recipes/sessions/[sessionId]` route stays as a labeled, deprecated reference. **1.6 deferred indefinitely** — see [Deferred / maybe never](#16--hsversionhistorypage--hsversionhistorymodal-deferred--maybe-never) below.

HS is currently missing entire pages that classic has. After Phase 1, every URL classic offers has an HS-native equivalent. The classic side stays accessible at `/betabuilder/*` as the side-by-side reference; the HS routes are now actually HS.

## 1.1 — HSBrowsePage

**Status:** Done. ✅ See the [Phase 1.1 retrospective](#phase-11-retrospective--lessons-for-subsequent-slices) below for findings important to subsequent phases.

After Phase 0 shipped, `/browse` was the most visually painful HS-chrome-around-classic-content surface — high traffic, busy grid layout where the mismatch is hardest to hide.

- **Current source:** [src/modules/sharing/BrowseRecipesPage.tsx](src/modules/sharing/BrowseRecipesPage.tsx) + [BrowseCard.tsx](src/modules/sharing/BrowseCard.tsx).
- **Route:** `/browse` — currently a re-export shim pointing at `/betabuilder/browse`.
- **What it does:** community recipe grid with search, sort, filter, compare-select mode. BrowseCard is the per-recipe tile with action menu (share, export, fork).
- **HS plan:**
  - `HSBrowsePage.tsx` — title bar with "your brewing —" Caveat kicker + display H1 + action row (search pill + sort select + compare toggle).
  - `HSBrowseCard.tsx` — extract and extend the community-section card pattern from [HopSkipCommunitySection.tsx](src/modules/hopskip/components/HopSkipCommunitySection.tsx). Add the action menu (share / export / fork) as an HS dropdown.
  - Drop the re-export shim at [app/browse/page.tsx](app/browse/page.tsx) and replace with the new HS server component that fetches `publicRecipeIndex` directly.
- **Data dependencies:** `publicRecipeIndex` admin SDK read (already used by HS home), fork action → `addFermentable`/etc., share via `slugUtils`.
- **Acceptance:** browse community recipes, search/sort/filter, fork to library, enter compare mode.
- **Effort:** L (search + filter + compare mode + action menu = lots of stateful UI).

## 1.2 — HSPublicRecipeView (shared-mode HopSkipBuilder)

**Status:** Chrome shipped. ✅ Inner read-only-rendering blocked on Phase 2. See the [Phase 1.2 retrospective](#phase-12-retrospective--lessons-for-subsequent-slices) below.

**Decision change vs. original plan:** the original spec called for a dedicated read-only viewer ("NOT the editing builder in disguise"). In execution we pivoted to **the viewer IS the builder, frozen** — visual continuity for brewers ("the recipe I view should look like the recipe I edit"). Implementation: extended `HopSkipBuilder` with shared-recipe props mirroring `BetaBuilderPage`'s API (`sharedRecipe`, `sharedOwnerName`, `sharedOwnerId`, `sharedRatingAvg`, `sharedRatingCount`).

- **Current source (replaced):** [src/modules/sharing/PublicRecipeView.tsx](src/modules/sharing/PublicRecipeView.tsx) + [PublicRecipeClient.tsx](src/modules/sharing/PublicRecipeClient.tsx) — were rendering `BetaBuilderPage` in read-only mode under HS chrome. Now `@deprecated` and unused except by quarantined `/betabuilder/r/[slug]`.
- **Route:** `/r/[slug]` — server component fetching `getPublicRecipe` directly into the HS shell; betabuilder re-export dropped.
- **New HS components** (`src/modules/hopskip/components/public/`):
  - `useForkRecipe.ts` — fork transaction hook with tier-gate. Extracted from classic `ForkButton`. **Reusable: HSBrowseCard's inline `handleFork` duplicates this; consolidate as a follow-up.**
  - `HSForkButton.tsx` — thin renderer over the hook; renders sign-in CTA when unauth.
  - `HSRatingStars.tsx` — interactive ink-stroked polygon stars (reuses the visual from HSBrowseCard) with the click + hover + optimistic-aggregate state machine from classic `RatingStars`. Reuses `submitRating` / `getUserRating` from `ratingService.ts` unchanged.
  - `HSPublicRecipeShell.tsx` — minimal client wrapper that maps server-component props to `HopSkipBuilder` shared-mode props (keeps `app/r/[slug]/page.tsx` server-only).
- **HopSkipBuilder shared-mode changes** (additive; non-breaking for the live builder at `/recipes/[id]`):
  - Recipe load: `setCurrentRecipe(sharedRecipe)` instead of `loadRecipe(recipeId)` when shared.
  - Sub-header: replaces Save / Open-in-classic with Fork + (if `viewer.uid === ownerId`) Open-in-builder + Back-to-browse. Hides the saved-status text.
  - Title band: swaps the recipe-name `<input>` for a static `<h1>`; changes the kicker from "recipe draft —" → "shared recipe —" (`hsTokens.water`).
  - Meta pills (`ClickableMetaPill`, `NumericMetaPill`): new `readOnly` prop renders display-only variants. Style-modal trigger suppressed.
  - New attribution + ratings band between title and live-numbers strip: owner (link to `/u/{ownerId}`) + parent-fork attribution (link to `/r/{parentRecipeShareSlug}` if present) + `HSRatingStars`.
  - Live-numbers kicker: "updates as you type ✦" → "set when published ✦".
  - Section frame: applies `.brew-read-only` class to disable mouse interactions on classic section inputs.
- **Data dependencies:** `getPublicRecipe`, `buildRecipeJsonLd`, `submitRating`, `getUserRating`, fork txn — all reused unchanged. SEO/OG/JSON-LD preserved verbatim.
- **What's NOT yet "frozen":** `.brew-read-only` only sets `pointer-events: none` on inputs — keyboard focus + typing still works once a field is tabbed into. Inputs are still semantically writable. **Fully read-only rendering requires each classic section to be replaced by an HS-native display-only equivalent** (Phase 2). For now, the chrome around the recipe is HS-native and read-only; the cells inside the tabs remain editable until each section migrates. Accepted as transitional — see retrospective.
- **Effort:** M (chrome only — turned out smaller than the original "L dedicated viewer" estimate because we reuse HopSkipBuilder's chrome).

## 1.3 — HSCompareRecipesPage

**Status:** Done. ✅ See the [Phase 1.3 retrospective](#phase-13-retrospective--lessons-for-subsequent-slices) below.

- **Current source (replaced):** [src/modules/compare/CompareRecipesPage.tsx](src/modules/compare/CompareRecipesPage.tsx) — now `@deprecated` and unreferenced from any HS-active code (only the quarantined `/betabuilder/browse/compare` mirror imports it, with an inline `eslint-disable no-restricted-imports`).
- **Route:** `/browse/compare?ids=…` — now a server component that parses the comma-separated IDs query param, resolves seed recipes via `findSeedRecipe()` and Firestore recipes via `adminDb.getAll(...)`, and hands `initialRecipes: Recipe[]` to `HSCompareRecipesPage`. Inline server fetch (no `/api/compare` round-trip).
- **New HS components** (`src/modules/hopskip/components/public/`):
  - `HSCompareRecipesPage.tsx` — client component (`RecipeCalculationService.calculate` runs in `useMemo`). Five inline sub-blocks:
    - **VitalsBlock** — HSCard (malt accent) with table: rows=recipes, cols=ABV/OG/FG/IBU/SRM/Cal. SRM color chip per cell. Average row (malt-tinted). BJCP guideline row (water-tinted) when ≥1 recipe has a code that maps to `getBjcpStyleSpec()`.
    - **GrainBlock** — HSCard (hops accent). Stacked horizontal bars per recipe + average bar + legend. Uses existing `GRAIN_CATEGORY_COLORS` and `GRAIN_CATEGORY_ORDER` from `compareUtils.ts`. **Each segment hovers a cursor-following tooltip** (`position: fixed`, z-index 100 to escape `HSCard`'s `overflow: hidden`) with the category name in Caveat cursive (matching the `HSCardLift` "open →" CTA), the segment's percentage + total kg, and a per-grain list (name + weight + pct). First-show snaps to cursor with transition temporarily disabled — no shoot-in from viewport origin.
    - **HopBlock** — HSCard (hops accent). Table: rows=hop names (union of all recipes), cols=recipes, plus Total + Rate (g/L) summary rows.
    - **MashBlock** — HSCard (roast accent). Table: rows=step indices, cols=recipes. Weighted-avg row + overall-avg row. Section auto-hides when no recipes have mash steps.
    - **WaterBlock** — HSCard (water accent). Table: rows=ions (Ca/Mg/Na/Cl/SO4/HCO3), cols=recipes + Avg. Cl:SO₄ ratio row. Section auto-hides when no recipes have water data.
  - Hero band identical to HSBrowsePage / HSUserProfile pattern (HSScriptNote kicker "side by side —" in water-blue + display-font H1 "Compare recipes." + body-font line "Comparing N recipes — vitals, grains, hops, mash, water side-by-side." + back-to-browse link).
  - Empty state when `items.length < 2`: small HSCard ("Pick at least two." + back-to-browse link).
- **Reused unchanged:** `compareUtils.ts` (all helpers: `getGrainBreakdown`, `getHopSummary`, `getWeightedMashTemp`, `getEffectiveWaterProfile`, `averageWaterProfiles`, `GRAIN_CATEGORY_COLORS/ORDER`, `avg`, `normalizeGrainName`), `RecipeCalculationService`, `srmToRgb`, `bjcpSpecs`. `/api/compare/route.ts` left untouched (still works; HS uses server-prefetch instead).
- **Deferred from v1** (not regressions vs. classic — bracket-noted to revisit as 1.3.x follow-ups):
  - Per-category normalized grain detail tables (the inline table showing each grain row with `count/total` indicator). HS surfaces the equivalent grain-level data via the **stacked-bar hover tooltip** (specific grain names + weights + percentages per segment); the always-visible cross-recipe table is deferred.
  - Hop addition-types grid (per-recipe `<HopAdditionRow>` panels).
  - Hop flavor radar (currently still uses `HopFlavorRadar` from classic — wires into Phase 2.8 when the entire Hop section migrates).
  - Water salt-additions detail table (gypsum/CaCl₂/Epsom/NaCl/NaHCO₃ rows).
  - MeanRecipeSummary block (vitals grid + grain bar + common hops + avg hop rate + avg mash temp + avg water).
- **Data dependencies:** Admin SDK `adminDb.getAll()` of full `recipes` docs (not `publicRecipeIndex` — Compare needs ingredient detail). Strips `ownerId` (privacy, matching classic API) and stored `id` (per Phase 1.2 fork-id-wins rule). Filters to `isPublic` only.
- **Effort:** M — single focused session as estimated.

## 1.4 — HSUserProfile

**Status:** Done. ✅ See the [Phase 1.4 retrospective](#phase-14-retrospective--lessons-for-subsequent-slices) below.

- **Current source (replaced):** [src/modules/sharing/UserProfileClient.tsx](src/modules/sharing/UserProfileClient.tsx) — now `@deprecated` and unreferenced from any HS-active code.
- **Route:** `/u/[userId]` — now a server component that admin-SDK-prefetches `publicRecipeIndex` filtered by ownerId and hands `initialRecipes` + pre-resolved `ownerName`/`recipeCount`/`topStyles` to `HSUserProfile`. Per-profile `generateMetadata` (title = ownerName, description = "{n} public brewing recipes by {ownerName}…").
- **New HS components** (`src/modules/hopskip/components/public/`):
  - `HSUserProfile.tsx` — hero band (`HSScriptNote` "brewer —" kicker in water-blue + display-font H1 ownerName + body-font secondary line "{n} public recipes · {topStyles}") + `HSBrowseCard` grid (1/2/3 cols at sm/md/lg, cycled tilts identical to HSBrowsePage) + empty-state `HSCard` ("no public brews yet —" / "Nothing shared." / "When {ownerName} publishes a recipe it shows up here.").
- **Reused unchanged:** `HSBrowseCard` (Phase 1.1) — works as-is in profile context; no `omitOwner` prop introduced (the inline ownerName→`/u/{ownerId}` self-link on each card is mildly redundant, accepted as transitional). Server page hidden `<nav aria-label="Recipes by {ownerName}">` of `<Link>` per recipe mirrors HSBrowsePage's SEO pattern.
- **Data dependencies:** `publicRecipeIndex` admin SDK read (server-side only — no client cache-first refresh). Mapper copied verbatim from [app/browse/page.tsx](app/browse/page.tsx).
- **Effort:** S — single focused session as estimated.

## 1.5 — HSBrewSessionPage

**Status:** Closed. ✅ Subsumed into [Phase 2.5a (Brew sheet display)](#25a--brew-sheet-display-only) ✅ + [Phase 2.5b (Brew Mode wiring)](#25b--brew-mode-actuals--session-wiring) ✅.

**Resolution:** Brewers record brew days natively in HS via the Brew toggle in the brew-sheet tab (`/recipes/[id]?tab=brewsheet&session=<id>`). Legacy `/recipes/sessions/[sessionId]` entry points redirect to the new URL pattern. The classic standalone page stays accessible at `/betabuilder/recipes/sessions/[sessionId]` as a quarantined, `@deprecated`-tagged reference.

**Decision change vs. original plan:** Original 1.5 spec was a dedicated HS-native session page at `/recipes/sessions/[sessionId]`. While planning the slice, the user reframed: the brew sheet section inside the recipe builder should evolve into a proper brew sheet (all targets in one place, designed for tablet use on brew day), and "Brew mode" inside that section will subsume the standalone session page. Both sub-slices have now shipped:

- Phase 2.5a shipped as a comprehensive display-only HS brew sheet (see 2.5a block). ✅
- Phase 2.5b added an "actuals" overlay on the brew sheet, wired to `useBrewSessionStore` with 400 ms debounce + flush-on-unload. `/recipes/sessions/[sessionId]` is now a client redirect to `/recipes/[recipeId]?tab=brewsheet&session=[id]`. ✅

**Status of classic sources:**

- [src/modules/beta-builder/presentation/components/BrewSessionPage.tsx](src/modules/beta-builder/presentation/components/BrewSessionPage.tsx) — `@deprecated`-tagged + eslint-blocked outside `/betabuilder/`. Still mounted at `/betabuilder/recipes/sessions/[sessionId]` (via an inline `// eslint-disable-next-line no-restricted-imports` on the mirror page) as the side-by-side reference per the quarantine-not-delete principle.
- `useBrewSessionStore`, `FirestoreBrewSessionRepository`, `BrewSessionCalculationService` — reused unchanged by Phase 2.5b. The store gained one additive action (`updateAddedFlags`) and `SessionActuals` gained per-step / per-row / gravity-log fields.

## 1.6 — HSVersionHistoryPage + HSVersionHistoryModal (deferred / maybe never)

**Status:** Deferred indefinitely. ⏸ Not on the active roadmap; may never ship.

**Why deprioritized (decision 2026-05-23):** Version history is low-traffic — most brewers iterate forward, not back; the few who restore old versions can do it via `/betabuilder/recipes/[id]/versions/[versionNumber]` which still works as a quarantined classic surface. Rebuilding it natively in HS for parity-sake doesn't earn the M session it would cost. The classic surface stays accessible as the quarantined reference per the [quarantine-not-delete principle](#architecture--principles) — no removal pressure. If user demand for an HS-native version viewer surfaces, revisit. Until then, this slice is not in the active count.

**If we ever do build it, the plan is:**

- **Current source:** [src/modules/beta-builder/presentation/components/VersionHistoryModal.tsx](src/modules/beta-builder/presentation/components/VersionHistoryModal.tsx) + the `versions/[versionNumber]` route at `/betabuilder/recipes/[id]/versions/[versionNumber]/page.tsx`.
- **Route:** `/recipes/[id]/versions/[versionNumber]` (new).
- **What it does:** view a historical version of a recipe + restore.
- **HS plan:**
  - `HSVersionHistoryModal.tsx` — opened from a "Version history" button in the HS recipe builder sub-header. List of versions (each as a `HSCard` row with version number + date + change note + "View" link).
  - `HSVersionHistoryPage.tsx` — the page that opens when you click "View". Looks like the HS read-only public viewer (Phase 1.2), but pulls from `recipeVersionRepository` instead of `publicRecipeIndex`. Adds a "Restore this version" button.
- **Data dependencies:** `recipeVersionRepository` (existing).
- **Acceptance:** open version history modal, view a historical version, restore it.
- **Effort if we do it:** M.

---

**After Phase 1 (excluding deferred 1.6) ships:** HS has page parity with classic for the surfaces brewers actually use. Every active URL works in HS. `/betabuilder/*` is now purely a reference, not a fallback.

---

# Phase 2 — Section-by-section HS-native rewrites

**Effort: 6–8 focused sessions.** Status: **All 8 builder sections shipped.** ✅ — 2.5a (Brew Sheet display) · 2.5b (Brew Mode wiring) · 2.1 (Fermentables) · 2.2 (Mash) · 2.3 (Fermentation) · 2.8 (Hops) · 2.6 (Yeast) · 2.7 (Water) · 2.4 (Equipment).

Each section is one vertical slice including its own modals and sub-components. After each ships, the corresponding classic source files become unimported from anywhere outside `/betabuilder/*` and can be left quarantined.

Order (simpler → harder). Each section's classic source files are listed under it; all of them get an HS-native equivalent in `src/modules/hopskip/components/builder/`. **Phase 2 was started out-of-order with 2.5a because the user reframed the brew sheet as the substrate for absorbing Phase 1.5 (brew session) functionality. After 2.3 shipped the per-list substrate, the user picked 2.8 Hops next (data-rich + visualizer slot is a real test of the substrate on a section with an established chart pattern from the brew sheet), then 2.6 Yeast (the substrate adapted cleanly to a single-strain "ledger" with the starter-steps mini-ledger nested inside). The remaining sections (2.4 / 2.7) will be picked from there.**

## 2.1 — Fermentables (first slice; lands HSModal)

**Status:** Done. ✅ See the [Phase 2.1 retrospective](#phase-21-retrospective--lessons-for-subsequent-slices) below.

- **Classic sources (renamed + quarantined):**
  - [OLD_FermentableSection.tsx](src/modules/beta-builder/presentation/components/OLD_FermentableSection.tsx) — was `FermentableSection.tsx`; renamed under the [OLD_ convention](#naming-convention-old_-prefix-on-classic-no-prefix-on-new). Eslint-blocked outside `/betabuilder/`.
  - [OLD_FermentablePresetModal.tsx](src/modules/beta-builder/presentation/components/OLD_FermentablePresetModal.tsx) — was `FermentablePresetModal.tsx`. The live classic picker was actually the generic `PresetPickerModal<FermentablePreset>`; this `OLD_` file was unused even by classic.
  - [OLD_CustomFermentableModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomFermentableModal.tsx) — was `CustomFermentableModal.tsx`.
- **New HS components** (no `HS` prefix per the [naming convention](#naming-convention-old_-prefix-on-classic-no-prefix-on-new) — section components are the canonical version of their feature; `HS` prefix stays on design-system primitives like `HSCard`/`HSButton`/`HSModal`):
  - [HSModal.tsx](src/modules/hopskip/components/modals/HSModal.tsx) — shared primitive (paper bg, 2px ink border, 7px malt top stripe via `border-top` not `::before`, sh4 shadow, focus trap, ESC/backdrop close, body scroll lock, click-origin scale-in animation). Exports `HSModalHeader` / `HSModalBody` / `HSModalFooter` sub-components for consistent inner chrome. **Keeps `HS` prefix — design-system primitive.**
  - [FermentableSection.tsx](src/modules/hopskip/components/builder/FermentableSection.tsx) — section title + 2-col grid (ledger left, bill stack + brewer's notes sidebar right). See the design iteration block below for the full structural breakdown.
  - [FermentablePresetModal.tsx](src/modules/hopskip/components/modals/FermentablePresetModal.tsx) — HSModal + cream-2 pill search field + filter toggle + advanced filters (Type / Color / Origin chips, OR within categories, AND across) + sticky group headers + preset rows on hover-tinted bare buttons (SRM dot + name + flag + °L/PPG).
  - [CustomFermentableModal.tsx](src/modules/hopskip/components/modals/CustomFermentableModal.tsx) — HSModal + inline `FieldText` / `FieldNumber` / `FieldSelect` primitives (cream-2 input bg, ink border, sh1, uppercase eyebrow label + Caveat script hint line). Type dropdown auto-sets sensible fermentability default per type.
- **Reused unchanged:** `useRecipeStore.addFermentable/updateFermentable/removeFermentable`; `usePresetStore.fermentablePresetsGrouped/loadFermentablePresets/saveFermentablePreset`; `fermentableCalculationService.calculatePercentsFromWeights / calculateWeightsFromPercentsAndABV / calculateTotalPercent`; `getFermentability` from the preset data layer; `srmToRgb`, `getCountryFlag`, `BREWING_ORIGINS`. No new store actions, no new repos, no new services.
- **What's NOT in v1 (deferred):**
  - **Animated number transitions on input** — classic uses `AnimatedNumberInput` (a custom input that smooths the value display); HS uses a plain `<input type="number">` with Caveat-font value. The animation is cosmetic and adds a custom-component dependency for marginal gain; revisit only if the value-change feedback feels jarring.
  - **`ScalableText` for long fermentable names** — classic shrinks the font when the name doesn't fit; HS truncates with ellipsis. Truncation is simpler and read tests well at common widths; revisit if real-world recipes have names that need both lines + scaling.
  - **Hover-reveal action buttons** — classic hides the swap/remove buttons until row hover; HS shows them always. The always-visible state is more discoverable, especially on touch; the cost is +56px of horizontal real estate per row (worth it).
- **Data dependencies:** All read-write via existing recipe + preset stores. No new server endpoints.
- **Acceptance:** ✅ add fermentable → row appears with SRM chip + name + chips + weight input → live numbers tick (OG/SRM/CAL); swap fermentable via swap icon → picker opens in "swap" mode → selecting preserves weight; remove fermentable → row disappears; switch to %, enter target ABV → weights auto-scale; open custom modal → save → toast confirms; ESC / backdrop / × button close modals; no console errors; no new lint findings (lint dropped 78 → 75 across the slice).
- **Effort:** M+ (single focused session) — exactly as estimated. ~1,250 LOC across 4 files.

### Design iteration shipped (post-initial-2.1 sessions)

After the initial ship, the user iterated heavily against a Claude Design handoff bundle. The Fermentables section ended up structurally different from the initial 2.1 — what landed is the substrate the rest of Phase 2 should evolve from. Captured here so the retrospective lessons below have context.

- **Outer section frame restored to brewsheet pattern.** Paper bg + 2px ink border + `0 0 14px 14px` (squared top corners that seat flush against the active tab) + sh3 shadow + 24px padding. The initial 2.1 leaned on the `.hs-section-frame` override CSS; the redesign owns the frame inline so the section is self-contained.
- **Section header rewritten as a slim title block.** Just script kicker ("your grain bill —") + display heading ("Fermentables.") + 2px malt-yellow rule under it. No mode toggle, no Target ABV pill, no Add button in the header anymore — all controls moved down to the ledger header row, "closer to the actual malt list since it is where they will actually be used" (user quote).
- **Bill Stack** — new visualization. Card with cream-2 bg, ink border, sh3 shadow, 64px-tall colored segmented bar with per-grain SRM color, % overlay on the dominant segment only (`pct >= 25` shows %, `pct >= 30` adds a short name), monospace weight legend below at each segment's left edge. Cursor-following hover tooltip (model: compare page's `BarRow`) shows grain name + category + share% + weight + °L/PPG/EBC. Lives in the right sidebar above the brewer's notes.
- **Ledger header row** — eyebrow "THE GRAIN LEDGER" + flex-spacer hairline + "{n} entries" script note + (Target ABV pill in % mode) + Amount/% segmented toggle + "+ Add fermentable" button. Sits between the title and the table.
- **Ledger table** — paper-bordered card with grid columns `62px | minmax(0, 1.7fr) | 140px | 86px | 32px`. Per-row: 42px SRM swatch with `°L` inside (white text above L>30) + PPG caption below; grain name (click-to-swap, hover-underline) + flag + category pill (Base malt / Crystal / Specialty / Roasted / Adjunct / Sugar, derived from Lovibond + name heuristic); editable Weight/% cell with Caveat 30px handwritten value + dotted-underline cue + hover stepper ▲▼; read-only computed Share/kg cell; ghost × remove button that fades in on row hover. Total row: `~EBC | "Total grain bill" | display-font kg | 100% | (empty)`. Mode toggle swaps which column is editable vs. computed; THead reorders labels accordingly.
- **Brewer's Notes** — sidebar card with subtle honey-tinted background (`color-mix(in srgb, var(--hs-cream-2) 86%, var(--hs-honey))`). Click-to-edit notes field (Caveat 19px, ESC cancels, Cmd/Ctrl+Enter commits, blur commits). Tag chip row below (click to edit; space-separated input, normalizes `#tag` strips). Wired to existing `recipe.notes` + `recipe.tags`.
- **2-col grid via `grid-template-areas`.** Desktop: `"lhead ." / "ltable aside"` — row 1 is ledger-header + empty, row 2 is ledger-table + sidebar (aside packed via flex with gap:16). The sidebar's TOP aligns with the ledger TABLE's top, not the header buttons. Mobile (≤900px): `display: contents` on the aside so bill + notes can flow individually into `"bill" / "lhead" / "ltable" / "notes"` — bill hoists to top (chart leads), notes anchors at bottom.
- **Mobile-only dashed "+ Add another fermentable" row.** Saves the brewer from scrolling up to the ledger header to add another grain. SVG `stroke-dasharray='12 8'` background-image (CSS native `border-style: dashed` doesn't allow dash-length control) + gentle cream-2 tinted bg. Always-visible on touch; hidden on desktop because the header button is right there.
- **Color indicator bar in live numbers** (HopSkipBuilder change — only live-numbers touch). Replaces the SRM small card with a wide gradient bar below the 6 remaining stat cards (OG/FG/ABV/IBU/pH/Cal). Gradient generated programmatically from `srmToRgb()` sampled at every integer SRM 1→40, so the gradient color at any X position exactly matches `srmToRgb(srm)` at that position. Pin marker uses `srmToRgb(srm)` as its fill (previews the actual beer color) + 2px ink border + 1.5px cream outer ring for visibility. Style-range hollow rings at the BJCP min/max SRM endpoints when a style is set. Script-font color adjective on the right (`straw ✦` → ... → `deep red ✦` → `brown ✦` → `black ✦`).
- **Per-section grouping** that came out of this: the section is now `[title]` → `[2-col grid containing main + sidebar]` → `[modals]`, where the sidebar pattern (bill + notes packed) is reusable for any Phase 2 section that wants a "visualizer + notes" rail.

## 2.2 — Mash

**Status:** Done. ✅ See the [Phase 2.2 retrospective](#phase-22-retrospective--lessons-for-subsequent-slices) below.

- **Classic sources (renamed + quarantined):**
  - [OLD_MashScheduleSection.tsx](src/modules/beta-builder/presentation/components/OLD_MashScheduleSection.tsx) — was `MashScheduleSection.tsx`. Eslint-blocked outside `/betabuilder/`.
  - [OLD_MashStepModal.tsx](src/modules/beta-builder/presentation/components/OLD_MashStepModal.tsx) — was `MashStepModal.tsx`. Now only imported by `OLD_MashScheduleSection`.
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles)):
  - [MashSection.tsx](src/modules/hopskip/components/builder/MashSection.tsx) — section title (roast accent rule) + 2-col grid (ledger left, sidebar right with a compact MashReadout on top + BrewersNotesCard below). Empty state with 3 generator cards (Single Infusion / Step Mash / Decoction) + custom-step button. Ledger header row with `HSActionMenu`-driven "Generate ▾" dropdown + roast-accented "+ Add step" button. Ledger table per-row grid `[# badge | step name + band caption | temp editable | time editable | actions]`. Steps badge uses a color derived from `temperatureColor(tempC)` — acid (cool straw) → protein (honey) → beta (deeper honey) → alpha (malt) → mash out (roast).
  - [MashStepModal.tsx](src/modules/hopskip/components/modals/MashStepModal.tsx) — HSModal (md size, roast accent) with FieldText (step name) + 2-col FieldNumber (temp + duration) + FieldNumber (decoction volume, optional) + 6-up preset grid (Acid / Protein / Beta / Sacch / Alpha / Mash Out — each with name, °C × min, and a Caveat-script tagline like "soften the husk" / "lock the enzymes"). Validates via `mashScheduleService.validateMashStep`.
- **Sidebar shape:** `[MashReadout] + [BrewersNotesCard]`. MashReadout is a chrome-less 3-row card — Strike / Mash / Sparge — final height ~109px (no header row, no script sublines). BrewersNotesCard mirrors fermentables (same `recipe.notes` / `recipe.tags` source of truth — edits sync between surfaces, which is desired), accented in roast.
- **Reused unchanged:** `useRecipeStore.addMashStep/updateMashStep/removeMashStep/reorderMashSteps/updateRecipe`; `mashScheduleService.generateDefaultSingleInfusion / generateStepMash / generateDecoction / validateMashStep`; `useRecipeCalculations` for `strikeTempC` + `mashWaterL` + `spargeWaterL`. No new store actions, no new repos, no new services.
- **What's NOT in v1 (deferred):**
  - **Mash profile chart.** An earlier v1 had a stepped temp-vs-time visualization in the sidebar. Dropped after user feedback ("Not sure we need this... the readout is fine"). The ledger row + colored badge already convey the schedule shape; the chart was redundant decoration. If a brewer ever asks for a brew-day visual of the schedule, the brew sheet section already prints it as a table.
  - **Mash pH + adjustments in the readout.** Dropped same time as the chart — pH lives on the Water tab where the brewer is already configuring source profile + salt additions; surfacing it on Mash too created cross-tab noise.
  - **Drag reorder.** Header buttons (▲ / ▼) reorder via `reorderMashSteps`. Drag-and-drop sortable was in the original PRD plan but the keyboard-and-mouse buttons are accessible, mobile-friendly, and ship-day cheap; HTML5 drag-and-drop on table rows has known issues on touch. Add later only if brewers ask for it.
  - **Animated number transitions on input** — same deferral as 2.1. The Caveat script-font commit feedback is the visual cue.
- **Data dependencies:** All read-write via existing recipe store + calc hook. No new server endpoints.
- **Acceptance:** ✅ open recipe → switch to Mash tab → empty state renders 3 generator cards + custom-step button; click "Step Mash" → 4 rows appear (Protein 52°C 15 min · Beta 63°C 30 min · Alpha 70°C 15 min · Mash Out 76°C 10 min); readout shows Strike temp + Mash water + Sparge water with helpful hints ("into the tun" / "rinse the grain" or "needs grain" / "set batch + equipment" when empty); brewer's notes card renders with placeholder + edit-toggle + tags row; click on a temp value → input swaps in with Caveat font, type new value, Enter commits, live numbers tick; click "+ Add step" → modal opens with empty name + temp 67 + time 60 + decoction 0 + 6 preset chips; click a preset → fields populate, click Save → row appears; ▲/▼ buttons reorder rows; × removes (disabled when only one step); Generate ▾ dropdown replaces schedule with confirm; ESC/backdrop/× close modal; no console errors; lint baseline holds (75 → 75).
- **Effort:** M (single focused session + sidebar rework iteration) — as estimated. ~1,300 LOC across MashSection + MashStepModal.

## 2.3 — Fermentation & Packaging (merged)

**Status:** Done. ✅ See the [Phase 2.3 retrospective](#phase-23-retrospective--lessons-for-subsequent-slices) below.

**Scope expansion vs. original 2.3 plan:** The initial v1 shipped as a Mash clone with a thin 3-row readout sidebar (Primary / Total / Crash). User feedback was that the readout had no useful data and "Fermentation section itself is kinda negligible." Decision to expand the tab to absorb packaging — the classic [PackagingSection.tsx](src/modules/beta-builder/presentation/components/PackagingSection.tsx) was orphaned (not surfaced in any HS tab), and the brewer's mental model is pitch → ferment → crash → package as one continuous flow. The merge makes the tab meaningful AND closes an orphan-classic gap in one slice. **Tab label stays "Fermentation"** (no UI churn); the section H2 renamed to "Fermentation & Conditioning." with a "from pitch to package —" script kicker to reflect the broader scope. A future Phase 2.9 for Packaging is no longer needed.

**Layout iteration**: shipped through ~12 micro-iterations after the initial merge — sidebar moved out then back, packaging moved in/out of cards, calendar pills tested above/below/inside the day axis, multiple rewrites of the carb-split timeline visualization. The final shape (documented below) emerged from playing with the brewer's mental model at every step. The retrospective captures the lessons from each pivot.

- **Classic sources (renamed + quarantined):**
  - [OLD_FermentationSection.tsx](src/modules/beta-builder/presentation/components/OLD_FermentationSection.tsx) — was `FermentationSection.tsx`. Eslint-blocked outside `/betabuilder/`.
  - [OLD_FermentationStepModal.tsx](src/modules/beta-builder/presentation/components/OLD_FermentationStepModal.tsx) — was `FermentationStepModal.tsx`.
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles)):
  - [FermentationSection.tsx](src/modules/hopskip/components/builder/FermentationSection.tsx) — section title (honey accent rule) + 2-col grid (ledger left, sidebar right with a 3-row FermentationReadout on top + BrewersNotesCard below). Empty state with 3 generator cards (Standard Ale / Lager / Hazy IPA) + custom-step button. Ledger header row with `HSActionMenu`-driven "Generate ▾" dropdown + honey-accented "+ Add step" button. Ledger table per-row grid `[# badge | step name + type caption + notes | temp editable | days editable | actions]`. Step badge uses `stepTypeColor(type)` — primary (honey) · secondary (yeast) · diacetyl-rest (roast) · conditioning (malt) · cold-crash (cool blue #7faec9).
  - [FermentationStepModal.tsx](src/modules/hopskip/components/modals/FermentationStepModal.tsx) — HSModal (lg size, honey accent) with a 5-up type-chip row at the top (Primary / Secondary / Diacetyl rest / Conditioning / Cold crash, each showing default temp + days + a Caveat-script tagline) + FieldText (step name) + 2-col FieldNumber (temp + duration in days) + FieldTextarea (notes) + tip card. Type-chip click auto-fills defaults ONLY when adding new (preserves edits when editing existing).
- **Layout (final post-iteration shape):** The tab is "two sections in one" — main column hosts both blocks stacked vertically; the sidebar holds an "At a glance" card with a journey visualization + brewer's notes.
  - **Main column** = `[Fermentation block]` + `[Conditioning block]`
    - **Fermentation block**: `BlockEyebrow("The fermentation schedule")` with hairline + script count + Generate ▾ menu + "+ Add step" button · then `FermentationEmptyState` (3 generator cards: Standard Ale / Lager / Hazy IPA) OR the `Ledger`.
    - **Conditioning block**: `BlockEyebrow("The conditioning plan")` with hairline + method label + "Change method" pill · then `ConditioningEmptyState` (3 method picker cards: Force carb / Bottle prime / Split it) when `recipe.packaging` is undefined, OR the `CO2TargetsCard` + method-specific cards (`KegPsiCard` if keg, `PrimingSugarCard` if bottle). For Split it, CO2 spans full width and Keg + Bottle cards sit side-by-side.
  - **Sidebar** = `[SummaryCard]` + `[BrewersNotesCard]` (no sticky — `align-items: start` on the grid aligns them with the main column's top).
    - **SummaryCard ("At a glance")**: container for the journey visualization. Contents (top to bottom):
      1. Header row: `Eyebrow("At a glance")` + script note ("ready ~Xd" or "keg ~Xd · bottle ~Yd" for split).
      2. **Calendar pills row** — `DatePill("brew")` left + `DatePill("ready")` right, flush against the bar (no spacer between them). Pills overlap into the same vertical band as the keg-ready callout (pills at L/R extremes, callout at middle keg/bottle boundary).
      3. **JourneyTimeline** — 36px tall horizontal stacked bar with one segment per fermentation step (colored by `stepTypeColor(s.type)`) + carb segments at the end. For solo keg or solo bottle, ONE carb segment. For Split, TWO sibling segments (`carb-keg` honey + `carb-bottle` malt) with a 1.5px dashed-rgba(40%) divider between them (replaces the previous solid border). Each carb segment has its own hover + tooltip kicker. Diagonal stripe overlay on all carb segments signals "estimated". Segment labels use the user's editable step name (e.g. "Dry Hop") not the canonical type label (e.g. "Secondary").
      4. **Keg-ready callout** (split-packaging only) — absolutely positioned above the bar at the keg/bottle boundary (`leftPct`). Hand-drawn SVG path `M 19 17 L 2 1` for a single sharp diagonal leader line angling up-and-left toward the bar's centre + Caveat-script "keg ready Jul 4" label rotated −3°. Angled toward the centre (away from the right-side calendar pill).
      5. **Day axis** — single centred `package · Nd` marker flanked by dotted hairlines.
      6. **Stat tiles grid** — `auto-fit minmax(64px, 1fr)`: ONE tile per fermentation step (label = user step name, value = temp, sub = days, `borderTop: 3px ${stepTypeColor}` accent) + CO₂ vol tile + Keg PSI tile (if keg) + Bottle grams tile (if bottle). Multi-tiered schedules (Hazy IPA primary + dry hop + cold crash) get a dedicated tile per phase rather than one rolled-up "Ferment" tile.
  - **Carb method cards** (rendered inside ConditioningBlock):
    - **CO2TargetsCard** — eyebrow + "from {peakTemp}°C peak ferment" script note · single row containing: `[Target stepper (rounded-rect, 10px corner, 32px tall)] · Inline residual readout · Inline needed readout · SuggestedStyleButton` (when `recipe.style` matches `styleCo2Range()` — click applies BJCP typical, content trimmed to "Style · range · ↗typical").
    - **KegPsiCard** — eyebrow + `CarbMethodToggle` (2-up segmented "Set & forget ~5d / Burst ~2d") in header row · serving stepper LEFT, PSI hero number + tagline RIGHT (max-width 170px on right column so tagline wraps to 2 lines at wide widths). Tagline copy changes with method ("Hold at serving psi 5–7 days." vs "30 psi for 24h, then drop to serving psi.").
    - **PrimingSugarCard** — eyebrow + "{batchL} L batch" sub · 4-up sugar-chip selector (Corn / Table / DME / Honey) · `Add 119g · 4.19 oz · 5.9 g/L` total row right-aligned (label sits 8px to the left of the value, not at the opposite end of the card). Falls back to "already over target —" script when residual ≥ target.
- **Reused unchanged:** `useRecipeStore.updateRecipe` (with `fermentationSteps`, `packaging`, AND `brewDate` patches — matches classic behavior; no new store actions added per the [2.2 scoping rule](#mashscheduleservice--userecipecalculations--recipestore-reused-exactly--zero-domain-changes)); `uid` for generated step IDs; **`packagingCalculationService` consumed in full** — `residualCo2`, `highestFermTemp` (the peak-temp formula matching Noonan / industry convention), `primingSugarGrams`, `forcedCarbonationPsi`, `styleCo2Range`, `gramsToOz`, `estimatedConditioningDays`. No new domain methods, no new repos, no new services. Packaging defaults are inline as `DEFAULT_PACKAGING` in the section file (target 2.4 vol · corn sugar · serving 4°C · bottle method) — recipe persists to `recipe.packaging` lazily on first interaction.
- **Recipe model addition (one schema change):** added `recipe.brewDate?: string` (ISO `YYYY-MM-DD` local-date) to the [Recipe type](src/modules/beta-builder/domain/models/Recipe.ts). Drives the calendar pills + ready-date back-calculation. Stored as a string for Firestore compatibility (Timestamp would also work but plain string is simpler with JSON.parse/stringify). Read in the section parent via `useMemo` + local-noon `new Date(y, m-1, d, 12)` to avoid timezone-edge shifts; written via `updateRecipe({ brewDate: dateToInputValue(d) })` with `undefined` for clear.
- **What's NOT in v1 (deferred):**
  - **Per-step notes display in the ledger.** Notes are stored + editable in the modal and rendered inline in the type caption (`Primary fermentation · Add dry hops on day 7`). Long notes truncate via the caption row. If brewers want richer per-step note formatting, add a hover/expand pattern then.
  - **Fermentation schedule generator service.** The 3 empty-state generators (Standard Ale / Lager / Hazy IPA) are inline preset arrays in the section file. If a 4th consumer wants the same presets (e.g., a recipe-creation wizard), promote to a `FermentationScheduleService` then.
  - **Animated number transitions on input** — same deferral as 2.1/2.2. Caveat script-font is the commit visual cue.
  - **Drag reorder.** Move up/down buttons reorder via array swap (matches mash). Drag-and-drop is a deferred mobile-hostile feature.
  - **Bottle entries (multi-size).** Classic packaging tracks per-size bottle counts (330ml / 500ml / 650ml / 750ml). HS v1 collapses the bottling card to "grams of sugar for the batch" — bottle-size assignments + counts are a brew-day concern that belongs in the brew sheet's printable view, not the planning sidebar.
  - **Sealed-fermenter / spunding-aware residual CO₂.** v1 uses peak fermentation temp (Noonan convention, matches industry calculators) which under-estimates residual for brewers running sealed/pressurised fermenters. An "advanced setting" toggle for "sealed fermenter — use packaging temp" is a future option. See the [residual CO₂ retrospective lesson](#residual-co-uses-the-peak-ferment-temp-not-the-last-step--match-industry-convention-rather-than-physically-optimistic-math).
  - **Conditioning temp input.** Bottle conditioning duration (`estimatedConditioningDays`) defaults to 20°C → 14 days. No UI to override yet. Add if brewers ask.
  - **Brew date as a server timestamp / multi-user sync.** `recipe.brewDate` is a plain ISO local-date string. No timezone metadata. Fine for single-user planning; revisit if collaborative brewing sessions become a thing.
- **Data dependencies:** All read-write via existing recipe store. No new server endpoints.
- **Acceptance:** ✅ open recipe → Fermentation tab → fermentation empty state with 3 generator cards + custom-step button AND conditioning empty state with 3 method pickers (Force carb / Bottle prime / Split it). Apply Hazy IPA → 3 ferm steps (Primary 20°C × 7d · Dry Hop 18°C × 4d · Cold Crash 2°C × 3d). Pick Split it → CO2TargetsCard full-width with `15A · 2.2–2.6` Suggested button on the right (when style is set); Keg PSI card with set-and-forget/burst toggle (set-and-forget default → 5d carb) + serving 4°C → 10.8 psi readout + tagline; Bottle Prime card with sugar chips + 123g corn readout. Sidebar At-a-glance card shows: header eyebrow + "keg ~19d · bottle ~28d" script · pills row "[🗓 Sep 1×] ... [🗓 Sep 29×]" · journey bar with PRIMARY (honey) / DRY HOP (yeast) / COLD CRASH (cool-blue) / KEG (honey, dashed boundary) / BOTTLE (malt) segments · "keg ready Sep 20" hand-drawn callout at the keg/bottle boundary · centered "package · 14d" axis · 6 stat tiles (Primary 20°C / Dry Hop 18°C / Cold Crash 2°C / CO₂ 2.4 / Keg PSI 10.8 / Bottle 123g). Switch Keg toggle to Burst → carb shortens 5d → 2d, axis updates "keg 16d · bottle 28d", callout updates. Set brew date Sep 1 → ready pill auto-derives Sep 29 (Sep 1 + 28); set ready Sep 29 → brew back-calcs Sep 1. Hover any segment → tooltip with date range "Sep 1 – Sep 8" (when brewDate set). Switch tabs to Mash and back → brewDate persists (`recipe.brewDate = "2026-09-01"`). Open Add step modal → 5 type chips, Primary preselected. ESC/backdrop close. tsc clean; lint baseline holds.
- **Effort:** M+ (one focused session of original + extensive iteration session for the timeline visualization + brewDate persistence). ~2,800 LOC across FermentationSection + FermentationStepModal (was ~1,300 pre-merge, ~1,800 post-merge, +1,000 for the journey visualization + calendar pickers + per-step tiles + carb method toggle).

## 2.4 — Equipment

**Status:** Done. ✅ See the [Phase 2.4 retrospective](#phase-24-retrospective--lessons-for-subsequent-slices) below.

**Decision change vs. original plan:** the pre-substrate plan called for "grouped HSCards (Mash tun / Kettle / Fermenter / Profile picker), each with eyebrow + grid of HS number fields." The substrate-faithful first pass shipped exactly that — outer frame + 4 cream2 sub-cards + per-field stepper tiles + sidebar (volumes readout + brewers notes). User feedback was immediate: **"visually crazy busy though. So much black and harsh colours. Look how scary this is to parse."** The substrate doesn't fit a settings page. Three iterations later the section landed at "one outer substrate frame + 2-col grid of plain rows + click-to-edit values, hover-revealed steppers" — visually quiet, set-and-forget. Equipment is the first Phase 2 slice where the substrate was actively *rejected* for the visual layer (the frame stayed; everything inside is non-substrate). The retrospective captures the lesson.

- **Classic sources (renamed + quarantined):**
  - [OLD_EquipmentSection.tsx](src/modules/beta-builder/presentation/components/OLD_EquipmentSection.tsx) — was `EquipmentSection.tsx`. Eslint-blocked outside `/betabuilder/`.
  - [OLD_EquipmentProfileModal.tsx](src/modules/beta-builder/presentation/components/OLD_EquipmentProfileModal.tsx) — was `EquipmentProfileModal.tsx`.
  - [OLD_CustomEquipmentModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomEquipmentModal.tsx) — was `CustomEquipmentModal.tsx`.
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles)):
  - [EquipmentSection.tsx](src/modules/hopskip/components/builder/EquipmentSection.tsx) — single substrate frame (paper bg + 2px ink + 14px corners + sh3 + 18-22px padding). Title row: Caveat kicker "your kit —" + display H2 "Equipment." + a single right-anchored consolidated profile pill ("Profile · {name} ▾") that opens the HSActionMenu; pill text shows current profile in ink (or muted "none selected"). Save-as-custom HSButton appears only when `hasUnsavedChanges`. Below the title: a plain-prose "Heads up — batch volume here is your final packaged beer …" callout. Then a 2-col grid (`grid-template-columns: repeat(2, 1fr)`, single col on ≤720px) of 4 groups: Batch & boil / Mash system / Kettle / Cooling & fermenter. Each group is just an eyebrow + hairline rule + a list of `FieldRow`s — no card chrome, no border, no shadow per group. Each row: `[label] [value unit]` with a dotted hairline bottom, click value to edit, `:hover` / `:focus-within` reveals tiny ghost − / + steppers on either side.
  - [EquipmentProfileModal.tsx](src/modules/hopskip/components/modals/EquipmentProfileModal.tsx) — HSModal (3xl, muted accent) + cream-2 pill search field + Source filter chips (All / Presets / Custom — Custom chip disables when none exist) + sticky group headers (Preset profiles / Custom profiles) + ProfileRow cards (each shows name + `Custom` chip + "in use ✦" script when current + optional description + 4-stat strip: Batch / Boil / Mash eff / BH eff).
  - [CustomEquipmentModal.tsx](src/modules/hopskip/components/modals/CustomEquipmentModal.tsx) — HSModal (md, honey accent) + FieldText (profile name) + FieldTextarea (description) + a `SnapshotPreview` showing what gets saved (8 of the 13 settings as a stat strip).
- **Quarantine pass:** ESLint `no-restricted-imports` rule extended with a new block for the 3 `OLD_` paths. Two external importers (BetaBuilderPage, BrewedVersionModal) had their `EquipmentSection` import + JSX symbol renamed to `OLD_EquipmentSection`. The renamed `OLD_EquipmentSection` had its internal modal imports + symbols renamed too. `OLD_` files are now only referenced by classic-aggregator code that itself is `OLD_` or already classic.
- **Wrapper changes in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx):** the Advanced expander band wrapper dropped `brew-theme hs-loose-section` className and the `ref` callback that auto-opened classic `<details>` (neither applies now). The wrapper bg `cream2` was dropped so the band inherits the page `cream` to match the Title band above. The Title band's `borderBottom: 2px ink` is conditionally dropped when `isEquipmentOpen`, so the Equipment section flows directly out of the title row when open. The Advanced toggle chevron switched from text `▲ / ▼` to an SVG `›` that rotates 90deg on open via `cubic-bezier(0.32, 0.72, 0, 1)`. The `.hs-collapse` opening easing was tuned to `cubic-bezier(0.785, 0.135, 0.15, 0.86)` (note this also affects the BJCP ranges expander which shares the class).
- **Reused unchanged:** `useRecipeStore.updateRecipe` (for both `batchVolumeL` and `equipment.*`); `useEquipmentStore.loadProfiles / saveCustomProfile / profiles`; `useHoldToRepeat` (lifted directly for the stepper hold). No new store actions, no new repos, no new services.
- **Batch-volume convention note (new HS-wide pattern worth reusing):** the section anchors a single plain-prose paragraph above the grid explaining that `batchVolumeL` represents the *final packaged* beer (what ends up in the keg), not into-the-fermenter as most calculators define it. The Recipe model docs the same — `"Target batch volume in liters (final packaged volume — fermenter loss is added on top)"`. This convention note pattern (1-line plain prose with bolded keywords, body-font, muted-color) is the right primitive for any HS surface where our calculation convention diverges from industry default; it doesn't need to be a fancy callout card.
- **What's NOT in v1 (deferred):**
  - **Per-field hint text / tooltips** — labels like "Tun deadspace" / "Grain absorption" assume the brewer knows what they mean. If brewers ask "what's deadspace?" add a small "(?)" tooltip pattern then.
  - **Profile diffing UI** — when `hasUnsavedChanges` is true, only the "Save as custom" button hints at it. We don't surface *what* changed vs. the selected profile. Could add a small "modified ✦" chip per changed field. Defer.
  - **Equipment-specific brewers notes / volume readout sidebar** — both shipped in v1, both dropped after user feedback ("just a settings page"). Brewers notes live with the recipe-shape sections (Fermentables, Mash, etc.); volume readout duplicates the brew sheet. If brewers ask, the right home is a small inline "you're using X% of your kettle" hint per row, not a sidebar.
  - **Custom-modal validation** — name field is required (toast warning if blank). No validation on profile-name uniqueness, no warning if the description is super long, no preview of what the calc-impact will be. Settings page; add later only if brewers report friction.
  - **Profile delete** — neither modal exposes delete for custom profiles. `useEquipmentStore.deleteCustomProfile` exists; add a 🗑 affordance per ProfileRow in EquipmentProfileModal when `profile.isCustom`. Defer.
  - **Animated number transitions on input** — same deferral as 2.1/2.2/2.3/2.6/2.7/2.8. Click-to-edit + scoped input is the commit feedback.
- **Data dependencies:** All read-write via existing recipe + equipment stores. No new server endpoints.
- **Acceptance:** ✅ open recipe → click Advanced (chevron rotates from right to down, section slides open with cubic-bezier easing, title band's bottom border disappears, Equipment band's cream bg matches the Title band above). Section renders with one substrate frame, kicker + "Equipment." + "Profile · {name} ▾" pill, batch-volume callout, 2-col grid of 4 groups. Hover any row → tiny − / + steppers fade in on either side of the value + dashed underline appears on the value. Click value → input swaps in, type, Enter/blur commits, Escape cancels. Hold − / + → accelerating repeat via `useHoldToRepeat`. Click the profile pill → HSActionMenu opens with all profiles + "Browse the full library" footer item. Pick "Browse" → EquipmentProfileModal opens with search + Source filter chips + grouped Preset/Custom lists; pick a profile → recipe + batch volume update + modal closes. Edit any field → "Save as custom" honey-accent HSButton appears in the title row; click → CustomEquipmentModal opens with name (required) + description fields + snapshot preview of the 8 main settings; save → toast confirms + profile becomes the active one. ESC / backdrop / × close modals. tsc + lint clean (no new findings vs. baseline).
- **Effort:** M (single focused session for v1 substrate-faithful pass + 4 user-led design iterations to land the quiet-settings shape + ~5 minutes quarantine + ESLint rule). ~1,000 LOC across EquipmentSection + the 2 modals (less than half of the data-richer Phase 2 sections like Yeast/Water; equipment has no per-row ledger and no chart so the LOC is concentrated in the FieldRow primitive + the profile modal).

## 2.5 — Brew sheet (split into 2.5a display + 2.5b Brew Mode)

**Decision change vs. original plan:** Original 2.5 was "each phase as an HSCard with checkboxes" — a small per-phase checklist. While planning the slice, the user reframed it as a **true comprehensive brew sheet**: every calculated target shown in its appropriate place, organized in brew-day chronology, optimized for reading on a tablet during brew day. This becomes the foundation for Brew Mode (the follow-up that wires `useBrewSessionStore` actuals into the same surface and replaces classic `BrewSessionPage`). The slice was split into two sub-slices because the display foundation was big enough on its own:

## 2.5a — Brew sheet (display only)

**Status:** Done. ✅ See the [Phase 2.5 retrospective](#phase-25-retrospective--lessons-for-subsequent-slices) below.

- **Classic sources (replaced):** [BrewDayChecklistSection.tsx](src/modules/beta-builder/presentation/components/BrewDayChecklistSection.tsx) — now `@deprecated` and only used by the quarantined classic builder at `/betabuilder/recipes/[id]` (BetaBuilderPage still imports it directly, exempted from the eslint rule via legacy presence rather than a new disable comment because BetaBuilderPage was already classic).
- **New HS component:** [src/modules/hopskip/components/builder/HSBrewSheetSection.tsx](src/modules/hopskip/components/builder/HSBrewSheetSection.tsx) — single client file, ~2500 LOC after many iterative reworks based on user visual feedback. The shipped layout is a **spreadsheet-style brew sheet** modeled after Brewers Friend's printable PDF and brewery production sheets. Final structure:
  - **TitleBlock** — display H1 "Brew sheet." + script-note kicker + tagline + **Print button** in the action row (the eventual "Brew" toggle will live next to it).
  - **Outer wrapper** — paper bg, 2px ink border, sh3 shadow, 20px padding, top corners squared (`borderRadius: "0 0 14px 14px"`) so the section seats flush against the tabs above.
  - **Top strip** — three side-by-side `MiniTable`s (Brew Data | Targets | Yeast), forced to 3 cols on print via `hs-print-cols-3`. Each MiniTable now supports three row shapes:
    - **single** (`MiniRow`) — `label | value(colspan=3)`
    - **paired** (`[MiniRow, MiniRow]`) — `label₁ | value₁ | label₂ | value₂` (used in Yeast: Strain+Lab, Attenuation+Pitch Temp, Pitch Date+Count, Pack(s)+Mfg Date)
    - **split-right** (`{ left, topRight, bottomRight }`) — `label(rowSpan=2) | value(rowSpan=2) | topLabel | topValue / bottomLabel | bottomValue` (used in Brew Data: Batch Volume left, Mash + Sparge stacked right, with `compact` padding on the right-side sub-rows)
    - Brew Data also includes `buildYeastRows` (helper that builds the paired Yeast rows including optional starter info)
  - **01 Ingredients** (no outer frame, just a `CategoryHeader` with accent rule bottom-border) — splits into **two sub-framed `ScheduleSection`s** in a 2-col grid (`hs-print-cols-2`):
    - **Grains** (malt accent) — `[Grain (SRM color chip + name) | kg | lb | %]` per fermentable + Total row
    - **Hops** (hops accent) — div-based grid (NOT `<table>`) with `HopHeaderRow`, `HopGroupRow` (Boil/Whirlpool/Dry hop), `HopDataRow` (4 cols: Stage/Time | Variety | Grams | AA%), `HopTotalRow`. Wrapped in `HopsList` which uses a 2-col grid (`hs-print-stack`) with the hops grid on the left and a floated **`HopFlavorMini`** SVG radar on the right (gram-weighted aggregate of `hop.flavor` data, 9 axes, ~190px). On print the radar stacks below the hops grid.
  - **02 Water** (water accent) — `WaterMatrix` — single transposed table where columns are stages (`Mash | Sparge`) each split into `Target | Actual` sub-cols (2-row thead). Rows: Volume, Strike/sparge temp, then per-salt rows (Gypsum, CaCl₂, Epsom, NaCl, Baking Soda — auto-split via `waterChemistryService.splitSaltsProportionally`), mash-only Lactic Acid / Baking Soda for pH / Estimated mash pH (sparge cells show em-dash). Bottom summary row: **Final profile (ppm)** on the left + **Total water** on the right, sharing one flex row (via `waterChemistryService.calculateFinalProfileFromTotalSalts`).
  - **03 Mash** (roast accent) — schedule table prominently styled with display-font 16-18pt step names (`hs-mash-schedule` class). Below it, optional Mash additions table (otherIngredients with `timing === "mash"`), then a subordinated **Mash checks** mini-table (smaller body font, muted borders): Iodine test (expected "negative"), First runnings SG (computed from `(preBoilSG - 1) × (preBoilVol / mashVol)`), Last runnings SG (`≥ 1.010` safety floor).
  - **04 Boil** (hops accent) — `BoilNumbersMatrix`: paired 6-col table with Pre-boil (Volume / Gravity / Boil time / Boil-off) on the left and Post-boil (Volume hot / OG target) on the right, each side with its own actual cell. Below the numbers, an **Additions** table that combines hops AND otherIngredients with `timing` boil/whirlpool, grouped by `During boil` → `Whirlpool` → `Other` with `BoilGroupHeader` band rows. Rightmost column is "Added" with `AddedCheckTd` (blank cell — custom click-check renders later in Brew Mode).
  - **05 Fermentation** (yeast accent) — small `PitchTempChip` inline-flex element at the top (just `PITCH @ 19.0 °C · 66 °F` in body+mono fonts, no outline, indented 64px). Below it, the prominent schedule table (`hs-ferment-schedule`) with display-font step rows. FG target row: empty colspan=2, "FG target" label in **Temp** column (with `72% apparent attenuation` hint stacked below), value in Duration column.
  - **06 Gravity Log** (malt accent) — 10 blank rows with columns `[Date | SG | pH | Temp °C | Notes]` — every cell is an empty actual cell, ready to write on paper or fill in when Brew Mode wires it.
  - **Print footer** (`hs-print-only` visibility) — small Caveat note at the bottom of the printed page.
- **Print/PDF:** The section header includes a Print button that calls `window.print()`. The print stylesheet went through two designs:
  - **v1:** `visibility: hidden` on `body *` + `visibility: visible` on the print path. Worked for "show only this content" but left **all hidden elements in layout**, so body retained its full pre-print height → blank pages before the brew sheet started.
  - **v2 (shipped):** narrower selector that hides only siblings of the print path: `body *:not(:has(.hs-print-area)):not(.hs-print-area):not(.hs-print-area *) { display: none !important }`. The `:has()` pseudo-class matches ancestors of the print area (which stay visible); only the off-path siblings get `display: none`. Crucially, this does **NOT** clobber the inline `display: grid` styles on the print path (which v1's `display: revert !important` did, collapsing all grid layouts).
- **Print layout rules:** A4 portrait, 10mm @page margins. Ancestor chrome stripped (`margin/padding/border/box-shadow/transform = 0` for `:has(.hs-print-area)` ancestors). The 720px printable width forces additional rules:
  - **Forced column counts** on the top strip (`hs-print-cols-3` → 3 cols) and Ingredients (`hs-print-cols-2` → 2 cols), since `auto-fit minmax(260px, 1fr)` collapses below ~780px.
  - **Stacked Hops radar** (`hs-print-stack` → 1 col) so the radar sits below the hops grid in the narrow half-page Ingredients column.
  - **MiniTable cells shrunk for print:** title 13pt → 10pt, value cells 12pt → 8pt with `white-space: normal`, label cells 10pt → 6pt with `width: 1%` trick (table-layout auto + nowrap = shrink to content) so STRAIN/ATTENUATION labels take minimum width and leave the rest for values like "Escarpment Labs".
  - **Schedule tables drop fixed pixel widths** on print (`width: auto !important` on `.hs-mash-schedule`/`.hs-ferment-schedule` cells) since their summed fixed widths (600-750px) exceed the printable 720px.
  - **Text wrap rules:** `overflow-wrap: break-word` everywhere as fallback for long unbreakable words (Saccharification); `white-space: normal` on value/hop cells; labels stay nowrap. NEVER use `word-break: break-word` — it breaks letter-by-letter (`STRAI N`, `Pri ma ry`).
- **Reused unchanged:** `RecipeCalculations` from `useRecipeCalculations`, `waterChemistryService.splitSaltsProportionally` + `calculateFinalProfileFromTotalSalts` from `WaterChemistryService`, `srmToRgb` from `srmColorUtils`, `HSScriptNote` + `hsTokens` from HS. Other HS primitives intentionally NOT used in this section: the design is tabular, not card-grid, so `HSCard` / `HSStatCard` / `HSEyebrow` were rejected after the first pass — they imposed too much padding + chrome for the brew-sheet aesthetic.
- **First runnings calculation:** Assuming uniform extract concentration in the mash, `firstRunningsSG = 1 + (preBoilSG - 1) × (preBoilVolumeL / mashWaterL)`. Pure derivation from existing `RecipeCalculations` — no new service.
- **Aggregate hop flavor:** Gram-weighted average across `recipe.hops[*].flavor` (skipping hops without inline flavor data). Renders as a 9-axis SVG radar in `HopFlavorMini`. If no hops have flavor data, the radar is hidden and the Hops sub-card uses a single-column layout.
- **Actuals visible as blank cells:** every `ActualTd` is a blank `<td>` with cream background + ink border — paper-ready for writing, non-interactive in v1. Boil additions use `AddedCheckTd` (cream cell, no visible checkbox — the visible check will be a custom on-click render in Brew Mode). Follow-up Brew Mode slice converts these to controlled inputs wired to `useBrewSessionStore.updateActuals()`. Layout doesn't change between v1 and Brew Mode — only the cell content does.
- **What's NOT in v1 (deferred):** editable actuals (Brew Mode follow-up); per-checkpoint checkboxes (dropped); phase staging accordion (dropped); starter calculator widget (Phase 2.6); proper hop preset DB lookup for flavors (currently uses only inline `hop.flavor` data).
- **Data dependencies:** All read-only from `RecipeCalculations` + `recipe.*` — no new store wiring, no new repositories, no new services.
- **Acceptance:** open recipe at `/recipes/<id>`, switch to **Brew sheet** tab, see the spreadsheet-style layout with bordered outer frame seated flush to the tabs, top strip + Ingredients + Water/Mash/Boil/Fermentation sections + gravity log; every classic number is present; blank actual cells visible. Click Print → browser print dialog opens with a paper-ready single-page-or-two layout (interactive UI hidden, A4 portrait, no blank leading pages, columns preserved). Side-by-side check vs. `/betabuilder/recipes/<id>` for data parity.
- **Effort:** L (single multi-day session across many iterative design passes with the user — see Phase 2.5 retrospective for the lesson on iterative design vs. up-front spec).

### What's done in 2.5a (concrete checklist)

- ✅ Read-only brew sheet renders at `/recipes/[id]?tab=brewsheet` (the HS builder's Brew Sheet tab)
- ✅ Classic `BrewDayChecklistSection` swapped out + `@deprecated` + eslint blocked
- ✅ All target numbers from classic preserved + many new ones surfaced
- ✅ Top strip (Brew Data / Targets / Yeast) with paired + split-right MiniTable rows
- ✅ Ingredients section (Grains + Hops 2-col sub-frames)
- ✅ Hop flavor radar (`HopFlavorMini`) with gram-weighted aggregate
- ✅ Water matrix (Mash | Sparge × Target | Actual) with auto salt-split + final mineral profile + total water
- ✅ Mash schedule + computed first runnings + mash additions
- ✅ Boil 2-col numbers (Pre-boil | Post-boil) + combined Additions table (hops + other ingredients) with `AddedCheckTd` blank cells
- ✅ Fermentation schedule + small `PitchTempChip` + FG target row
- ✅ 10-row blank Gravity Log
- ✅ Print button (`window.print()`) + print stylesheet (`:has()` selective hide, forced col counts, label `width: 1%` trick, etc.)
- ✅ Outer section frame matching sibling builder tabs (squared top corners to seat against tabs)

### What's NOT in 2.5a (deferred)

- ❌ `AddedCheckTd` click-to-check interactivity (currently a blank cream cell; the visible check is "custom on-click rendering" that hasn't been built)
- ❌ Long-recipe / large-hop-schedule / many-fermentation-steps print verification (only spot-tested with the Irish Red Ale seed recipe)
- ❌ Hop flavor radar falls back to "hide radar" if no hop has inline `flavor` data — older recipes without flavor data won't show a radar at all (no preset-DB lookup fallback)
- ❌ First-runnings calculation is a derivation, never verified against an actual brew. Could be off vs. what brewers measure in practice.
- ❌ Mash thickness / total grain / efficiency target stat strip was removed at user request as "not useful while brewing." If brewers come back asking for any of these, re-add as an Equipment tab annotation rather than on the brew sheet.

## 2.5b — Brew Mode (actuals + session wiring)

**Status:** Done. ✅ See the [Phase 2.5b retrospective](#phase-25b-retrospective--lessons-for-subsequent-slices) below.

**Resolution:** brewers now record a brew day natively in HS. Click the **Brew** toggle in the brew-sheet tab header → if prior sessions exist for this recipe, a picker dropdown opens (with a "+ Start new session" footer); otherwise a new session is created immediately. Blank actual cells become controlled inputs wired to `useBrewSessionStore.updateActuals` (400 ms debounce + flush on `beforeunload`). The legacy `/recipes/sessions/[sessionId]` URL redirects to `/recipes/[recipeId]?tab=brewsheet&session=[id]`.

**Goal:** A "Brew" toggle in the brew sheet section header (sitting next to the Print button) flips the section from display-only into a live brew session — every blank actual cell + every "Added" checkbox becomes a controlled input wired to `useBrewSessionStore`, with auto-save matching the classic's 400ms debounce + flush-on-unload.

**What needs to be built:**

- **`HSBrewSheetSection` prop additions** (additive, non-breaking):
  - `actuals?: SessionActuals` — current session's actual measurements
  - `onActualsChange?: (partial: Partial<SessionActuals>) => void` — write callback
  - `addedFlags?: Record<string, boolean>` — which Added checkboxes are checked (keyed by hop id or other-ingredient id)
  - `onAddedChange?: (id: string, checked: boolean) => void`
  - `isBrewMode?: boolean` — drives whether actual cells render as inputs or blanks
  - `sessionId?: string` — if set, the session being recorded
- **Brew Mode toggle** in `TitleBlock`'s action row, next to the Print button. Pill or toggle that flips local state and signals up.
- **Convert `ActualTd` / `MatrixActualCell` / `AddedCheckTd` etc. to controlled inputs** when `isBrewMode={true}`. Number inputs for SG/temp/volume cells; checkbox click handler for Added cells; small text input for notes/dates.
- **Session loader/creator hook** at the recipe page level: if `/recipes/[id]?tab=brewsheet&session=[id]` query param present, load that session via `useBrewSessionStore.loadSession`. Otherwise, when user clicks Brew, create a new session via `createSession(recipe)` and route to `?session=<new-id>`.
- **Auto-save** — debounced 400ms `updateActuals` + `saveCurrentSession`. Reuse classic's `useBrewSessionStore` actions exactly. Add a beforeunload flush.
- **`/recipes/sessions/[sessionId]` redirect** — new route at `app/recipes/sessions/[sessionId]/page.tsx` that server-redirects to `/recipes/[recipeId]?tab=brewsheet&session=[id]` (needs a `loadSessionRecipeId(sessionId)` admin-SDK lookup OR just client-side redirect after loading session).
- **Brewed-version modal trigger** — classic's "Edit Brewed Version" button forks the recipe into a brewed-version snapshot. Either bring that button into the HS brew sheet header (next to Brew toggle) and open the classic modal with eslint-disable, OR defer until Phase 2.1 lands HSModal and we rebuild it.
- **Quarantine `BrewSessionPage.tsx`** — once 2.5b ships and the `/recipes/sessions/[sessionId]` redirect is live, the classic standalone page becomes deletable from active code paths. Mark `@deprecated`, add to eslint rule.

**Data dependencies (all exist, reuse unchanged):**

- `useBrewSessionStore` — `loadSession`, `createSession`, `updateActuals`, `updateSession`, `updateStatus`, `saveCurrentSession`. Auto-save pattern: 400ms debounce on actuals change.
- `BrewSessionCalculationService` — computes `actualABV`, `mashEfficiency`, `brewhouseEfficiency`, `apparentAttenuation` from actuals. Could surface these as "live calculated" rows under FG target / OG target in brew mode.
- `FirestoreBrewSessionRepository` — already has doc-id-wins hardening from Phase 1.2. No new wiring needed.

**Acceptance:**

- Open `/recipes/[id]`, switch to Brew Sheet tab, click "Brew" → new session created, blank actual cells become editable inputs, Added cells become clickable checkboxes.
- Enter actuals → 400ms later they persist to Firestore. Refresh the page → values come back.
- Click "Brew" again to exit Brew Mode → returns to display-only view; session data preserved.
- Resume by URL: `/recipes/[id]?tab=brewsheet&session=[id]` loads that session into Brew Mode automatically.
- Deep link from old URL: `/recipes/sessions/[id]` redirects to the recipe-page Brew Mode for that session.
- Classic `/betabuilder/recipes/sessions/[id]` keeps working as the quarantined reference.

**Effort:** M+ (single focused session) — most of the structural work is reusing existing primitives + adding props; the main risk is the session-create-or-load flow and getting the URL routing right.

### Polish iteration shipped (post-initial-2.5b session)

A follow-up session reworked the Brew Mode UX based on user feedback. Captured here so the retrospective lessons below have context.

- **Inline click-to-edit cells.** `CellInput` / `CellTextInput` swapped from always-visible chrome to "invisible until clicked". Default state: nothing rendered (blank cream cell); click → input appears, type a value, blur/Enter commits → input disappears, value displays in HS script (Caveat handwriting) font. Esc cancels. Inputs use `position: absolute; inset: 0` to fill the full cell area, so clicking anywhere in the cell triggers edit mode (parent cells got `position: relative`).
- **`AddedCell` + `AddedActualPopover`.** Replaces the prior simple checkbox `AddedCheckTd` / `CellCheck` / `AddedCheckDivCell`. Click a grain / hop / water-salt / mash-addition "Added" cell → popover opens with two affordances: ① "Use planned amount" (sets added=true, no actual amount recorded — shows ✓ checkmark) ② "Different amount: ___ unit" + Save (sets added=true with the entered actual amount — shows the amount in script font). Popover position is `fixed` near the trigger's `getBoundingClientRect`, ESC / click-outside / Cancel closes, auto-focuses the number input on open. Actual amounts persist to `ingredientActualAmounts` and are surfaced to downstream calcs.
- **Recompute from ingredient actuals (`applyIngredientActualsToRecipe`).** Helper substitutes fermentable weights, hop grams, and salt amounts (summed from `salt:mash:<key>` + `salt:sparge:<key>` actuals) into a recipe clone, then `recipeCalculationService.calculate()` runs against the substituted recipe. Yields parallel `actualsCalculations` (OG/FG/ABV/IBU/SRM/preBoilVolumeL/preBoilGravity/estimatedMashPh/mashPhAdjustment). Salt actuals propagate into `estimatedMashPh` because `MashPhCalculationService` reads `recipe.waterChemistry.saltAdditions`.
- **Scratched-and-penned-in revisions (`RevisedValue`).** When `actualsCalculations` differs from `calculations`, the planned value renders with a roast-red strikethrough (`textDecorationColor: hsTokens.roast`, 2px solid, 0.7 opacity on the planned text) and the revised value drops below in water-blue HS script font. Two display modes: `compact` (asterisk marker only, parent renders a single corner note) and non-compact (inline `*due to X` annotation in roast-red script). Applied to: Targets table (OG/FG/ABV/IBU/SRM/Mash pH rows), Fermentation FG target row, Water Final Profile summary row, Boil Pre-boil/Post-boil volume + gravity cells.
- **Per-section revision annotation placement.** Each section places its `*due to X changes` note differently based on what fits the surface: **Targets** top-right in card header (auto-collected from any row with `revisionReason`); **Boil** top-right of the Pre-boil / Post-boil `<th>` cells in `BoilNumbersMatrix` (via new `preBoilFlag` / `postBoilFlag` slots); **Water** inline beside the Final Profile revised mineral string (stacked + non-compact mode); **Fermentation** inline beside the FG target revised value. Section decorative taglines ("rolling boil ✦", "patience pays ✦", etc.) all removed from ScheduleSection headers to give the revision annotation a clear top-right slot.
- **Mash pH target = post-adjustment value when adjustments planned.** Display logic: if `mashPhAdjustment.lacticAcid88Ml > 0 || mashPhAdjustment.bakingSodaG > 0` → show `targetPh` (post-adjustment) with "after adjustments" hint; else show raw `estimatedMashPh`. Salt actuals now flow through `applyIngredientActualsToRecipe` so `actualsCalculations.estimatedMashPh` reflects them and a strikethrough revision renders when the value moves.
- **OG predictor uses the revised target.** When grain actuals shift the realistic OG ceiling (e.g. 1.055 → 1.052), the predictor compares predicted post-boil OG against the revised value, not the original. The tooltip surfaces `(target 1.052 revised from 1.055 after grain changes)` so the brewer sees what changed. This was a real bug — a 1.047 pre-boil reading was incorrectly flagged as "4 points low" against the original 1.055 when it was actually on-target for the revised 1.052.
- **`PostBoilOgTip` — hop-aware boil-longer caveat.** Replaces the pre-boil predictor once `postBoilVolumeHotL` + `originalGravity` are entered. Detects "late additions" (any boil hop with `timeMinutes < 30` OR whirlpool hop) and varies the boil-longer option: **bittering-only recipes** → straight suggestion ("bittering hops already utilized, extra boil just concentrates"); **late additions present** → caveats with hop-filter escape hatch ("late hops will over-extract — use a hop filter / bag to remove them first, then boil"). Capped at 30 min extra (impractical beyond). Honey-accented script note distinguishes from the water-blue pre-boil predictor.
- **`BrewTipFlag` hover-flag pattern.** The verbose `predicted OG ✦` and `post-boil reading ✦` cards collapsed into small severity flags: hand-drawn warning triangle (`WarningTriangleGlyph` — ink-stroked triangle with `!`) for caution, `CheckGlyph` for success. Inline-flex, script-font label (15pt), in the severity color (roast / hops). No border, no fill, no pulse. Hover (or keyboard focus on the underlying `<button>`) reveals a cursor-following tooltip — `position: fixed; z-index: 100`, first-mouseEnter snaps to cursor with transition disabled (mirrors the compare-page `BarRow` pattern). Flags live in the `BoilNumbersMatrix` `<th>` cells, right-aligned via `flex; justifyContent: space-between` so "Pre-boil" sits left and the flag sits right of the same header.
- **Tooltip content rewritten conversationally.** Replaced dense mono-font lines like `Pre-boil 27.2 L @ 1.047 → post-boil 25.1 L @ 1.051 (target 1.052…)` with sentence prose: *"A 60-min boil will land at 25.1 L @ 1.051, ~4 points below target 1.052…"*. Fix options reworded as imperatives (*"Add ~257 g DME at flameout — cleanest fix"*).

## 2.6 — Yeast

**Status:** Done. ✅ See the [Phase 2.6 retrospective](#phase-26-retrospective--lessons-for-subsequent-slices) below.

**Decision change vs. original plan:** the pre-substrate plan called for a strain "list" with `HSCard` per strain and a separate `HSStarterCalculator` widget. Post-2.3 the locked substrate carried — **the yeast section is a yeast-peach-accented substrate variant** with a single-strain "ledger" (since the current data model is single-yeast UI even though `recipe.yeasts` is an array), and the starter steps as a second mini-ledger in the same main column. The sidebar visualizer slot is filled by a **Cells readout** — Available / Required / Surplus-or-Deficit. Three rounds of post-implementation iteration with the user reshaped the row layout, the source cluster, the starter prompt, and the per-row computed column treatment — those iterations are captured in the [Phase 2.6 retrospective](#phase-26-retrospective--lessons-for-subsequent-slices) below.

- **Classic sources (renamed + quarantined):**
  - [OLD_YeastSection.tsx](src/modules/beta-builder/presentation/components/OLD_YeastSection.tsx) — was `YeastSection.tsx`
  - [OLD_StarterCalculator.tsx](src/modules/beta-builder/presentation/components/OLD_StarterCalculator.tsx) — was `StarterCalculator.tsx`
  - [OLD_CustomYeastModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomYeastModal.tsx) — was `CustomYeastModal.tsx`
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles)):
  - [YeastSection.tsx](src/modules/hopskip/components/builder/YeastSection.tsx) — substrate clone matching MashSection's scale (~2,000 LOC). Outer `sectionFrameStyle` (paper bg + 2px ink L/R/B border + `0 0 14px 14px` radius + sh3 shadow + 24px padding), `SectionTitle` (script kicker "your fermenter friend —" + display H2 "Yeast." + 2px **yeast-peach** accent rule), Fermentation-style 3-row grid (`"lhead ." / "main aside"` desktop, mobile reflows to single column). The `main` column stacks two blocks — the same composition pattern as FermentationSection's fermentation + conditioning blocks:
    - **Strain block.** BlockEyebrow "The yeast strain" + meta count ("1 strain · 75% att") + "+ Pick strain" button. Empty state: dashed-border cream2 card with **3 real strain quick-picks** (SafAle US-05 / SafLager 34/70 / LalBrew Voss) + "Or browse the full library" HSButton — real strains that map to actual presets in the library rather than invented style labels. With data: `StrainLedger` bordered card (`overflow: visible` so the per-row Type ▾ dropdown extends below) with `STRAIN_LEDGER_COLS = "44px minmax(140px, auto) 72px minmax(330px, 1fr) 64px"` + `LedgerHead` + N×`LedgerRow` + `MobileAddRow`. **No Σ totals row** (removed — the row's source cluster already shows pack count + type inline). Strain row organizes into two visual groups separated by an obvious gap: **left identity group** [lab-favicon badge | strain name (bold, click → swap) + lab caption (muted script) | Attenuation EditableCell left-aligned in its 72px col so it sits flush against the strain identity], **right source group** [Type ▾ HSActionMenu chip + Packs/Slurry-Amount EditableCell + MfgDatePill, all packed into a `flex-end nowrap` cluster anchored to the right edge of col 4 so it butts up against the actions column]. The `auto`-width strain column + 1fr source column + right-anchored cluster opens a clear horizontal gap between atten (left) and source (right), so the eye reads "yeast identity, ··· source/pitch" rather than "evenly distributed cells".
    - **Starter block.** Three distinct presentation states based on pitch math:
      - **Steps exist** → full block: BlockEyebrow "The starter schedule" + meta "N steps · X L · Y g DME · method" + Method ▾ HSActionMenu (No agitation / Shaking / Stir plate) + "+ Add step" button capped at 3 → `StarterLedger` (6-col grid: `"44px minmax(0, 1.5fr) 110px 110px 90px 64px"`). Starter row: [# badge (yeast color) | "Starter step N" | Size L EditableCell | Gravity SG EditableCell | **DME computed read-only cell** with edge-to-edge `color-mix(in srgb, var(--hs-ink) 5%, var(--hs-paper))` tint that bleeds across the row's vertical padding via `margin: -14px 0` — mirrors the per-row IBU stripe pattern from HopSection | remove ×]. No `LedgerTotal` row (also removed — total DME folded into the BlockEyebrow meta string).
      - **No steps + underpitched** (cells available < required) → **`StarterPromptProminent`** — prominent honey-accented prompt: roast-less honey eyebrow "Let's grow your pitch" + script meta `"47 B cells shy"` + honey-bordered card with `color-mix(cream-2, honey 16%)` tinted bg, yeast script "build a starter —", friendly body copy quoting the concrete cell deficit, and a yeast-colored `+ Build a starter` HSButton. Palette is honey + yeast-peach (warm, helpful), NOT roast (alarm red) — the prompt reads as a friendly nudge, not a warning the recipe is broken.
      - **No steps + adequate pitch** → **`StarterPromptSubtle`** — single-line muted script "We have enough cells. Starter optional." + tiny dotted-underline "+ Add starter" button. No block header chrome, no card. Brewers who want a margin (older yeast, lager pitch rate) can click in; brewers who don't can ignore it.
  - [YeastPresetModal.tsx](src/modules/hopskip/components/modals/YeastPresetModal.tsx) — HSModal + cream-2 pill search field + filter toggle + Attenuation chips (Low <72% / Med 72–76% / High >76%) + Brand chips (scrollable) + sticky brand group headers + preset rows with lab-favicon badge + name + attenuation % caption. Mirrors `FermentablePresetModal` shape almost verbatim, swapping fermentable-specific filters (Type / Color / Origin) for yeast-specific ones (Attenuation / Brand). Same `editing` (swap mode) behaviour.
  - [CustomYeastModal.tsx](src/modules/hopskip/components/modals/CustomYeastModal.tsx) — HSModal + inline `FieldText` (name) + `FieldText` (lab/brand) + `FieldNumber` (attenuation %, clamped 50–95). Mirrors `CustomFermentableModal` shape. Saves to the user's yeast preset library via `usePresetStore.saveYeastPreset`.
- **Sidebar (right column):** `[PitchReadout (Cells card)]` on top + `[BrewersNotesCard]` below — same packing as fermentables' `[BillStack] + [BrewersNotesCard]` and hops' `[HopFlavorRadar] + [BrewersNotesCard]`. The Cells card has its own `Eyebrow` header "Cells" + hairline divider (replacing the deeper BillStack-style title-bar with right-side meta — a single eyebrow is enough since the rows below are self-explanatory once labeled). Three `ReadoutRow`s: Available (B) / Required (B) / Surplus-or-Deficit (B) — the third row's label, sub-script, and value-color flip based on `cellDiff` (Surplus + hops-green + "good to pitch ✦" when adequate; Deficit + roast + "add a starter step" when short; "—" + muted + "pick a strain" when no strain selected). Per the [2.8 visualizer-slot lesson](#the-substrate-held-on-a-data-richer-section-than-212223--visualizer-slot-earns-its-real-estate-when-theres-a-chart-worth-showing), the readout surfaces the *result* of combining strain (attenuation), source (pack count + mfg date + slurry density), and starter steps (size + gravity + model) into a cells-available-vs-required answer that's one glance instead of three lookups.
- **MfgDatePill.** Lifts the FermentationSection `DatePill` pattern verbatim: a styled pill (filled `paper` when set, dashed-border `cream` when empty) + a 1×1 invisible `<input type="date">` triggered via `el.showPicker()`. The OS calendar pops over the row instead of expanding inline as a second sub-row. When a date is set, the pill displays the computed age in script font ("30d old" / "2mo old") with a small × to clear. Calendar icon dropped to keep the pill narrow enough to fit alongside the Type chip and Packs cell on a single source-cluster line.
- **Reused unchanged:** `useRecipeStore.addYeast / updateYeast / removeYeast / updateRecipe`; `usePresetStore.yeastPresetsGrouped / loadYeastPresets / saveYeastPreset`; `starterCalculationService.calculateStarter` (returns `cellsAvailableB`, `requiredCellsB`, `stepResults[].dmeGrams`, `finalEndB`, `totalDmeG`, `totalStarterL`); `useRecipeCalculations` for the OG that feeds the required-cells math; `getYeastLabFavicon` for the lab badges; `toast` for the "preset saved" confirmation. No new store actions, no new repos, no new services.
- **What's NOT in v1 (deferred):**
  - **Multi-yeast UI.** The data model supports `recipe.yeasts: Yeast[]` but the current section is single-strain (matches classic). Adding multi-strain (blends, bottle yeast, secondary pitch) is a follow-up — would extend the ledger to N rows and add a "+ Add another strain" CTA (the `MobileAddRow` button is already in place but hidden on desktop).
  - **Per-step animated number transitions on input** — same deferral as 2.1/2.2/2.3/2.8.
  - **Drag reorder of starter steps** — steps are ordered 1→3 with no reorder controls. Add ▲/▼ buttons if brewers want to insert a smaller "boost" step before a larger one.
  - **Per-step end-cell counts (`stepResults[].endBillion`)** — computed but not surfaced in the row. Could add as a 4th column or as a hover tooltip on the DME cell. Defer until brewers ask.
  - **Pitch temp + ferm temp displays.** These belong to FermentationSection (already shipped in 2.3) — pitch temp is set there and read for the brew sheet. Don't duplicate.
- **Data dependencies:** All read-write via existing recipe + preset stores. No new server endpoints.
- **Acceptance:** ✅ open recipe → switch to Yeast tab → empty state with 3 strain quick-picks (US-05 / 34/70 / Voss) + "Or browse the full library". Click US-05 → strain row appears with Fermentis favicon, strain name top + lab caption below, 75% atten cell, source cluster on the right with `Liquid 100B ▾` chip + `1 pack` editable + `mfg date` dashed pill. Click Type ▾ → HSActionMenu opens DOWN over the source col (no clipping, `overflow: visible` on the ledger). Click mfg date pill → OS calendar pops up (no inline expansion). Set Aug 1 → pill text becomes "30d old" in script. Cells card on the right shows Available / Required / Surplus with `Cells` eyebrow header. If batch volume + OG demand more cells than 1 liquid pack provides → Cells card flips to Deficit (roast), AND a honey-bordered prominent starter prompt appears below the strain block ("Let's grow your pitch · 47 B cells shy"). Click "+ Build a starter" → starter block populates with a default 2 L · 1.036 step + 6-col ledger showing DME = 96 g in an ink-tinted stripe column. Add a 2nd step → meta script becomes "2 steps · 4.0 L · 162 g DME · shaking", Cells card's Available number jumps to post-starter `finalEndB`, prompt disappears. Hover the last data row → cream2 bg respects the ledger's rounded bottom corners (`:last-of-type` rule). ESC / backdrop close modals. tsc + lint clean (75 → 75).
- **Effort:** M+ (~2,000 LOC for YeastSection.tsx alone, matching MashSection's scale — the picker + custom modal are direct clones of FermentablePresetModal / CustomFermentableModal, and the starter-calculator math reuses `starterCalculationService` verbatim. Single focused session for v1 + 3 substantial rounds of user-led UX iteration (row restructure, source-cluster anchoring, starter-prompt softening, per-row DME stripe). See the [Phase 2.6 retrospective](#phase-26-retrospective--lessons-for-subsequent-slices) below.

## 2.7 — Water

**Status:** Done. ✅ See the [Phase 2.7 retrospective](#phase-27-retrospective--lessons-for-subsequent-slices) below.

**Decision change vs. original plan:** the pre-substrate plan was a fairly minimal "ion bars + salt cells" port. The actual slice grew significantly during the design pass to land on a target-anchored UX with a compound section-identity system that ended up being applied retroactively across all sibling sections (Hops/Mash/Fermentables/Yeast/Fermentation). The visualizer underwent ~6 redesigns: square-target → outline target → line target / capsule current → shared scale → gamma curve, etc. — driven by the user's request that "ratios displayed should match the visual" without losing readability for small-magnitude ions.

- **Classic sources (renamed + quarantined):**
  - [OLD_WaterSection.tsx](src/modules/beta-builder/presentation/components/OLD_WaterSection.tsx)
  - `water-section/OLD_*` — all 9 sub-files (WaterChemistrySection, PhAdjustmentsSection, SaltAdditionsPanel, SaltSummary, WaterProfileComparison, WaterIonRangeStrip, OtherIngredientsPanel, WaterIngredientPickerModal, CustomWaterIngredientModal, WaterVolumesDisplay)
  - [OLD_SourceWaterModal.tsx](src/modules/beta-builder/presentation/components/OLD_SourceWaterModal.tsx) + [OLD_CustomSourceWaterModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomSourceWaterModal.tsx)
  - [OLD_TargetStyleModal.tsx](src/modules/beta-builder/presentation/components/OLD_TargetStyleModal.tsx) + [OLD_CustomTargetStyleModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomTargetStyleModal.tsx)
- **New HS components:**
  - [WaterSection.tsx](src/modules/hopskip/components/builder/WaterSection.tsx) — outer `sectionFrameStyle` (paper bg + 2px ink L/R/B border + 14px bottom corners + sh3 + 22px padding + 10px gap). `SectionTitle` script kicker "your brewing water —" + display H2 "Water." + 2px **water-blue** accent rule. 2-row grid: row 1 = `"plan ."` (Water Plan header constrained to left col), row 2 = `"main aside"` (left flex-column of salts + pH + other ingredients; right aside = ion visualizer + brewers notes). Salt cells use the HSStatCard pattern (2px ink + sh1 + 12px radius + 4px water-blue accent strip + always-visible `[−] g [+]` horizontal flank).
  - [SourceWaterPresetModal.tsx](src/modules/hopskip/components/modals/SourceWaterPresetModal.tsx) + [CustomSourceWaterModal.tsx](src/modules/hopskip/components/modals/CustomSourceWaterModal.tsx) — HSModal-based picker over `COMMON_WATER_PROFILES`.
  - [TargetStylePresetModal.tsx](src/modules/hopskip/components/modals/TargetStylePresetModal.tsx) + [CustomTargetStyleModal.tsx](src/modules/hopskip/components/modals/CustomTargetStyleModal.tsx) — categorised BJCP style picker (Hoppy Ales / Lagers / Dark Ales / Belgian & Other) + live Cl:SO₄ ratio + flavor-label preview.
  - [WaterIngredientPickerModal.tsx](src/modules/hopskip/components/modals/WaterIngredientPickerModal.tsx) + [CustomWaterIngredientModal.tsx](src/modules/hopskip/components/modals/CustomWaterIngredientModal.tsx) — finings / spices / water-agents / herbs / flavors / other.
- **Ion visualizer (sidebar):** 6 horizontal bars (Ca/Mg/Na/Cl/SO₄/HCO₃) on a **shared, gamma-curved domain** so same-value targets sit at the same X position across ions. Each bar: cream paper track with 2px ink border, cross-hatch tinted with the row's proximity color from 0 → source, solid capsule fill from source → current (proximity-colored), source-ring marker, draggable 3px ink **target line**. Hard cap per ion enforces brewing-realistic ceilings (Ca 400 / Mg 100 / Na 300 / Cl 500 / SO₄ 600 / HCO₃ 500). Below: compact inline "Final" readout `Ca 96 · Mg 20 · Na 54 · Cl 103 · SO₄ 123 · HCO₃ 104 ppm` with proximity coloring. Cl:SO₄ ratio caption lives in the card header.
- **AutoCalcCompoundButton:** ink pill containing `[☑ NaHCO₃ | Auto-Calc]` — embedded NaHCO₃ toggle controls whether baking soda is included in the optimizer. Lives in the water-plan header next to source/target pills, separated by a thin vertical ink divider.
- **pH adjustments:** baking-soda CTA routes to `waterChemistry.saltAdditions.nahco3_g` directly (it IS NaHCO₃), incrementing the salt cell; lactic acid stays an "other ingredient" with `timing="mash"`.
- **Reused unchanged:** `WaterChemistryService.calculateFinalProfileFromTotalSalts` / `splitSaltsProportionally` / `chlorideToSulfateRatio`; `WaterSaltOptimizer.optimizeSaltAdditions`; `MashPhCalculationService` via `RecipeCalculations`; `useRecipeStore.updateRecipe / addOtherIngredient / updateOtherIngredient / removeOtherIngredient`; constants `COMMON_WATER_PROFILES`, `BEER_STYLE_TARGETS`, `getWaterTargetForBjcpStyle`, `CATEGORY_LABELS`, `UNITS`, `TIMINGS`, `getDefaultUnit`, `getDefaultTiming`. **Zero domain changes.**
- **Cross-cutting design pass (applied retroactively across all 2.x sections):** subtle ingredient-tinted visual identity layered across multiple touchpoints — see the [Phase 2.7 retrospective](#phase-27-retrospective--lessons-for-subsequent-slices).
- **Data dependencies:** All read-write via existing recipe + preset stores. No new server endpoints.
- **Effort:** L+ (single focused session — substrate locked but the visualizer and tinting iterations pushed actual time well beyond original L estimate; ~2,800 LOC across all new files + cross-section style updates).

## 2.8 — Hops

**Status:** Done. ✅ See the [Phase 2.8 retrospective](#phase-28-retrospective--lessons-for-subsequent-slices) below.

**Decision change vs. original plan:** the pre-substrate plan called for per-row HSCards with usage-type pill toggles + a chevron menu + a variety browser drawer. Post-2.3 the locked substrate was the right pattern here too — **the hops section ended up a fermentables clone in hops-green** with a hop flavor radar in the sidebar visualizer slot. The user picked 2.8 next specifically because it tests the substrate on a section with an established sidebar chart (the `HopFlavorMini` SVG radar that already ships inside [HSBrewSheetSection.tsx](src/modules/hopskip/components/builder/HSBrewSheetSection.tsx)) — the radar style ported as a slightly larger 9-axis SVG with cursor-following per-axis tooltips.

- **Classic sources (renamed + quarantined):**
  - [OLD_HopSection.tsx](src/modules/beta-builder/presentation/components/OLD_HopSection.tsx) — was `HopSection.tsx`
  - [OLD_HopAdditionRow.tsx](src/modules/beta-builder/presentation/components/OLD_HopAdditionRow.tsx) — was `HopAdditionRow.tsx`
  - [OLD_HopVarietyCard.tsx](src/modules/beta-builder/presentation/components/OLD_HopVarietyCard.tsx) — was `HopVarietyCard.tsx`
  - [OLD_HopFlavorRadar.tsx](src/modules/beta-builder/presentation/components/OLD_HopFlavorRadar.tsx) — was `HopFlavorRadar.tsx` (still imported by quarantined consumers: `HopRadarDemo`, `PublicRecipeView`, `compare/sections/HopComparison`)
  - [OLD_HopFlavorMini.tsx](src/modules/beta-builder/presentation/components/OLD_HopFlavorMini.tsx) — was `HopFlavorMini.tsx`
  - [OLD_CustomHopModal.tsx](src/modules/beta-builder/presentation/components/OLD_CustomHopModal.tsx) — was `CustomHopModal.tsx`
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles); design-system primitives like `HSModal` keep their prefix):
  - [HopSection.tsx](src/modules/hopskip/components/builder/HopSection.tsx) — clones the 2.1/2.2/2.3 substrate: outer `sectionFrameStyle` (paper bg + 2px ink L/R/B border + `0 0 14px 14px` radius + sh3 shadow + 24px padding), `SectionTitle` (script kicker "your hop bill —" + display H2 "Hops." + 2px **hops-green** accent rule), 2-col grid via `grid-template-areas` with `display: contents` mobile reflow ordering `"radar" / "lhead" / "ltable" / "notes"`. `LedgerHeaderRow` with `THE HOP BILL` eyebrow + hairline + script entries-count + `IBU pill` (current calc) + `+ Add hop` button (hops-green CTA). Ledger table per-row grid: `[usage-color badge | variety name + AA% caption + usage caption | grams editable | time editable | actions]`. Badge color via a `usageColor(use)` switch: boil=hops-green / first-wort=hops-green-deep / whirlpool=honey / dry-hop=yeast / mash=roast. Per-row click-to-swap on the variety name opens the preset picker in swap mode (mirrors fermentables' swap pattern); usage type changes via a tiny inline `HSActionMenu` (5 options) on the usage caption — not a per-row pill toggle (rejected as too much horizontal real estate). Time editable cell is context-aware: minutes for boil/whirlpool/first-wort/mash, days for dry-hop. Total row: `~Σg | "Total hops" | display-font Σg | (IBU sum) | (empty)`.
  - [HopPresetModal.tsx](src/modules/hopskip/components/modals/HopPresetModal.tsx) — HSModal + cream-2 pill search field + filter toggle + advanced filters (Country / Purpose chips — bittering / dual / aroma — and a flavor-cluster filter if `hopEnrichmentService` exposes one) + sticky country/purpose group headers + preset rows on hover-tinted bare buttons (variety dot + name + flag + AA range + 1-line flavor descriptor). Mirrors `FermentablePresetModal` shape almost verbatim, swapping fermentable-specific filters (Type / Color / Origin) for hop-specific ones (Country / Purpose / Flavor cluster). Same `swap` mode behaviour.
  - [CustomHopModal.tsx](src/modules/hopskip/components/modals/CustomHopModal.tsx) — HSModal + inline `FieldText` (name) + `FieldSelect` (country) + `FieldNumber` row (alpha acid % + beta acid %) + `FieldSelect` (default usage: boil / first-wort / whirlpool / dry-hop / mash) + optional flavor data fields (the 9 axes the radar uses, default 0). Saves to user's hop preset library. Mirrors `CustomFermentableModal` shape.
- **Sidebar (right column):** `[HopFlavorRadar card]` on top + `[BrewersNotesCard]` below — same packing as fermentables' `[BillStack] + [BrewersNotesCard]`. The hop flavor radar is a 9-axis SVG polygon (citrus, tropical, stone fruit, berry, pine, herbal, floral, spicy, earthy) showing the **gram-weighted aggregate** across all hops with inline `flavor` data. The card surface tone is the middle tier (`color-mix(in srgb, var(--hs-cream), var(--hs-cream-2))` per the [2.2 surface-tone hierarchy lesson](#surface-tone-hierarchy--three-discrete-levels)). Use the inline SVG radar from [HSBrewSheetSection.tsx](src/modules/hopskip/components/builder/HSBrewSheetSection.tsx)'s `HopFlavorMini` as the starting point — it already computes the weighted aggregate and renders the polygon; lift it into a `HopFlavorVisualizer.tsx` helper alongside the section, or inline it directly in `HopSection.tsx` (decide during implementation based on whether the radar's tooltip behavior diverges). Cursor-following hover tooltip on each axis (axis name + the dominant hop contributing to that axis) follows the [BillStack tooltip pattern](#hover-tooltip-on-chart-segments--the-barrow-pattern-ports-verbatim) — this is the third consumer of the cursor-follow pattern, so consider promoting to a small `useCursorFollowTooltip()` hook per the 2.1 retro flag.
- **Reused unchanged:** `useRecipeStore.addHop / updateHop / removeHop` (verify exact action names during 2.8 read-classic pass); `usePresetStore.hopPresetsGrouped / loadHopPresets / saveHopPreset` (verify); `hopEnrichmentService` for the variety database lookups; `useRecipeCalculations` for live IBU + per-hop IBU contribution; `getCountryFlag`, `BREWING_ORIGINS`. No new store actions, no new repos, no new services per the [2.2 scoping rule](#mashscheduleservice--userecipecalculations--recipestore-reused-exactly--zero-domain-changes).
- **What's NOT in v1 (deferred):**
  - **Hop addition timeline visualization.** A boil-time-axis stripe (60 → 0 min) with dots at each addition is an obvious visualization but the radar already earns the sidebar real estate. Add as a second sidebar card later if brewers ask for "when am I adding what" at a glance. The brew sheet already shows the full addition schedule for brew-day reference.
  - **Per-row IBU contribution chip.** Could surface "~18 IBU" in the row caption next to the grams. Defer until brewers ask — the total IBU is in the ledger header pill + the live numbers strip.
  - **Hop substitution suggestions.** Classic has a "similar hops" hint when picking a variety; defer to a follow-up unless it falls out cheaply from `hopEnrichmentService`.
  - **Animated number transitions on input** — same deferral as 2.1/2.2/2.3.
  - **Drag reorder** — same deferral as 2.2/2.3.
- **Data dependencies:** All read-write via existing recipe + preset stores. No new server endpoints.
- **Acceptance:** open recipe → switch to Hops tab → empty state with `+ Add your first hop` CTA + dashed-border invitation. Click → preset picker opens. Pick "Citra" → row appears with hops-green badge, AA% caption, default usage=boil, default time=60, grams stepper. Live IBU ticks. Click variety name → preset picker reopens in swap mode → pick "Mosaic" → swap preserves grams + time + usage. Click usage caption → 5-option action menu opens → pick "Dry hop" → row updates, time cell unit flips minute→days. Edit grams → IBU ticks. Add a second + third hop → radar updates (gram-weighted aggregate). Hover a radar axis → tooltip shows axis name + dominant contributor. Open custom modal → fill name + AA + flavor axes → save → toast confirms → custom hop appears in picker. ESC / backdrop / × close modals. No console errors. tsc + lint clean.
- **Effort:** M+ (single focused session of ~1,500 LOC — the substrate is locked in, but the radar wiring + variety swap interactions + custom modal with 9 flavor-axis fields push it past pure 2.2 / 2.3 effort). Slightly above 2.1/2.2/2.3's M because of the radar; well under the original "L (saved for last)" estimate because the substrate ate the row-card complexity.

---

**Migration choreography for each Phase 2 section (per slice):**

1. **Read the classic source** to understand props, store interactions, validation rules, and edge cases (empty states, modal triggers, tier gates).
2. **Write the HS-native components** (section + modals + sub-components) in the matching folder under `src/modules/hopskip/components/builder/` and `modals/`. **Name them with no `HS` prefix** (`FermentableSection`, `MashSection`, etc. — per the [naming convention](#architecture--principles)).
3. **Swap the import** in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) — one line change for the section, and update modal triggers accordingly.
4. **Run `npx tsc --noEmit`** to check the contract.
5. **Visual parity check:** open the HS recipe at `/recipes/[id]` AND the classic version at `/betabuilder/recipes/[id]` in two browser tabs. Edit a recipe in HS, then open in classic — confirm the data is the same. Edit in classic, then HS — confirm both see the change (they share the same store + repos).
6. **Delete the matching rules** from [overrides.css](src/modules/hopskip/styles/overrides.css) (the entries targeting the classic class names being replaced).
7. **Rename classic files to `OLD_` prefix** (file + function + any local interface types — e.g., `FermentableSection.tsx` → `OLD_FermentableSection.tsx`, `function FermentableSection()` → `function OLD_FermentableSection()`). Update internal imports + the few classic-aggregator importers (BetaBuilderPage, BrewedVersionModal, etc.) — the importer change is a global find-replace of `<ClassicName` → `<OLD_ClassicName` plus the import line. Drop any `@deprecated` JSDoc — the `OLD_` prefix is now the signal. Use `git mv` so history is preserved.
8. **Extend the ESLint `no-restricted-imports` rule** in [eslint.config.js](eslint.config.js) — append entries for the renamed classic paths (`**/modules/beta-builder/presentation/components/OLD_FermentableSection` etc.) with a clear `message:` pointing at the new HS path. Verify lint stays clean by confirming no surviving HS code still imports the OLD_ paths.
9. **Commit** that section's vertical slice.

The same choreography applies to Phase 1 sub-slices (replace HSBrowsePage / HSPublicRecipeView / HSCompareRecipesPage / HSUserProfile / HSBrewSessionPage / HSVersionHistoryPage, delete matching override rules, tag the replaced classic files, extend the lint rule). Phase 3 (calculators) and Phase 4 (learn articles) follow the same pattern — at smaller granularity.

---

## 2.9 — Builder shell polish (BJCP rail rebuild + responsive tab strip)

**Status: ✅ Shipped.** Not a section-by-section migration — this is iteration on the builder shell (the tablist + live-numbers band) on top of the existing HopSkipBuilder. No new modal, no new section, no new repo/service touched.

**What changed:**
- Replaced the wrapped legacy `StyleRangeComparison` with native `BJCPStyleRail` + `BJCPRangeRow` components. Single boxed card lives inside the live-numbers band (collapsible via the existing `STYLE RANGES` toggle). 5 mini-range rows (OG/FG/ABV/IBU/BU·GU) + SRM color footer with cross-hatched out-of-range zones, vertical ink edge ticks, and a recipe-color pin marker.
- Removed the standalone `ColorIndicatorBar` element — its content (SRM gradient + style-range markers + color adjective) is now the rail card's footer.
- Removed the per-StatCard BJCP target range text — fully consolidated into the rail.
- Tab strip became responsive across 5 stages (A → E): full chrome at ≥1000px container width down to a two-row layout at <560px. See HOPSKIP_PRD.md §8.E for the full table + stage E specifics (3+3 split, brick offset, tuck-under, cover strip, stable baseline filler, hover-rise + counter-translated inner line).
- Hover effect: inactive tabs rise 4px (3px in stage E) + accent strip fades in to 0.4 opacity. Inner bottom line counter-translates so the binder line stays anchored to the content frame top regardless of hover position.

**Files:**
- New: `src/modules/hopskip/components/BJCPStyleRail.tsx`, `BJCPRangeRow.tsx`
- Edits: `src/modules/hopskip/components/HopSkipBuilder.tsx` (live-numbers band restructure, responsive tab strip, hover styles)
- Cleanup: dropped dead `ColorIndicatorBar` + `srmAdjective` + `SRM_BAR_MAX` + `SRM_GRADIENT` from HopSkipBuilder; dropped unused `srmToRgb` import. `.hs-bjcp` / `.hs-bjcp-grid` CSS rules deleted from `overrides.css` (legacy `style-strip-*` rules in §9 of design PRD are now marked deprecated — kept only because the classic beta builder still uses them).

### Polish iteration retrospective — patterns for future builder work

**1. Callback ref > useEffect+useRef for any ref-dependent setup when the parent might early-return.** `HopSkipBuilder` returns a `Loading recipe…` placeholder while `currentRecipe === null`. A `useEffect(() => { ... }, [])` setup with a `useRef` would attach to a null ref on mount and never retry once the tablist actually mounted — the ResizeObserver never attached and the responsive tier system was stuck at stage A. Switching to a callback ref (function passed to `ref={}` that runs on mount/unmount) fixed it cleanly. **Apply this pattern any time a ref-dependent effect runs in a component that has conditional early returns.**

**2. Hover-rise needs container clipping + extension padding to avoid exposing the surface beneath.** The naive approach (just `transform: translateY(-4px)` on hover) exposes the section bg in the 4px gap that opens below the tab. The fix used in stage E AND single-row stages: (a) extend the tab's padding-bottom by N pixels so the tab box is taller than its visible area, (b) put the tabs inside a wrapper with `clip-path: polygon(0% -200%, 100% -200%, 100% 100%, 0% 100%)` — the polygon clips at the wrapper's bottom (extension hidden in normal state, fills the gap on hover) while extending 200% above (so the tab's risen top is still visible). Compensate for the bigger tab box via padding-bottom so the label stays at the same visual position.

**3. Counter-translate inner elements to anchor them in absolute space while the parent transforms.** The binder line at the bottom of inactive tabs would normally lift with the tab on hover. Adding a `.hs-bottom-line` span inside each tab with its OWN `transform: translateY(+N)` matching the parent's `-N` keeps the line glued to the content frame top — purely CSS, no JS measurement. Same pattern works for any "anchored child" effect.

**4. clip-path polygon math is more reliable than negative margin / negative top for "show above, clip below" layouts.** Tried both; `clip-path: polygon(0% -200%, 100% -200%, 100% 100%, 0% 100%)` is the cleanest expression and doesn't fight other margin collapsing.

**5. Stage-aware styling beats responsive CSS for layouts that need structural changes (not just sizing).** A `data-stage="A|B|C|D|E"` attribute on the tablist (set from JS via ResizeObserver measurement) makes both the JSX and CSS branches easy to author. CSS-only media queries would force everything through a single layout that has to handle both single-row and two-row geometry — much harder.

**6. Active tab's paper border merging with content frame is fragile under `position: relative` changes on ancestors.** When the tabs section was given `position: relative` (to anchor an absolute cover element), it created a new stacking context that put the tablist's positioned children ABOVE the content frame (which was non-positioned). The content frame's ink top border then leaked through above the active tab's paper border. Resolution: put cover elements INSIDE the tablist (which is already positioned with z-index:5) rather than as siblings of the tablist needing the section as their positioning ancestor. **Rule:** don't add `position: relative` to the tabs section. Anchor absolute children to the tablist instead.

**7. SRM gradient slicing trick** for the BJCP color row's bulge-out in-range bar: each segment of the SRM bar (out-of-range left, in-range bulge, out-of-range right) uses the same full-width `SRM_GRADIENT` image but with `background-size` + `background-position` scaled so the gradient color at each segment's edge matches what it would be on a single continuous bar. See `srmSliceBackground(a, b)` helper in `BJCPStyleRail.tsx`.

---

# Phase 3 — Calculator widgets

**Status:** Done. ✅ See the [Phase 3 retrospective](#phase-3-retrospective--lessons-for-phase-4) below.

**Scope correction vs. original plan:** the PRD asserted "app/calculators/page.tsx already implements all six calculators inline." In reality the page had only **four** (ABV, IBU, BoilOff, Dilution) inline — Carbonation, Hydrometer, and StrikeTemp existed only as classic Tailwind widgets in `src/components/`. The Phase 3 slice covered both the **extraction** of the four inline calcs and the **HS-native rewrite** of the three missing ones (drawing on the same pure calc functions used by classic).

- **Classic sources (renamed + quarantined):**
  - [OLD_AbvCalculator.tsx](src/components/OLD_AbvCalculator.tsx) — was `AbvCalculator.tsx`. Eslint-blocked outside `/betabuilder/`.
  - [OLD_BoilOffCalculator.tsx](src/components/OLD_BoilOffCalculator.tsx) — was `BoilOffCalculator.tsx`.
  - [OLD_CarbonationCalculator.tsx](src/components/OLD_CarbonationCalculator.tsx) — was `CarbonationCalculator.tsx`.
  - [OLD_DilutionCalculator.tsx](src/components/OLD_DilutionCalculator.tsx) — was `DilutionCalculator.tsx`.
  - [OLD_HydrometerCorrectionCalculator.tsx](src/components/OLD_HydrometerCorrectionCalculator.tsx) — was `HydrometerCorrectionCalculator.tsx`.
  - [OLD_StrikeTempCalculator.tsx](src/components/OLD_StrikeTempCalculator.tsx) — was `StrikeTempCalculator.tsx`.
- **New HS components** (no `HS` prefix per the [naming convention](#architecture--principles) — feature components drop the prefix; the classic widgets renamed with `OLD_` so the new files can take the canonical name):
  - [ResultGauge.tsx](src/modules/hopskip/components/calculators/ResultGauge.tsx) — shared cream-2 result tile (eyebrow + 48px display-font value + optional script note). Sized `md` / `lg` via prop. Extracted from the inline version on the calculators page.
  - [Segmented.tsx](src/modules/hopskip/components/calculators/Segmented.tsx) — generic 2-option pill toggle (ink border + paper bg + accent-filled active cell). Used for °C/°F unit toggles in Carbonation/Hydrometer/StrikeTemp and the 15/20°C calibration toggle in Hydrometer.
  - [CalculatorEmbed.tsx](src/modules/hopskip/components/calculators/CalculatorEmbed.tsx) — small HSCard wrapper with title row (Glyph badge + eyebrow + display title + "live ✦" script note). Wraps each calc in the 6 learn articles for consistent HS chrome.
  - [AbvCalculator.tsx](src/modules/hopskip/components/calculators/AbvCalculator.tsx), [BoilOffCalculator.tsx](src/modules/hopskip/components/calculators/BoilOffCalculator.tsx), [DilutionCalculator.tsx](src/modules/hopskip/components/calculators/DilutionCalculator.tsx), [IbuCalculator.tsx](src/modules/hopskip/components/calculators/IbuCalculator.tsx) — extracted from `app/calculators/page.tsx`. ABV grew validation (range checks + FG ≤ OG); BoilOff gained the boil-off rate input + boil-time output (matches the classic feature set the inline version was missing); Dilution grew a total-volume gauge + conservation-of-points hint.
  - [CarbonationCalculator.tsx](src/modules/hopskip/components/calculators/CarbonationCalculator.tsx), [HydrometerCorrectionCalculator.tsx](src/modules/hopskip/components/calculators/HydrometerCorrectionCalculator.tsx), [StrikeTempCalculator.tsx](src/modules/hopskip/components/calculators/StrikeTempCalculator.tsx) — net-new HS-native ports of the classic widgets. Reuse the existing pure calc functions (`correctHydrometer`, `calculateStrikeTemp`); Carbonation adds a new pure module at [src/calculators/carbonation.ts](src/calculators/carbonation.ts) (Tinseth/Carbonation polynomial + C↔F + psi→bar) that didn't exist before.
- **`/calculators` page** ([app/calculators/page.tsx](app/calculators/page.tsx)) — rewritten to import the components instead of inlining them. Catalog expanded from 4 → 7 calcs (added Hydrometer to Gravity & ABV, StrikeTemp to Mash & water, Carbonation to a new Packaging category). Active calc stays single-select.
- **6 learn articles wired:** each `/learn/<calc>-calculator/page.tsx` swapped from `@/components/<Calc>Calculator` to `@/modules/hopskip/components/calculators/<Calc>Calculator`, wrapped in `<CalculatorEmbed eyebrow=… title=… glyph=… accent=…>`. The standalone classic widget chrome (`brew-section` title bar + blurb) is gone; the embed card supplies the eyebrow + title + accent badge.
- **Quarantine pass:** `app/betabuilder/learn/*/page.tsx` (6 files) + `src/views/Calculators.tsx` (1 file, the classic `/betabuilder/calculators` page body) had their imports + JSX symbols renamed to `OLD_*Calculator` with inline `// eslint-disable-next-line no-restricted-imports` headers. ESLint `no-restricted-imports` rule extended with a new block for the 6 OLD_ paths pointing at the new HS folder.
- **Reused unchanged:** pure calc functions in [src/calculators/](src/calculators/) (`abv`, `boilOff`, `dilution`, `hydrometerCorrection`, `strikeTemp`); `HSNumberField`, `HSCard`, `HSEyebrow`, `HSScriptNote`, `Glyph`, `HSRangeBar`. The IBU calc continues to use `recipeCalculationService.calculateIBU` via a `Recipe` shim (same approach as the inline original).
- **What's NOT in v1 (deferred):**
  - **Yeast pitch rate + starter sizing calcs.** Out of scope for Phase 3 (the original PRD didn't list them). Could be a future addition — the math already exists in `starterCalculationService` (reused by `YeastSection`). The page footer card now teases "Mash pH, yeast pitch rate, and starter sizing — coming next."
  - **Mash pH calculator widget.** Same as above — math exists in `MashPhCalculationService`. Not in this slice's scope.
  - **`CalculatorCard.tsx` + `WaterSaltsCalc.tsx`.** Orphaned dead code in `src/components/` — no consumers, neither in HS-active nor classic-quarantine paths. Not renamed in this slice. Candidate for a separate cleanup PR (these aren't "classic widgets we're replacing" — they're never-shipped scaffolding).
  - **Animated number transitions on input** — same deferral as Phase 2 sections. `HSNumberField` uses a plain `<input type="number">`; the display-font value is the commit cue.
  - **Validation toast on out-of-range inputs.** v1 surfaces inline error strings instead (matches classic widget pattern). If brewers find them too quiet, switch to toasts.
- **Data dependencies:** Pure math from [src/calculators/](src/calculators/) — unchanged. Existing `abv.ts`, `boilOff.ts`, `dilution.ts`, `hydrometerCorrection.ts`, `strikeTemp.ts` reused as-is. New `carbonation.ts` adds the polynomial fit + temperature conversions (lifted verbatim from the classic Carbonation widget so the math agrees with what brewers were getting before).
- **Acceptance:** ✅ `/calculators` renders the 7-calc catalog with the active calc shown in the featured HSCard; click any catalog tile → swap the featured calc. ✅ Each of the 6 learn articles renders a `CalculatorEmbed` card with the new HS-native calc inside; the classic Tailwind chrome is gone. ✅ `/betabuilder/calculators` and `/betabuilder/learn/*-calculator` still serve 200 with the original classic widgets (now renamed `OLD_*Calculator`). ✅ tsc clean. ✅ ESLint clean for new code (the renamed `OLD_HydrometerCorrectionCalculator.tsx` carries a single pre-existing `label-has-associated-control` warning that the rename inherited verbatim).
- **Effort:** S — single focused session as estimated. ~1,500 LOC across the 10 new files (7 calc components + ResultGauge + Segmented + CalculatorEmbed) plus the rewrites to `app/calculators/page.tsx` and 7 learn-article touch-ups + 7 quarantine renames + ESLint rule extension.

### Phase 3 retrospective — lessons for Phase 4

**The PRD's "already implements all six" overcount was the same gotcha as Phase 0.** Phase 0 was sized assuming "75 Bitter / 8 Shadows / 7 coral-500 inline declarations" exist; actual counts were 65 / 0 / 0. Phase 3 was sized assuming six calculators were inline; actual count was four. **Always verify pattern existence via `grep -c` or by reading the source before sizing.** For Phase 4, this means: before committing to "14 articles, S each, 3–4 sessions" — actually grep each article for the patterns the cleanup targets (`text-base`/`text-sm` Tailwind size classes, inline-gradient styles, custom inline mockups). Skip articles that are already clean; size up articles with custom mockups (`HopAdditionPreview` in IBU, etc.) separately.

**Classic widget feature parity is a moving target — preserve features the user already has.** The inline BoilOff calc on `/calculators` had only 3 inputs (pre vol, pre SG, target OG); the classic BoilOff widget had 4 (+ boil-off rate, with a boil-time output). The HS-native rewrite restored the 4th input because the classic was the more useful product. Same for Dilution: classic added a `Total volume` gauge + conservation-of-points hint that the inline version dropped. For Phase 4 article body cleanup, the same rule applies — when rewriting prose / mockups, the article must read at least as well as the classic version. Drop nothing without a deliberate decision.

**Pure calc math should always live in `src/calculators/`, never in the component.** The classic `CarbonationCalculator.tsx` had the carbonation polynomial inline (with `calculatePsi` + `psiToBar` + `cToF` + `fToC` as private file-locals). Lifting it to [src/calculators/carbonation.ts](src/calculators/carbonation.ts) means: (a) Phase 2.3's Fermentation section can also use `carbonationPsi` if it ever needs to surface a "what PSI is my keg sitting at" annotation; (b) the new HS calc and the OLD_ classic calc both prove they agree on the math because they import the same function. **Rule for Phase 4:** if a learn article's mockup contains math (e.g. IBU's `HopAdditionPreview` likely does), lift the math into `src/calculators/` or `src/modules/beta-builder/domain/services/` rather than re-inlining it. Article body should read the math via a function, not embed numbers.

**`CalculatorEmbed` is a reusable Phase 4 primitive.** Any learn article that wants to show a "live HS-themed widget" can use it. The pattern is the same shape as the title bar on `/calculators` page but smaller — a 38px Glyph badge + eyebrow + 18pt display title + "live ✦" script note + 2px ink top border + cream-2 padding. For Phase 4, when porting article-specific mockups (e.g. the `HopAdditionPreview` mini-builder), wrap them in `CalculatorEmbed` (or a similar `MockupEmbed` that drops the "live ✦" and lets the article title the mockup more descriptively) for visual consistency.

**The substrate for non-builder surfaces is the embed card, not the full section frame.** Phase 2 builder sections use a heavy outer frame (paper bg + 2px ink + 14px-bottom-only corners + 24px padding + sh3 + section title block + sidebar grid). That works because the section seats flush against the tab strip and owns its full tab. For learn articles + standalone calc surfaces, the embed card is enough — no kicker / display H2 / accent rule per calc; the surrounding article supplies the heading hierarchy. **Rule:** if a Phase 4 mockup is decoration, embed it with `CalculatorEmbed`-style chrome (compact header, no sidebar). If it's load-bearing pedagogy (e.g. a step-through that progresses the article's argument), consider a full HSCard with its own header + footer. Don't over-frame decoration; don't under-frame pedagogy.

**Naming convention applied cleanly to calc widgets.** The OLD_-classic + no-prefix-new pattern from Phase 2 ports cleanly because (a) classic and new files want the same canonical name; (b) the new files live in a different folder, so there's no cross-folder collision; (c) the ESLint `no-restricted-imports` rule already had the right shape — just append a new `group` block. **Rule for Phase 4:** if any article body component (e.g. `HopAdditionPreview`, custom IBU mockup) gets ported, keep the same pattern. `OLD_HopAdditionPreview.tsx` in `src/modules/learn/` (or wherever it lives), new `HopAdditionPreview.tsx` in `src/modules/hopskip/components/learn-mockups/` or inline in the article.

**Carbonation polynomial verification.** The classic Carbonation widget used `-16.6999 - 0.0101059·T + 0.00116512·T² + 0.173354·T·V + 4.24267·V - 0.0684226·V²` (T in °F, V in volumes). This is the standard fit used by most homebrew calculators (BeerSmith, Brewfather agree to ~0.1 PSI). The new module exposes the formula in [src/calculators/carbonation.ts](src/calculators/carbonation.ts) with a comment block citing the polynomial — if a future PR wants to switch to a more accurate model (e.g. Henry's law-based), they're swapping the implementation behind the same function signature. **Rule for Phase 4:** any time you encounter math inline in an article body, that math should already live in `src/calculators/` or a service. If it doesn't, lift it. Don't have two sources of truth.

---

# Phase 4 — Learn article body cleanup

**Effort: 3–4 focused sessions.**

The 14 article pages at `app/learn/<topic>/page.tsx` have HS-native wrappers (`HSLearnArticle`, `HSFormulaCallout`) but the article BODY content is still hand-authored classic JSX:

- Inline `style={{ fontFamily: "'Bitter', serif" }}` on h2/h3 (mostly removed in Phase 0.2, but inline gradient styles remain)
- Tailwind size classes (`text-base`, `text-sm`, etc.)
- Inline-styled gradient callout divs with hue-based oklch (`<div className="grain rounded-xl p-5" style={{ background: linear-gradient(...) }}>`)
- Custom inline JSX mockups (e.g. `HopAdditionPreview` in IBU article — uses classic CSS variables and hue-based gradients inline)

**HS plan:**

- Build small helpers: `HSLink` (article body link), `HSArticleCallout` (replaces `<div className="grain rounded-xl">` pattern — uses HSCard with optional accent strip).
- For each of the 14 articles, rewrite the body to use:
  - Plain `<h2>` / `<h3>` (no inline fontFamily — `.learn-prose` styles them).
  - `<HSLink>` for in-article links.
  - `<HSArticleCallout>` for callout boxes.
  - HS-native mockups — port the article-specific inline mockups (e.g. `HopAdditionPreview`) to use HSCard + HSPill + HSIngredientDot.
- Article content (text, formulas, math expressions) is unchanged. Only the wrapping JSX changes.

**Acceptance:** each article reads as HS prose with no classic inline styles. Override CSS rules targeting article-internal classic patterns (`.grain.rounded-xl`, etc.) can be deleted as articles are rewritten.

**Order suggestion:** start with the 6 calculator articles (quick once Phase 3 widgets exist), then the 4 short articles (carbonation, hydrometer, dilution, strike-temp — already done as calc articles + boil-off, hop-flavor, yeast-starters, mash-ph), then the 4 long articles (IBU, water-chemistry, getting-started, mash-temperature) which have custom mockups inline.

**Effort:** S per article × 14 = ~3–4 focused sessions.

---

# Phase 5 — Optional deferred deletion

**Not scheduled. Not required.**

`/betabuilder/*` and the classic source under `src/modules/beta-builder/`, `src/modules/sharing/`, `src/modules/learn/{LearnArticle,FormulaCallout,BuilderMockups,HopRadarDemo,LearnNav,MathBlock}.tsx`, `src/views/`, and the 6 classic calculator widgets + classic chrome (`NavBar`, `Footer`, `Logo`, `GrainOverlay`, `GrainGradient`, `GrainTweaker`) in `src/components/` all stay alive indefinitely as quarantined reference material.

If at some point we decide to actually delete:

1. Verify no HS-active code imports from `src/modules/beta-builder/` or `src/modules/sharing/` (a single grep).
2. Confirm `docsConfig.ts` in `src/modules/learn/` is kept (HS consumes it).
3. Delete `app/betabuilder/`.
4. Delete the classic source folders.
5. Simplify [ClientShell.tsx](app/ClientShell.tsx) — remove the `isClassic` branch entirely. Just `<AuthProvider><HSThemeWrapper>{children}</HSThemeWrapper><Toaster /></AuthProvider>`.
6. Remove the "Classic ↻" link from [HSHeader.tsx](src/modules/hopskip/components/HSHeader.tsx).
7. Delete [src/modules/hopskip/styles/overrides.css](src/modules/hopskip/styles/overrides.css) (everything in it targets classic patterns that no longer exist).
8. Consider promoting `src/modules/hopskip/` → `src/modules/ui/` since HS is now the only UI.

Roughly one focused session whenever someone wants to do it.

---

## Verification

Throughout the migration:

- **Per-component:** `npx tsc --noEmit` clean, the matching HS and `/betabuilder/*` routes both render correctly, no console errors, no broken interactions.
- **Per-phase:** spot-test feature parity. For builder sections, edit each tab end-to-end. For modals, open every modal from its entry point. For calculators, run a known input and confirm the result matches the classic.
- **Server-page slices (Phase 1, future SSR routes):** `tsc + lint + build + curl-greps` for the route's SSR markup (status 200, expected HS markers, JSON-LD if applicable) + user-side visual check. The harness is enough to certify the SSR contract; interactive visual rests with the user.
- **Builder-tab slices (Phase 2):** lead with `preview_eval` DOM/data assertions over `preview_screenshot` — the bottom-docked nav competes for viewport space and screenshots get clipped; eval-based text + structure checks read faster and compare across runs.
- **End-of-Phase-2:** `npm run build` succeeds, all HS routes serve 200, all 8 builder tabs render their HS-native sections, every modal opens and closes correctly.
- **End-of-Phase-4:** all 14 learn articles render in HS prose. The override stylesheet at this point should be mostly inert — the only entries left would be ones we forgot to delete during section migrations.

---

## Critical files

- [src/modules/hopskip/components/HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) — the import-swap point for builder section components (Phase 2)
- [src/modules/hopskip/styles/overrides.css](src/modules/hopskip/styles/overrides.css) — shrinks across all phases; may eventually be deleted in Phase 5
- [src/modules/hopskip/styles/tokens.css](src/modules/hopskip/styles/tokens.css) — stays forever
- [src/modules/beta-builder/presentation/components/](src/modules/beta-builder/presentation/components/) — quarantined classic source, never deleted unless Phase 5 fires
- [src/modules/beta-builder/presentation/stores/recipeStore.ts](src/modules/beta-builder/presentation/stores/recipeStore.ts) — unchanged, reused by every HS component
- [src/modules/beta-builder/presentation/hooks/useRecipeCalculations.ts](src/modules/beta-builder/presentation/hooks/useRecipeCalculations.ts) — unchanged
- [src/modules/beta-builder/domain/services/RecipeCalculationService.ts](src/modules/beta-builder/domain/services/RecipeCalculationService.ts) — unchanged
- [src/modules/beta-builder/domain/repositories/FirestoreRecipeRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreRecipeRepository.ts) — Phase 1.2 hardening: doc-id-wins on read; rule applies to any future Firestore-backed model
- [src/modules/beta-builder/domain/repositories/FirestoreBrewSessionRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreBrewSessionRepository.ts) — same hardening, applied prophylactically
- [src/calculators/](src/calculators/) — pure calc functions, unchanged
- [src/utils/bjcpSpecs.ts](src/utils/bjcpSpecs.ts) — unchanged
- [app/ClientShell.tsx](app/ClientShell.tsx) — touched in Phase 0 (drop `/r/` `/browse` `/u/` from `isClassic`), possibly simplified in Phase 5
- [app/betabuilder/](app/betabuilder/) — quarantined, never deleted unless Phase 5
- [src/components/{AbvCalculator,BoilOffCalculator,DilutionCalculator,CarbonationCalculator,HydrometerCorrectionCalculator,StrikeTempCalculator}.tsx](src/components/) — quarantined; HS replacements ship in Phase 3
- [src/modules/sharing/](src/modules/sharing/) — quarantined; HS replacements ship in Phase 1
- [src/modules/learn/](src/modules/learn/) — `docsConfig.ts` stays (HS consumes it); the rest is quarantined and HS replacements ship in Phase 4

---

## Phase 0 retrospective — lessons for Phases 1–4

Real notes captured while executing Phase 0. Read before starting subsequent phases.

### Apply quarantine guards (`@deprecated` + ESLint `no-restricted-imports`) AT THE MOMENT each replacement ships, never as a pre-emptive sweep.

The original plan was to label everything classic up front. In practice this immediately marks legitimate working code as broken because HS itself currently imports classic components: the HS recipe builder ([HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx)) wraps the classic builder sections, the `/r/`/`/browse/`/`/u/` server pages import `src/modules/sharing/*`, and the calculator learn articles import the classic widgets. Each Phase 1/2/3/4 slice now closes its own deprecation loop — see the choreography in Phase 2 (steps 7 + 8) which Phase 1, 3, and 4 also adopt at smaller granularity.

### `overrides.css` shrinks per-replacement, not as a Phase 0 audit.

Phase 0.3 only removed 1 line. Most rules retarget classic structure that's still rendered by classic components inside HS chrome. They become dead exactly when each classic component is replaced — that's why "delete the matching override rules" is step 6 of Phase 2's choreography. Don't expect a satisfying Phase 0.3 shrink; expect chunky drops as each section migrates.

### HS chrome + classic content is genuinely jarring (and that's the deal we're accepting).

Phase 0.1 moves `/r/`, `/browse`, `/u/` from classic chrome to HS chrome. The inner content is still classic — wrapped in `.brew-theme`, which the `.hs-theme .brew-theme [...]` override rules retarget, but the result is hybrid. The user-visible effect on `/browse` is HS-styled header + classic-styled community cards + HS-styled footer. We accepted this as transitional rather than rolling back, because Phase 1.1 (HSBrowsePage) will replace the inner content natively and the chrome flip stays. If a future migration phase produces a similar mismatch that feels worse, revert that one specific route into `isClassic` for the duration of that phase — the routing is per-pathname, not all-or-nothing.

### Phase 1.1 (HSBrowsePage) is the most visually painful gap until it ships.

`/browse` shows HS chrome + classic cards on every page load. Prioritize Phase 1.1 over the other Phase 1 slices when sequencing the next focused session — it closes the most-trafficked aesthetic mismatch.

### Inline-style "selector hook" patterns are NOT dead.

Phase 0.2 had to scope down. We thought `style={{ fontFamily: "'Shadows Into Light', cursive" }}` was a dead inline declaration; it's actually a HOOK — the `.hs-theme [style*="Shadows Into Light"]` attribute selector in overrides.css uses the inline `style="…Shadows…"` substring to apply HS script font to callout captions. Removing the inline style removes the hook. The same gotcha applies to other `style*="…"` attribute selectors elsewhere in overrides.css — before deleting an inline style declaration that *looks* dead, grep for `[style*="<the value>"]` in overrides.css. If a rule depends on it, leave it alone (or rewrite the override to use a class instead).

### The Bitter inline declarations were actually dead, but only because `.learn-prose h2/h3 { … !important }` outranks the inline style.

`!important` in author CSS beats a plain inline `style="…"`. Verified empirically on the Bitter cleanup. Useful to remember when assessing whether other inline-style declarations are dead: if the override CSS uses `!important`, the inline is dead; if not, the inline still wins.

### The PRD's "explore agent counts" overcounted.

The pre-Phase-0 exploration reported "75 Bitter / 8 Shadows / 7 coral-500" inline-style declarations. Actual counts: 65 / 0 / 0 (the 7 coral-500s were all Tailwind `className` strings, not inline styles; the 8 Shadows were nested inside multi-property objects, not standalone declarations). Verify pattern existence with `grep -E` against the actual JSX before sizing the work.

### Privacy + Terms pages have dead inline styles too.

[app/privacy/page.tsx](app/privacy/page.tsx) and [app/terms/page.tsx](app/terms/page.tsx) carry 4 Bitter inline declarations identical to the article ones, dead for the same reason (`.learn-prose` or `.hs-theme [style*="Bitter"]` overrides them). Phase 0 scoped to `/learn/` only — these are a candidate for a 5-minute follow-up cleanup.

---

## Phase 1.1 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 1.1. Read before starting 1.2 and beyond.

### Three reusable primitives landed early — use them.

- **[HSCardLift](src/modules/hopskip/components/HSCardLift.tsx)** — drop-in wrapper for card-tile UIs. Renders a `<Link>` (or `<div>` if no `href`), applies `.hs-lift-card` to itself, auto-injects `.hs-lift-inner` into the child HSCard via `cloneElement`, and renders a cursor-following "open →" CTA with counter-rotation. Use it anywhere classic shipped a `<Link><HSCard>…</HSCard></Link>` pattern. Already powers the homepage community + library grids and `/recipes`. Future targets: 1.2 PublicRecipeView "fork of" / "more like this" surfaces, 1.4 HSUserProfile cards.
- **[useCursorFollowCard](src/modules/hopskip/components/useCursorFollowCard.ts)** — the underlying hook. Reach for it directly only when the card needs custom click handling that `HSCardLift` doesn't fit (HSBrowseCard uses it because its click target depends on `compareMode`). Returns `setWrapper` (callback ref so it works on `<div>` and `<Link>` alike), `ctaRef`, `onMouseMove`, `onMouseLeave`.
- **[HSActionMenu](src/modules/hopskip/components/HSActionMenu.tsx)** — small dropdown primitive (paper bg, ink border, click-outside, ESC, focus restore). Phase 1.1 used it for the per-card ⋯ menu (fork / share / export). Reuse in 1.2 PublicRecipeView header actions, 1.4 HSUserProfile recipe-card actions, and any 2.x section that needs an overflow menu before HSModal exists.

### Lift / scale / cursor CTA CSS lives globally in [tokens.css](src/modules/hopskip/styles/tokens.css), not in a per-page `<style>` block.

The rules — `.hs-lift-card { transition: transform … }`, `.hs-lift-card:hover { transform: translate + scale }`, `.hs-lift-card:hover .hs-lift-inner { transform: rotate(0deg) !important; box-shadow: 7px 7px 0 ink !important; }`, all wrapped in `@media (hover: hover)` — apply anywhere those classes appear. Either use HSCardLift (which adds them automatically) or opt-in manually. Touch devices skip the lift behaviour by design.

### Server-prefetch + `initialRecipes` prop beats the classic dual-fetch pattern.

`app/browse/page.tsx` is a server component that reads `publicRecipeIndex` via admin SDK and passes `initialRecipes: BrowseRecipe[]` to the client. Eliminates skeleton flash on first paint while keeping the IndexedDB-cache → Firestore refresh client-side. Preserve the hidden `<nav>` of `<Link>` for SEO crawlability when porting the other public routes (1.2 `/r/[slug]`, 1.4 `/u/[userId]`).

### `overrides.css` shrunk by 7 lines, exactly as Phase 0 predicted.

Only `.hs-theme .brew-recipe-card` was deletable in 1.1 — it lived inside `.hs-theme` and nothing else used it. The `.brew-section`/`.brew-input`/`.brew-tag`/`.brew-menu-item` rules still serve classic builder sections inside HS context; they'll fall in Phase 2 chunks. Don't expect satisfying CSS shrinks per phase; expect chunky drops when each section migrates.

### `UpgradeModal` (and any other classic-themed modal) stays classic-rendered inside HS until Phase 2.1 lands `HSModal`.

The export-gate flow in HSBrowseCard opens the classic UpgradeModal directly. Acceptable as a transitional state — the user sees a brief style mismatch only when free-tier exporting. Hold the line: don't half-rebuild HSModal in Phase 1; let it fall out of Phase 2.1's Fermentables vertical slice as originally planned.

### `useRef<HTMLDivElement>` does not satisfy a `<Link>`'s ref slot — use a callback ref.

`Ref<T>` is invariant in React, so a `HTMLDivElement` ref can't be passed to an anchor. `useCursorFollowCard` exposes `setWrapper: (el: HTMLElement | null) => void`, used as `ref={setWrapper}` on whichever element the wrapper renders. Repeat this pattern for any other dual-render (div-vs-Link) HS primitives.

### Hand-drawn ink-stroked glyphs are now an established pattern.

HSBrowseCard's 5-star rating: 22px polygons with three cycled point variants for asymmetry + `[-4°, 2°, -1°, 3°, -2°]` per-star rotation + thicker (1.7px) ink stroke with `linejoin/linecap: round` + honey fill. Pairs with a Caveat-font rating number (`hsTokens.script`). If future surfaces (1.4 HSUserProfile, 2.x BrewSession highlight numbers) want a similar hand-drawn feel, follow this pattern or promote it to a small `HSStarRating` primitive.

---

## Phase 1.2 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 1.2. Read before starting 1.3 and beyond.

### Pivot mid-plan: the public viewer IS the HS builder, frozen — not a dedicated read-only layout.

The original PRD called for "a dedicated read-only viewer (NOT the editing builder in disguise)" — a bespoke single-column layout with hero + ingredient HSCards + timelines. After writing that plan the user pushed back: visual continuity matters more than architectural separation. A brewer looking at someone else's recipe should see the same shapes they see when editing their own. We extended `HopSkipBuilder` with shared-recipe props (mirroring `BetaBuilderPage`'s `shared*` API) and applied a read-only wrapper to the section frame instead. **Apply to 1.5 (BrewSessionPage) and 1.6 (VersionHistoryPage):** if the natural read-only experience is "the builder, frozen", default to that pattern rather than building a separate viewer layout.

### `.brew-read-only` is mouse-only — it does NOT prevent keyboard editing of classic inputs.

The class hides action buttons + sets `pointer-events: none` on inputs/selects/textareas. That stops click-to-focus, but tab-focused inputs remain semantically writable and accept keystrokes. Mobile keyboards may still appear. **Implication:** Phase 1.2 ships HS chrome + shared-mode affordances around the recipe; the cells inside the tabs are still editable until each classic section is replaced by an HS-native display-only equivalent in Phase 2. Accepted as transitional. **Don't try to bandaid this** — strengthening `.brew-read-only` with `disabled` attributes via DOM mutation or per-section read-only props is wasted work; Phase 2's HS-native sections render display-only JSX (no inputs at all), which is the proper fix.

### Three new shared HS public primitives landed — reuse them.

- **[useForkRecipe](src/modules/hopskip/components/public/useForkRecipe.ts)** — fork transaction with tier-gate, atomic Firestore write + recipeCount increment, best-effort forkCount increment, toast + redirect. Returns `{ fork, isForking, isSignedIn, needsSignIn }`. **The classic `ForkButton` and `HSBrowseCard`'s inline `handleFork` both duplicate this logic.** HSBrowseCard's inline version is missing the tier-gate (real bug — free-tier users at the recipe limit can still trigger a fork attempt from the browse card). Consolidate as a small follow-up.
- **[HSForkButton](src/modules/hopskip/components/public/HSForkButton.tsx)** — drop-in CTA over `useForkRecipe`. `solid` hops accent when authed; `ghost` sign-in CTA otherwise. Use in 1.4 HSUserProfile recipe cards if a "fork" action is wanted there too.
- **[HSRatingStars](src/modules/hopskip/components/public/HSRatingStars.tsx)** — interactive 22px ink-stroked polygon star input. Reuses the polygon variants + rotations + gradient pattern from `HSBrowseCard` (display-only) + the state machine (userRating, hoveredStar, justRated, isSubmitting, optimistic aggregate update) from classic `RatingStars`. If a third surface needs stars (1.4 HSUserProfile, or anywhere else), promote the polygon glyph to a small shared `HSStarRow` primitive at that point. Two consumers is still inline-copy territory.

### Server fetch + client-component shell is the right split for `/r/`, `/u/`, `/recipes/[id]/versions/...`.

`app/r/[slug]/page.tsx` is a server component that calls `getPublicRecipe` (server-only, admin SDK) and renders both the `<script type="application/ld+json">` and the JSX-server-side <Metadata>. It passes the recipe data to a thin `"use client"` shell (`HSPublicRecipeShell`) which renders the HopSkipBuilder. Keeps SEO + JSON-LD + OG metadata in the server component (where they belong) and isolates client-state concerns in the shell. Repeat for 1.4 `/u/[userId]`, 1.5 `/recipes/sessions/[sessionId]`, 1.6 `/recipes/[id]/versions/[versionNumber]`.

### Server-rendered "Loading recipe…" flash is unavoidable with the Zustand-in-useEffect pattern.

`HopSkipBuilder` initializes the recipe in a `useEffect` (`setCurrentRecipe(sharedRecipe)`), so the SSR'd HTML always shows the "Loading recipe…" branch — the actual builder UI hydrates on the client. The classic `/betabuilder/r/[slug]` has the same SSR behavior, so it's not a regression, but it does mean: (a) SEO content from the recipe body isn't in SSR HTML (only JSON-LD/OG metadata is, which IS server-rendered), (b) `curl` checks for `brew-read-only` or section markup don't work — they live in the hydrated DOM. Mitigation if it ever matters: refactor to pass the recipe through props rather than the Zustand store, but that's a much bigger surgery touching `/recipes/[id]` too. Out of scope until Phase 5 deletion or a dedicated perf pass.

### Make new props on `HopSkipBuilder` strictly additive — non-breaking for `/recipes/[id]`.

Five new optional props (`sharedRecipe`, `sharedOwnerName`, `sharedOwnerId`, `sharedRatingAvg`, `sharedRatingCount`) plus an `isShared = Boolean(sharedRecipe)` derived flag. Every shared-mode branch in HopSkipBuilder is gated on `isShared`, so the live builder at `/recipes/[id]` behavior is unchanged. Same pattern for 1.5/1.6 if they reuse HopSkipBuilder (e.g. brew session might pass `sessionRecipeSnapshot` props alongside shared props).

### `ClickableMetaPill` / `NumericMetaPill` gained a `readOnly` prop in this slice.

They live inside HopSkipBuilder as inline primitives, not exported. Phase 2 might want to promote them — but only if a second consumer arises. For now they're hidden implementation details of the builder chrome.

### Latent fork-id bug surfaced during 1.2 testing — fixed with a doc-id-wins hardening across all Firestore reads.

User reported a React duplicate-key warning on `/recipes` after forking the same seed recipe twice; root cause was a bug shared between classic `ForkButton` (and the new `useForkRecipe` and the inline fork in `HSBrowseCard`) where the source recipe's `id` field wasn't stripped from the destructured payload. Every fork wrote a fresh-uid doc but the doc's data contained the seed's stored `id`. On read, `FirestoreRecipeRepository`'s mapper used `{ id: d.id, ...d.data() }` — spread-later-wins, so the stored `id` overrode the doc id. Result: multiple Firestore docs presented as a single in-memory recipe.

Two fixes landed together:

1. **Strip `id` in every fork destructure.** Applied to [useForkRecipe.ts](src/modules/hopskip/components/public/useForkRecipe.ts), [ForkButton.tsx](src/modules/sharing/ForkButton.tsx), [HSBrowseCard.tsx](src/modules/hopskip/components/public/HSBrowseCard.tsx).
2. **Flip the read-mapper precedence so `doc.id` wins over any stored `id` field** — applied to all 5 read sites in [FirestoreRecipeRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreRecipeRepository.ts) and all 3 in [FirestoreBrewSessionRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreBrewSessionRepository.ts). Pattern: `{ ...snap.data(), id: snap.id }` instead of `{ id: snap.id, ...snap.data() }`. Zero network/cache impact — pure JavaScript object-merge ordering.

**Rule for future phases (1.5/1.6 + Phase 2 writes):** when writing to Firestore via `setDoc(doc(ref, freshId), data)`, ensure `data` does NOT contain an `id` field (`saveAsync`/`saveNewAsync` already strip it via destructure; transactional writes need the same care). When reading via `{ ...snap.data(), id: snap.id }`, the doc id always wins, defending against latent legacy data. Repeat for any new Firestore-backed model (equipment profiles, ratings, public index, sessions, version snapshots).

Existing user-data side effect: any forks the user already had with mismatched stored `id`s now resolve to their correct doc ids in memory, so saves go to the right doc and duplicate-key warnings clear. The downside (any `parentRecipeId` reference captured under the old data-wins semantics points to a stale id) is real but small: the `parentRecipeShareSlug` field handles the user-facing "see the original" link, and stale `parentRecipeId` reverse-lookups silently fail with no UX impact.

---

## Phase 1.4 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 1.4. Read before starting 1.3, 1.5, and 1.6.

### Server-prefetch + thin client component is now the standard pattern for public read-only routes — copy it verbatim.

Phase 1.1's `app/browse/page.tsx` pattern ported to `/u/[userId]` cleanly: dynamic import of admin SDK, `BrowseRecipe` mapper copied as-is (just swap `orderBy('publishedAt', 'desc').get()` for the where-clause variant). The two-method pattern (server page does fetch + metadata + SEO hidden nav; client component owns interactivity) is now mechanical. Repeat for 1.5 `/recipes/sessions/[sessionId]` and 1.6 `/recipes/[id]/versions/[versionNumber]` — both are read-only public-ish views that benefit from the same shape.

### Compute derived values server-side to eliminate header fallback flash.

Classic `UserProfileClient` showed "Brewer" briefly before resolving to the real owner name (recipe data loaded after first paint). By computing `ownerName`, `recipeCount`, and `topStyles` in the server page and passing them as props, the SSR'd HTML already has the correct values; no hydration swap on the heading. Apply to 1.5 (brew-session header — recipe name + date should come from the server) and 1.6 (version-history header — version number + change note should come from the server).

### Metadata title gotcha: root layout already auto-appends "| Brewing.It" — set the bare phrase.

Initial attempt `title: \`${ownerName} on Brewing.It\`` rendered as `Lucas on Brewing.It | Brewing.It` because the root layout's `title.template` wraps every page title. Fixed to `title: ownerName` → `Lucas | Brewing.It`. **Rule:** in `generateMetadata` for any new page, the `title` field should be the bare unbranded phrase. The `openGraph.title` and `twitter.title` fields are NOT wrapped by the template, so those keep an explicit `| Brewing.It`. Repeat for 1.5/1.6 metadata.

### `HSBrowseCard` reused as-is — no profile-context-specific prop introduced.

The card's inline ownerName→`/u/{ownerId}` self-link is mildly redundant on the user's own profile page (links to the same page) but functions correctly and saves us a new prop. Promoting an `omitOwner` (or similar) prop is premature until a third consumer surfaces with the same need. Phase 1.5/1.6 are unlikely to use HSBrowseCard, so this is dormant.

### Admin-SDK fetch called twice per request (once in `generateMetadata`, once in the page) — consistent with `/r/[slug]` convention; don't optimize as a one-off.

`UserProfilePage` and `generateMetadata` each call `loadProfile(userId)` independently. Two Firestore queries per request, not deduped by React `cache()`. This matches `app/r/[slug]/page.tsx`'s `getPublicRecipe(slug)` pattern. If 1.5/1.6 want to eliminate the duplication, wrap the loader in `cache()` from `react` at the loader site — but do it as a separate project-wide refactor across all three (`/r/[slug]`, `/u/[userId]`, future routes), not as a one-off in any single slice.

### Plan-file naming irrelevance.

The plan file lived at `/Users/lucascg/.claude/plans/i-want-to-continue-proud-lollipop.md` — auto-generated slug bears no relation to "Phase 1.4". Worth knowing that plan-mode files are session-scoped, not slice-scoped: if a future slice needs to revisit prior plan decisions, the canonical reference is THIS PRD (now updated), not the plan file.

---

## Phase 1.3 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 1.3. Read before starting 1.5, 1.6, and any later compare follow-up.

### The classic compare module is ~1,400 LOC across 8 files — a 1:1 port is the wrong scope.

`CompareRecipesPage.tsx` is 144 LOC but it composes six section components (`VitalsComparison`, `GrainComparison`, `HopComparison`, `MashComparison`, `WaterComparison`, `MeanRecipeSummary`) and a 389-line `compareUtils.ts`. Total is ~1,400 LOC. Reproducing every nested table and per-category detail breakdown in one session would balloon scope past M effort. **What worked:** keep the v1 to the five core sections (Vitals + Grain bars + Hop table + Mash table + Water ions) and bracket-note the deferrals (detail tables, addition-types grid, flavor radar, mean recipe) as 1.3.x follow-ups. The user can decide whether any are worth a separate slice.

### Reuse the pure utility layer (`compareUtils.ts`) verbatim — it's already framework-agnostic.

`compareUtils.ts` declares "No React/browser dependencies — safe for both client and server" at the top, and lives up to it: `getGrainBreakdown`, `getHopSummary`, `getWeightedMashTemp`, `getEffectiveWaterProfile`, `averageWaterProfiles`, `avg`, `normalizeGrainName`, `GRAIN_CATEGORY_COLORS`, `GRAIN_CATEGORY_ORDER` all imported into the HS component with zero changes. Same rule applies to `RecipeCalculationService` (already used as a pure class) and `bjcpSpecs` / `srmToRgb`. **Repeat for 1.5 and 1.6**: only the JSX is new; any pure data-layer code in the classic module can be imported into the HS slice as-is. Don't waste cycles rewriting helpers that don't have React in them.

### Server-prefetch pattern continues to scale — even for query-param-driven routes.

Phase 1.1/1.4 used path-param routes (`/browse`, `/u/[userId]`). Phase 1.3 is the first query-param-driven server fetch (`?ids=…`). Works identically — `searchParams: Promise<{ ids?: string }>` resolved with `await`, parsed inline, fed to admin SDK. Inline fetch logic (~25 LOC mirrored from `/api/compare/route.ts`) is cleaner than calling the API route via internal `fetch()`. **Lesson:** for server components consuming admin-SDK data, always inline the fetch over calling your own `/api/*` routes — the route still serves external callers, and the server page skips the HTTP round-trip.

### When migrating a route that has a `/betabuilder/*` mirror, the mirror needs an `eslint-disable-next-line` for the classic import.

The first lint pass blocked `app/betabuilder/browse/compare/page.tsx` from importing `CompareRecipesPage`. Fixed by adding `// eslint-disable-next-line no-restricted-imports` with a comment explaining the quarantine. Phase 1.5 and 1.6 will hit this for `/betabuilder/recipes/sessions/[sessionId]` and `/betabuilder/recipes/[id]/versions/[versionNumber]` — pre-empt by adding the suppression in the same commit as the lint-rule extension.

### `RecipeCalculationService.calculate` is pure but expensive — wrap in `useMemo` keyed on `initialRecipes`.

Each `.calculate(recipe)` does the full grain/hop/water/IBU math. With up to 8 recipes in compare mode, that's 8 calc passes per render. `const items = useMemo(() => initialRecipes.map(r => ({recipe: r, calcs: calc.calculate(r)})), [initialRecipes])` keeps it to one pass per param change. Classic does the same; preserve the pattern. The calc service instance itself is module-scoped (`const calc = new RecipeCalculationService()`) so it's only constructed once.

### Inline sub-block functions in a single file beat a folder-of-sections for a slice of this size.

Classic compare splits sections into `sections/VitalsComparison.tsx`, `sections/GrainComparison.tsx`, etc. — six files. For HS v1, all five sub-blocks live as named functions in the same `HSCompareRecipesPage.tsx` file (~580 LOC). Trade-off: one big file vs. six small ones. **One big file wins here** because (a) the sub-blocks share styling tokens declared at the top (`cellHeadStyle`, `cellBodyStyle`, `cellAvgStyle`, `sectionEyebrowStyle`, `sectionTitleStyle`), (b) the v1 sub-blocks are 50–150 LOC each — small enough to read inline, (c) no other consumer needs them. If a sub-block grows past ~250 LOC or gets a second consumer, promote then. Don't over-decompose preemptively.

### The classic API route at `/api/compare` stays — don't delete it.

The HS server page inlines the fetch logic, but the `/api/compare/route.ts` endpoint is still reachable. Don't delete it: it's still used by the quarantined `/betabuilder/browse/compare` route (which renders the classic `CompareRecipesPage` that client-fetches it), and an external caller could conceivably hit it for raw JSON. **Rule:** when a slice replaces a client-fetch consumer of an internal API, leave the API route alive until Phase 5 deletion. Same will apply for any future client-fetch endpoints (`/api/fork`, `/api/publish`, etc.) — they're not coupled to the HS migration.

### Cursor-follow tooltips must use `position: fixed` (not `position: absolute`) when their host is inside an `overflow: hidden` ancestor.

The grain-bar hover tooltip initially used `position: absolute` relative to a `position: relative` row wrapper. Inside an `HSCard` (which has `overflow: hidden` to clip the accent strip's rounded corners), the tooltip clipped at the card boundary. Fix: switch the tooltip to `position: fixed` with `top: 0; left: 0` and feed `e.clientX` / `e.clientY` directly to the transform. Viewport-coord positioning escapes every ancestor's `overflow: hidden` (provided no ancestor has `transform`/`filter`/`will-change` that establishes a containing block for fixed descendants — `HSCard` only sets `transform` when `tilt` is non-zero, so it's safe by default). **Repeat for any future HS hover tooltip inside an `HSCard`:** default to `position: fixed`. Phase 2.x sections that need on-canvas tooltips (hop flavor radar callouts, water ion bars) will hit the same constraint.

### First-show flicker: snap to cursor with transition disabled, then re-enable.

A `position: fixed` tooltip parked at `top: 0; left: 0` will animate its transform FROM the viewport origin TO the cursor on the first mouseMove unless you suppress the transition for that one frame. Pattern:
```ts
if (isFirstMove) {
  t.style.transition = "none";
  applyTransform(e.clientX, e.clientY, 0);
  void t.offsetHeight; // force reflow so the no-transition snap commits
  t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
}
```
The `void t.offsetHeight` is the load-bearing line — it flushes the layout so the next style change uses the new (snapped) transform as the transition origin. Without it, the browser collapses both style changes into one transition starting from origin. `lastClientXRef.current === null` is the first-move sentinel; `onMouseLeave` resets it so re-entry also snaps cleanly. The classic `useCursorFollowCard` doesn't need this because its CTA is `position: absolute` inside the lift wrapper — the prior position is *near* the cursor by virtue of being inside the card.

---

## Phase 2.5 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.5 (and the 1.5 reframe). Read before starting Brew Mode (the follow-up) and Phase 2.1+.

### Phase 2 doesn't have to ship in PRD order — and the first slice can be picked for "this codebase's current state", not abstract simplicity.

PRD originally recommended 2.1 (Fermentables) as the first Phase 2 slice because it lands the HSModal primitive. We shipped 2.5 first instead because (a) the user's mental model put brew sheet ahead of brew session integration, (b) BrewDayChecklistSection was already mounted in HopSkipBuilder, making the swap a 2-line change, and (c) 2.5 has no modals, so HSModal lands whenever 2.1 finally ships — sequencing is uncoupled. **Rule for future picks:** the "simpler → harder" order in the PRD is a default, not a constraint. If the user has a domain-driven reason to reorder, follow it; the technical sequencing usually permits it.

### "Subsume a Phase 1 slice into a Phase 2 slice" is a legitimate move when the original Phase 1 surface duplicates state already living in the builder.

Phase 1.5 was originally a standalone HSBrewSessionPage at `/recipes/sessions/[sessionId]`. We replaced it with: "brew sheet section in the builder + a follow-up Brew Mode toggle that loads the session into that same surface." Net effect: one screen instead of two, no context switch for the brewer, and the brew session URL becomes a deep-link redirect rather than its own page. **Rule:** when planning a Phase 1 slice, check if the data could naturally live inside the builder via a mode toggle rather than its own page. If yes, consider moving it to a Phase 2 slice and replacing the Phase 1 URL with a redirect at follow-up time.

### Iterative design with screenshots beats up-front spec for visually dense, layout-sensitive surfaces.

The brew sheet went through **easily a dozen visual iterations** based on user screenshots: card-grid → tabular → reorganized sections (chemistry into Water, hops into Ingredients) → 2-col Boil numbers → split-right Batch Volume row → matrix-style Water → final profile row merged with Total water → pitch chip as a pill, then a small grid, then an outlined chip, then a plain "PITCH @ X" inline element → outline around the whole section but with the top two corners squared. Each pass changed structure in ways the original spec couldn't predict.

**Rule:** for visually dense surfaces (brew sheets, spreadsheets, dashboards), the only spec that holds is a screenshot. Don't try to enumerate every layout decision in the PRD up front. Ship a v1 that captures the data + rough structure, then iterate against the user's eye. Cap each iteration at a small structural change (one section, one row pattern, one font size) so feedback is targetable.

**Lessons captured for similar future surfaces:**

- **Hop "wrap-around" radar layout doesn't work with `<table>` content.** Block-level grids and tables don't shrink-fit around floats. Compromise: use a 2-col CSS grid (radar in a fixed-width right column, content in `1fr` left column) instead of true wrap-around. Stack vertically when the parent is narrow (print).
- **First runnings calculation:** Pure math from `RecipeCalculations` — `1 + (preBoilSG - 1) × (preBoilVol / mashVol)`. No new service needed.
- **Mash thickness / total grain / efficiency target stat strip:** user removed it. Stats that describe equipment ("mash thickness 3.0 L/kg") aren't useful while *brewing*. Display targets, schedules, additions, and measurements — leave equipment metadata in the Equipment tab.
- **Schedule typography vs. mash checks typography:** when one table is the primary content and a sibling is supporting, use display-font 16-18pt + 12px padding for primary, body-font 11pt + 5px padding + 92% opacity for supporting. The visual weight difference makes the "main vs. annotation" hierarchy obvious without explicit labels.
- **Hop variety + AA + grams in two places (Ingredients section AND Boil additions section):** intentional duplication. Ingredients is the pre-brew prep view ("gather these"). Boil additions is the during-brew schedule ("add these at these times"). The repeat is OK because the user reads them at different moments.
- **"Look like X" feedback means copy the visual treatment of X, not the structural shape.** When the user said "Pitch should look like Brew Data", they meant: cream-2 right-aligned uppercase label cell + body-font value cell. NOT: same outer card chrome. Inferring "the cells" not "the wrapper" requires looking at what they're actually pointing to.
- **"Actuals hidden in v1" answer was overruled by a reference image showing visible blank actual cells.** When a user gives a concrete visual reference that contradicts a prior answer, the reference wins.

### Print/PDF support went through two designs — the first one created blank leading pages.

**v1 (broken):** `body * { visibility: hidden }` + `.hs-print-area, .hs-print-area * { visibility: visible }`. Worked for "show only this content" but kept all hidden elements in the layout tree, so body retained its full pre-print height → 1-2 blank pages before any content rendered.

**v2 (shipped):** narrower selector targeting only off-path siblings:
```css
body *:not(:has(.hs-print-area)):not(.hs-print-area):not(.hs-print-area *) {
  display: none !important;
}
body *:has(.hs-print-area) { /* strip padding/margin/border/shadow/transform */ }
```

The `:has()` pseudo-class (Chrome 105+, Safari 15.4+, Firefox 121+) matches ancestors of the print area, so they stay visible (and get their chrome stripped). Only sibling subtrees off the path get `display: none`. Crucially this does NOT touch `display` on the print path — so inline `display: grid` / `display: flex` styles in the brew sheet are preserved.

**Print width is ~720 CSS pixels (A4 portrait at 10mm margins):**

- `auto-fit minmax(260px, 1fr)` collapses below ~780px → forced 3/2/1 column counts via `hs-print-cols-3` / `hs-print-cols-2` / `hs-print-stack` classes.
- Schedule tables with fixed pixel widths (180px + 120px + ...) summed past 720px and squeezed the Step column. Fix: drop fixed widths on print (`width: auto !important`) and let `table-layout: auto` distribute by content.
- MiniTable cells need aggressive shrinking on print: title 13→10pt, value 12→8pt, label 10→6pt with `width: 1%` (the table-layout-auto trick that shrinks a nowrap cell to its content width).
- Text wrap on print: `overflow-wrap: break-word` for unbreakable long words (Saccharification), `white-space: normal` on value/hop cells, labels stay nowrap. NEVER `word-break: break-word` — it breaks letter-by-letter (`STRAI N`, `Pri ma ry`).

**Rule for any HS surface that needs to print:**

1. Mark the print target with `.hs-print-area`.
2. Use the `:has()` selective-hide pattern (v2 above), not `visibility: hidden`.
3. Tag any `auto-fit` grids with `.hs-print-cols-N` (N = forced column count) so they don't collapse on narrow printable pages.
4. Tag nested 2-col grids that should stack vertically on print with `.hs-print-stack`.
5. For MiniTable-style cards: tag label cells with `.hs-mini-label-cell` and value cells with `.hs-mini-value-cell` so print can shrink labels and wrap values independently.
6. Use `display: none` on the actual `.hs-print-hide` and the `display: block` reveal for `.hs-print-only` (paper-only annotations like the generated-from footer).
7. Test with `window.print()` → "Save as PDF" before signing off. Visual differences from screen are common.

### BetaBuilderPage still imports the classic section directly — no `eslint-disable` needed *yet*, because the import lives in a file that's already entirely classic.

Phase 1.3 added per-mirror `// eslint-disable-next-line no-restricted-imports` comments to `app/betabuilder/browse/compare/page.tsx`. For 2.5, the equivalent is BetaBuilderPage's import of BrewDayChecklistSection. We chose NOT to add the disable comment because BetaBuilderPage is the *root* of the quarantined classic builder — every section it renders is currently classic, and adding 8+ disable comments per Phase 2 slice is noise. **Rule:** classic-aggregator files (BetaBuilderPage, classic AccordionSection wrappers, classic NavBar, etc.) can stay un-decorated until their last classic import is replaced; at that point, either the file disappears (Phase 5 deletion) or it gets a single file-level eslint disable rather than line-by-line. Track which classic aggregators still hold quarantined imports as Phase 2 progresses.

### One ~2500 LOC file with inline sub-blocks beats splitting — even at this size.

`HSBrewSheetSection.tsx` ended up at ~2500 LOC after all iterations. It defines: `TitleBlock`, `MiniTable` (with `MiniLabelCell`/`MiniValueCell` + paired/split-right row variants), `ScheduleSection`, `CategoryHeader`, `WaterMatrix` (+ `MatrixRow`/`MatrixValueCell`/`MatrixActualCell`/`MatrixDashCell`), `BoilNumbersMatrix` + `BoilPairRow`, `BoilAdditionsTable` + `BoilGroupHeader` + `AddedCheckTd`, `HopsList` + `HopHeaderRow`/`HopGroupRow`/`HopDataRow`/`HopDataCell`/`HopTotalRow`, `HopFlavorMini` (inline SVG radar), `Table`/`THead`/`Td`/`ActualTd` primitives, `FermentRow`, `PitchTempChip`, `MashChecks`, `EmptyRow`, `SubLabel`, `IconButton`, `PrinterIcon`, `PrintStyles`, plus helper functions (`buildYeastRows`, `computeAggregateHopFlavor`, `formatFermentationType`/`Color`, `formatYeastType`).

**One big file still wins because** (a) almost every primitive is deeply local to this surface (table column widths, actual-cell variants, ink-border patterns specific to the brew sheet), (b) each sub-block is 30–150 LOC — small enough to read inline, (c) splitting into 25+ files would create more friction than the file size causes. **Rule:** promote a sub-block to its own file only when it grows past ~300 LOC *or* gets a second consumer outside this file. Many of these primitives will eventually move to Brew Mode in the follow-up, and the `ActualTd`/`AddedCheckTd`/`HopDataCell` primitives are hook points for controlled inputs at that point.

### Recipe model gotchas: `recipe.mashSteps`, `recipe.fermentationSteps`, `recipe.yeasts` (plural array, not `yeast`), `recipe.hops[*]` uses `grams` + `alphaAcid` + `timeMinutes` (not `amountG` + `aaPct` + `timeMin`).

When porting classic components or writing fresh consumers of the Recipe type, the field names are not what the casual reader assumes — always grep the type definition before writing. Saved this discovery as a one-time check.

### Browser visual verification rests with the user (predicted — fifth slice in a row).

Pre-existing `next dev` typically holds `.next/dev/lock`, so `preview_start` may fail. The canonical Phase 1+2 verification harness remains `tsc + lint + build + (curl-greps for SSR routes)`. For builder-tab swaps (like this slice), there's no new SSR route — the swap is purely client-side inside the recipe builder, so `curl /recipes/<id>` only confirms the route compiles, not that the brewsheet tab renders the new component. User verifies in their existing dev server.

---

## Phase 2.5b retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.5b (Brew Mode wiring). Read before any Phase 2 slice that wires new editable surfaces.

### Brew Mode is "the same sheet, different verbs" — props bundle, not a separate render path.

Wiring `actuals` + `onActualsChange` + `addedFlags` + `onAddedChange` into HSBrewSheetSection as a `BrewMode | null` bundle let every blank cell stay in place; the only thing that changes is what each `<td>` *contains*. No separate "Brew Mode" component tree, no parallel JSX. The same matrix renders display-only or interactive based on whether the bundle is non-null. Apply to other read-then-write surfaces (the public viewer when each section ships an HS-native display-only version in Phase 2 — same idea: a section accepts an optional bundle and renders blank vs. wired cells).

### Data model expansion: keep the existing 15 fields, add structured maps for per-step / per-row scopes.

`SessionActuals` gained `mashStepActuals: Record<id, {…}>`, `fermentationStepActuals: Record<id, {…}>`, `mashAdditionActuals: Record<id, {…}>`, `gravityLog: Array<…>`, and (in the polish iteration) `ingredientActualAmounts: Record<string, number>` — a single flat map keyed by ingredient id (fermentable / hop / `salt:mash:<key>` / `salt:sparge:<key>` / mash-addition id). Keyed by step/ingredient id (stable across renames + reorders, unlike index). `addedFlags` lives one level up on `BrewSession` since it's a workflow flag rather than a measurement. Firestore handled the additive expansion transparently because the repository already strips `undefined` and applies doc-id-wins. **Rule for future model expansions:** keep new fields optional + use id-keyed maps (not arrays) when the underlying recipe steps have stable ids; prefer a single flat map with namespaced ids (e.g. `salt:mash:gypsum_g`) over nested structures when consumers fan in from many surfaces.

### Calculator inlining — boilOff + dilution + abv compose into "mid-brew tips" naturally.

Importing `postBoilVolume` (boilOff), `dilutionWater` (dilution), `abvFromOGFG` (abv) directly into the section gave two zero-cost integrations:
- **OG predictor** beneath the boil numbers matrix — when pre-boil grav + vol are entered, predicts post-boil OG; if off by ≥0.002, recommends extra boil minutes or flameout water. Wraps `postBoilVolume` + `dilutionWater`.
- **Inline actual ABV** at the FG target row + in the Targets MiniTable — auto-computes when both OG + FG actuals are present.

Both render as small `hs-print-hide` callouts in water-blue. Future Brew Mode follow-ups can layer more tips (hydrometer correction on the gravity log, mash-temp delta hint) using the same pattern: thread the actuals slice into the relevant section, run the pure calc, render a small inline note.

### Auto-save plumbing belongs at the controller (HopSkipBuilder), not the surface (HSBrewSheetSection).

The 400 ms debounce + `beforeunload` flush live in HopSkipBuilder. HSBrewSheetSection just calls `onActualsChange(partial)` and the controller debounces. This keeps the section pure — it doesn't know about Firestore, timers, or unload handlers. Same separation as the classic `BrewSessionPage` (timer in the page, callbacks into sub-components). **Rule for Phase 2 slices that gain auto-save:** put the timer/store wiring at HopSkipBuilder; the section accepts handlers and treats them as fire-and-forget.

### URL routing: redirect from legacy → primary; controller reads searchParams via lazy useState initializer.

The classic `/recipes/sessions/[sessionId]` route becomes a thin server+client wrapper (`SessionRedirectClient`) that loads the session and `router.replace`s to `/recipes/[recipeId]?tab=brewsheet&session=[id]`. This means RecipeListPage / RecipeSessionsBar / VersionHistoryModal don't need to change — they still push the legacy URL; the redirect carries them through. Costs one brief "Resuming brew session…" flash; gains zero edits to classic files.

For tab+session URL reading inside HopSkipBuilder: lazy `useState` initializer reads `searchParams.get("tab")` once on mount; subsequent tab changes are local state only. The session param drives `loadSession` + `setIsBrewMode` in an effect. **Rule for future query-param-driven UI:** URL is the source of truth on mount; state takes over after. Only write back to URL for state transitions that should be back-buttonable (Brew Mode enter/exit qualifies; tab clicks don't).

### Brew button picker — anchor inside the surface, not the controller.

The Brew toggle + session picker dropdown live inside `TitleBlock` (a sub-component of HSBrewSheetSection). HopSkipBuilder passes `priorSessions: BrewSession[]` + `onResumeSession(id)` + `onCreateNewSession()` callbacks; TitleBlock owns the picker open/close state. Clean ownership boundary: controller exposes data + handlers; surface owns the picker UI + click-outside / ESC behavior. The picker reuses the established HS dropdown aesthetic (paper bg, 2px ink border, sh3 shadow, honey-accent CTA at the bottom).

### Lint baseline holds (zero new warnings from this slice).

The slice added ~700 LOC across HSBrewSheetSection + 200 LOC in HopSkipBuilder + new model fields. Lint went from 71→73 problems prior to this slice (drift from earlier phases), and stayed at 73→73 after this slice. Confirmed by grep — none of my new files appear in the lint output. The Phase 1.3 retrospective rule held: keep accessibility + interactive-element guidance in mind during writing (role/aria-pressed/keyboard handlers on the AddedCheckTd; aria-expanded on the Brew button; role="dialog" + aria-label on the picker; aria-label on input fields).

### What's NOT in 2.5b (deferred):

- **BrewedVersionModal** (the "Edit Brewed Version" mid-brew recipe modification flow) — user chose to defer. Still accessible via the quarantined classic `/betabuilder/recipes/sessions/[id]` page. Rebuild as a follow-up after Phase 2.1 lands `HSModal`.
- **Hydrometer correction** on the gravity log SG cells — defers (would need a calibration-temp setting per user).
- **Mash temp delta hint** — defers (needs a clearer fix-derivation UX with grain/water inputs).
- **Strike-temp adjustment tip** — defers (same).
- **Quarantining the standalone classic page** — stays as the side-by-side reference per the quarantine-not-delete principle. `@deprecated`-tagged + eslint-blocked outside `/betabuilder/`, but `/betabuilder/recipes/sessions/[sessionId]` still mounts it with an inline `// eslint-disable-next-line no-restricted-imports`.

### Polish iteration retrospective — UX lessons from the follow-up session

Captured after the polish work (inline edit cells, AddedCell modal, RevisedValue, BrewTipFlag, hop-aware tips). Read before any Phase 2 slice that wires editable surfaces with revisions.

### Scratched-and-penned-in is the right metaphor for "this changed".

When ingredient actuals shift planned targets, the user's mental model is "I crossed it out and wrote in the new number". The `RevisedValue` component runs with this directly: roast-red strikethrough through the planned value (textDecorationColor matches the "pen ink"), water-blue HS script font for the revised value. The colors split deliberately: red marks the correction (struck-out + footnote asterisk + "*due to X" annotation all in roast), blue is the new content (the revised value). The pattern reads as **one pen-pass with red ink correcting the printed numbers and blue ink writing in the new ones**. Don't unify to a single color — the two-color split carries semantic load.

### Per-surface annotation placement: ship-by-feedback, not by spec.

The "*due to X changes" annotation went through four placements in iteration: bottom-of-card → top-right header → inline-beside-value → per-section variant (top-right for Targets/Boil, inline for Water/Fermentation). The final per-surface rule worked because each surface has different content density — a 5-row Targets table benefits from a corner footer (dedupes when multiple rows share a reason); a single-row Water profile reads better with an inline annotation right after the value. **Rule:** for revision/change-callout patterns, expect multiple iterations on placement; design the component so the annotation slot is decoupled from its position (props for both inline and corner-footer modes).

### Modal popover beats inline checkbox once "added" might come with a measured amount.

The original `AddedCheckTd` was a simple toggle. When the brewer wanted to record an actual amount that differed from plan, a click-to-toggle UI couldn't capture it. The new `AddedActualPopover` exposes two affordances side-by-side ("use planned" button + "different amount" input + Save) so the brewer can choose without leaving the cell. Auto-focusing the number input lets power users just-type-and-Enter; the "use planned" button is the fast path for matching-the-recipe brewers. **Rule:** any "did you do this?" cell that has an associated amount should default to the popover, not the toggle. The toggle only makes sense for binary did/didn't with no quantity.

### Cursor-following hover flags > inline tip cards for situational guidance.

The pre-boil / post-boil OG cards (200+px tall, full-width, sitting under the boil matrix) were verbose and didn't read like brewing advice — they read like compiler warnings. Collapsing into small severity flags (`BrewTipFlag` with hand-drawn warning triangle + script-font label, 15pt, no border, no fill) with the full content as a cursor-following tooltip cut visual weight by 90% while preserving the depth on demand. The cursor-follow pattern from the compare page's `BarRow` (position: fixed; z-index 100; first-move snap to cursor with transition disabled) ports verbatim — promote to a primitive when a third consumer arises. **Rule for future tips:** lead with the small indicator + hover reveal; reserve full-card real estate for content the brewer needs to read every time (not contextual warnings).

### Brewing reasoning beats generic warning text.

The first version of "boil longer" said *"hops are already added — extra boil changes hop character"* uniformly. Real brewing nuance: bittering hops at 60+ min are fully utilized (their alpha acids have plateaued) — extra boil doesn't change them. The risk is specifically with **late additions**: any boil hop at <30 min OR whirlpool hops sitting in hot wort. The polished `PostBoilOgTip` filters `recipe.hops` for these and varies the message — bittering-only recipes get straightforward "extra boil just concentrates"; recipes with late additions get the hop-filter escape hatch. **Rule for brewing advice tooltips:** read the recipe's actual additions before warning. Generic caveats erode trust; recipe-aware caveats earn it.

### Click-to-edit cells: position: absolute + parent position: relative is the cleanest fill pattern inside a `<td>`.

Trying to make the click target span an entire `<td>` from inside the cell content area led to a dead-zone problem (cell padding wasn't clickable). The solution: `position: absolute; inset: 0; width/height: 100%` on the button/input + `position: relative` on the cell. Click anywhere in the cell hits the button. Works inside `<table>` layouts in modern browsers (Chrome/Safari/Firefox tested). When in edit mode, the input replaces the button at the same fill — no layout shift. **Rule for fill-the-cell interactive children inside tables:** parent gets `position: relative`, child gets `position: absolute; inset: 0`.

### Unified `ingredientActualAmounts: Record<string, number>` simplified the salt + mash-addition wiring.

Originally I considered nested per-category maps (grainActuals, hopActuals, saltActuals.mash, saltActuals.sparge, etc.). The flat map with namespaced ids (`fermentable.id`, `hop.id`, `salt:mash:gypsum_g`, `salt:sparge:cacl2_g`, `salt:mash:lacticAcid`, mash-addition id) collapsed to one Record and one `onIngredientActualChange(id, amount)` callback. The AddedCell component takes a `plannedAmount` + `unit` + `id` and the unified storage doesn't care what category it is. **Rule for cross-cutting data captured from many surfaces:** prefer one flat keyed map with namespaced ids over nested category structures. Easier to thread, easier to read back, easier to extend.

### Section taglines ("rolling boil ✦", "patience pays ✦") add visual noise without informational value.

These scriptNotes lived in each ScheduleSection header from 2.5a as decorative flavor. When the polish iteration introduced revision annotations in the same header slot, the taglines competed for attention without earning their space. Removed from all sections. The `scriptNote` prop on ScheduleSection stays in the signature in case a section ever needs it back, but no current section passes it. **Rule:** before adding decorative text in a content slot, check whether functional content (annotations, statuses, action buttons) might want that slot. Functional content wins.

### Pre-boil predictor's target shifts with grain actuals — easy bug, real impact.

The OG predictor was comparing predicted post-boil OG against `calculations.og` (the original recipe target). When the brewer entered actual grain weights that lowered the recipe's realistic OG (e.g. used 4.8 kg base malt instead of 5.0 kg planned), the predictor still complained about being 4 points below the *original* target — even though the brewer was on-target for what they were actually brewing. Fixed: target is now `actualsCalculations?.og ?? calculations.og`. The tooltip surfaces `(target 1.052 revised from 1.055 after grain changes)` so the brewer sees the shift. **Rule:** any "compare actual to target" surface in Brew Mode must use the actuals-revised target when ingredient actuals are present. The original is for reference only.

---

## Phase 2.1 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.1 (Fermentables + HSModal). Read before any Phase 2 slice that needs a modal or a section with editable rows.

### HSModal landed exactly as spec'd — `border-top: 7px solid <accent>` on the dialog itself, not `::before`.

The stacking-context gotcha called out in HOPSKIP_PRD §10 is real: a `::before` accent stripe inside an element that establishes a stacking context (transform, filter, will-change) sits BEHIND descendant text in some browsers. Putting the accent on `border-top` of the dialog wrapper avoids the gotcha entirely — no pseudo-element, no z-index dance, no stacking-context surprise. The two-line CSS reads as "a thicker top border" and renders correctly everywhere. **Rule for any future HS modal/card variant that wants an accent stripe at the top:** use a colored top border, not a pseudo-element.

### `HSModal` exposes `HSModalHeader` / `HSModalBody` / `HSModalFooter` as sub-components.

The header has its own padding + cream background + ink bottom border; the body has flex-grow + scroll + paper bg; the footer has cream-2 + ink top border. Each modal that uses HSModal composes these three (or skips any of them). The header takes `title`, `kicker`, `onClose`, `titleId`, `rightSlot`; the footer has `align="between" | "end" | "start"`. The split makes the per-modal authoring extremely terse — both `HSFermentablePresetModal` and `HSCustomFermentableModal` end up at ~250-400 LOC instead of duplicating chrome boilerplate. **Rule:** when a primitive has multiple sub-regions with distinct styling (header/body/footer), export the sub-pieces as named exports alongside the default. Consumers wire what they need.

### `data-autofocus` attribute + `requestAnimationFrame` is the right autofocus pattern — `autoFocus` prop is a lint warning trap.

`jsx-a11y/no-autofocus` warns on every `<input autoFocus>`. HSModal already runs an effect on open that finds `[data-autofocus]` and focuses it via `requestAnimationFrame` — so the `autoFocus` prop is redundant when the input is inside a modal. **Rule for any modal-internal input that should focus on open:** add `data-autofocus="" ` (or any string) as a marker, drop the `autoFocus` prop. Lint stays clean and the focus still lands correctly. The pattern is documented inline in HSModal's focus-management effect.

### Hover-tracking outer wrappers around interactive children need `eslint-disable-next-line jsx-a11y/no-static-element-interactions`.

When you wrap a `<button>` (or other interactive element) in an outer `<div onMouseEnter/onMouseLeave>` purely to track hover state for presentational reasons (revealing steppers, toggling row tints, anchoring a cursor-following tooltip), `jsx-a11y/no-static-element-interactions` fires on the outer div. The inner interactive child owns the keyboard contract; the outer div is presentational. **Rule:** suppress with `// eslint-disable-next-line jsx-a11y/no-static-element-interactions` directly above the wrapper, with a brief comment explaining the interactive child owns the contract. Used in EditableCell wrappers (Fermentables + Mash), MashProfile tooltip parent (deleted), Compare BarRow tooltip, BillStack tooltip.

### Click-origin scale-in animation reuses the classic `ModalOverlay` pattern (CSS vars + transform).

HSModal captures the last `pointerdown` coordinates globally, computes `dx/dy` from viewport center on open, and feeds them into `--hs-modal-dx` / `--hs-modal-dy` CSS variables. The keyframe `from` uses `translate(var(--hs-modal-dx), var(--hs-modal-dy)) scale(0.85)` so the modal appears to grow from the click point. The classic `ModalOverlay` does the same with `--modal-dx/dy`; HSModal uses its own variable names to avoid collision but the technique is identical. **Rule for cross-cutting animations** (modal opens, drawer slides, toast appearances): the global `pointerdown` listener is set up once on mount; multiple consumers can read the same coords without contention. If a future HS popover needs the same growth-from-click effect, lift the listener + variable scheme into a tiny `useClickOrigin()` hook rather than re-implementing it.

### Don't replace `PresetPickerModal<T>` with `HSPresetPickerModal<T>` — write per-section modals instead.

The classic `PresetPickerModal` is a generic component parameterized by `T` with `renderItem` / `renderFilters` / `groups` props. It looks tempting to port to HS as a generic, but: (a) the search + filter + group display has tight per-section variations (hops want flavor radars in the filter row, water wants ion sliders, yeast wants viability hints) that bloat the generic surface, (b) `T` parameterization in shared React primitives is a pain point for prop inference at consumer sites, (c) HSModal + HSModalHeader/Body/Footer give you the chrome for free, so the per-section modal is mostly "search box + filter chips + list rendering" — which is exactly the part that varies. **Rule:** for Phase 2.2+ (Hops/Yeast/Water preset pickers), write a bespoke `HSHopPresetModal` / `HSYeastPresetModal` / etc. that uses HSModal directly. Don't port the generic.

### Caveat script font on input values is the right "handwritten brew sheet" feel — but only on display, not while editing.

The fermentable row's weight/% input uses `fontFamily: hsTokens.script` (Caveat). The classic uses a generic input font. The script font reads as "you scribbled this in" and matches the rest of HS's handwritten-feel notes. It DOES make double-digit precision values (2.50, 12.5) slightly less precise to read mid-edit — but the trade-off works because the input is small (64px) and the user knows what they typed. **Rule:** Caveat is appropriate for editable values that read as personal annotations (your grain weight, your hop grams). Stick with display/body fonts for system-computed numbers (totals, calculated percentages, OG/FG/ABV in the live numbers strip).

### `position: relative` parent + filling input pattern was overkill for non-cell inputs — keep the simpler 2-line label here.

The brewsheet's click-to-edit cells use `position: absolute; inset: 0` on the input + `position: relative` on the parent `<td>` to make the entire cell clickable. For section-level inputs that live inside a row card (not a `<td>`), the simpler pattern is just `<label>` wrapping `<span eyebrow>` + `<input>` with normal flow layout. Lower complexity, no positioning, label clicks still focus the input via standard `htmlFor`. **Rule:** keep the `position: absolute` fill pattern reserved for table cells where the cell needs to be the click target. For card rows, normal `<label htmlFor>` is enough.

### Empty state: dashed border + script kicker + body line + primary CTA reads as "design intent", not "loading".

The first cut had a plain HSCard for the empty state; it looked too much like a "no data yet" placeholder. Switched to dashed ink border + cream-2 bg + "empty bill —" script kicker + a one-sentence brewing-context line + the primary "Add your first fermentable" button. Reads as a friendly intro, not a system message. **Rule for HS empty states:** dashed border distinguishes intentional empty from "this should be filled" required-state styling; a script kicker grounds it in the HS visual language; one explanatory sentence + one CTA is the minimum.

### Quarantine took 3 minutes — the eslint pattern + `@deprecated` tags pattern is mechanical now.

The Phase 2.5 + 1.x retrospectives established a clear choreography: `@deprecated` JSDoc on the default export of each replaced classic file + a new entry in the `no-restricted-imports` group with a `**/modules/.../ClassicName` pattern + a clear migration message. For 2.1 this took 3 file edits + 1 eslint config edit. The relative-path imports inside `beta-builder/` (`./FermentableSection`) don't match the glob — which is correct: classic-aggregator files (BetaBuilderPage, BrewedVersionModal) are part of the quarantined ecosystem and shouldn't be forced to add eslint-disable per slice. The rule guards against NEW non-classic code re-importing the deprecated paths. **Rule:** keep using the `**/modules/<area>/<File>` glob, not absolute paths; it threads the needle of "stop new use" without "spam disables in old quarantined files".

### Lint went DOWN by 3, not up — fixing autoFocus on the way in is essentially free.

Pre-slice baseline: 78 problems. Post-slice: 75 problems (4 errors, 71 warnings). The 3-problem drop came from removing autoFocus in favor of `data-autofocus`. Net effect: the slice added ~1,250 LOC of HS-native code, 0 new lint issues, AND incidentally cleared 3 prior warnings. The exact same pattern applies to every future Phase 2 modal slice. **Rule:** when porting a classic modal that uses `autoFocus`, swap to `data-autofocus` during the port — saves a follow-up lint pass.

### Visual verification worked this time (preview server started cleanly).

Phase 1.1/1.2/1.3/1.4 retrospectives all reported `preview_start` failing on the dev-lock. This slice ran `preview_start` against the harness-managed launch config and it worked: opened `/recipes/new`, switched to Fermentables tab, opened the picker, selected "1886 Malt House - NY Pale Malt", saw the row + chips + live-number tick (OG 1.011, SRM 2.1, CAL 35) in a single screenshot. **Update to the verification harness rule:** the canonical Phase 1+2 verification is now `tsc + lint + build + preview_screenshot of the key surface`. The "dev-server-lock makes preview unavailable" claim from earlier phases was tied to a user-pre-started server; with launch.json managing the lifecycle, preview is reliable.

### Design-iteration retrospective — lessons from the post-2.1 polish sessions

Captured after iterating on the initial 2.1 against (a) screenshot feedback and (b) a Claude Design handoff bundle the user attached partway through. Read before any Phase 2 slice that has a sidebar, an editable cell, or a chart-style visualization.

### Claude Design handoff bundles are gzipped tarballs — fetch, unpack, then READ THE CHATS.

The `https://api.anthropic.com/v1/design/h/...` URL returns a `application/gzip` archive (`brewing-it/README.md` + `chats/chat[12].md` + `project/...jsx`). The README's first instruction is "Read the chat transcripts first" — and that's exactly right. The chat captures what the user kept/dropped during iteration, which is the actual spec. The JSX files are the output; the chats are the intent. **Rule for any future Claude Design handoff:** fetch via `WebFetch`, extract via `gunzip + tar -xf`, read README → chats → variations folder in that order. Delegating to an agent for a focused summary (with explicit "tell me what the user wants for the FERMENTABLES section, not the whole bundle") cuts the read down to ~600 words of actual signal.

### Brewsheet-pattern outer frame is the right anchor for any section, not just brew sheet.

The initial 2.1 used the inherited `.hs-section-frame` override CSS to get the squared-top-corners + ink border + sh3 shadow. The redesign owns the frame inline (paper bg, 2px ink L/R/B border, `0 0 14px 14px` radius, sh3 shadow, 24px padding). This is the same pattern HSBrewSheetSection's `pageStyle` uses — and it works for any section that lives inside the tab-content slot. Self-contained framing means the section can move (or be quarantined) without depending on a wrapper class. **Rule for Phase 2.2+ sections:** own the section frame inline, copy the brewsheet's `pageStyle` shape verbatim. Stop relying on the `.hs-section-frame` cascade.

### A separate "bill stack" visualization above the editor is the right pattern for visual-leading sections.

Fermentables → Bill Stack (colored % bar with SRM-derived segments). Hops will want a similar "addition timeline" (additions across the boil timeline, colored by hop type or alpha %). Mash will want a temperature/time chart. Water will want an ion-comparison bar. Each section's "what does my recipe LOOK like at a glance" deserves a dedicated chart card in the sidebar, separate from the editable list below. **Rule:** when a section has data that's hard to read row-by-row but tells a story as a chart, give it its own chart card above (mobile) or beside (desktop) the editor. Reuse the cursor-following tooltip pattern (`position: fixed; z-index: 100`; first-move snap with `void offsetHeight` reflow trick) for any chart hover details.

### Programmatic gradient from `srmToRgb()` beats a hardcoded gradient — and the marker should USE the same color function.

The first cut of the SRM color bar used a hardcoded `linear-gradient(to right, #f8e8a8 0%, ...)` with hand-picked stops. That's two sources of truth (gradient stops + position math) that have to agree. The fix: sample `srmToRgb(s)` at every integer SRM 1→40, build the gradient stops from those, and use the SAME function for the pin's fill. Now any X position on the bar = `srmToRgb(srm)` for the corresponding SRM, AND the pin previews the actual beer color. **Rule for any "value plotted on a color scale" surface (gravity, IBU intensity, mash pH zone):** generate the gradient from the same function that computes the marker color. Don't hand-pick stops.

### Bill stack visual feedback: the visualizer should be SMALL and live in the sidebar.

The initial bill stack was 96px tall and lived in the main column. User feedback: "too vertically tall; should be 2/3 the size. Maybe it should actually go in the sidebar above the brewers notes section so that the left is just the grain bill." Two specific moves: shrunk to 64px and moved to the sidebar above the notes. The lesson is generalizable — **the editor (where the user clicks) belongs in the main column at full width; charts/notes/context belong in the sidebar.** When in doubt, ship the chart small and to the side, not big and at the top.

### `grid-template-areas` with `display: contents` is the right pattern for sidebars that reflow on mobile.

Desktop wants: ledger header on top-left, ledger table below it, sidebar (bill + notes packed) on the right aligned with the ledger table. Mobile wants: bill at top, ledger header, ledger table, notes at the bottom — bill and notes split apart so notes anchors below. The trick: use `grid-template-areas` on the parent + a `<aside>` wrapper containing bill + notes (so on desktop they're packed via flex). On mobile, `display: contents` on the aside makes the wrapper "disappear" so its children participate directly in the parent grid — letting bill claim a top slot and notes claim a bottom slot. **Rule for any sidebar that contains multiple cards:** wrap in `<aside>` with `display: flex; gap: N` on desktop; flip to `display: contents` at the mobile breakpoint + give each child its own grid-area. Cleanest way to get desktop-packed + mobile-split without duplicating JSX.

### Top-of-sidebar alignment: ledger header in row 1 + sidebar in row 2 (not spanning).

The first cut had the sidebar in row 1, aligned with the ledger header's top (so the bill stack sat next to the Amount/% buttons). User feedback: "I want the top of the sections to align instead of the sidebar aligning with the buttons." Fix: split the main column into two grid slots (`lhead` + `ltable`) and put the sidebar in row 2 only, alongside `ltable`. Now the sidebar's TOP = the ledger TABLE's TOP, which is where the eye expects "section content" to begin. **Rule:** when a left column has a header strip followed by the main content, sidebars should align with the main content, not the header. Use `grid-template-areas` to split.

### Hex-alpha appended to a CSS var (`var(--hs-ink)66`) is broken in React inline styles — use color-mix or solid colors.

Several places in the codebase use `${hsTokens.ink}66` to get a translucent ink. When React converts that to inline style (`border: 1.5px dashed var(--hs-ink)66`), browsers either invalidate the whole declaration (border doesn't render at all) or drop the alpha bytes (renders as solid `--hs-ink`). Both modes were observed. **Rule for inline-style alpha:** use `color-mix(in srgb, ${hsTokens.ink} 40%, transparent)` (modern, ergonomic, works with CSS vars) or pick a solid color from the palette that's already at the desired tone (e.g., `hsTokens.muted` for "subtle dashed"). Don't append hex alpha to a `var()`. The broken pattern still exists at lines that I haven't migrated — flag for cleanup as a separate sweep.

### CSS `border-style: dashed` doesn't let you control dash length — use an SVG background-image for chunky dashes.

The dashed "+ Add another fermentable" button needed longer dashes with bigger gaps than the browser's default. CSS gives you `dashed` and that's it; no `border-dash-array`. Workaround: render the dashed outline as an inline SVG data URL background-image with `<rect stroke-dasharray='12 8'/>` and 100% width/height + `preserveAspectRatio='none'`. The SVG scales with the button and rounds the corners (via `rx`/`ry`). **Rule for any HS surface that wants visibly chunky dashes:** SVG background-image. Promote `dashedBorderBg(color, {dash, gap, strokeWidth, radius})` to a shared util if a third consumer arises.

### Mobile parity for hover-only affordances: always-visible variant + bare chrome.

Desktop's hover stepper ▲▼ doesn't fire on touch — there's no hover. The mobile-mode fix: `@media (max-width: 640px) { .hs-ferm-steppers { opacity: 1 !important; pointer-events: auto !important; background: transparent; border: none; box-shadow: none; ... } }` — keep the steppers visible, drop the chrome so they don't look like buttons sticking out. Same idea applies to the per-row remove icon (always 1.0 opacity on mobile, no fade-in). **Rule for any hover-revealed affordance:** use a width-based media query (not `(hover: none)` which is unreliable in headless browsers) to make the affordance always-visible on mobile, AND strip the visual chrome so it reads as part of the row, not a "button". Add a parallel mobile-only "add another" CTA at the bottom of long lists so the user doesn't have to scroll up to the header button.

### Brewer's Notes color: `color-mix(cream-2, honey)` is the right "yellowed beige" — but dial the mix LOW.

First attempt at "yellowed beige" used 28% honey. User: "a bit dark? Can we go more subtle." Second attempt: 14% honey. The card now reads as a distinct surface without becoming an accent block. **Rule for tinted card backgrounds in HS:** mix the base surface (cream/cream-2/paper) with the accent at 10-20%, not higher. If the tint looks heavy, the mix is too strong. Use `color-mix(in srgb, var(--base) NN%, var(--accent))` so dark-mode adapts proportionally.

### Bill stack background: cream-2 reads as "summary surface" — paper reads as "hero card".

Initial bill stack used `paper` bg (like the ledger table). User: "Can the grain bill % visualizer get the slightly grey background color? (The color we use on row hover I guess)." Switching to `cream-2` made the bill stack read as a quieter "context" card instead of a hero. **Rule:** the most prominent card on a surface gets `paper`; secondary/context cards get `cream-2`. Tertiary/notes cards get a tinted variant. Three tiers of card weight, like the three tiers of input/row/section background documented in `overrides.css`.

### Hover tooltip on chart segments — the `BarRow` pattern ports verbatim.

The compare page's `BarRow` cursor-follow tooltip (position: fixed; z-index 100; first-move snap with `void offsetHeight` reflow; mouse-move applies rotation based on velocity; settle timeout straightens it) ported straight into the Bill Stack with zero changes. This is the second consumer; **the third instance should promote the pattern to a shared `useCursorFollowTooltip()` hook or `<HSCursorTooltip>` primitive.** Until then, inline-copy is fine.

### Reorganize controls "closer to where they're used" — header should be just identity.

User feedback: "Amount/% toggle and add fermentable button should just go closer to the actual malt list since it is where they will actually be used." Moved out of the section header (kicker + title only) and into a dedicated "ledger header row" (eyebrow + entries count + controls + add button). The section header becomes a quiet identity strip; the controls live with the data they affect. **Rule:** if a control mutates the data in a sub-area, render the control adjacent to that sub-area, not in the section-wide header. Section headers are for identity/context, not interaction.

### Click-to-edit cells with Caveat display + dotted-underline cue + hover stepper is the cell pattern.

The mockup uses `border-bottom: 1.5px dotted ink55` on the displayed value as the "click me" cue, solidifies on hover. HS adopted this. Pair with the brewsheet's CellInput button + input-on-edit + Esc-cancel + Enter-commit + ▲▼ hover stepper. The Caveat handwritten font on the displayed value reads as "your number" — matches the rest of HS's hand-written annotations. **Rule for editable numeric cells in HS:** Caveat 30px value + 11px mono unit + dotted underline cue at rest; cream cell + malt outline + Caveat input on click; absolute-positioned ▲▼ steppers fading in on hover. Pre-built; use `CellInput` from `HSBrewSheetSection` or this file's local `EditableCell`.

### Live-numbers SRM card removed in favor of the color bar — keep the other 6.

User explicitly said "remove the SRM live number card now that we have the SRM bar" — the SRM number is now in the bar's right caption ("14.5 SRM / 29 EBC"). The other 6 stat cards (OG/FG/ABV/IBU/pH/Cal) stayed. The grid template went `repeat(7, 1fr)` → `repeat(6, 1fr)` with the mobile breakpoints scaled proportionally. **Rule for live-numbers changes triggered by a section visualizer:** if the visualizer surfaces a stat, the stat card is redundant — drop the card, don't double-show. Keep all OTHER stats untouched per the user's "don't lose any of the live numbers" guidance from this slice.

### Synthetic mouse events don't trigger React's `onMouseEnter` reliably — verify hover behavior with real cursor or by inspecting CSS rules.

The bill-stack hover tooltip + the row-hover bg pattern both rely on React `onMouseEnter` (or the CSS `:hover` pseudo). `preview_eval` dispatched `dispatchEvent(new MouseEvent('mouseover'))` does NOT reliably fire React's synthetic mouseenter — checked opacity stayed 0 even after dispatch. Verification approach: inspect the CSS rule via `document.styleSheets` to confirm it's registered, then trust the pattern (especially when copying from a known-working pattern like `BarRow`). Real cursor verification is the user's job. **Rule for hover-driven UI testing:** don't try to programmatically simulate hover; verify the CSS rule + computed style at hover state via DevTools instead.

### Naming convention shifted mid-slice: `OLD_` prefix on classic, drop `HS` prefix from new sections.

After the initial 2.1 shipped with `@deprecated` JSDoc + `HSFermentableSection` naming, the user reframed: rename classic to `OLD_FermentableSection` and drop the `HS` prefix from the new one so it's just `FermentableSection`. The argument: the `OLD_` prefix screams at the top of every grep/IDE search, the folder location (`beta-builder/` vs `hopskip/`) is the structural marker, and the eslint rule does the enforcement — `@deprecated` is redundant. Section components are the canonical version of their feature, so they shouldn't carry a design-system prefix; design-system primitives (`HSCard`, `HSButton`, `HSModal`, `HSPill`, `HSEyebrow`) keep `HS` because they ARE part of the design system. This applies going forward to every section migration. **Rule:** when a section migrates, `git mv` the classic file to `OLD_<Name>.tsx`, rename its default export + interface types with the same prefix, drop the `@deprecated` JSDoc, and rename the matching HS file to just `<Name>.tsx` with `<Name>` as the default export. Update eslint paths to point at `**/.../OLD_<Name>`. Choreography step 7 was rewritten to capture this. The `OLD_` prefix doesn't violate any naming-convention lint rule we have (verified post-rename: 75-problem baseline stayed at 75).

---

## Phase 2.2 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.2 (Mash + MashStepModal). Read before 2.3 / 2.4 / 2.6 / 2.7 / 2.8.

### The 2.1 substrate is locked in — 2.2 was a near-mechanical clone with section-specific data + chart.

The whole slice (MashSection + MashStepModal, ~1,300 LOC) was written by following the 2.1 substrate verbatim: outer `sectionFrameStyle` (paper + 2px ink + `0 0 14px 14px` + sh3), `SectionTitle` (kicker + display H2 + accent rule), 2-col grid with `grid-template-areas` + `display: contents` mobile reflow, `LedgerHeaderRow` with eyebrow + hairline + entries-count + Add button, ledger table with per-row grid columns, `EditableCell` + `HoverSteppers` + `StepperBtn` cloned with section-specific accent (roast instead of malt), `MobileAddRow` with the SVG dashed-border helper, `MashSectionStyles` mirroring `FermentableSectionStyles`. **Rule:** for 2.3 / 2.6 / 2.8 (per-list sections), clone these primitives into the new file rather than promoting them to shared modules. The per-section variations (accent color, column widths, badge content, hover text) are local enough that inline copies beat a shared abstraction. Promote only when a third consumer needs the exact same shape with no per-section variation — and even then prefer copying a thin function rather than building a generic.

### Per-section sidebar = `[small readout] + [brewer's notes]` for most sections. Skip the chart when the ledger already tells the story.

The first cut of MashSection shipped with a `MashProfile` stepped chart (temp-vs-time bars) + a 4-row `MashReadout` (strike / water / pH / total time). User feedback after seeing it: "Not sure we need this Mash profile section. I think the readout is fine. Maybe it should just have mash/sparge amounts and strike temp. Otherwise should just be the readout and the brewers notes there." Two lessons: (1) **a per-step ledger with colored badges already conveys the schedule's shape** — a chart on top adds visual weight without adding information; (2) **the readout should answer "what amounts do I need on brew day," not "what's happening inside the mash."** Dropped the chart, simplified the readout to 3 rows (Strike temp / Mash water / Sparge water), and added the BrewersNotesCard.

**Rendering `recipe.notes` in multiple surfaces is fine** — edits sync, the brewer sees their notes from whichever tab they're on, no friction. Notes are session-context, not section-specific data; show them everywhere they're useful.

**Rule for upcoming sections:** default sidebar shape is `[compact readout (3-4 rows of brew-day numbers)] + [brewer's notes]`. Add a chart only if the ledger genuinely can't convey the shape (Hops' addition timeline + flavor radar, Water's ion comparison bars). When in doubt ship v1 with just readout + notes; add visualization if asked. The notes card should adopt the section's accent color on edit-mode borders (roast for Mash, malt for Fermentables) so it visually belongs to its section.

### `HSActionMenu` slotted right into the ledger header as the Generate dropdown.

Phase 1.1 introduced `HSActionMenu` for browse-card overflow menus; 2.2 uses it for the "Generate ▾" trigger. The `trigger` ReactNode + `items` array shape compose cleanly inside the header row — no styling friction, no per-consumer copy. **Rule:** for any section that needs a small choice menu (Generate / Export / Bulk action / etc.), reach for `HSActionMenu` first. Don't reinvent a dropdown in JSX inline.

### Iteration cost: a sidebar chart can be cleanly removed in 5 minutes when feedback says drop it.

The mash profile chart was a ~120 LOC component (DOM-based stepped bars + cursor-following tooltip with `position: fixed; z-index: 100` + `void offsetHeight` first-move snap). When user feedback came in to drop it, the removal was: delete the component, drop the `<MashProfile>` call site, remove `grid-template-areas: "profile"` from the mobile reflow, swap the desktop sidebar children. tsc + lint clean on the first pass. **Rule:** keep sidebar visualizations as standalone components (one function, one CSS class) so they can be deleted as a unit when feedback turns. Don't tangle chart state into the section's main render — the chart should be a pure prop-driven component. (Even though this one got dropped, the DOM-rects-not-SVG pattern is good: if a future section's chart is just per-element rectangles on one axis, build it in DOM — no axis libs, simpler tooltip wiring. SVG only when the chart needs continuous curves.)

### The mash badge color function (`temperatureColor`) doubles as visual semantics + chart legend.

One function maps temp → color: acid < 48°C (cool straw), protein 48–60 (honey), beta 60–66 (deeper honey), alpha 66–72 (malt), mash out 72+ (roast). The same function colors the row's step badge AND the chart segment, so the user sees "row badge is honey-yellow → chart bar at that temp is honey-yellow." Free semantic linkage. **Rule:** when a section has discrete categorical bands derived from a continuous value, write one `categoryColor(value)` helper and use it everywhere — badges, chart segments, tooltip kickers, legend chips. The visual consistency carries the meaning for free.

### `mashScheduleService` + `useRecipeCalculations` + `recipeStore` reused exactly — zero domain changes.

The only TypeScript imports added were `MashStep` (type), `mashScheduleService` (validate + generators), `useRecipeStore` (actions), `useRecipeCalculations` (strike temp + mash water + pH). No new store actions, no new domain methods, no new pure helpers. This is the goal of the substrate — the HS-native section is a pure presentation rewrite. **Rule for Phase 2.x scoping:** if a slice needs new domain logic, that's a sign the scope is wrong. Either find a way to fit it into the existing calculation service, or stop and add the domain method first as its own commit before the section migration. Don't bundle "new math" with "new JSX" — they're different review surfaces.

### `git mv` + 6-line edit pattern for quarantine is now mechanical.

The whole quarantine took ~4 minutes: `git mv MashScheduleSection.tsx → OLD_MashScheduleSection.tsx`, `git mv MashStepModal.tsx → OLD_MashStepModal.tsx`, rename `function` + `default export` + sibling JSX usage (`<MashStepModal` → `<OLD_MashStepModal`) + interface type (`MashStepModalProps` → `OLD_MashStepModalProps`), update the 2 classic-aggregator imports (`BetaBuilderPage.tsx` + `brew-session/BrewedVersionModal.tsx`), append an eslint `no-restricted-imports` block. Tsc + lint both clean on the first pass. **Rule:** the 2.1 retrospective's 3-minute quarantine claim is real — the pattern is rote enough that future slices should budget ~5 min, no more. If you find yourself spending 20+ minutes on quarantine, you missed a non-classic consumer; grep `grep -rn "<ClassicName" src app` BEFORE renaming so you know the full call sites up front.

### Modal preset chips: 6-up grid with `auto-fit minmax(180px, 1fr)` works for all rest counts.

Classic had a `grid-cols-2` 5-up button grid. The HS version is `auto-fit minmax(180px, 1fr)` — on desktop this lays out 3 cols × 2 rows (the modal is `size="lg"` = 720px wide); on narrow screens it collapses to 2 then 1 cols. Each chip stacks (display-name + mono °C × min + Caveat-script tagline) in a small card with `cream2` bg + `sh1` shadow that hover-promotes to `paper` + `sh2`. The tagline ("soften the husk" / "lock the enzymes") is the HS handwriting cue that earns its place — without it the chips read like a database, with it they read like a guided menu. **Rule for any preset/picker grid in HS:** the data row is "name + numbers"; the script-font tagline is what makes it feel like a recommendation. Spend the 30 seconds to write one per option.

### The `confirm()` browser-native prompt for "replace schedule" stays — don't HSify it yet.

Classic uses `confirm()` for the generator-button "this replaces your current schedule" check. HS could replace with a custom HSConfirmModal but that's a new primitive for one consumer. Kept the native dialog for v1. If a second consumer needs the same shape (e.g., "this resets all hop additions"), promote then. **Rule:** native browser dialogs are an acceptable transitional state when the alternative is building a new design-system primitive for a single use case. Track them as TODOs but don't block on them.

### Lead with `preview_eval` DOM assertions over `preview_screenshot`.

The page has a bottom-docked nav that competes for viewport space, so screenshots are awkward — eval-based text + structure checks (row count, label/value assertions, computed-style reads) are faster to write, faster to read, and easier to compare across runs. Screenshots stay valuable for layout regressions you can't assert programmatically.

### Stale Turbopack `console_logs` buffer is a known noise source — ignore it after a confirmed reload.

`preview_console_logs` returned 102 entries referencing `HSFermentableSection` (a name that doesn't appear anywhere in my edits). Those are stale buffer entries from earlier turbopack hot-reload errors that the API still surfaces. Confirmed harmless via `window.location.reload()` + re-snapshotting the page, which showed the section rendering correctly. **Rule:** if `preview_console_logs` shows errors that don't match the current source code, assume buffer staleness. Use `console.clear()` before the user-facing check to flush, or just verify behavior via DOM assertions instead of trusting the log buffer.

### Polish iteration shipped (post-initial-2.2 sessions)

Cross-cutting lessons surfaced by a few rounds of user feedback. Apply to 2.3+:

- **`HSActionMenu` trigger hardcodes `width: 28, height: 28`.** Fine for icon-only buttons; crushes text-bearing ones (a "GENERATE ▾" pill rendered as a tiny round button overlapping the Add Step). Override with `width/height: "auto"` in `triggerStyle`. Promote a `triggerSize="pill"|"icon"` prop on the primitive if a third consumer hits this.
- **Surface tone hierarchy — three discrete levels.** Header bands = `var(--hs-cream)` (#f4eedd, slightly darker). Sidebar context cards (readout, bill stack, visualizer) = `color-mix(in srgb, var(--hs-cream), var(--hs-cream-2))` (~#f7f2e3 midpoint — quieter than the header band, still warmer than paper). Honey-tinted notes card from 2.1 = third tier. Pick by role, not by feel. Applied retroactively to Fermentables (LedgerHead → cream, BillStack → color-mix midpoint).
- **Centering ledger column headers over their values takes four moves.** (1) `display: block` on the Eyebrow `<span>` (textAlign + padding-right don't apply to inline spans). (2) header `textAlign: center`. (3) data-cell wrapper `justifyContent: center`. (4) `paddingRight: 28` on the header when the data cell is an EditableCell (the button reserves 28px of right padding for hover steppers; without compensation the header floats 28px right of where the visible value ends). Skip any one and header/value visibly drift apart. Applied to Mash + Fermentables ledgers.
- **Mobile `grid-template-areas` needs distinct names per child.** Two cells both assigned `grid-area: vals` stacked into one cell ("68" + "60" rendered as "6800"). Fix: `"temp temp time"` with `justify-self: start/end` to pin them to opposite ends of the row. **Rule:** never reuse a grid area name on two children unless overlap is the intent.
- **Readout card converged on a tight 3-row layout.** After a few iterations: dropped the "MASH READOUT · live ✦" header row, dropped per-row script sublines, kept one optional inline sub-hint next to the label (e.g. Strike's "for 52°C"), value font display-17 (was display-22). Card went ~220px → ~109px. **Rule for sidebar readouts:** if the labels are self-evident and the card has ≤4 rows, the eyebrow heading is decoration — cut it. Aim for the card to be shorter than the data table it accompanies; it's context, not content.

---

## Phase 2.3 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.3 (Fermentation + FermentationStepModal). Read before 2.4 / 2.6 / 2.7 / 2.8.

### Categorical color function replaces the continuous `temperatureColor` from Mash — same downstream wiring.

Mash mapped `tempC → color` along a continuous gradient. Fermentation has 5 discrete `FermentationStepType` values; the natural shape is `stepTypeColor(type) → color`. The downstream consumers (row badge fill, badge text inversion via `badgeIsDark()`, modal type-chip swatch) all take a color string and don't care whether it came from a band lookup or a switch statement. **Rule for categorical sections (Yeast, possibly Hops):** if the section has a closed set of discrete kinds (step types, yeast lab/strain families, hop usage purposes), write a `kindColor(kind)` switch + a small `kindIsDark(kind)` boolean for the few dark fills that need cream-on-dark text. The same color function should drive both the section row badge AND the modal type-chip color dot — free semantic linkage, same lesson as Mash's `temperatureColor`.

### Inline preset arrays for generators are fine when there's no existing service.

Mash had `mashScheduleService.generateDefaultSingleInfusion / generateStepMash / generateDecoction` already in the classic domain layer — the HS section reused them verbatim. Fermentation has no `fermentationScheduleService`. Instead of bundling "new domain logic" with the section rewrite (which the [2.2 scoping rule](#mashscheduleservice--userecipecalculations--recipestore-reused-exactly--zero-domain-changes) warns against), the 3 generators (Standard Ale / Lager / Hazy IPA) live as inline preset arrays inside the section file — pure data, no logic, ~20 lines. **Rule for upcoming slices:** if the section needs a small set of static presets (1–5 entries) and there's no existing service, inline them as constants in the section file. Promote to a domain service only when (a) a second consumer needs them OR (b) the preset values depend on calculated state (e.g., "scale fermentation duration to ABV"). Empty-state generator buttons are presentation concerns until proven otherwise.

### The store doesn't need section-specific actions when `updateRecipe(...)` already covers the shape.

Mash had `addMashStep / updateMashStep / removeMashStep / reorderMashSteps` — those existed in classic and the HS rewrite reused them. Fermentation classic does everything via inline `updateRecipe({ fermentationSteps: [...] })` array manipulation — no section-specific actions. The HS rewrite follows the same pattern: inline `writeSteps(next)` helper that calls `updateRecipe` with the new array. **Rule:** match the existing store shape — don't add `addFermentationStep` just because Mash has `addMashStep`. The two sections have different domain conventions and that's OK. If a future slice's per-row edit becomes complex enough to warrant a dedicated action (e.g., recalculating downstream values on update), add it then — but bundle the action with the new logic, not with the section migration.

### Per-step notes display inside the type caption row instead of a separate ledger line.

Classic FermentationSection rendered notes as a `<div>` below each row's main content block — a third visual line in the row card. To keep the HS ledger's compact 1-row-per-step layout, the HS version folds notes into the type caption: `Primary fermentation · Add dry hops on day 7`. Long notes truncate via the caption row's `text-overflow: ellipsis`. **Rule for surfacing per-row metadata:** if the section's ledger row has a script-font caption line under the bold name, optional metadata (notes, tags, sub-flags) can ride on that caption with a ` · {value}` separator. Adding a third row per-card is rarely worth the vertical cost; the caption already invites secondary info. If the metadata gets long enough to truncate frequently, promote to a hover/expand or move into the modal-only view.

### Type-chip switch in the modal mirrors classic's "auto-fill only when creating" rule.

Classic FermentationStepModal: changing step type via Select dropdown auto-fills name/temp/days defaults ONLY when `!editingStep` (i.e., adding new). When editing an existing step, type-switch ONLY changes the type — preserves the user's manual edits. HS modal replaces the Select with 5 chip-buttons but keeps the exact same `if (!existingStep)` guard. **Rule:** when porting forms with auto-fill behavior on field change, copy the guard logic verbatim before re-designing the UI shape. A different visual control (chips vs. dropdown) should not change which actions cascade defaults.

### Synthetic `.click()` on buttons is unreliable for React `onClick` — use `dispatchEvent` with a real `MouseEvent`.

Testing the type-chip switch with `el.click()` did not fire React's `onClick` handler (aria-pressed stayed on the old chip, inputs didn't change). Switching to `el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))` worked. **Rule for preview verification:** `preview_eval` testing of click interactions on React components should use `dispatchEvent` with a real bubbling `MouseEvent`, not `.click()`. This complements the Phase 2.1 retro's `onMouseEnter` lesson — same root cause: React's synthetic event system needs the event to bubble through the listener path it registered. Save this for upcoming Hop/Yeast/Water slice verification.

### Stale Turbopack console-buffer errors *can* repeat post-`console.clear()` + tab-switch.

The Phase 2.2 retro said "stale Turbopack `console_logs` buffer is a known noise source — ignore it after a confirmed reload." This slice surfaced a stronger version: after `console.clear()` + navigating away from MashSection and back, the `BrewersNotesCard is not defined` errors re-appeared in the buffer even though MashSection itself rendered correctly (`h2 === "Mash."`, no error-boundary UI). The errors are emitted by Turbopack's `applyUpdate`/`performReactRefresh` chain replaying an old HMR diff — not by the current MashSection render. **Rule:** when `preview_console_logs` shows errors that reference a component whose CURRENT render is verified clean (`hsXxxSectionPresent: true`, title text matches, expected child count > 0), trust the render-side assertions over the log buffer. The buffer can re-emit historical HMR errors during tab navigation in dev. In CI / production build this won't appear.

### The substrate is locked in — Phase 2.3 was almost mechanical post-2.2.

Same outer frame, same SectionTitle shape (kicker + display H2 + accent rule, accent swapped to honey), same 2-col grid + display:contents mobile reflow, same LedgerHeaderRow with eyebrow + hairline + script entries-count + Generate ▾ menu + Add button, same Ledger / LedgerHead / LedgerRow / LedgerTotal / MobileAddRow, same EditableCell + HoverSteppers + StepperBtn (accent color swap roast → honey for the active state), same IconBtn for move/remove. Only true new logic: `stepTypeColor` / `badgeIsDark` / `STEP_TYPE_LABELS`, the FermentationReadout content (different brew-day numbers than Mash), inline generator presets, the modal's type-chip row. The 2-file slice came in at ~1,300 LOC (980 section + 470 modal) — exactly the [2.2 estimate](#phase-22-retrospective--lessons-for-subsequent-slices). **Rule:** at this point the per-list section template is locked in. Budget upcoming list-section slices (Hops, Yeast for the parts that ARE a list) at ~1,200–1,400 LOC with maybe 1.5 hours of focused work; if it's taking significantly longer, you're either (a) over-designing a new visualization or (b) tripping on a hidden domain dependency that should have been resolved before the section migration started.

### Packaging-merge iteration shipped (same session as initial 2.3)

Cross-cutting lessons from the post-initial-2.3 merge expansion. Apply to 2.4 / 2.6 / 2.7 / 2.8 — especially the "sidebar should justify its real estate" rule.

- **A sparse 3-row readout is not enough to justify a sidebar.** The initial FermentationReadout had Primary / Total / Crash — all values either already visible in the ledger (Primary, Total via Σ row) or decorative (Crash). The user called it out: "I don't think the side section has any useful data." **Rule:** when designing a sidebar for a Phase 2 section, the readout cards must either (a) surface a value derived from cross-section state that's NOT trivially readable in the main column, or (b) host an INPUT that drives downstream calculations. Pure restatements of ledger data don't earn the sidebar real estate.
- **Orphan classic sections are candidates for absorption — not 1:1 ports.** The classic [PackagingSection.tsx](src/modules/beta-builder/presentation/components/PackagingSection.tsx) was already orphaned: not surfaced in any HS tab, no entry in the [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) tab list. Rather than building a dedicated Phase 2.9 packaging slice (matching the classic 1:1), we absorbed packaging into 2.3 as the sidebar content. **Rule:** before scoping a new Phase 2.X slice, check whether the classic section is already orphaned in HS. If yes, find an adjacent HS section where the content logically belongs and absorb it. Saves a slice; mirrors the [2.5 / 1.5 absorption pattern](#phase-2-section-by-section-hs-native-rewrites) — Phase 2.5 (brew sheet) subsumed Phase 1.5 (brew session) for the same reason.
- **`PackagingCalculationService` was reused in full — zero domain changes.** The service has `residualCo2`, `highestFermTemp`, `primingSugarGrams`, `forcedCarbonationPsi`, `styleCo2Range`, `gramsToOz`. All consumed verbatim in the HS section via `import { packagingCalculationService as pkgCalc } from "@/modules/beta-builder/domain/services/PackagingCalculationService"`. The merge added ~600 LOC of pure presentation — no new pure functions, no new store actions, no new repos. **Rule:** if absorption requires NEW domain logic, the absorbed surface isn't a clean fit — keep it as a separate slice and add the domain logic deliberately. The fact that this merge needed zero domain changes is what made it cheap.
- **Recipe state lazy-init via `currentRecipe.packaging ?? DEFAULT_PACKAGING`.** The classic packaging UI had an explicit "Set Up Packaging" empty-state button — the HS version skips the setup gate entirely by rendering against `DEFAULT_PACKAGING` constants (target 2.4 vol · corn sugar · serving 4°C) until the user touches an input. The first touch calls `updatePackaging(partial)` which writes the merged `{ ...DEFAULT_PACKAGING, ...current, ...partial }` to `recipe.packaging`. **Rule:** for optional sub-objects on the recipe (packaging, water chemistry, equipment profile), prefer lazy persistence over explicit "set up" empty states. The fewer "set up X" prompts in the builder, the better the flow.
- **MiniStepper is the right primitive for compact sidebar inputs (vs. the EditableCell pattern used in ledger rows).** Ledger rows use `EditableCell` (large Caveat-script display, dotted-underline cue, hover-reveal steppers, click-to-input). Sidebar inputs are tighter: a round pill with `−` + value + suffix + `+` buttons inline, always-visible nudgers, small footprint. Different content density → different control. **Rule:** the EditableCell pattern is for VALUE-FORWARD display (big Caveat font, value IS the cell) — like ledger rows. The MiniStepper is for INPUT-FORWARD compact controls (small body font, +/− nudge primary) — like sidebar inputs and modal fields. Don't reach for EditableCell in a sidebar; the size mismatch reads as "the sidebar is shouting."
- **Cross-card derived state via `useMemo` chains is the natural pattern for packaging.** `highestFermTempC` (from `steps`) → `residualCo2` (from temp) → flows into both `primingSugarG` AND the CO2TargetsCard's "Needed" readout. `pkg.targetCo2Volumes` + `pkg.servingTempC` → `kegPsi`. `pkg.targetCo2Volumes` + `pkg.primingSugarType` + `residualCo2` + `batchVolumeL` → `primingSugarG`. Each `useMemo` is keyed exclusively on its inputs; React rerenders only the affected card. **Rule:** for sections with multiple interconnected calculator cards, define `useMemo` constants at the section's top scope (not inside the cards), pass values down as props. Keeps the cards pure-presentational and makes the derivation chain greppable from the section's entry point.
- **`recipe.style` is `string | undefined` — substring match is the right shape for style-suggestion lookups.** `pkgCalc.styleCo2Range(styleName)` does case-insensitive substring match against the BJCP table — so "American IPA" matches "American IPA" exactly, and "Hazy NEIPA" can substring-match "Hazy IPA". The chip click writes `targetVols = typical`. **Rule:** when the data layer offers a fuzzy-match function (substring, prefix, fuzzy-distance), prefer it over exact-match for user-facing suggestions. Brewers don't always type the exact BJCP-canonical style name.
- **Synthetic-click test trick for steppers: 3 sync clicks register as 1 increment** (React state batching with stale closures). When verifying stepper behavior in `preview_eval`, click ONCE, await, then click again. Or `el.dispatchEvent` 3 times sees only the first commit because each handler closure captures the same stale `value`. **Rule for preview testing of nudge controls:** test via single-click increments with `await new Promise(setTimeout)` between each — don't fire 3 events in a row expecting 3 increments. The actual user clicks have natural timing that React handles correctly; the test method needs to mimic that timing.
- **The section now mixes ledger-driven and packaging-driven state — kept the title as just "Fermentation."** The H2 stays "Fermentation." for tab-label parity (the tab is still "Fermentation" in the nav). The "& packaging" lives in the script kicker ("your fermentation & packaging —") which signals the merge without renaming the nav surface. **Rule:** when expanding a section's scope mid-Phase, prefer to expand the script kicker (decoration, easy to read past) rather than the H2 (load-bearing for navigation). Tab labels in the nav rail should stay short and recognizable.

### Layout restructure iteration shipped (same session as packaging merge)

Second restructure within the same session — the packaging-as-sidebar shape from the merge iteration didn't match the rest of the HS design language. The brewer ergonomics shifted to "two sections in one tab" with shared summary aside. Lessons:

- **"Sidebar = summary + notes" is the load-bearing convention for HS sections.** Fermentables / Mash / and now (post-restructure) Fermentation all share the same sidebar shape: a context-summarizing readout at top + brewer's notes at bottom. Deviating from that convention (e.g., the intermediate "3 packaging cards in sidebar" attempt) reads as "what is this tab doing differently?" even when the cards themselves are useful. **Rule:** if a slice ends up with primary-action cards in the sidebar, that's a smell — either promote them to the main column or admit the sidebar lacks summary content. The fix is usually "find a real summary" not "redefine what the sidebar is for."
- **Per-section "block" abstraction with `BlockEyebrow` + `BlockHeaderActions` lets one tab host multiple logical sub-sections.** Pulled the ledger-header-row pattern (eyebrow + hairline + script count + actions) out of the old `LedgerHeaderRow` component into a reusable `BlockEyebrow` taking `label` + `meta` + `right` props. Both blocks (fermentation schedule + conditioning plan) reuse it. **Rule:** when a section has 2+ sub-blocks (schedule + conditioning here, billboard + ledger in Fermentables), define a generic `BlockEyebrow` primitive at the top of the section file. Don't duplicate the hairline + meta + actions layout per block.
- **Two empty states in one tab is a feature, not a bug.** Each block (`[Fermentation block]`, `[Conditioning block]`) has its own empty state with its own pickers. Brewer reads: "Pick a schedule (3 generator cards), then pick a carb plan (3 method cards)." Two independent decisions surfaced clearly. **Rule for tabs that absorb a second concept:** give each concept its own empty state — don't try to unify them into a single dashboard. The empty states ARE the onboarding.
- **`recipe.packaging` lazy persistence becomes a UX signal, not just a default.** Setting `packaging` to `undefined` means "no carb plan picked yet" — shows the method-picker empty state. First click on a picker writes `{ ...DEFAULT_PACKAGING, methods: [picked] }`. "Change method" pill (top right of configured block) resets `packaging` to `undefined`, returning to the empty state. **Rule:** for optional sub-objects with a clear "configured / not configured" UX state, treat `undefined` as the empty-state signal rather than introducing a boolean flag. The 2-state shape is cleaner.
- **"Split it" path needs special-case grid layout in the conditioning block.** When `methods` includes both keg AND bottle, the `CO2TargetsCard` spans both columns (`gridColumn: "1 / -1"`) and Keg PSI + Priming Sugar sit side-by-side below. When single-method, all cards stack in one column. The internal `gridTemplateColumns` switches between `"1fr 1fr"` and `"minmax(0, 1fr)"` based on `isKeg && isBottle`. **Rule for sections with 1-or-many sub-cards:** drive `gridTemplateColumns` from the count, not from a fixed-cols value. Single card looks balanced in 1-col; 2 cards work side-by-side; 3+ cards need careful thought.
- **Sticky sidebar (`position: sticky; top: 20px`) is a UX upgrade for long main columns.** With both blocks stacked in the main column (~713px tall), the sidebar would scroll out of view fast. Sticky keeps the summary card visible during conditioning edits. Reset to `position: static` on mobile (`@media (max-width: 900px)`) where the main column collapses to vertical-stack with sidebar at the bottom anyway. **Rule:** any section with a main column taller than ~600px and a sidebar that summarizes/contextualizes the main content should use `position: sticky` for desktop. Skip on mobile.
- **`SummaryCard` is the load-bearing component for "what does the brewer need to glance at?"** Two rows: Ferment (with primary or peak temp sub) and Carb to (with PSI / priming grams sub depending on method). Two rows is enough — three felt like restating the ledger. **Rule for summary cards:** identify the 2–3 numbers the brewer would memorize for brew day; show those. Anything more = the brewer reads the ledger anyway. Anything less = the card doesn't earn its real estate.
- **Mid-slice restructures cost ~30 minutes when the substrate is well-factored.** The pre-restructure code had separate `CO2TargetsCard` / `KegPsiCard` / `PrimingSugarCard` components used as sidebar siblings. The restructure was: (a) extract `BlockEyebrow` from the old `LedgerHeaderRow`, (b) introduce `ConditioningBlock` wrapper that internally picks which cards to render, (c) introduce `SummaryCard` for the sidebar, (d) flip CSS from `lhead/ltable/aside` 3-area grid to `main/aside` 2-col grid. The cards themselves didn't change — they're just rendered inside `ConditioningBlock` instead of directly in `<aside>`. **Rule:** when iterating on layout, the components shouldn't need to move — only the wrapping containers. If a layout iteration forces a component rewrite, the component is doing too much.

### At-a-glance iteration shipped (post-merge follow-up session)

A focused session of layout + visualization iteration on top of the merged Fermentation & Conditioning slice. The "At a glance" sidebar card evolved from a 2-row data block into a full journey visualization with calendar pickers, hand-drawn callouts, and per-step tiles. Lessons cluster around (a) visualization design, (b) brewing-science verification, (c) state persistence patterns, and (d) micro-interaction polish.

### "At a glance" sidebar is the right home for cross-block summary — once it actually summarizes things.

The original "Ferment 37 days · primary 11°C · 14d" + "Carb to 2.4 vol · split · 10.8 psi · 119g priming" 2-row card was a restatement of data already visible elsewhere — the [2.2 sidebar lesson](#a-sparse-3-row-readout-is-not-enough-to-justify-a-sidebar) flagged this as not earning the real estate. The fix wasn't to drop the sidebar; the fix was to make it summarize content that ISN'T trivially derivable from the main column: a TIMELINE that shows when each phase happens, CALENDAR PILLS for "when am I brewing this" → "when can I drink it", and per-PHASE stat tiles that decompose the recipe (Hazy IPA's primary + dry-hop + cold-crash as 3 tiles, not one rolled-up "Ferment" tile). **Rule:** sidebars don't fail because they're sidebars — they fail when they restate. A peek-card with VISUALIZATION + INPUTS + per-stage tiles + calendar anchors = ~600px sidebar that justifies itself.

### Layout iteration takes 5+ tries — don't lock in the first shape.

The Fermentation+Packaging section moved between layouts ~8 times in this session: original (sparse readout sidebar) → packaging in sidebar → packaging in main column with summary sidebar → renamed to "Fermentation & Conditioning" → conditioning empty state with method-picker → carb method toggle added → calendar pills added above bar → calendar pills moved into day axis → calendar pills moved back above bar but flush against it. Each move was prompted by user feedback. **Rule:** for any new "shape" slice (Phase 2 Hops, Water visualizations later), expect 5+ layout iterations before the final shape lands. Plan the slice with buffer for that, don't try to spec the final layout up front. The right layout emerges from playing with the brewer's mental model at every step.

### Journey timeline = horizontal stacked bar with per-step colors + carb tail(s).

The visualization is a single 36px-tall flex row inside a paper-bg 8px-radius rounded box, with one segment per fermentation step (`flex: ${days} 0 0`, `min-width: 6px`) colored via `stepTypeColor(s.type)`. Carb segments are pushed last with a diagonal stripe overlay (`repeating-linear-gradient(135deg, ...)`) to signal "estimated." On hover, a cursor-following tooltip (cloned from the Phase 2.1 BillStack pattern) shows the segment label, days, sub-info, and (if `brewDate` set) the absolute date range "MMM d – MMM d". **Rule for similar timeline visualizations in future slices** (Brew Sheet timeline, Compare-recipes phase view): the BillStack tooltip pattern is the substrate — `position: fixed` tooltip, `applyTransform()` on mousemove for cursor-follow + velocity rotation, `void offsetHeight` on first-show to skip transition flicker. Don't reinvent.

### Hand-drawn SVG callouts are the right vocab for "this happens here on the timeline".

For Split-packaging recipes, a hand-drawn leader line + Caveat-script "keg ready Jul 4" label points at the keg/bottle dashed-boundary on the journey bar. The SVG is intentionally simple — `M 19 17 L 2 1` is a single straight diagonal (not a wobbly multi-curve, not multi-stroke) — because the HAND-DRAWN feel comes from `stroke-linecap: round` + slight tilt + script-font label, NOT from path complexity. **Rule:** when adding a one-off annotation/pointer/highlight to a chart in HS, prefer a single straight stroke with rounded caps + a small script-font label rotated -3°. Squiggly paths look noisy at small sizes; clean diagonals read as intentional.

### Math correctness: parallel processes can't be added as sequential days.

A user-caught bug — the original "Bottle finishes" segment showed `bottle - keg` days back-to-back with the keg segment. User read this as "5d keg + 9d bottle = 14d sequential" when actually the two run in PARALLEL after packaging. **The fix that stuck**: keep two sibling segments (so each has its own hover + color) but (a) DROP the day count from segment labels (just "keg" / "bottle"), (b) replace the solid divider with a gentle 1.5px dashed rgba ink at 40% opacity so the segments read as one continuous parallel period, (c) ensure the total carb time on the bar = `max(keg, bottle) = bottle`, NOT `keg + bottle`. **Rule for any "parallel processes" visualization** (e.g., dual-stage hop boil + whirlpool, simultaneous mash + sparge water heating): NEVER let segment widths be additively interpreted as durations when they actually represent overlapping time windows. Drop day labels from the segments, put absolute readouts in the tooltip + axis, use SOFT divisions (dashed) between the parallel-phase boundaries.

### Residual CO₂ uses the peak ferment temp, not the last step — match industry convention rather than physically-optimistic math.

I briefly changed `pkgCalc.residualCo2` to consume the last fermentation step's temp (cold-crash) instead of the peak. Physical argument: cold beer holds more CO₂ per Henry's Law. Real-world result: that's only true for SEALED fermenters under positive CO₂ pressure during crash; in most homebrew setups, cold crash creates negative headspace pressure, sucks outside air through the airlock, drops the CO₂ partial pressure, and the beer LOSES residual rather than gaining it. Noonan's formula + BeerSmith / Brewfather / BrewersFriend all use peak ferment temp — that's the conservative, empirically-tuned answer. **Rule:** when you find yourself "fixing" a domain calculation that matches widely-used industry tools, STOP and verify the assumption before shipping. Standard brewing software has been calibrated against real-world results for decades; deviating without strong evidence (sealed/spunded setups, calorimetry studies, etc.) ships incorrect carbonation. The right user concession is an "advanced sealed-fermenter mode" toggle, not changing the default.

### Per-step stat tiles > single rolled-up Ferment tile for multi-tiered schedules.

For a Hazy IPA (Primary 7d → Dry Hop 4d → Cold Crash 3d), a single "Ferment 14 days" tile loses information. The brewer wants to see EACH phase's temp + duration at a glance. Replace the single tile with `steps.map(s => StatTile)` — one tile per fermentation step, label = `s.name` (user's editable name), value = temp, sub = days, with a `borderTop: 3px ${stepTypeColor}` accent that ties back to the ledger badge color. **Rule for any peek/summary card containing data that maps to a per-row collection** (mash steps, hop additions, water salts, fermentation steps): default to per-row tiles. Don't roll up unless the user explicitly says they want a single number.

### Recipe model gets a single new field — `brewDate?: string` — to make calendar pills survive tab navigation.

Initial v1 stored brewDate in `useState` inside SummaryCard. Lost on tab switch (component unmounts on tab change). The fix added `recipe.brewDate?: string` (ISO `YYYY-MM-DD` local-date) to the [Recipe type](src/modules/beta-builder/domain/models/Recipe.ts), read it in the section parent via `useMemo` + local-noon `new Date(y, m-1, d, 12)`, write via `updateRecipe({ brewDate: dateToInputValue(d) })`. The schema change is ONE optional string field — Firestore JSON.parse/stringify pattern handles `undefined` removal naturally. **Rule:** if user state is lost on tab navigation, that's the signal to promote to the recipe model — DON'T use `localStorage`, DON'T lift to a parent useState. The recipe IS the persistence layer; planning data belongs there. Tab unmount + remount is the SAME as page-refresh + load from the perspective of the user, and both should restore the same state.

### Calendar pickers via hidden `<input type="date">` + `showPicker()` give native UX for free.

Skip building a custom calendar popover. The button is HS-styled (custom calendar SVG icon, ink border, Caveat-script date display), but the actual date-picking is delegated to a hidden `<input type="date">` triggered via the HTML5 `showPicker()` API (Chrome 99+, Firefox 101+, Safari 16+, with `el.click()` fallback). Cross-browser, accessibility-correct, keyboard-navigable for free. **Rule:** for any single-date input in HS, prefer hidden-native-input + custom-styled trigger button over a custom popover. The browser does the calendar UI right; you just style the trigger.

### Capsules → rounded rects for inputs that aren't pills.

The first-pass packaging cards used `border-radius: 999` (pill shape) for all the steppers + chips + suggested-style chip. User pushback: "what's the deal with the capsules everywhere." The fix shifted everything to `border-radius: 10` (rounded rects) for stepper inputs + smaller `border-radius: 8` for chips. The only true pills left are the HS design-system pills (`HSButton`, header action menus, calendar date pills). **Rule:** reserve `border-radius: 999` for top-level "this is an action you tap" elements (CTAs, segmented toggles, calendar pills). For inline inputs inside cards, use rounded rects (10–12px radius). Mixed-radius in a single section is fine — the meaning is "actions are round, values are rounded rectangles."

### Synthetic event quirks: `dispatchEvent` for React clicks, but stepper increments need separate ticks.

Two testing quirks worth remembering:
- React's `onClick` doesn't fire reliably from `element.click()` — use `el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))` instead. (Phase 2.3 already documented this.)
- Firing 3 click events in a row on a stepper's `+` button registers as ONE increment, not three. Each click handler closes over the same stale `value`, so all three compute `value + step` independently. Real users have natural timing between clicks; the test method needs the same — `await setTimeout(...)` between increments to let React batches flush.
- Tooltip-display testing via mouseenter is unreliable because the tooltip POSITION is driven by `onMouseMove` on the bar, not by the segment's `onMouseEnter`. To test tooltip content, fire both events (enter on segment + move on bar).

### Quarantine took ~3 minutes — matches the 2.2 mechanical-rename estimate exactly.

`git mv FermentationSection.tsx → OLD_FermentationSection.tsx`, `git mv FermentationStepModal.tsx → OLD_FermentationStepModal.tsx`, rename `function` + `default export` + sibling JSX usage (`<FermentationStepModal` → `<OLD_FermentationStepModal`) + import (`./FermentationStepModal` → `./OLD_FermentationStepModal`) inside `OLD_FermentationSection`, update the 2 classic-aggregator imports (`BetaBuilderPage.tsx` + `brew-session/BrewedVersionModal.tsx`), append an eslint `no-restricted-imports` block. Tsc + lint clean on first pass. **Rule:** the 2.1 retro's claim is real and consistent — budget 5 minutes for quarantine across all remaining slices. If it takes longer, you missed a consumer; grep `grep -rn "<ClassicName" src app` BEFORE renaming.

---

## Phase 2.8 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.8 (Hops + HopPresetModal + CustomHopModal). Read before 2.4 / 2.6 / 2.7.

### The substrate held on a data-richer section than 2.1/2.2/2.3 — visualizer slot earns its real estate when there's a chart worth showing.

The PRD-1 lesson "for sections with a sidebar, the readout cards must either surface a derived cross-section value or host an input that drives downstream calculations" (from the [2.3 packaging-merge retro](#a-sparse-3-row-readout-is-not-enough-to-justify-a-sidebar)) ran in the opposite direction here: the radar IS the cross-section derivation (gram-weighted aggregate flavor across every hop with `flavor` data). It earned the slot trivially because the data is already there — `hopFlavorCalculationService.calculateCombinedFlavor()` was shipped in classic, lifted into the section with zero domain changes, and the brewer sees "what does my hop bill TASTE like" at a glance. **Rule:** the visualizer slot belongs to a chart only when there's a cross-row aggregate worth seeing. For sections where the ledger fully tells the story (Mash temp schedule, Fermentation steps), keep the sidebar a compact readout. For sections where multiple ingredients combine into something new (Hops → flavor profile, Water → ion balance), the chart earns its space.

### Don't roll a fresh radar — port the existing inline `HopFlavorMini` pattern from `HSBrewSheetSection`.

The brewsheet already has a 190px inline SVG radar with the polygon-fill + 9-axis pattern. The new sidebar radar bumps to 240px, adds axis labels in semantic colors (citrus = yellow, pine = green, etc.), and adds cursor-following per-axis tooltips that surface the dominant contributor ("most from Cascade"). The polygon math + ring math + axis spoke math is identical to the brewsheet's `HopFlavorMini`. **Rule for any future section that wants a radar chart:** copy the SVG block from `HSBrewSheetSection.tsx:6849-6979` (the `computeAggregateHopFlavor` + `HopFlavorMini` pair) as the starting point. Don't reach for recharts; the inline SVG is ~80 LOC, no library cost, easier to style.

### `useRecipeCalculations` returns `RecipeCalculations | null` — always nullish-coalesce when reading from it.

The `useRecipeCalculations(currentRecipe)` hook returns `null` when there's no recipe loaded (transitional state during recipe page mount). The `LedgerHeaderRow`'s IBU pill took `ibu: number`, so I wrote `calculations.ibu` and tsc immediately caught "possibly null". Fix: `calculations?.ibu ?? 0`. **Rule for upcoming Phase 2 sections that surface live numbers in their headers (Water cell summary, Yeast pitch info, Equipment derivations):** `useRecipeCalculations(currentRecipe)` is nullable; treat it as `?.someField ?? sensibleDefault` everywhere. The `useRecipeCalculations()` (no arg) form doesn't exist — the hook always takes a recipe argument.

### Multi-value timing cells need a `compact` + `muted` variant of `EditableCell`.

The ledger row's timing cell shapeshifts by usage type:
- **boil** = single primary value ("60 min" at Caveat 30px) — same shape as fermentables' weight cell
- **whirlpool** = two stacked values ("15 min" primary + "80 °C" secondary, smaller + muted)
- **dry hop** = two stacked values ("3 days" primary + "0 day in" secondary, smaller + muted)
- **first wort / mash** = static script text "✦ no timing"

To make this fit in a 130px column without horizontal overflow, the substrate's `EditableCell` gained two new props: `compact` (drops font size from 30→22px, stepper buttons from 16→14px, suffix font 11→10pt) and `muted` (uses `hsTokens.muted` for value text + drops font to 18px). The same component handles all variants. **Rule for upcoming sections with multi-value cells (Equipment "Mash tun: 30L / sphere-bottom" type displays, Yeast pitch rate displays):** extend `EditableCell` with `compact` + `muted` rather than writing a second editable primitive. The two-row "primary big, secondary small" pattern is now established — clone it from `HopSection.tsx`'s `TimingCell`.

### HSActionMenu's hardcoded 28×28 trigger needs override for any non-icon use.

The Phase 2.2 retro flagged this for the "GENERATE ▾" pill (28×28 default crushed text-bearing triggers). For the usage badge — a 44×44 colored square with "BOIL"/"DRY"/etc. text — I overrode via `triggerStyle: { width: 44, height: 44, borderRadius: 10, padding: 0, background: color, ... }`. The override fully replaces the default chrome (no merging trick needed because `triggerMerged` spreads `triggerStyle` last). **Rule reinforced:** if your trigger is anything other than a small ⋯/⋮ icon button, always pass `triggerStyle` with explicit `width`/`height`/`background`. Don't fight the default. Consider promoting `triggerSize="pill" | "icon" | "square"` to the primitive if a third consumer hits this.

### Flat ledger (one row per hop) beats grouped-by-variety even though classic grouped — substrate consistency wins.

Classic `HopSection` grouped hop additions by variety name (`HopVarietyCard` containing multiple `HopAdditionRow`s per variety). The HS rewrite flattens — each addition is its own row, even if 3 Citra additions appear back-to-back. Trade-off: classic surfaced per-variety subtotals (Σg, IBU, g/L) in a footer below each variety group; HS shows them in a single Total row at the bottom. **Net:** the substrate's "one-row-per-thing" shape reads cleaner, scales identically with fermentables/mash/fermentation rows, and removes the cognitive load of "which variety am I editing". The aggregate radar in the sidebar still shows the "what's the recipe doing" view that variety grouping was meant to convey. **Rule:** when classic has a structural grouping that doesn't appear in the substrate, default to flattening. The aggregate visualization in the sidebar can re-surface the grouped insight without imposing it on the ledger.

### Click-to-swap on the variety name + click-to-change-use on the badge are two distinct affordances — the row supports both without modal confusion.

Two click targets on the same row (the name button opens the preset picker in swap mode; the badge opens a HSActionMenu with 5 usage options). They don't conflict because the badge is visually a separate cell (a colored 44px square in the leftmost column) and the name is in the second column with its own hover-underline cue. **Rule:** multiple click targets on a ledger row are fine as long as (a) each lives in its own visual cell, (b) hover state makes each one clear, (c) keyboard focus order is left-to-right reasonable. For Equipment (2.4) and Water (2.7), this lets per-row controls coexist without forcing a row-edit modal for the multi-action case.

### `hopEnrichmentService.getFlavorByName` is the fallback for hops without inline `flavor` data — wire both sources into the radar's flavor map.

Some hop presets have inline `flavor` data; others don't but match an entry in the enrichment service's variety database. The radar consumer needs to consult both: `const flavor = h.flavor ?? hopEnrichmentService.getFlavorByName(h.name)`. Without the enrichment fallback, the radar shows "no flavor data" for any user-saved or imported hop that lacks inline flavor. **Rule for upcoming sections that need preset metadata at runtime:** when adding a preset to a recipe, ALSO try the enrichment service for any optional fields the user might want to consume later. For 2.7 Water, this is the source-water mineral lookup; for 2.6 Yeast, the strain attenuation lookup.

### Five external consumers of `HopFlavorRadar` to update during quarantine — not all hop quarantine is internal.

Fermentables, Mash, and Fermentation each had ~2 classic-aggregator consumers (BetaBuilderPage + BrewedVersionModal). Hops had 5: those 2 PLUS `HopRadarDemo` (learn module), `PublicRecipeView` (sharing module), and `compare/sections/HopComparison` (compare module). All three external consumers are themselves quarantined per Phase 1.2/1.3/1.4 + Phase 4 plans, so they accept the OLD_-prefixed import via the relative-path exemption from the no-restricted-imports glob. **Rule for future quarantine passes:** before renaming, always `grep -rln '\\(<ClassicName\\|from.*ClassicName\\)' src app | head` to map ALL consumers. Don't assume internal-only.

### `no-restricted-imports` glob doesn't match relative paths — the rule is a "stop NEW @/-prefixed imports" guard, not a hermetic seal.

The Phase 2.1/2.2/2.3 retros all noted that the eslint rule pattern `**/modules/beta-builder/presentation/components/OLD_<File>` exempts intra-`beta-builder/` relative imports (`./OLD_<File>`). Phase 2.8 surfaced a second exemption tier: external module relative imports like `'../../beta-builder/presentation/components/OLD_HopFlavorRadar'` also slip past the glob. Two implications:

1. **No `// eslint-disable-next-line no-restricted-imports` needed** on `HopComparison.tsx` / `PublicRecipeView.tsx`'s relative-path imports of `OLD_HopFlavorRadar`. The disable comment would be flagged as unused.
2. **The `@/`-prefixed import in `HopRadarDemo.tsx` DOES need the disable** because absolute paths via the `@/` alias match the glob.

**Rule:** before adding `// eslint-disable-next-line no-restricted-imports` to a quarantined consumer's import, check whether the import is absolute (`@/...`) or relative (`./...` / `../...`). Absolute = need the disable. Relative = the rule already exempts it (silently); no disable. Add a clarifying comment about the relative-path exemption instead of a redundant disable directive.

### Quarantine took ~6 minutes for 6 files — the rename ratio held even at higher file count.

`git mv` for 6 classic files → rename function + default export + interface types + intra-classic-aggregator JSX usage across BetaBuilderPage + BrewedVersionModal + the 3 external module consumers (HopRadarDemo, PublicRecipeView, HopComparison) → eslint rule extension → tsc clean on first pass. **Rule reinforced for the 4-file-or-fewer slices ahead (2.4 Equipment, 2.6 Yeast):** budget 5 minutes; if 6 files take 6 minutes, fewer files should be proportionally faster.

### Stale Turbopack console-buffer errors from prior FermentationSection HMR cycles persist across page navigation.

When verifying the new HopSection rendered correctly, `preview_console_logs` showed several `ReferenceError: DatePill is not defined` and `ReferenceError: brewDate is not defined` errors from FermentationSection's SummaryCard — none of which I touched. The Phase 2.2 retro's rule applies: "if `preview_console_logs` shows errors that reference a component whose CURRENT render is verified clean, trust the render-side assertions over the log buffer." The HopSection's DOM was confirmed correct (h2 = "Hops.", ledger renders, radar renders, modals open/close), so the buffer noise was safely ignored.

### `preview_screenshot` viewport at recipe page is awkward — DOM assertions remain the primary verification.

The recipe builder page has the live numbers strip at top, sticky bottom nav competing for viewport space, and the section content sandwiched between. Even after `scrollIntoView({block: 'start'})`, the screenshot captured just the radar card (zoomed in via OS-level page zoom). DOM-level assertions (section present, h2 text, IBU pill value, action menu items present, radar SVG axis count) gave faster + more reliable verification. **Rule reinforced from 2.2:** for builder-tab slices, lead with `preview_eval` DOM/data assertions; use `preview_screenshot` only when the layout regression is visible, not when verifying the core behaviour.

### `<circle>` with React `onMouseEnter` doesn't trigger `jsx-a11y/no-static-element-interactions`.

The radar's invisible per-axis hover circles fire mouse events but live inside an SVG, which the rule doesn't apply to. Initial cautionary `// eslint-disable-next-line jsx-a11y/no-static-element-interactions` was flagged as unused and removed. **Rule:** SVG children (`<circle>`, `<path>`, `<g>`) bearing interactive props don't need the static-element-interactions disable. The rule scopes to HTML elements (div, span, section, etc.) only.

### Polish iteration retrospective — UX lessons from the follow-up sessions

Captured after an extensive polish pass on the initial 2.8 (Use dropdown clipping, hover previews on row mini-radars + modal presets, multi-series radar with Est/Both/Each toggle, per-row IBU column, animation port from classic OLD_HopFlavorRadar). Four cross-cutting lessons worth carrying into 2.4 / 2.7.

### CSS custom properties don't cascade into `document.body` portals — wrap portal contents in `<div className="hs-theme">` + literal hex fallback.

The HS theme tokens (`--hs-paper`, `--hs-ink`, etc.) are defined on a `.hs-theme` wrapper that lives DEEPER than `document.body`. When `createPortal(jsx, document.body)` mounts a tooltip / menu / preview at the body root, `var(--hs-paper)` resolves to nothing — the portal renders with no background, transparent borders, or default browser styling. Bit both the Use-menu panel (in `UsageBadge`) and the modal preset hover preview (in `HopPresetModal`) in this slice. **Fix pattern (applies to every portal'd HS element):**

```tsx
createPortal(
  <div className="hs-theme" ref={previewRef} style={{
    background: "#f8f3dc",                          // literal hex fallback
    backgroundColor: "var(--hs-paper, #f8f3dc)",    // var with fallback for theme switching
    border: `2px solid ${hsTokens.ink}`,            // hsTokens.* values already resolve via the wrapper
    // ...
  }}>
    {/* content */}
  </div>,
  document.body
)
```

**Rule for any future portal'd HS surface (2.7 Water's source/target modals, Equipment 2.4's profile picker, any custom popover):** always wrap in `.hs-theme` AND use literal-hex fallbacks for the most critical visual properties (background, color, border-color). Without the wrapper, CSS custom properties resolve to `inherit` → `initial` → nothing. The wrapper costs one extra div.

### Cursor-follow tooltip pattern now has 4 consumers — time to promote to a `useCursorFollowTooltip()` hook.

The pattern (position: fixed tooltip + ref-driven transform via mousemove + first-move snap with `void offsetHeight` reflow + velocity rotation + rest-timer to straighten) is now copy-pasted across:

1. Compare page's `BarRow` (Phase 1.3)
2. Fermentables `BillStack` (Phase 2.1)
3. Hops main radar (`HopFlavorRadarCard`) per-axis tooltips (Phase 2.8 initial)
4. Hops modal preset hover preview (Phase 2.8 polish)
5. Hops row mini-radar hover preview (Phase 2.8 polish)

That's 5 inline copies of the same ~80-line pattern. The 2.1 retro flagged "third consumer should promote to a shared hook" — at 5× the technical debt is real. **Rule for 2.7 Water / 2.4 Equipment if they need cursor-follow tooltips:** promote to `src/modules/hopskip/hooks/useCursorFollowTooltip.ts` BEFORE writing the new consumer. Signature roughly:

```ts
const { previewRef, onCursorMove, onCursorLeave } = useCursorFollowTooltip({
  width: 200,           // tooltip width for viewport-edge flip
  halfHeight: 110,      // for vertical clamp
  offsetX: 18,          // distance from cursor on the non-clipped side
});
```

Consumers thread `onCursorMove` into their hover target's `onMouseMove` handler and assign `previewRef` to the portal'd div. The hook handles all 80 lines of math + state internally.

### Bespoke fixed-position menu is the right answer when `HSActionMenu`'s absolute panel gets clipped.

`HSActionMenu`'s panel uses `position: absolute` relative to its trigger's parent. When the trigger lives inside a card with `overflow: hidden` (e.g., the hops ledger with rounded corners + bg fills), the panel gets clipped at the card boundary. Two alternatives:

1. **Switch the card to `overflow: visible`** + add per-element corner-radius compensation (LedgerHead `border-top-*-radius`, last data row `border-bottom-*-radius`). The [2.6 retro](#overflow-visible-on-the-ledger-card-is-the-right-answer-for-in-row-dropdowns--compensate-with-per-element-corner-radii-instead-of-moving-the-dropdown) documents this for the yeast strain Type ▾ menu.
2. **Build a bespoke menu that uses `position: fixed`** + a portal to escape every ancestor's overflow. Used in 2.8 for the hop row's `UsageBadge` because the ledger needed `overflow: hidden` to clip the per-row hover backgrounds against the 14px rounded corners.

The shared `HSActionMenu` primitive stays untouched — other consumers (HSBrowseCard, MashSection's Generate ▾, FermentationSection's Generate ▾) don't have the clipping problem and benefit from the simpler absolute-positioning behavior. **Rule for 2.7 Water (per-row source-water picker) and 2.4 Equipment (per-row profile picker):** if the section's ledger uses `overflow: hidden`, build a bespoke fixed-position menu locally (~80 LOC inside the section file). If `overflow: visible` works (no per-row hover backgrounds, no rounded inner cells), use `HSActionMenu` with the 2.6 corner-compensation pattern.

### Group-fade pattern for SVG entrance animations preserves children's `opacity` attributes.

When animating opacity on individual SVG elements that have their own `opacity="0.35"` / `opacity="0.2"` attributes, `animation-fill-mode: both` overrides the attribute with the keyframe's final value (typically opacity: 1) — elements end up brighter than their intended static state. Implicit `to` keyframes don't reliably inherit the SVG attribute either (browsers interpret missing properties as defaults, not as the element's computed value).

**Fix:** wrap the elements in a single `<g className="hs-foo-grid">` and animate the GROUP's opacity 0 → 1. Each child keeps its own opacity attribute; the compounded value (group_opacity × child_opacity) equals the child's natural opacity once the group reaches 1. Settled state is bit-identical to no-animation. Lost: per-element stagger (all children fade together). Gained: zero static-state regression.

```css
@keyframes hs-foo-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.hs-foo-grid {
  animation: hs-foo-fade-in 500ms ease-out both;
}
```

```tsx
<g className="hs-foo-grid">
  {rings.map((m) => <polygon key={m} opacity={m === 1 ? 0.35 : 0.2} {...} />)}
  {axes.map((k) => <line key={k} opacity={0.25} {...} />)}
</g>
```

**Rule for 2.7 Water's ion-comparison bars or any future SVG visualization with entrance animations:** wrap "grid" elements (rings, axes, reference markers) in a fading `<g>`; animate only that group's opacity. Reserve per-element animations for elements that don't need to preserve a specific static opacity (the series polygons, which animate scale 0.3 → 1.0 and end at full opacity by design). Also remember: `transform-box: fill-box` + `transform-origin: center` are required for scale animations on SVG children to use the child's own center (default is the SVG root).

## Phase 2.6 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.6 (Yeast + YeastPresetModal + CustomYeastModal). Read before 2.4 / 2.7.

### Substrate fidelity is more than the section frame — it's the LedgerHead + LedgerRow + LedgerTotal pattern + the BlockEyebrow header + the readout sidebar shape + the full BrewersNotesCard + the SectionStyles `<style>` block + the EditableCell with `onCommit + onNudge` separated + IconBtn + HoverSteppers + MobileAddRow + dashedBorderBg.

The first cut of YeastSection (1,894 LOC) had the right outer frame, the right section title, and a generally cohesive look — but it had skipped the **LedgerHead / LedgerRow / LedgerTotal** pattern with `LEDGER_COLS` in favor of looser stacked cards, used a simplified EditableCell where `onCommit` and `onNudge` were merged via internal state (instead of the substrate's pattern where the section owns the nudge logic and clamping), and used a thinner BrewersNotesCard that lacked the placeholder ghost text + tag-editing affordances of the substrate. User rejected the first cut.

The rewrite re-traced the full Mash + Fermentation patterns line-by-line and replaced every primitive with the established substrate version. Final file: ~1,800 LOC matching MashSection's scale (1,805 LOC). **Rule for any future Phase 2 slice — and especially Equipment 2.4 which feels like "a different shape":** before writing a single line, open MashSection.tsx and FermentationSection.tsx side-by-side and identify every named primitive (`Eyebrow`, `BlockEyebrow`, `BlockHeaderActions`, `LedgerHead`, `LedgerRow`, `LedgerTotal`, `EditableCell`, `HoverSteppers`, `StepperBtn`, `IconBtn`, `MobileAddRow`, `dashedBorderBg`, `BrewersNotesCard`, the readout card, the SectionStyles block). The new section MUST use every one of these primitives — copy verbatim and rename the CSS class prefix (`hs-mash-*` → `hs-<section>-*`). Don't write your own variants. The substrate's value is consistency; a single bespoke primitive in your slice breaks the system. If you find a primitive truly doesn't fit the section, escalate to the user before deviating.

### The substrate scales *downward* to single-row "lists" — don't reach for a different template.

Going in, the worry was that the substrate (which assumes a multi-row ledger) wouldn't fit a section whose entire ledger is one row. The answer turned out to be: keep the substrate, lean on the ledger header for context-rich controls (Attenuation pill, Swap, Clear), and use the main column's vertical stack for the section's *other* content (Source fields card, Starter steps mini-ledger). The sidebar slot — which on multi-row sections shows an aggregate visualization — works equally well as a *result* visualization on a single-row section (here the pitch dashboard combines the one strain + the source inputs + the starter steps into Available/Required/Diff). **Rule for Equipment 2.4 and any other "feels different" section:** before designing a new template, ask whether the substrate's three roles (ledger header / row table / sidebar visualizer) can absorb the section's content with a single-row table + a sidebar that surfaces a *derivation* instead of an aggregate. If yes, clone the substrate. If no, document precisely what doesn't fit before reaching for a new pattern.

### Nested mini-ledgers (starter steps inside StarterStepsCard) compose with the outer ledger without competing for layout space.

The starter-steps mini-ledger is a 5-column grid (`32px | 1fr | 1fr | 1fr | 32px` — index / size / gravity / DME / remove) inside a paper-bg card that lives in the main column's vertical stack. It uses the same `EditableCell` primitive as the outer substrate (compact variant) but with its own muted-border row shells (`1.5px solid var(--hs-ink)22`) instead of the substrate's display-font totals row — because a "starter step" is structurally different from "an ingredient" (it's a process step, not a quantity-of-thing). **Rule:** mini-ledgers inside section cards are fine when (a) the rows represent *process steps* rather than *thing entries*, (b) the row shell uses muted borders to read as "sub-content" relative to the outer card's 2px ink border, (c) the row controls use the established `EditableCell` primitive so editing affordances stay consistent across the section. Don't roll a fresh editable primitive for the nested case.

### Inline `<img>` tags for vendor favicons don't need the `@next/next/no-img-element` disable — the rule isn't loaded in this config.

Initial impulse was to defensively add `// eslint-disable-next-line @next/next/no-img-element` above the lab-favicon `<img>` (porting from classic's `YeastLabBadge` which uses `<img>` too). Lint flagged the disable as "rule not found" — the Next.js core-web-vitals plugin isn't included in this project's `eslint.config.js`. **Rule:** before adding a Next.js-specific eslint-disable, check whether the rule is actually configured (`grep -n "no-img-element" eslint.config.js`). If absent, the disable is dead code that the linter flags as unused. The classic `YeastLabBadge` uses bare `<img>` without a disable, which is the established pattern. Same applies to other Next.js plugins (`@next/next/no-html-link-for-pages`, etc.) — verify the plugin is loaded before disabling its rules.

### `useRecipeStore` selector-pattern reads scale cleanly to 5 selectors per section.

Previous sections varied between destructured `useRecipeStore()` and per-selector `useRecipeStore((s) => s.x)`. The 2.6 section uses 5 separate selectors (`currentRecipe`, `addYeast`, `updateYeast`, `removeYeast`, `updateRecipe`) — each one runs Zustand's referential-equality check independently, so a write to `currentRecipe.fermentables` (unrelated to yeast) doesn't re-render YeastSection. **Rule reinforced from prior sections:** prefer per-selector reads over destructured ones. The verbosity (5 lines vs. 1) is worth the render-scoping win. The same pattern works in `usePresetStore`.

### `starterCalculationService.calculateStarter` reuses verbatim — no service changes, no domain changes.

The pure-class calculation service in `src/modules/beta-builder/domain/services/StarterCalculationService.ts` was ported intact. It takes `(batchVolumeL, og, yeastType, packs, mfgDate, slurryLiters, slurryBillionPerMl, steps)` and returns `{ requiredCellsB, cellsAvailableB, stepResults, finalEndB, totalDmeG, totalStarterL }` — every field the new section needs. No new method signatures, no new edge cases. **Rule reinforced from the [2.2 scoping rule](#mashscheduleservice--userecipecalculations--recipestore-reused-exactly--zero-domain-changes):** the domain layer is shared infrastructure; sections rebind into it via `useMemo` on the inputs that matter for that section's display, but the service itself stays untouched. If a Phase 2 section *requires* a domain change to render, that's a red flag — investigate whether the section is doing computation it shouldn't be (and whether the computation belongs in the section's `useMemo` instead).

### The empty-state message can carry context-sensitive prose without growing the layout.

`StarterStepsCard`'s empty state shows one of two messages depending on `underpitched`: *"You're short on cells — add a starter step to grow your pitch."* vs. *"Your pitch covers the cells you need. Add a starter only if you want a margin or you're using older yeast."* Both fit in the same paragraph slot; the difference is one boolean conditional in JSX. **Rule:** empty-state copy is a high-value place to surface *why* (the dashboard says "you're short" — the empty state says "...so do X"). If the section has a derived state that determines whether the empty state's CTA is *needed* or just *optional*, branch the copy. Don't make the brewer mentally combine the dashboard + the empty state to figure out what to do.

### A single empty-state isn't enough when the derived state has meaningfully different prominence levels — split into prominent + subtle prompts.

The post-initial iteration expanded the lesson above: a *boolean conditional in JSX* (same paragraph slot, two messages) under-communicates when the brewer's response should also differ in *visual weight*. The shipped pattern uses **three** distinct states for the starter block, each with its own component:

1. **Steps exist** → full block with BlockEyebrow + ledger + meta (the brewer has already invested; show them what they built).
2. **No steps + underpitched** → `StarterPromptProminent` — full BlockEyebrow with honey accent + dashed-border card + script note + concrete deficit quote + colored HSButton. The card takes ~150px of vertical space; the brewer can't miss it.
3. **No steps + adequate pitch** → `StarterPromptSubtle` — single-line muted script + tiny dotted-underline button. ~30px tall, sits inline. The brewer who doesn't need a starter doesn't have to think about it.

**Rule for any section with an "optional but sometimes important" subsection:** pick three states, not two. Steps-exist is non-negotiable. The other two diverge based on the derived data, and the visual weight should match the urgency. A single conditional-text empty state is the right answer ONLY when the action is equally optional regardless of state — once urgency varies, the layout has to vary too.

### Use the friendlier accent (honey / yeast-peach) for "you should do this" prompts, not the alarm accent (roast).

The first cut of `StarterPromptProminent` used roast (deep red) for the eyebrow, border, script, and button — the same accent the section uses for destructive actions and error states. User feedback was that it read as "your recipe is broken" rather than "here's a helpful nudge". The fix swapped to honey (eyebrow + border + card bg tint) + yeast-peach (script + button) — both warm, neither alarming. The deficit number is still surfaced concretely (`"47 B cells shy"` script meta), so the brewer knows the size of the gap, but the framing reads as a suggestion. **Rule:** reserve roast for *actual* problems (validation errors, destructive confirmations, "this will overwrite X" warnings). For "you could improve this" / "this is suboptimal but functional" / "we suggest doing Y" prompts, use honey + yeast-peach. The brewer's emotional state on first read is what determines whether they engage or close the tab.

### `MobileAddRow` is the structural last child of every ledger — `:last-child` selectors target IT, not the last data row.

The strain ledger uses `overflow: visible` (so the per-row `Type ▾` HSActionMenu can extend below the card without being clipped). With `overflow: visible`, the row's `hover` background fills the row's rectangular bounds — but the *ledger's* outer border has a 14px corner radius. Hovering the last data row exposed a "square corner inside a rounded frame" artifact. The intended fix was a CSS rule: round the last row's bottom corners to match the ledger's outline. The bug: `> .hs-yeast-data-row:last-child` never matched, because `MobileAddRow` (a `<button>`, `display:none` on desktop) is the structural last child. **Fix:** use `:last-of-type`. Because `MobileAddRow` is a `<button>` and data rows are `<div>`s, `:last-of-type` correctly identifies the last `<div>` data row regardless of the trailing button. **Rule:** whenever a ledger has a hidden mobile-only `MobileAddRow` AND uses `overflow: visible`, the last-row corner-rounding selector must use `:last-of-type` (or `:nth-last-child(2)` if there are mixed element types). Applies to any future section that puts in-row HSActionMenu dropdowns inside the ledger (Equipment 2.4's profile picker, Water 2.7's source-water picker if they end up in-row).

### `overflow: visible` on the ledger card is the right answer for in-row dropdowns — compensate with per-element corner radii instead of moving the dropdown.

The fix above is half of the pattern; the other half is the corner-radius compensation. With `overflow: visible`, the ledger's `borderRadius: 14` only applies to the 2px ink border outline — the cream-bg `LedgerHead` and the hover-bg `LedgerRow` would otherwise have square corners that bleed past the rounded outline. Fix: add explicit `border-top-left-radius: 12 / border-top-right-radius: 12` on the LedgerHead inline style, and the `:last-of-type` rule above for the bottom-row hover. The 12px (vs the parent's 14px) accounts for the 2px border thickness. **Rule:** if any in-row child needs to escape the ledger's overflow (dropdown menus, popovers, hover tooltips that extend below the row), switch to `overflow: visible` AND add the head's `border-top-*-radius` + the last data row's `border-bottom-*-radius` rules. Don't try to portal the dropdown — the per-element radius approach is simpler and doesn't break the substrate's structural conventions.

### `DatePill` pattern: hidden `<input type="date">` triggered via `showPicker()` is the canonical date-affordance — never use an inline-expanding date input in a row cell.

The first cut of `MfgDatePicker` rendered an inline `<input type="date">` directly in the strain row — clicking it caused the row to *grow taller* because the native date input rendered as a 32px-tall block element, taking its own row of vertical space. User flagged this immediately. The fix: clone `FermentationSection`'s `DatePill` pattern verbatim. A visible styled pill (filled `paper` when set, dashed `cream` when empty) is the affordance; a 1×1px `position: absolute; opacity: 0` `<input type="date">` is mounted but invisible; clicking the pill calls `inputRef.current?.showPicker?.()` (with `el.click()` fallback) so the OS calendar pops up *over* the row instead of expanding inline. **Rule:** any time a row needs a date input, use the `DatePill` pattern. Never put `<input type="date">` directly in a row cell — it'll always expand the row's height. The same pattern works for any native input that has a built-in OS picker (`time`, `color`, etc.) — render a styled trigger + a hidden native input + `showPicker()`.

### Per-row computed column with edge-to-edge tint (the IBU stripe) reads as "the section's read-only result column" — use it for any derived value worth surfacing per-row.

The starter ledger's DME column ports the per-hop IBU pattern from HopSection verbatim: `background: color-mix(in srgb, var(--hs-ink) 5%, var(--hs-paper))` + `padding: 14px 12px` + `margin: -14px 0` so the tint bleeds to the row's vertical edges + `alignSelf: stretch` so the cell fills the full row height. The visual effect is a faint vertical column stripe running through the entire ledger, marking the "computed" column distinct from the editable cells. Originally the DME totals lived in a `LedgerTotal` row at the bottom of the ledger; the user flagged that as visually busy and asked for per-row treatment "like IBU". Moving the value into the row killed the totals row (folded total DME into the BlockEyebrow meta string instead). **Rule for any section with a per-row derived value:** show it inline with the editable cells, use the ink-tinted stripe to mark it read-only, and fold the aggregate into the section header/meta rather than a separate totals row. Applies to Water 2.7 (per-salt residual ppm contribution), Equipment 2.4 (per-vessel deadspace as a percentage), and any future computed column.

### Header alignment over a flex-end body cluster: mirror the body's flex layout with invisible spacers for the trailing items.

The Source column has its header label `"Source"` in the LedgerHead and its body cluster `[Type ▾] [Packs] [Mfg date]` in each data row. The body uses `justifyContent: flex-end` (cluster pushed against the actions column to open a visual gap from atten). The user wanted the SOURCE header positioned *above the leftmost item of the cluster* (the Type chip), not at the column's left edge nor right-aligned with the column's right edge. **Fix:** render the header inside a `display: flex; justifyContent: flex-end; gap: 8` wrapper with the `"Source"` label PLUS two invisible spacers matching the widths of the Packs cell (80px) and Mfg date pill (95px). Because both header and body use `flex-end + gap`, the SOURCE label lands at the same X-coordinate as the Type chip below it. The label also gets `minWidth: 116; textAlign: center` to match the Type chip's width and center alignment, so the label's *center* aligns with the chip's *center* (not just its right edge). **Rule:** when a column header needs to track a flex-end-aligned body cluster, mirror the cluster's layout in the header — same flex direction, same gap, same invisible spacers, same item widths. CSS grid columns alone won't position the header relative to the body's content; you need the body's flex structure to repeat in the header.

### Two-group row layout: `auto` strain col + `1fr` source col + `flex-end` source cluster opens a visual gap that signals "different group".

The strain row pre-iteration evenly distributed [identity | atten | source | actions] across the row, so the eye read it as four equally-weighted cells. User feedback: atten reads as part of the *yeast identity* group (lab + strain + atten), and Type/Packs/Mfg read as the *pitch source* group — they shouldn't sit next to each other. **Fix:**

1. Strain col = `minmax(140px, auto)` — sizes to content only.
2. Atten col = `72px` narrow + `justifyContent: flex-start` so the value sits flush against the strain col on the right (visually grouped).
3. Source col = `minmax(330px, 1fr)` — absorbs all remaining horizontal slack (since the strain col is `auto`).
4. Source cluster inside uses `justifyContent: flex-end` — items push against the actions col on the right.

Result: a horizontal whitespace gap opens between atten (left) and source (right). The brewer reads the row as two distinct visual groups without any explicit divider — just the gap. **Rule:** when a row's columns split into two semantic groups, use `auto`/fixed widths on the left-group columns + a single `1fr` source col + `flex-end` cluster on the right group. The fr-column absorbs slack so there's always a gap. Don't try to use spacer columns or explicit gap-only divs — the asymmetric flex/grid sizing carries the grouping signal naturally.

### Quick-pick generators must use *real* strains (US-05, 34/70, Voss), not invented style labels.

The first-cut empty state had 5 invented "style" labels — *"American Ale"*, *"Hazy IPA Blend"*, *"German Lager"*, etc. — pointing at preset entries with brand-agnostic names. User flagged that as "making up yeasts that don't exist". Reduced to 3 quick-picks that map to *real, widely-stocked dry strains*: SafAle US-05 (Fermentis), SafLager 34/70 (Fermentis), LalBrew Voss Kveik (Lallemand). The pattern label + sub-caption now read as concrete picks the brewer can recognize from a homebrew shop. **Rule for any quick-pick / generator empty state in a section that maps to real-world inventory:** use the actual product names, not category-style labels. The 3-card grid is enough; brewers who want anything else use the "Or browse the full library" CTA. Applies to Water 2.7 (use real water profile names like "Burton-on-Trent" / "Pilsen" / "Dublin" / "Munich", not "Hard mineral water"), Equipment 2.4 (real popular vessel SKUs like "Anvil Foundry 6.5gal" / "Brewzilla 35L" / "10gal cooler MLT", not abstract "Single Tier" / "Three Vessel").

### When two affordances duplicate each other (Generate ▾ in header + Pick strain button), drop the redundant one.

The first-cut strain block had both a `Generate ▾` HSActionMenu (5 quick-pick presets) AND a `+ Pick strain` HSButton in the BlockEyebrow's `right` slot. Both opened-or-replaced the active strain. With the empty state already surfacing the 3 quick-picks + "Or browse the full library", the Generate ▾ menu in the populated state was just *a different way to do the same thing*. Removed the menu; kept the button. **Rule:** in any section header with multiple action affordances, audit for duplicates. If the empty state surfaces option A and the populated state offers both option A (via the same menu) and option B (a button that does the same thing), drop one. The substrate's `BlockHeaderActions` slot should never hold two competing affordances for the same action.

### Iterative UX is the rule, not the exception, on substrate-faithful sections. Budget for 2-4 user-feedback rounds *after* the initial substrate match.

Phase 2.6 shipped a substrate-faithful first cut, then went through ~10 rounds of iterative user feedback addressing: row column structure (2 rounds — group reorganization), source cluster alignment (3 rounds — wrapping, anchoring, header positioning), starter prompt prominence (2 rounds — palette + 3-state vs 2-state), per-row totals vs aggregate (1 round — drop Σ row, surface in meta + per-row stripe), and small polish (DatePill, header copy, hover rounded corners). The total iteration LOC was comparable to the initial substrate clone, but the conceptual work was almost entirely about *visual grouping* and *information hierarchy* — not about substrate primitives. **Rule for Equipment 2.4 and Water 2.7:** ship the substrate-faithful v1, then explicitly invite user feedback on group reorganization + visual hierarchy *before* polishing details. The substrate gets you to "structurally correct"; only user feedback gets you to "reads correctly at a glance".

### Card-internal accent stripes (`borderLeft: 6px solid <accent>`) compose with the outer 2px ink border without visual conflict.

The StrainCard uses a 6px yeast-peach left border on top of the standard 2px ink border on the other three sides. Reads as "this is the strain's card, accent applied" without competing with the section frame's outer 2px ink border. **Rule for Phase 2.4 Equipment and 2.7 Water** (both sections will have multiple sub-cards in the main column): use accent strips on internal cards to color-code sub-content (mash tun / kettle / fermenter for Equipment; source water / target / salts for Water). The accent goes on the *left* edge — top/bottom/right edges stay 2px ink so the cards still read as "sub-content of the section". This is the same pattern Phase 0's `[data-accent]` classic CSS uses for top-of-section indicators, ported to internal cards.

### Quarantine took ~5 minutes for 3 files + 2 consumer updates — the rename ratio holds at the smaller file count too.

`git mv` for 3 classic files → rename function + interface types + intra-classic-aggregator JSX usage across BetaBuilderPage + BrewedVersionModal → eslint rule extension → tsc + lint clean on first pass. The [2.8 retro lesson](#quarantine-took-6-minutes-for-6-files--the-rename-ratio-held-even-at-higher-file-count) said "budget 5 minutes for 4-file-or-fewer slices" — 2.6 lands at ~5 minutes for 3 files, validating the budget. **Rule reinforced:** the quarantine choreography is rote at this point. If a slice's quarantine takes >10 minutes, something is wrong (unmapped external consumer, missed interface type rename, classic-aggregator that's actually live).

### `presetStore.yeastPresetsGrouped` matches `fermentablePresetsGrouped` shape exactly — the picker modal pattern ports verbatim.

The store returns `Array<{ label: YeastCategory; items: YeastPreset[] }>` — same `{label, items}` shape as fermentables and hops. The picker modal (search field + filter chips + grouped rows + sticky group headers + "+ Create custom" footer) ported directly from `FermentablePresetModal` with only the per-item content changed (lab favicon badge + name + attenuation % instead of SRM dot + name + °L/PPG). **Rule for 2.4 Equipment and 2.7 Water:** if the section needs a preset picker and the store's getter returns `{label, items}[]`, clone `FermentablePresetModal` as the starting point. Differences will be in the filter chip set (Type/Color/Origin → section-specific filters) and the row renderer (per-preset metadata). Don't roll a new picker primitive — the shape is locked in across 3 sections now.

---

## Phase 2.7 retrospective — lessons for subsequent slices

Real notes captured while executing Phase 2.7 (Water + 6 modals + cross-section identity pass). The water section is the only Phase 2 slice that *doesn't* have a per-row ledger as its central primitive, so a lot of the lessons here are about how the substrate adapts to "blocks + visualizer" sections — and the design-pass tinting work ended up being applied retroactively to every other 2.x section, so this retro is also the canonical reference for the section-identity system.

### Non-ledger sections still wear the substrate frame — just compose different blocks underneath.

Phases 2.1/2.2/2.3/2.6/2.8 all converged on `[LedgerHead + N data rows + LedgerTotal]` as the section's central primitive. Water doesn't have N homogeneous rows; it has FIVE heterogeneous blocks (water plan / salt cells / pH card / other ingredients / ion visualizer). The substrate accepts this: `sectionFrameStyle` (2px ink frame + paper bg + sh3) + `SectionTitle` (script kicker + display H2 + 2px accent rule) + a custom internal layout. The grid template ends up being `"plan ." / "main aside"` — water plan header constrained to the left column (so its hairline doesn't extend over the aside), then a 2-col body with a flex-column "main" stacking the left blocks and a flex-column "aside" stacking the right blocks. **Rule for future heterogeneous-content sections:** keep the section frame + SectionTitle; inside, build whatever the section needs as a flex/grid composition. The substrate is the FRAME, not the internal pattern.

### Don't let a tall aside dictate left-column row heights — wrap the left column in its own flex container.

First-pass attempts at the 2-row grid (`"source ." / "salts aside" / "ph aside" / "other aside"`) put each left-column block in its own grid row, with aside spanning all three. Because the aside (ion visualizer ~466px + notes card) was taller than salts/pH/other combined, the grid distributed the extra ~205px evenly across the three left rows — creating huge empty gaps below each block even though `row-gap: 10px` was set. The fix: collapse salts/pH/other into a SINGLE grid cell (`"main aside"`), with that cell being a flex-column owning its own internal gap. Now the left column's row heights are determined by content only; the aside can be as tall as it likes without distorting the left. **Rule for any 2-col layout where one column is taller than the other AND multiple stacked items live in the shorter column:** wrap those items in a single grid cell with `display: flex; flex-direction: column; gap: X` rather than putting each in its own grid row. Otherwise the spanned tall column will redistribute its excess height across the shorter column's rows.

### Section header convention: eyebrow LEFT, flex-1 hairline, controls RIGHT — including the action button.

Section headers across all 2.x sections (HopSection's `LedgerHeaderRow`, Fermentables, etc.) follow the same pattern: eyebrow on the left, a `flex: 1` ink-hairline filling the middle, meta + readouts + action button(s) on the right. The Water plan header initially put source/target pills in the middle and `Auto-Calc` on the far right with `marginLeft: auto` on the inner cluster — which silently consumed the hairline's flex-grow space (a margin-auto sibling beats flex-grow in the box model). Visible symptom: the hairline disappeared. **Rule:** when arranging items in a `flex; gap` row that includes a `flex: 1` hairline, do NOT also apply `marginLeft: auto` to a sibling — pick one or the other. The hairline approach is right when you want a continuous decorative rule between eyebrow and controls; the margin-auto approach is right when you don't.

### When a button is configured by an adjacent control, pull the control INTO the button as a compound.

The Auto-Calc button has an `includeBakingSoda` boolean toggle. The first cut put a separate checkbox above/beside the button; the user requested they live inside the button itself ("inside the AutoCalc button, there can be a checkbox for NaHCO₃"). The shipped `AutoCalcCompoundButton` is an `inline-flex` ink pill containing two visually-distinct halves separated by a cream-25%-opaque divider: `[☑ NaHCO₃ | Auto-Calc]`. The left half is a `<label>` wrapping `<input type="checkbox">`; the right half is a `<button onClick={onAutoCalculate}>`. Both halves stop click propagation correctly because they're separate elements. **Rule:** when a primary action has a single boolean modifier that lives *only with that action*, embed the modifier as a left-half compound rather than scattering it nearby. Single visual pill, two distinct interactions. Nested `<button>` is invalid HTML — use a wrapper div with two sibling interactive elements.

### Iterative UX iteration count: 8+ rounds on the ion visualizer alone.

The visualizer went through (in order): square target chip → outline-only square → square swapped with line (target=line, current=square) → revert (line is target, current is capsule fill end) → shared scale → gamma-curved scale → hard-cap per ion → debounced domain (grow-on-edge / shrink-on-slack) → fix post-drag shrink → tint hatch with proximity color → add Cl:SO₄ caption to header → final-profile inline readout simplification. **Rule reinforced from [2.6 retro](#iterative-ux-is-the-rule-not-the-exception-on-substrate-faithful-sections-budget-for-2-4-user-feedback-rounds-after-the-initial-substrate-match):** budget 6–10 user-feedback rounds for visualizer-centric sections. The first design is never the last. Each round is small (5–20 minutes of edits + an inspection), so the total cost is reasonable, but the *number* of rounds is much higher than the substrate-faithful row sections.

### Debounced domain math: grow on right-edge, shrink-on-slack with delay, AND the drag-end transition must be in the effect deps.

Final shape of the domain effect (after 3 corrections):

```js
useEffect(() => {
  if (isDragging) { /* only grow if marker at edge */ return; }
  if (ideal > domain * GROW_TRIGGER) { setDomain(ideal); return; }
  if (ideal < domain * SHRINK_TRIGGER) { schedule shrink after delay; }
}, [ideal, peak, domain, isDragging]);
```

The two bugs that surfaced: (1) shrink-during-drag is disorienting (mid-drag re-scale moves the marker under the user's cursor); fix is `if (isDragging) return` early. (2) The shrink schedule is set up inside the effect, but the effect only re-runs when its deps change. After a drag ends, `peak` may not have changed (the last pointermove already updated state to the final value), so the effect doesn't re-run, and the shrink never schedules. Fix: include `isDragging` in the dep array — the `true → false` transition forces a re-run, which then schedules the shrink. **Rule for any debounced-resize chart with drag interaction:** include the drag-state boolean in the effect's deps even if you reference it only via early-return — the boolean's transition is what triggers the post-drag work.

### Visual semantics: TARGET = line, CURRENT = capsule fill. Source = empty ring marker. Don't make any of them the same shape.

The mental model the user landed on after 5 rounds: target is a *destination*, so it's a thin draggable line — affords "you can move me". Current is a *journey* — the colored capsule fill that grows from source toward final, ending at the current value. Source is *where you started* — a small empty ring marker (paper interior, ink outline) sitting on the bar. Each shape is unambiguous and they never confuse each other. **Rule for any range-with-target visualizer (future use cases: pH, OG, ABV ranges?):** target → thin line, current → growing fill end, prior state → empty ring. Don't use a square chip for both target and current — they collide visually.

### HSStatCard pattern (design system §05.4) is the right frame for any "small dense value card" — including salt cells.

The salt cells initially used `1.5px subtle border` + no shadow + conditional cream/paper bg. Per the design system reference HTML the user attached, the HSStatCard pattern is: **2px ink border + sh1 hard offset shadow + 12px radius + 5px ingredient-color accent strip at the top + paper background**. Salts adopted this pattern — five cells in a horizontal flex row, each with a 4px water-blue accent strip (because salts ARE water-chemistry adjusters), `[− input +]` horizontal flank stepper layout, and a faded variant when `totalAmount = 0` (cream2 bg + 35%-opacity ink border + no shadow + 0.7 opacity + accent strip at 0.18). **Rule:** when a section displays a horizontal row of dense numeric cells (salt grams, future use cases: mash-tun volumes, batch volumes, calculator inputs?), use the HSStatCard shape. The accent strip carries the section identity; the framed card gives weight without being heavy. Empty/inactive variants fade EVERY dimension (bg, border, shadow, opacity, accent) — a half-faded card reads as "still active but quiet"; a fully-faded card reads as "available but unused".

### Cross-ion ratio comparison requires a SHARED scale across bars — but a linear shared scale crushes small-magnitude ions.

The user explicitly asked for cross-ion comparison ("Ca 75 and Cl 75 should look the same"). Per-row dynamic scale doesn't deliver this: same-value targets land at different visual X positions because each bar's domain is sized to its own content. A linear shared scale (single domainMax for all 6 ions) DOES deliver this — but Mg (target 15 ppm) on a 600 ppm scale fills only 2.5% of the bar, which is functionally invisible. The compromise: shared scale + **gamma curve** of 0.6 applied to value → position mapping. Effect: Mg target 15 occupies 33% of bar width (not 2.5%), Cl/SO₄/Ca target 75 all occupy 87% (same position!), HCO₃ target 49 falls at 67%. Math: `posPct = (value / domain) ^ 0.6`. The inverse for drag interaction: `ppm = pct ^ (1/0.6) * domain`. **Rule for cross-element comparison charts where element magnitudes vary by >5×:** linear shared scale crushes the small ones; per-element scale loses cross-element semantics; **gamma curve (0.5–0.7) on the shared scale** is the compromise that gives BOTH cross-element comparison AND visibility of small values. Document the inverse mapping next to the forward mapping or future drag-interaction code will be hard to derive.

### Per-element hard caps prevent UI from drifting into brewing-nonsense values.

Each ion has a different brewing-realistic maximum (Ca 400 / Mg 100 / Na 300 / Cl 500 / SO₄ 600 / HCO₃ 500 ppm). Without caps, drag could push the value arbitrarily high and the domain would grow to fit — leading to a Mg target of 800 ppm (which is meaningless chemistry). The visualizer enforces caps in THREE places: (1) drag input clamps via `Math.min(hardMax, computed)`, (2) keyboard arrow nudges clamp at `hardMax`, (3) domain growth is clipped at `hardMax`. The slider's `aria-valuemax` reports the hard cap to screen readers. **Rule for any user-driven numeric control with domain-specific sane bounds:** clamp at the UI layer, not just the data layer. The user shouldn't be able to drag a bar into a chemistry-nonsense state and then have to manually back off.

### Routing "add baking soda" to the NaHCO₃ salt cell — NOT to a new "Baking soda" ingredient — is correct (same chemistry, different framing).

The pH adjustments card's "+4.8 g baking soda" CTA initially added "Baking soda" as a separate `OtherIngredient` (water-agent category, timing=mash, unit=g). User pointed out that baking soda IS NaHCO₃ — the same substance as the existing NaHCO₃ salt cell. Routing the CTA to `waterChemistry.saltAdditions.nahco3_g` instead of `addOtherIngredient` consolidates the data, lets the salt cell reflect the addition, and avoids creating a second source-of-truth for the same substance. Lactic acid stays in OtherIngredients (it's not a salt; it's an acid, with no corresponding salt cell). **Rule:** when a derived suggestion (auto-calc, pH adjustment, ferment temp ramp) wants to mutate something the user already has a primary control for, route the suggestion INTO the primary control. Don't create a parallel/shadow representation of the same substance in a different data structure — even if it's slightly more code to wire the route. The data model should have one place per concept.

### Section-identity tinting: a multi-touchpoint compound at very low intensities (3–5%) beats any single channel at high intensity.

The user's request was "each section visually distinct while remaining in harmony". The first attempt was a single 5% accent tint on the sidebar visualizer card's background — read as too uniform across sections. The shipped pattern layers the section accent across SIX touchpoints, each at very low intensity:

| Touchpoint | Recipe |
|------------|--------|
| Sidebar viz card **background** | `cream/cream-2` base + **5%** accent |
| Sidebar viz card **border** | ink + **15%** accent (border is the strongest signal — small accent here is loud) |
| **Ledger head** band | `cream` + **4%** accent |
| **Total** band | `cream-2` + **4%** accent |
| **Row hover** | `paper`/`cream-2` 20/80 base + **2%** accent (half intensity of head/total so it doesn't collide) |
| **IBU / DME stripe** (read-only result column) | `ink + paper/cream-2` 5–9% base + **4%** accent |

Brewers Notes card stays honey-tinted at 80/20 across all sections — that card is the "warm/handwritten" companion to the framed visualizer next to it, intentionally NOT tagged with the section's accent because its identity is the brewer's-voice motif, not the section.

**Rule for cross-section visual identity:** a single high-intensity tint feels like a paint job. A multi-touchpoint very-low-intensity compound feels like the section is itself made of its ingredient. Pick 5–7 surfaces in the section that the eye lands on naturally (frame, headers, totals, hover, accent strips on cards) and apply 2–5% of the accent to each. The cumulative effect is unmistakable; no single touchpoint is loud enough to feel decorative.

### Color hierarchy for proximity status: pull from the HS palette directly, don't synthesize mid-hues.

The ion bars initially used HSL hue interpolation: `hue 145 (green) → hue 250 (blue)` for low, `hue 145 (green) → hue 25 (orange-red)` for high. The user pointed out that "high" rendered as muddy orange-brown (hue 25 with 60/45 saturation/lightness), not the punchy red they expected. The fix: replace the interpolation with discrete tokens. Ideal (within ±10% of target) = `hsTokens.hops` (#4a8a3d). Low (<90%) = `hsTokens.water` (#2b6fb8). High (>110%) = `hsTokens.roast` (#d4452c). Three discrete colors, sourced from the design system, no synthesis. **Rule:** when a chart needs to signal "good/low/high" or any other small-finite-state status, use the HS palette tokens directly. HSL interpolation between two tokens produces colors that aren't IN the design system — they read as muddy or off. Per the design system §001: "Don't introduce new accent colors. If you need another dimension of meaning, use shape — not a new hue." Discrete tokens are also accessibility-friendlier (each color has known WCAG contrast against cream/paper backgrounds).

### Hover tint must be visually distinct from header/footer tint OR the table flattens.

When all three (head, total, hover) used 4% accent intensity, hovering a row produced a band visually identical to the head/total bands above and below — flattening the table's vertical structure. The fix: cut hover intensity in half (2%) AND lighten the base (paper/cream-2 20/80 instead of cream-2 alone). Hover now reads as "a row that lifts toward the section accent" rather than "a row that's pretending to be the head". **Rule:** the head/footer bands are PROMINENT (they frame the data); the hover is TRANSIENT (it indicates "this row is interactive"). They should have visually different weights even if they share an accent color. The simplest knob is intensity (head/total 4%, hover 2%); the secondary knob is the base color (head: cream, total: cream-2, hover: lighter blend). Don't share the exact same `color-mix` recipe across both kinds of band.

### Salt cell hover steppers: always-visible horizontal `[− input +]` flank beats hover-revealed vertical chevrons.

First cut: hover-revealed vertical up/down chevrons positioned absolutely on the right edge of each salt cell. Felt like an Easter egg — brewers had to discover the steppers existed. Replaced with always-visible `[− input +]` horizontal flank inspired by the classic SaltAdditionsPanel's `starter-stepper` pattern. Minus on the left (with auto-disable when `totalAmount ≤ 0`), `+` on the right, the input claims `flex: 1` between them. Each button: 22×22, 1.5px ink border, paper bg → water-blue on hover. **Rule for inline steppers on a numeric input in a dense card:** flank the input horizontally with always-visible buttons. Hover-revealed steppers belong in larger ledger rows where the row itself has multiple affordances; on a small standalone card the stepper IS the primary affordance and should be visible at rest. Use literal `−` / `+` text glyphs (in body font, weight 700) — not chevrons. The math symbols read as a stepper instantly; chevrons read as "this expands a dropdown".

### Quarantine took ~12 minutes for 14 files + 2 consumer updates — the rename ratio still holds.

Six top-level OLD_ renames (WaterSection, SourceWaterModal, CustomSourceWaterModal, TargetStyleModal, CustomTargetStyleModal) + nine `water-section/OLD_*` renames + two consumer-import updates (BetaBuilderPage, BrewedVersionModal) + ESLint `no-restricted-imports` extension with 14 new paths. The Water section had the most quarantine files of any 2.x slice so far. The mechanical rename pattern (`git mv` + content rename + import update + `OLD_` function name) scaled linearly — no surprises. **Rule reinforced:** budget ~1 minute per file for quarantine rename work, plus 5–10 minutes for consumer-import updates and the ESLint extension. Water's 12 minutes was on-trend.

### When the design system reference is available, USE it — don't reinvent component shapes.

The user shared their HS design system HTML file mid-session. Reading it changed several decisions: salt cells adopted the documented HSStatCard pattern (2px ink frame + sh1 + accent strip), the ion bar status colors switched from HSL interpolation to direct palette tokens, and the section-identity tinting was capped at the design system's documented "pick at most three accents per screen" rule. **Rule for any future section slice:** if the design system has a documented pattern for the shape you're building, copy that pattern — even if your inline implementation works. Consistency with the design system pays off in cross-section harmony and in the cumulative effect of small touchpoints (the cross-section identity work in this slice could only land because all sections share the same frame language). The design system file is at `~/Downloads/Hop & Skip Design System.html` (user-local) — for future slices, ASK the user to share it if you don't have visibility into the canonical patterns.

---

## Phase 2.4 retrospective — lessons for subsequent slices

### The substrate doesn't fit a settings page. Reject it for the visual layer when the section is set-and-forget.

Every other Phase 2 section (Fermentables / Mash / Fermentation / Hops / Yeast / Water / Brew sheet) is *active authoring* — the brewer is making decisions, comparing values, scrolling through ledgers, watching live numbers tick. The substrate's chrome budget (paper bg + 2px ink border + 14px corners + sh3 + sub-card eyebrows + cream2 secondary cards + sidebar visualizer + brewer's notes) is *earned* by how often the brewer's eye lands on each surface element. Equipment is the opposite. Brewers tune it once when they get a new vessel and then never look at it again — the success metric is invisibility, not legibility.

The first pass shipped substrate-faithful: substrate outer frame, 4 cream2 sub-cards (Batch & boil / Mash system / Kettle / Cooling & fermenter) with their own borders + shadows + muted accent strips + script-font ✦ taglines, per-field StepperFields each with their own ink border + cream2 bg + label eyebrow + always-visible − / + buttons, plus a right sidebar with a VolumesReadout (Mash water / Sparge / Pre-boil / Batch / Total / Strike temp) + the shared BrewersNotesCard. User screenshot reaction: **"visually crazy busy though. So much black and harsh colours. Look how scary this is to parse. This is bad design."** 13 stepper-field cards + 26 stepper-button cards + 4 sub-card borders + outer frame = ~44 ink strokes on one page. The substrate's chrome is fine when the surface earns it; on Equipment it reads as a black grid.

**Rule:** when a section is configuration rather than authoring, keep the outer substrate frame (HS signature, one stroke total) and drop *everything* inner-substrate. No per-field cards, no sub-card borders, no sidebars, no brewer's notes, no script ✦ taglines. The substrate's role on this kind of section is to anchor the section in the HS visual language; the *content* layer should be quiet enough that the brewer can leave it and forget it.

### Iterate through "too busy → too generic → just right" — three passes, not one.

The visual landed across four iterations: (1) substrate-faithful with sidebar — too busy; (2) substrate frame + flat per-field cards inside it — still ~78 ink strokes, still busy; (3) no chrome at all (no outer frame, plain rows, generic web-form look) — user feedback **"doesnt really fit stylistically"**; (4) outer substrate frame back + plain rows inside + 2-col grid + Caveat script kicker for HS identity — landed.

The middle iteration (3) was useful data even though it didn't ship: it confirmed the outer substrate frame is the HS signature that earns its keep on every section regardless of how quiet the content is. Stripping it made the page read as a generic settings form, not a Brewing.It section. **Rule for any "quiet" surface:** the outer substrate frame is non-negotiable; the inner chrome is the dial.

### Consolidate split affordances into single buttons when set-and-forget.

The first profile picker shipped as `Profile · {name}  [Switch ▾]` — a label and a separate button. The user asked for it consolidated: `[Profile · {name} ▾]` — single pill, clicking anywhere on it opens the HSActionMenu. The split made sense for an active-authoring section (the label is the *current value*, the button is the *action*). On a set-and-forget section, the brewer doesn't need to read the current value before deciding to switch — they're either switching or they're not. Consolidation removes one element of visual decision-making.

**Rule for any settings-page-shaped section:** when an information element and its action are adjacent, fold them into one button. Especially when the section's whole job is to fade into the background.

### The substrate's outer frame + the page's band wrapper double up — drop one bg.

The Advanced expander band wrapper sets `background: cream2`. The substrate frame inside sets `background: paper`. The combined effect on the user's screenshot read as: title band (cream, from page bg) → band wrapper (cream2) → section frame (paper). Three distinct surfaces stacked. User feedback: **"Background colour needs to be unified to be the same as the header colour."**

Fix: drop the wrapper's `background: cream2` so the band inherits page `cream` like the Title band above. The substrate frame's `paper` then sits on top of the same cream surface the Title band uses — visually unified. **Rule for any Phase 2 section mounted inside a colored band wrapper:** check whether the wrapper bg actually serves a purpose. If the section's own substrate frame already provides visual containment, the wrapper bg is redundant chrome.

### Title band's `borderBottom` becomes a separator-too-far when the expander opens — drop it conditionally.

The Title band has a permanent `borderBottom: 2px ink` that separates it from the live-numbers band below. When the Advanced expander opens, the *Equipment section* slides in *between* — so now the Title band's bottom border sits between the title row and the Equipment section, creating a visual separator the brewer doesn't want. The Equipment band has its own `borderBottom` to separate from live-numbers, so the Title's border is redundant when open.

Fix: `borderBottom: isEquipmentOpen ? "none" : "2px solid ink"` on the Title band. When closed: title separates from live-numbers. When open: title flows directly into Equipment, Equipment separates from live-numbers. **Rule for any expanding band that slides between two sibling bands:** the upstream sibling's bottom border should disappear while the expander is open so the expanded surface reads as a continuation of the upstream surface, not a separate insertion.

### Chevron rotation > glyph swap for expander state.

Classic equipment used `▲ / ▼` text glyphs. The user asked for the chevron to point right when closed and rotate to point down when open. A single SVG `›` path with `transform: rotate(0deg | 90deg)` and a 180ms cubic-bezier transition reads as one continuous motion — the open/close state is felt, not just inferred. Stroke weight + cap style stay consistent across both states (glyph swap mid-state can flicker the font fallback chain). **Rule for any expander chevron:** one SVG path, transform-rotated. Not two text glyphs swapped via JSX.

### Click-to-edit + hover-revealed steppers is the right field UX for settings pages.

Default state: just the value as a span. Hover the row: tiny ghost − / + steppers fade in on either side + dashed underline appears under the value. Click the value: it swaps to a typeable input scoped to the row. Enter/blur commits; Escape cancels.

Why this works for settings: the page is read-mostly. Brewers come to *check* what their equipment is set to, not to actively tune it. The values being readable as plain text matches what the brewer is actually doing 99% of the time. The +/− steppers only appear when a brewer expresses intent to change something (hover), keeping the default state visually quiet. The click-to-edit fallback is for keyboard-first users and for typing a new value directly (faster than holding +/−).

**Rule for any set-and-forget configuration surface:** invert the affordance defaults. Read state is the canonical state; edit state is conditional. Substrate sections do the opposite (edit-by-default, since authoring is the canonical state) — Equipment proves that swapping the default is the right call for the settings shape.

### Pure-CSS hover/focus-within beats React state for ephemeral chrome.

First implementation used `useState(hovered)` + `onMouseEnter / onMouseLeave` on each FieldRow to drive the steppers' opacity. eslint flagged jsx-a11y warnings about non-interactive elements with mouse handlers. Fix: drop React state entirely, use `:hover` and `:focus-within` in a scoped `<style>` block to flip the steppers' opacity. Same behavior, zero React re-renders, lint-clean, fewer LOC.

**Rule for any "ephemeral chrome appears on row hover" pattern:** CSS first, React state only if the visibility depends on something React knows but CSS doesn't (e.g. a sibling component's state). For pure visual hover effects, CSS is faster, cheaper, and keeps the eslint warnings off.

### `batchVolumeL = final packaged volume` deserves a permanent prose note.

The Recipe model documents `batchVolumeL` as "Target batch volume in liters (final packaged volume — fermenter loss is added on top)". Most brewing calculators (BeerSmith, Brewfather) define batch volume as into-the-fermenter, with packaging-loss subtracted as a separate readout. Brewing.It's convention is the opposite: brewers enter what they actually want to drink (final keg or bottle volume), and fermenter / chiller / cooling losses are added on top of that to compute mash + sparge water.

This is a meaningful convention difference — brewers coming from other tools will misread the value if it's not flagged. A single plain-prose paragraph above the field grid is enough: bold the keywords (`Heads up —`, `final packaged`), use body font in muted color, no card chrome, no script flourishes. The note is one line of plain text — that's enough to set expectations without dominating the page.

**Rule:** any HS surface where our calculation convention diverges from industry default earns a one-line plain-prose note anchored next to the field. Don't bury it in tooltips, don't lift it into a banner card, don't write it in Caveat script. The convention note pattern is: body font · 12.5px · 1.45 line-height · muted color · bold keywords in ink · single paragraph. Cumulatively cheap; high-value when the brewer hits it.

### Quarantine took ~5 minutes for 3 files + 2 consumer updates — matches the per-file budget.

Three `git mv` renames, three `export const … → OLD_…` renames, three internal-import-and-symbol updates (the section's modal imports + JSX usages), two external importer updates (BetaBuilderPage + BrewedVersionModal — both classic-only aggregators), one ESLint `no-restricted-imports` block append. tsc clean first pass, lint baseline holds (3 warnings on touched files, all pre-existing — `autoFocus` on OLD_CustomEquipmentModal + 2 unused eslint-disable directives on BetaBuilderPage that pre-date this slice). The mechanical pattern is now locked across 7 Phase 2 quarantine passes: budget ~1 minute per file, plus 2–3 minutes for consumer-import + ESLint rule extension. 3 files × ~1.5 min = ~5 min for this slice. **Rule confirmed for all future quarantine work:** the per-slice quarantine effort scales linearly with file count; no slice has surprised this estimate so far.

### `presetStore` / `equipmentStore` shape is consistent — the picker modal pattern ports without surprises.

`useEquipmentStore.profiles: EquipmentProfile[]` is flatter than the `{label, items}[]` shape used by `presetStore.fermentablePresetsGrouped` / `hopPresetsGrouped` / `yeastPresetsGrouped`. The EquipmentProfileModal handles the grouping inline (split into `presets` vs `customs` by `profile.isCustom`). That's a minor port-time difference but doesn't change the picker modal pattern — search field + filter chips + group headers + rows + footer with "+ Create custom" still ports verbatim from YeastPresetModal. **Rule for any future preset-picker work:** if the store returns a flat array instead of `{label, items}[]`, do the grouping inline in the modal's filtered-grouped useMemo. Don't push the grouping into the store unless multiple consumers need it.

---

## Total effort estimate

- **Phase 0** (free wins + quarantine labeling): ✅ Done — ≈ 1 focused session
- **Phase 1** (5 active pages: Browse, Public viewer, Compare, User profile, Brew session — Version history deferred indefinitely): **done** — 1.1 ✅ · 1.2 chrome ✅ · 1.3 ✅ · 1.4 ✅ · **1.5 closed via 2.5a + 2.5b ✅** · **1.6 deferred / maybe never** (low-traffic, classic surface stays as reference)
- **Phase 2** (8 builder sections + their bundled modals): **done** ✅ — 2.5a ✅ · 2.5b ✅ · 2.1 ✅ · 2.2 ✅ · 2.3 ✅ · 2.8 ✅ · 2.6 ✅ · 2.7 ✅ · 2.4 ✅
- **Phase 3** (6 calculator widgets extracted from existing inline implementations): NOT STARTED — 1 focused session
- **Phase 4** (14 learn article body rewrites): NOT STARTED — 3–4 focused sessions
- **Phase 5** (optional deferred deletion): NOT STARTED — ~1 focused session, whenever

**Roughly 4–5 focused sessions remaining** (excluding deferred deletion + deferred 1.6). With all 8 Phase 2 sections shipped, the substrate is fully validated — across ledger-shaped sections (2.1/2.2/2.3/2.8/2.6) and non-ledger sections (2.7 visualizer-anchored, 2.4 quiet settings page). 2.4 Equipment was the first Phase 2 slice where the substrate was actively *rejected* for the visual layer (the frame stayed; everything inside is non-substrate flat-form). Next-priority slice: **Phase 3** (extract the 6 inline calculator widgets from `app/calculators/page.tsx` into `src/modules/hopskip/components/calculators/` so the 6 learn articles can share them — ~1 focused session, very mechanical), then **Phase 4** (14 learn article body rewrites — 3–4 focused sessions; start with the 6 calculator articles after Phase 3, then the 4 short articles, then the 4 long articles with custom inline mockups).
