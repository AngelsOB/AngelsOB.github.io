/**
 * Tier access control — single source of truth for feature gating.
 *
 * Pure logic, no Firebase or browser dependencies.
 * UI components call canAccess() to decide what to render.
 * Firestore rules + API routes enforce server-side.
 */

export type UserState = 'anonymous' | 'free' | 'premium';

export type Feature =
  | 'save_recipe'
  | 'unlimited_recipes'
  | 'export'
  | 'enhanced_brew_mode'
  | 'auto_water_calc'
  | 'fork'
  | 'publish';

/** Max cloud-saved recipes for free-tier users. */
export const RECIPE_LIMIT = 5;

/** Features that require any sign-in (anonymous cannot access). */
const REQUIRES_AUTH: Feature[] = [
  'save_recipe',
  'fork',
  'publish',
  'export',
];

/** Features exclusive to Premium subscribers. */
const PREMIUM_FEATURES: Feature[] = [
  'unlimited_recipes',
  'export',
  'enhanced_brew_mode',
  'auto_water_calc',
];

/**
 * Can a user in the given state access this feature?
 *
 * - Premium: everything.
 * - Free: everything except PREMIUM_FEATURES.
 * - Anonymous: only features that need neither auth nor premium.
 */
export function canAccess(feature: Feature, state: UserState): boolean {
  if (state === 'premium') return true;
  if (state === 'anonymous') {
    return !REQUIRES_AUTH.includes(feature) && !PREMIUM_FEATURES.includes(feature);
  }
  // free
  return !PREMIUM_FEATURES.includes(feature);
}

/**
 * Can the user create another recipe given their current count?
 *
 * Anonymous users cannot save at all.
 * Free users are capped at RECIPE_LIMIT.
 * Premium users are unlimited.
 */
export function canCreateRecipe(state: UserState, recipeCount: number): boolean {
  if (state === 'anonymous') return false;
  if (state === 'premium') return true;
  return recipeCount < RECIPE_LIMIT;
}
