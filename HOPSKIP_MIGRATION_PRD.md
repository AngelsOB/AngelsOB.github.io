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

## Target folder layout

```
src/modules/hopskip/
├── components/
│   ├── (existing primitives + chrome — HSCard, HSButton, HSHeader, etc.)
│   ├── HSActionMenu.tsx, HSCardLift.tsx, useCursorFollowCard.ts (NEW — landed in Phase 1.1, reused by 1.2/1.4/2.x)
│   ├── HSLearnArticle.tsx, HSLearnNav.tsx, HSFormulaCallout.tsx, HSBuilderMockups.tsx (already exist)
│   ├── HopSkipBuilder.tsx, HopSkipHomeContent.tsx, etc. (already exist)
│   ├── builder/         ← NEW (Phase 2 — one folder per section)
│   ├── modals/          ← NEW (HSModal + bespoke modals as they're built per-section)
│   ├── calculators/     ← NEW (Phase 3 — extracted calculator widgets)
│   └── public/          ← Phase 1 — HSBrowsePage + HSBrowseCard live here (1.1 shipped); PublicViewer, Compare, UserProfile to follow
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

**Effort: 3–4 focused sessions.** Phase 1.1 ✅. Phase 1.2 chrome ✅ (inner read-only deferred to Phase 2 sections). 1.3–1.6 remain.

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

- **Current source:** [src/modules/compare/CompareRecipesPage.tsx](src/modules/compare/CompareRecipesPage.tsx).
- **Route:** `/browse/compare` — currently a re-export.
- **What it does:** side-by-side comparison of 2–4 recipes.
- **HS plan:** HS column-grid layout. Each column is a recipe with its key stats + ingredient diff highlights. Stat comparison bars in HS style.
- **Effort:** M.

## 1.4 — HSUserProfile

- **Current source:** [src/modules/sharing/UserProfileClient.tsx](src/modules/sharing/UserProfileClient.tsx).
- **Route:** `/u/[userId]`.
- **What it does:** public user profile — username, brew count, list of published recipes.
- **HS plan:** HS hero (display username + brew count) + grid of `HSBrowseCard` (reused from Phase 1.1). Small composition; the cards are already done.
- **Effort:** S.

## 1.5 — HSBrewSessionPage

- **Current source:** [src/modules/beta-builder/presentation/components/BrewSessionPage.tsx](src/modules/beta-builder/presentation/components/BrewSessionPage.tsx).
- **Route:** `/recipes/sessions/[sessionId]` (new) — classic has it at `/betabuilder/recipes/sessions/[sessionId]`.
- **What it does:** brew-day session log — gravity readings, temperature checkpoints, timestamps, notes, deviations from the recipe plan.
- **HS plan:**
  - `HSBrewSessionPage.tsx` — header (recipe name + session date) + per-checkpoint cards (HSCard with eyebrow + display reading + Caveat note for "actual vs target").
  - Reuse `useBrewSessionStore` from existing classic.
- **Data dependencies:** `useBrewSessionStore` (already exists), recipe by id from `useRecipeStore`.
- **Acceptance:** open a brew session, log a checkpoint, view past checkpoints, mark session complete.
- **Effort:** M.

## 1.6 — HSVersionHistoryPage + HSVersionHistoryModal

- **Current source:** [src/modules/beta-builder/presentation/components/VersionHistoryModal.tsx](src/modules/beta-builder/presentation/components/VersionHistoryModal.tsx) + the `versions/[versionNumber]` route at `/betabuilder/recipes/[id]/versions/[versionNumber]/page.tsx`.
- **Route:** `/recipes/[id]/versions/[versionNumber]` (new).
- **What it does:** view a historical version of a recipe + restore.
- **HS plan:**
  - `HSVersionHistoryModal.tsx` — opened from a "Version history" button in the HS recipe builder sub-header. List of versions (each as a `HSCard` row with version number + date + change note + "View" link).
  - `HSVersionHistoryPage.tsx` — the page that opens when you click "View". Looks like the HS read-only public viewer (Phase 1.2), but pulls from `recipeVersionRepository` instead of `publicRecipeIndex`. Adds a "Restore this version" button.
- **Data dependencies:** `recipeVersionRepository` (existing).
- **Acceptance:** open version history modal, view a historical version, restore it.
- **Effort:** M.

---

**After Phase 1 ships:** HS has page parity with classic. Every URL works in HS. `/betabuilder/*` is now purely a reference, not a fallback.

---

# Phase 2 — Section-by-section HS-native rewrites

**Effort: 6–8 focused sessions.**

Each section is one vertical slice including its own modals and sub-components. After each ships, the corresponding classic source files become unimported from anywhere outside `/betabuilder/*` and can be left quarantined.

Order (simpler → harder). Each section's classic source files are listed under it; all of them get an HS-native equivalent in `src/modules/hopskip/components/builder/`.

## 2.1 — Fermentables (recommended first slice)

- **Classic sources:**
  - [FermentableSection.tsx](src/modules/beta-builder/presentation/components/FermentableSection.tsx) — section shell + grain list
  - [FermentablePresetModal.tsx](src/modules/beta-builder/presentation/components/FermentablePresetModal.tsx) — preset grain picker
  - [CustomFermentableModal.tsx](src/modules/beta-builder/presentation/components/CustomFermentableModal.tsx) — "add custom grain" form
- **HS plan:**
  - `HSFermentableSection.tsx` — section shell with `HSSectionHeader` "Fermentables", segmented amount/percent toggle (HS pill style), target ABV input (HS number field with malt accent side-strip), "+ Add fermentable" button, grain rows (cream-2 `HSCard` with name + SRM color chip + Lovibond/EBC pills + weight/percent inputs + delete button).
  - `HSFermentablePresetModal.tsx` — uses `HSModal` (built here for the first time, lives in `modals/`). Search input + filter chips + grain rows (cream-2 with SRM color chip + name + Lovibond + supplier).
  - `HSCustomFermentableModal.tsx` — HSModal + form (name, SRM, Lovibond, max %, supplier dropdown). Falls out naturally.
  - `HSModal` shared primitive (`modals/HSModal.tsx`) — paper bg, 2px ink border, 7px malt-yellow top stripe (use `border-top: 7px solid malt`, NOT `::before`, per HOPSKIP_PRD §10 stacking-context gotcha), `sh4` offset shadow, focus trap, ESC to close, click-backdrop closes, click-inside doesn't.
- **Data dependencies:** `useRecipeStore` → `addFermentable`, `updateFermentable`, `removeFermentable`, `fermentables`. `srmToRgb` for color chips. `bjcpSpecs` for target ABV range hints. Existing grain preset database.
- **Acceptance:** add/edit/remove fermentables, toggle amount vs percent, target ABV input drives auto-scaling, open preset modal + custom modal, OG on live-numbers updates.
- **Effort:** M (the section itself) plus the two modals + HSModal primitive (S each, ≈M total). One focused session.
- **Why first:** simpler than Hops (no flavor radar, no variety browser), still has the full section + 2 modals pattern, classic source is well-bounded, proves the whole vertical-slice approach including the HSModal primitive.

## 2.2 — Mash

- **Classic sources:**
  - [MashScheduleSection.tsx](src/modules/beta-builder/presentation/components/MashScheduleSection.tsx)
  - [MashStepModal.tsx](src/modules/beta-builder/presentation/components/MashStepModal.tsx)
- **HS plan:** Section shell with roast accent + "+ Add step" button. Each step is an `HSCard` with step type label (HSEyebrow), display-font temperature, body-font duration, drag handle. Mash pH summary at the bottom (HSCard with estimated pH + adjustment chip). HSMashStepModal for add/edit (type pill selector + temperature + duration + ramp options).
- **Data dependencies:** `useRecipeStore` mash step actions, `useRecipeCalculations` for `estimatedMashPh` + `mashPhAdjustment`.
- **Effort:** M.

## 2.3 — Fermentation

- **Classic sources:**
  - [FermentationSection.tsx](src/modules/beta-builder/presentation/components/FermentationSection.tsx)
  - [FermentationStepModal.tsx](src/modules/beta-builder/presentation/components/FermentationStepModal.tsx)
- **HS plan:** Same pattern as Mash but with honey accent. Step type pills: primary / secondary / conditioning / cold-crash / diacetyl-rest.
- **Effort:** S.

## 2.4 — Equipment

- **Classic sources:**
  - [EquipmentSection.tsx](src/modules/beta-builder/presentation/components/EquipmentSection.tsx) — equipment fields
  - [EquipmentProfileModal.tsx](src/modules/beta-builder/presentation/components/EquipmentProfileModal.tsx) — saved profile picker
  - [CustomEquipmentModal.tsx](src/modules/beta-builder/presentation/components/CustomEquipmentModal.tsx) — "create new profile" form
- **HS plan:** `HSEquipmentSection.tsx` — grouped HSCards (Mash tun / Kettle / Fermenter / Profile picker), each with eyebrow + grid of HS number fields. Profile picker is an `HSPill` opening the profile modal.
- **Data dependencies:** `useRecipeStore` → `updateRecipe.equipment`, equipment profile load/save.
- **Effort:** M.

## 2.5 — Brew sheet

- **Classic sources:** [BrewDayChecklistSection.tsx](src/modules/beta-builder/presentation/components/BrewDayChecklistSection.tsx).
- **HS plan:** Each phase (Mash → Sparge → Boil → Whirlpool → Pitch) as an `HSCard` with eyebrow + display number + body-text instruction. Checkboxes in HS style (square + ink check). No modals.
- **Effort:** M.

## 2.6 — Yeast

- **Classic sources:**
  - [YeastSection.tsx](src/modules/beta-builder/presentation/components/YeastSection.tsx)
  - [StarterCalculator.tsx](src/modules/beta-builder/presentation/components/StarterCalculator.tsx)
  - [CustomYeastModal.tsx](src/modules/beta-builder/presentation/components/CustomYeastModal.tsx)
- **HS plan:** Section + "+ Add yeast" button + strain list (`HSCard` per strain, yeast-peach accent strip). `HSStarterCalculator` — vertical-stack layout: viability % (HSStatCard), packages, starter steps (HSCards), final cell count gauge.
- **Effort:** M.

## 2.7 — Water

- **Classic sources:**
  - [WaterSection.tsx](src/modules/beta-builder/presentation/components/WaterSection.tsx)
  - [water-section/WaterChemistrySection.tsx](src/modules/beta-builder/presentation/components/water-section/WaterChemistrySection.tsx)
  - [water-section/PhAdjustmentsSection.tsx](src/modules/beta-builder/presentation/components/water-section/PhAdjustmentsSection.tsx)
  - [SourceWaterModal.tsx](src/modules/beta-builder/presentation/components/SourceWaterModal.tsx)
  - [CustomSourceWaterModal.tsx](src/modules/beta-builder/presentation/components/CustomSourceWaterModal.tsx)
  - [TargetStyleModal.tsx](src/modules/beta-builder/presentation/components/TargetStyleModal.tsx)
  - [CustomTargetStyleModal.tsx](src/modules/beta-builder/presentation/components/CustomTargetStyleModal.tsx)
- **HS plan:** Source/target pickers (`HSPill`s), salt cells (4 HSCards in a row with auto-calc button), 5 ion comparison bars (HS track + water-blue fill + ink target marker — see [HSBuilderMockups](src/modules/hopskip/components/HSBuilderMockups.tsx) `WaterChemMockup` for the reference pattern, then make it interactive). pH adjustments (acid malt / lactic acid toggle controls).
- **Data dependencies:** `useRecipeStore` → `updateRecipe.waterChemistry`, water chemistry calc service, source/target water profile constants.
- **Effort:** L (lots of modals, complex chemistry math wiring).

## 2.8 — Hops

- **Classic sources:**
  - [HopSection.tsx](src/modules/beta-builder/presentation/components/HopSection.tsx)
  - [HopAdditionRow.tsx](src/modules/beta-builder/presentation/components/HopAdditionRow.tsx)
  - [HopVarietyCard.tsx](src/modules/beta-builder/presentation/components/HopVarietyCard.tsx)
  - [HopFlavorRadar.tsx](src/modules/beta-builder/presentation/components/HopFlavorRadar.tsx)
  - [CustomHopModal.tsx](src/modules/beta-builder/presentation/components/CustomHopModal.tsx)
- **HS plan:** `HSHopSection` — section shell + add-hop button + list of `HSHopAdditionRow`s + `HSHopFlavorRadar`. Each row is an HSCard (cream-2, no shadow) with variety name + AA% chip, HSPill segmented control for type (boil / whirlpool / dry hop / first wort / mash), inline number inputs for grams + time, chevron menu for delete/duplicate. `HSHopFlavorRadar` wraps recharts with HS color tokens. `HSHopVarietyCard` for the variety browser drawer.
- **Data dependencies:** `useRecipeStore` hop actions, `useRecipeCalculations` for live IBU, `hopEnrichmentService` for variety database lookups.
- **Effort:** L (radar + variety browser + most complex row layout). Saved for last.

---

**Migration choreography for each Phase 2 section (per slice):**

1. **Read the classic source** to understand props, store interactions, validation rules, and edge cases (empty states, modal triggers, tier gates).
2. **Write the HS-native components** (section + modals + sub-components) in the matching folder under `src/modules/hopskip/components/builder/` and `modals/`.
3. **Swap the import** in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) — one line change for the section, and update modal triggers accordingly.
4. **Run `npx tsc --noEmit`** to check the contract.
5. **Visual parity check:** open the HS recipe at `/recipes/[id]` AND the classic version at `/betabuilder/recipes/[id]` in two browser tabs. Edit a recipe in HS, then open in classic — confirm the data is the same. Edit in classic, then HS — confirm both see the change (they share the same store + repos).
6. **Delete the matching rules** from [overrides.css](src/modules/hopskip/styles/overrides.css) (the entries targeting the classic class names being replaced).
7. **Add JSDoc `@deprecated` tags** to the classic files just replaced (deferred from Phase 0.4b — see that section). Tag format: `/** @deprecated Classic UI. Migrating to HS — see HOPSKIP_MIGRATION_PRD.md. */` above the default export.
8. **Extend the ESLint `no-restricted-imports` rule** in [eslint.config.js](eslint.config.js) to block the classic files just replaced (deferred from Phase 0.4e). Add the `/eslint.config.js` rule if it doesn't exist yet, otherwise append paths. Verify lint stays clean by confirming no surviving HS code still imports those paths.
9. **Commit** that section's vertical slice.

The same choreography applies to Phase 1 sub-slices (replace HSBrowsePage / HSPublicRecipeView / HSCompareRecipesPage / HSUserProfile / HSBrewSessionPage / HSVersionHistoryPage, delete matching override rules, tag the replaced classic files, extend the lint rule). Phase 3 (calculators) and Phase 4 (learn articles) follow the same pattern — at smaller granularity.

---

# Phase 3 — Calculator widgets

**Effort: 1 focused session.**

The HS calculators page at [app/calculators/page.tsx](app/calculators/page.tsx) already implements all six calculators inline using HS primitives (`HSNumberField`, `ResultGauge`, etc.). The 6 calculator learn articles (`/learn/abv-calculator`, `/learn/boil-off-calculator`, `/learn/dilution-calculator`, `/learn/carbonation-calculator`, `/learn/hydrometer-calculator`, `/learn/strike-temp-calculator`) still import the classic versions from `src/components/`.

**Action:** Extract each inline calculator from `app/calculators/page.tsx` into its own component in `src/modules/hopskip/components/calculators/`:

- `HSAbvCalculator.tsx`
- `HSBoilOffCalculator.tsx`
- `HSDilutionCalculator.tsx`
- `HSCarbonationCalculator.tsx`
- `HSHydrometerCorrectionCalculator.tsx`
- `HSStrikeTempCalculator.tsx`

Then both `/calculators` and the 6 learn articles import the HS versions.

**Data dependencies:** Pure math from [src/calculators/](src/calculators/) — unchanged.

**Effort:** S each (6× S).

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

### Browser-preview verification was blocked the whole session — work around with curl + admin SDK.

The user's pre-existing `next dev` held `.next/dev/lock`, so `preview_start` failed. Verified via `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `curl /browse` / `curl /` / `curl /recipes` returning 200 with the expected HS markers in the SSR output. Worth flagging early if the same situation recurs — the user can stop their server, or accept that visual verification rests with them.

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

