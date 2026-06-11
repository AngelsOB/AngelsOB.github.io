# Codebase Cleanup Map (legacy removal)

Status: analysis complete, deletion not yet started.
Generated from manual import tracing + `npx knip` module-graph analysis on the
`feat/nextjs-migration` branch.

## TL;DR — why it feels like spaghetti

You did **not** build hopskip as a clean replacement that you can swap in and
delete the old thing. The live app (hopskip + the v4 homepage + the top-level
`app/` routes) is built **on top of** `beta-builder`'s domain layer. So
`beta-builder` is two things glued together:

- a **shared core** the live app still imports (recipe models, the calculation
  services, presets, a handful of stores/components) — **must keep**
- a **dead presentation/persistence layer** (old UI, repositories, brew-session
  components, `OLD_*` files) — **safe to delete**

That's why `rm -rf src/modules/beta-builder` would break everything, and why it
feels scary. The job is to separate those two halves, not nuke the folder.

## The one fact that removes the fear

**`tsc --noEmit` + `next build` are a deterministic safety net.** You cannot
delete a file that something live still imports without TypeScript naming the
exact `file:line` that broke. So the method is: delete a batch on a branch →
run the gate → if it goes red, restore the few files it names → commit when
green. You don't have to be 100% certain up front; the compiler proves it.

Gate command (run before starting, and after every batch):

```bash
npx tsc --noEmit && npm run test:run && npm run build
```

(`npm run ci` does lint + test + build — also fine, slower.)

---

## Live vs legacy (high-level)

```
app/
├─ page.tsx ............................. LIVE  (renders HomeV4)
├─ layout.tsx, ClientShell.tsx ......... LIVE  (shell, nav, theme)
├─ v4/ ................................. LIVE  (the homepage you like)
├─ recipes/ browse/ calculators/        LIVE  (top-level routes → hopskip)
│  learn/ r/[slug]/ u/[userId]/ account/
├─ api/ ................................ LIVE
├─ can-tuner/ ......................... LIVE-ish (labels physics tuner, dev tool)
│
├─ v3/ ................................ DEAD  (previous homepage, orphaned)
├─ _home/ ............................. DEAD except lib/communityCard.ts
└─ betabuilder/ ....................... DEAD  (old route tree, orphaned)

src/
├─ modules/hopskip/ ................... LIVE  (the builder — but has ~5 orphan files)
├─ modules/auth sharing compare        LIVE  (sharing/labels have a few orphans)
│  labels learn/
├─ modules/beta-builder/ .............. SPLIT (see below)
├─ components/ ........................ LIVE primitives + ~9 orphans + 6 OLD_ calcs
├─ calculators/ stores/ hooks/ data/    LIVE  (shared)
│  utils/ config/ assets/
├─ views/ ............................. DEAD  (Vite-era SPA views; only betabuilder uses)
├─ App.css, vite-env.d.ts ............. DEAD  (Vite leftovers)
└─ index.css .......................... LIVE  (the real global stylesheet, 240KB)
```

### Inside `src/modules/beta-builder/` (~122 files)

| Group | Verdict | Notes |
|---|---|---|
| `domain/models/` (Recipe, Presets, Equipment, BrewSession) | **KEEP** | hopskip imports these |
| `domain/services/` — ~9 of 22 | **KEEP** | RecipeCalculation, HopFlavor, WaterChemistry, MashSchedule, Packaging, Starter, Fermentable, WaterSaltOptimizer, HopEnrichment |
| `domain/services/` — the other ~6 | **DELETE** | BeerXmlExport/Import, BrewDayChecklist, BrewSessionCalculation, MashPhCalculation, Volume |
| `domain/repositories/` (8 files) | **DELETE** | entirely unused — no live code uses these |
| `data/fermentablePresets.ts` | **KEEP** | live |
| `data/hopPresets.ts, yeastPresets.ts` | **DELETE** | dead |
| `presentation/stores/` (5), `hooks/` (3), `utils/` (2) | **KEEP** | live (recipeStore, equipmentStore, presetStore, recipeExport, etc.) |
| `presentation/components/` — ~6 | **KEEP / verify** | BetaBuilderPage, BrewSessionPage, RecipeListPage, StyleSelectorModal, UnsavedChangesModal, OLD_HopFlavorRadar (still referenced by `/recipes/*` and `/learn`) |
| `presentation/components/` — ~16 + `brew-session/` (14) + `water-section/` | **DELETE** | dead UI |
| `**/OLD_*` (~33 files) | **DELETE** | your own dead-marker prefix |

