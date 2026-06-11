'use client';

/**
 * useRecipeCalculations Hook
 *
 * This is the "adapter" layer that makes domain services work with React.
 * It wraps the RecipeCalculationService and makes it reactive.
 *
 * WHY THIS EXISTS:
 * In SwiftUI, you can just call manager.calculate() in your View and it automatically
 * re-renders when needed. In React, you need useMemo to tell React "only recalculate
 * when recipe changes" - otherwise it would recalculate on every render (wasteful).
 *
 * This hook is just a performance wrapper - nothing more.
 */

import { useMemo } from 'react';
import type { Recipe, RecipeCalculations } from '@/modules/recipe/models/Recipe';
import { recipeCalculationService } from '@/modules/recipe/services/RecipeCalculationService';
import { usePreferencesStore } from '@/modules/auth/preferencesStore';

/**
 * Calculate all recipe values (memoized for performance)
 *
 * Usage in component:
 *   const recipe = useRecipeStore(s => s.currentRecipe);
 *   const calculations = useRecipeCalculations(recipe);
 *   return <div>ABV: {calculations?.abv}%</div>
 */
export function useRecipeCalculations(recipe: Recipe | null): RecipeCalculations | null {
  const attenuationModel = usePreferencesStore((s) => s.attenuationModel);

  return useMemo(() => {
    if (!recipe) return null;

    // Call the domain service (your "Manager")
    return recipeCalculationService.calculate(recipe, { attenuationModel });
  }, [recipe, attenuationModel]); // Recalculate when recipe or model changes
}

/**
 * Calculate just OG (useful for forms that only need OG)
 */
export function useOG(recipe: Recipe | null): number {
  return useMemo(() => {
    if (!recipe) return 1.0;
    return recipeCalculationService.calculateOG(recipe);
  }, [recipe]);
}

/**
 * Calculate just ABV
 */
export function useABV(og: number, fg: number): number {
  return useMemo(() => {
    return recipeCalculationService.calculateABV(og, fg);
  }, [og, fg]);
}

/**
 * Calculate just IBU
 */
export function useIBU(recipe: Recipe | null): number {
  return useMemo(() => {
    if (!recipe) return 0;
    const og = recipeCalculationService.calculateOG(recipe);
    return recipeCalculationService.calculateIBU(recipe, og);
  }, [recipe]);
}

/**
 * Calculate just SRM
 */
export function useSRM(recipe: Recipe | null): number {
  return useMemo(() => {
    if (!recipe) return 0;
    return recipeCalculationService.calculateSRM(recipe);
  }, [recipe]);
}