### `overrides.css` shrunk by zero lines — exactly as predicted.

The `.brew-read-only` class is in `src/index.css`, not overrides.css. Every `.brew-*` rule in overrides.css still serves the live builder at `/recipes/[id]`. They become deletable when each classic section is replaced (Phase 2). Don't chase it in 1.2 retrospect.

### Visual side-by-side verification rests with the user (again).

Same situation as Phase 1.1: pre-existing `next dev` held `.next/dev/lock`, so `preview_start` failed. Verified via `npx tsc --noEmit`, `npm run lint`, `npm run build`, `curl /r/<slug>` returning 200 with HS chrome + JSON-LD markers, and parsing the JSON-LD to confirm structure. Browser verification (the read-only flash + click-through interactions) handed back to the user. If this happens a third time, consider documenting "stop your dev server before each phase" in the per-phase choreography.

### Latent fork-id bug surfaced during 1.2 testing — fixed with a doc-id-wins hardening across all Firestore reads.

User reported a React duplicate-key warning on `/recipes` after forking the same seed recipe twice; root cause was a bug shared between classic `ForkButton` (and the new `useForkRecipe` and the inline fork in `HSBrowseCard`) where the source recipe's `id` field wasn't stripped from the destructured payload. Every fork wrote a fresh-uid doc but the doc's data contained the seed's stored `id`. On read, `FirestoreRecipeRepository`'s mapper used `{ id: d.id, ...d.data() }` — spread-later-wins, so the stored `id` overrode the doc id. Result: multiple Firestore docs presented as a single in-memory recipe.