> The `presentation/components` "keep" set needs a per-file `tsc` check — some of
> the live `/recipes/[id]` routes still import beta-builder presentation, so this
> group is the one place to go file-by-file rather than bulk.

### Confirmed unused (knip, cross-checked)

- **Dependency:** `recharts` — 0 imports anywhere. Safe remove (heavy lib).
- **Orphan files (nothing imports them):** `src/components/{CalculatorCard,
  Collapsible,DualUnitInput,DualUnitInputTest,GrainTweaker,HopFlavorMini,
  InputWithSuffix,SegmentedToggle,WaterSaltsCalc}.tsx`,
  `src/hooks/useGrainTexture.ts`, `src/utils/grainTexture.ts`,
  `src/modules/hopskip/components/{HSColorBlock,HSHopCone,HSPill,
  HSSectionHeader,HSStatCard}.tsx`,
  `src/modules/labels/{BeerCan3D,DomColliders,HomePhysicsCans,
  HomePhysicsCansLoader,useTopRatedLabels}.*`,
  `src/modules/sharing/{PublicRecipeView,UserProfileClient}.tsx`.
- **Dev scripts (your call, not imported):** `debug_bjcp.ts`,
  `scripts/{capture-charts.mjs,publish-seeds.ts,verify-attenuation-models.ts}`,
  `attenuation-charts.html`. `publish-seeds.ts` may be a manual maintenance tool —
  keep if you still publish seed recipes.
- **Maybe-removable devDeps (verify each):** `autoprefixer` (Tailwind v4 doesn't
  need it), `culori`, `eslint-plugin-react-refresh`, `puppeteer` (only used by the
  dead `capture-charts` script), `postcss` (transitively needed — leave).

### Routing note

`next.config.ts` redirects the **public** URL `/beta-builder/:path*` →
`/recipes/:path*` (hyphenated). The internal `app/betabuilder/` folder (no hyphen)
serves `/betabuilder` which is **not** redirected and **not** linked anywhere.
Deleting `app/betabuilder/` does not touch the redirect — leave the redirect in.

---

## Phased deletion plan (safest → riskiest)

Each phase = one branch commit, gated by `tsc --noEmit && npm run test:run && npm run build`.

- **Phase 0 — Vite leftovers + pure orphans.** `src/App.css`, `src/vite-env.d.ts`,
  the knip-confirmed orphan files above, `recharts` dependency. Zero risk.
- **Phase 1 — v3 homepage + old mock.** Delete `app/v3/`, delete `app/_home/`
  except `lib/communityCard.ts` (move that type into `app/v4/lib/` and repoint the
  two importers). Verifies the homepage you like still builds.
- **Phase 2 — betabuilder route tree + its exclusive deps.** Delete
  `app/betabuilder/`, `src/views/`, `src/components/OLD_*Calculator.tsx` (6).
  Keep the `/beta-builder` redirect.
- **Phase 3 — beta-builder dead internals.** Delete `domain/repositories/` (8),
  the dead `domain/services` (~6), dead `data` presets, `presentation/components`
  dead set + `brew-session/` + `water-section/` dead set, all `OLD_*`. Go
  file-by-file for the `presentation/components` "keep/verify" group.
- **Phase 4 (optional) — honest naming.** What survives in `beta-builder` is a
  shared recipe core. Rename/move `domain/` (+ the few live stores/components) to
  `src/modules/recipe-core/` (or `src/core/`) and update imports. Pure
  path-rename refactor, fully `tsc`-checked. Optional polish, not required.
- **Phase 5 (optional) — keep it clean.** Add `knip` to `package.json` + CI so
  dead code can't silently re-accumulate.

## Re-running the analysis

```bash
npx -y knip --no-progress    # unused files / exports / deps
npx tsc --noEmit             # proves nothing live is broken
```
