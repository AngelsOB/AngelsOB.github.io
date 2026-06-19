// Simple ABV approximation using the standard formula.
// Single source of truth for the ABV formula — RecipeCalculationService.calculateABV
// and BrewSessionCalculationService.calculateABV delegate here so the
// implementations can't drift.

/** Standard ABV factor: ABV% = (OG − FG) × 131.25. */
export const ABV_FACTOR = 131.25;

export function abvFromOGFG(og: number, fg: number): number {
  return (og - fg) * ABV_FACTOR;
}
