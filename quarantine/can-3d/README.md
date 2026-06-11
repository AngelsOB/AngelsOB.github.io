# Quarantined: 3D Beer Can / Physics Experiment

Parked during the v1 cleanup refactor (June 2026). The 3D-can idea (physics
cans bouncing on the old homepage, a label-wrapped 3D can on recipe pages, and
the `/can-tuner` physics playground) wasn't used by the current builder or
homepage, so the rendering layer lives here until/unless the idea returns.

**Label plumbing was NOT quarantined** — `src/modules/labels/` still has
`LabelUploader.tsx`, `labelService.ts`, `imageProcessor.ts`,
`useTopRatedLabels.ts`, and the `/api/label-image` route, because label art is
coming back. Only the 3D presentation is parked.

This folder is excluded from `tsconfig.json`, `eslint.config.js`, and
`.prettierignore` — nothing in it compiles, and import paths inside are stale
on purpose.

## To revive

Reinstall the deps that were removed from package.json:

```
npm i three three-subdivide @react-three/fiber @react-three/drei @react-three/rapier
npm i -D @types/three
```

Also: `can.obj` (the can mesh the loaders fetch from `/can.obj`) was moved
here from `public/` — move it back to `public/can.obj` when reviving.

## Files

- `BeerCan3D.tsx` — Three.js can mesh: loads an OBJ can model, subdivides it
  (three-subdivide), wraps the recipe's label image around it.
- `PhysicsCan.tsx` — Rapier rigid-body wrapper around the can. Was rendered by
  the old `PublicRecipeView` / `BetaBuilderPage` (both deleted) to show the
  recipe's label on a knockable can.
- `HomePhysicsCans.tsx` + `HomePhysicsCansLoader.tsx` — a pile of physics cans
  for the OLD homepage hero (`src/views/Home.tsx`, deleted). Loader was the
  dynamic-import wrapper.
- `DomColliders.tsx` — generated Rapier colliders from DOM element rects so
  cans could land on real page elements.
- `canPhysicsConfig.ts` — shared physics constants (`DEFAULT_CAN_CONFIG`) and
  the `CanPhysicsConfig` type.
- `can-tuner-page.tsx` — was `app/can-tuner/page.tsx` (route `/can-tuner`,
  linked from nowhere): a slider playground for tuning gravity, mass,
  restitution, etc. against the live physics scene.
