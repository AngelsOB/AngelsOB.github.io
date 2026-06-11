# Quarantined: Recipe Version History UI

Removed from the live app during the v1 cleanup refactor (June 2026) because the
feature's UI was only reachable from the deprecated beta-builder interface — the
current builder never exposed it. The **data layer is still live** in the
codebase; only the UI was parked here so a future version can rebuild it cleanly.

This folder is excluded from `tsconfig.json`, `eslint.config.js`, and
`.prettierignore` — nothing in it compiles. The files reference modules that
have since moved or been deleted (import paths are stale on purpose).

## What the feature did

- **Create version**: snapshot the current recipe before bumping
  `recipe.currentVersion`. Triggered from the old recipe list's row menu.
- **View history**: a modal listing all snapshots for a recipe, each linking to
  a read-only viewer page.
- **Restore**: auto-snapshot the current state ("Auto-save before restoring
  vN"), then overwrite the recipe with the chosen snapshot and bump the version.

## Where the data lives

Version snapshots are stored in **localStorage** under the key
`beer-recipe-versions-v1` (NOT Firestore — only the recipe's
`currentVersion` counter lives in the Firestore recipe doc). Each entry is a
`RecipeVersion` (see `models/Recipe.ts`): `{ id, recipeId, versionNumber,
createdAt, changeNotes?, recipeSnapshot }`. A future rebuild will likely want to
move snapshots to a Firestore subcollection so they survive across devices.

## What is STILL LIVE in the codebase (the data layer)

- `RecipeVersion` type — `src/modules/recipe/models/Recipe.ts`
- `RecipeVersionRepository` — `src/modules/recipe/repositories/RecipeVersionRepository.ts`
  (localStorage CRUD: `loadByRecipeId`, `loadByRecipeIdAndVersion`, `save`)
- Store actions in `src/modules/recipe/stores/recipeStore.ts`:
  - `createNewVersion(recipeId, changeNotes?)`
  - `loadVersionHistory(recipeId): RecipeVersion[]`
  - `restoreVersion(recipeId, versionNumber)`
  - (plus `createVariation`, which forks a recipe and records parentage)

Rebuilding the feature = new UI wired to those three store actions. No data
plumbing needed.

(If paths above have drifted, search for `RecipeVersionRepository` /
`createNewVersion` — the names are stable.)

## Files in this folder

- `version-viewer-page.tsx` — was `app/recipes/[id]/versions/[versionNumber]/page.tsx`.
  Rendered `BetaBuilderPage` (the old builder, deleted in this refactor), which
  detected the `versionNumber` route param, loaded the snapshot via
  `recipeVersionRepository.loadByRecipeIdAndVersion(id, Number(versionNumber))`,
  set it as the current recipe, and rendered the whole builder read-only with a
  "Version N (Read-only)" banner. Metadata: `robots: { index: false }`.
- `VersionHistoryModal.tsx` — the history modal. Listed snapshots
  (`loadVersionHistory`), linked each to the viewer route, offered Restore.
  Former deps: `@components/Button`, `ModalOverlay`, `recipeStore`.

## How the old UI wired together

1. Old recipe list row menu → "Save version" → `createNewVersion(recipe.id)`.
2. Row menu → "Version history" → `VersionHistoryModal`.
3. Modal row → `/recipes/{id}/versions/{versionNumber}` → read-only viewer.
4. Modal "Restore" → `restoreVersion(recipeId, versionNumber)`.
