# sharing

Publishing and community services for recipes — no UI here (the public-facing
components are `src/modules/builder/components/public/`).

- `publishService.ts` — publish/unpublish a recipe to the public index
- `getPublicRecipe.ts` — server-side fetch + schema.org JSON-LD builder for
  `/r/[slug]` (must stay server-safe: no `'use client'`)
- `ratingService.ts` — submit/fetch recipe ratings
- `slugUtils.ts` — share-slug generation/validation
