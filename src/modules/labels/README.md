# labels

Custom label art for recipes: upload, processing, storage, and retrieval.

Heads-up: `LabelUploader.tsx` and `useTopRatedLabels.ts` currently have **zero
importers** — they're kept on purpose because label art is planned to return
to the builder. `labelService.ts` and `imageProcessor.ts` are live via
`recipeStore`. The related `/api/label-image` route is also live.

The old 3D can rendering (Three.js/Rapier) that used to display these labels
was parked in `quarantine/can-3d/` during the v1 cleanup — see its README to
revive.