Two fixes landed together:

1. **Strip `id` in every fork destructure.** Applied to [useForkRecipe.ts](src/modules/hopskip/components/public/useForkRecipe.ts), [ForkButton.tsx](src/modules/sharing/ForkButton.tsx), [HSBrowseCard.tsx](src/modules/hopskip/components/public/HSBrowseCard.tsx).
2. **Flip the read-mapper precedence so `doc.id` wins over any stored `id` field** — applied to all 5 read sites in [FirestoreRecipeRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreRecipeRepository.ts) and all 3 in [FirestoreBrewSessionRepository.ts](src/modules/beta-builder/domain/repositories/FirestoreBrewSessionRepository.ts). Pattern: `{ ...snap.data(), id: snap.id }` instead of `{ id: snap.id, ...snap.data() }`. Zero network/cache impact — pure JavaScript object-merge ordering.

**Rule for future phases (1.5/1.6 + Phase 2 writes):** when writing to Firestore via `setDoc(doc(ref, freshId), data)`, ensure `data` does NOT contain an `id` field (`saveAsync`/`saveNewAsync` already strip it via destructure; transactional writes need the same care). When reading via `{ ...snap.data(), id: snap.id }`, the doc id always wins, defending against latent legacy data. Repeat for any new Firestore-backed model (equipment profiles, ratings, public index, sessions, version snapshots).

