import type { Recipe } from "@/modules/recipe/models/Recipe";

/**
 * Whether the water section is showing its full-width "intro" (the
 * Source → Target onboarding) rather than the populated 2-column panel.
 *
 * Live, recipe-derived, no latch: the intro is up iff there are no salt
 * additions AND it hasn't been explicitly dismissed. Picking a source or
 * target alone does NOT exit the intro — only Auto-Calc (which writes salts,
 * flipping `saltsEmpty`) or "I'll set them myself" (which persists
 * `introDismissed`) does. WaterSection computes its own `showIntro` from this
 * same function, so the grid's layout collapse and the section's render can
 * never disagree.
 */
export function isWaterIntro(recipe: Recipe): boolean {
  const wc = recipe.waterChemistry;
  const saltsEmpty = Object.keys(wc?.saltAdditions ?? {}).length === 0;
  return saltsEmpty && !wc?.introDismissed;
}

/**
 * Whether a builder tab is in its empty / intro state — the single source of
 * truth that drives the `.section-empty` full-width layout collapse.
 *
 * Mirrors each section's own empty branch exactly (fermentables/hops/mash/
 * yeast/fermentation key off the same arrays the sections do; water defers to
 * `isWaterIntro`). Keep it live — recompute every render; never memoize on the
 * tab alone and never feed it into a React `key`. Brew sheet has no helper
 * column and never collapses.
 */
export function isSectionEmpty(tab: string, recipe: Recipe): boolean {
  switch (tab) {
    case "fermentables":
      return recipe.fermentables.length === 0;
    case "hops":
      return recipe.hops.length === 0;
    case "mash":
      return recipe.mashSteps.length === 0;
    case "yeast":
      return recipe.yeasts.length === 0;
    case "fermentation":
      return recipe.fermentationSteps.length === 0;
    case "water":
      return isWaterIntro(recipe);
    default:
      return false;
  }
}
