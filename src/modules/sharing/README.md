# DEPRECATED CLASSIC UI

This folder contains the original Brewing.It sharing UI (`BrowseRecipesPage`, `BrowseCard`, `PublicRecipeView`, `PublicRecipeClient`, `UserProfileClient`, `ShareModal`, `ForkButton`, `RatingStars`), kept as a reference implementation during the HopSkip migration. Do not modify the UI components; do not import them from outside `app/betabuilder/`. HS-native replacements ship in Phase 1 under `src/modules/hopskip/components/public/`.

The service helpers here — `publishService.ts`, `ratingService.ts`, `slugUtils.ts`, `getPublicRecipe.ts` — are reused by their HS replacements when those land; they are NOT strictly classic-only.

See [/HOPSKIP_MIGRATION_PRD.md](/HOPSKIP_MIGRATION_PRD.md) for the migration plan.