Existing user-data side effect: any forks the user already had with mismatched stored `id`s now resolve to their correct doc ids in memory, so saves go to the right doc and duplicate-key warnings clear. The downside (any `parentRecipeId` reference captured under the old data-wins semantics points to a stale id) is real but small: the `parentRecipeShareSlug` field handles the user-facing "see the original" link, and stale `parentRecipeId` reverse-lookups silently fail with no UX impact.

---

## Total effort estimate

- **Phase 0** (free wins + quarantine labeling): ≈ **1 focused session**
- **Phase 1** (6 missing pages: Browse, Public viewer, Compare, User profile, Brew session, Version history): **3–4 focused sessions**
- **Phase 2** (8 builder sections + their bundled modals): **6–8 focused sessions**
- **Phase 3** (6 calculator widgets extracted from existing inline implementations): **1 focused session**
- **Phase 4** (14 learn article body rewrites): **3–4 focused sessions**
- **Phase 5** (optional deferred deletion): **~1 focused session, whenever**

**Roughly 14–18 focused sessions to migration-complete** (excluding deferred deletion). Each phase ships independently — you can stop anywhere and the remainder can be deferred. Phase 1 closes the feature-gap and is the highest-priority work; Phase 2 is the bulk of the quality upgrade but every section ships independently.

---

## Honest caveat — this PRD's audience

This is a **solid scaffold for someone with codebase context** (you, or a dev who can read the existing HS code in `src/modules/hopskip/` to fill in patterns). It is **not** self-sufficient for a cold dev. To make it self-sufficient would require:

- Inline restatement of HS visual rules (instead of pointing at HOPSKIP_PRD.md)
- Per-component prop/interaction contracts (exact prop signatures, keyboard interactions, validation rules, edge cases)
- Empty-state + loading-state + error-state specs per surface
- HSModal accessibility spec (aria attributes, focus restore target, scroll lock)
- Data-model crib sheet (Recipe / Hop / Fermentable type shapes)
- Tier-gate handling notes (which features are premium and how to preserve those gates)

The first 1.5x effort would buy that detail. The current document is intentionally lighter to stay scannable.
