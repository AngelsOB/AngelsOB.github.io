/**
 * Malt Flavour Lexicon — promoted to the app's data layer (Jul 2026).
 *
 * The lexicon, aggregation math and the runtime name→archetype matcher now
 * live in `src/modules/recipe/data/maltFlavor.ts`, where the builder's
 * fermentables section charts the same 9 axes the steering engine uses. This
 * re-export keeps every corpus-lab import path working; the lab importing
 * from the app is the allowed dependency direction (see §2 of
 * docs/corpus-lab-build.md — the app still imports nothing from the lab).
 *
 * The offline corpus classifier (`offline/build-archetype-map.mjs`) remains a
 * standalone .mjs copy of the matcher — plain node can't import app TS.
 */
export * from "@/modules/recipe/data/maltFlavor";
