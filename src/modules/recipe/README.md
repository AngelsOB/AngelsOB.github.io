# recipe

The shared recipe domain layer — no UI lives here. The builder UI
(`src/modules/builder`) is the main consumer; sharing, compare, and the API
routes also lean on it.

- `models/` — domain types: `Recipe` (plus `RecipeVersion`), `Equipment`,
  `Presets` (hop/yeast/fermentable preset types), `BrewSession`.
- `services/` — pure calculation/import-export services
  (`RecipeCalculationService`, water chemistry, mash, starter, packaging,
  BeerXML import/export, …). No browser deps; safe in server components.
  Tests live alongside as `*.test.ts`.
- `repositories/` — persistence. Firestore repos for recipes/equipment/brew
  sessions; `RecipeVersionRepository` is localStorage-based (see
  `quarantine/version-history/README.md` for the parked version-history UI).
- `stores/` — Zustand stores (`recipeStore` is the big one).
- `hooks/` — React hooks over the stores (`useRecipeCalculations`,
  `useUnsavedChangesGuard`, `useGuardedLinkClick`).
- `data/` — ingredient preset data (hops, yeasts, fermentables).
- `utils/` — `recipeExport` (BeerXML download, client-only), SRM color utils,
  yeast lab icons.
