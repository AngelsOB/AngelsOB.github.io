// Simple ABV approximation using the standard formula.
// Single source of truth for the ABV formula — RecipeCalculationService.calculateABV
// delegates here so the two implementations can't drift.
export function abvFromOGFG(og: number, fg: number): number {
  return (og - fg) * 131.25;
}
