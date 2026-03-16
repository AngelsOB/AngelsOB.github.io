import { describe, test, expect } from 'vitest';
import {
  canAccess,
  canCreateRecipe,
  RECIPE_LIMIT,
  type Feature,
  type UserState,
} from './tierAccess';

describe('tierAccess', () => {
  describe('canAccess', () => {
    // --- Premium gets everything ---
    test('premium can access all features', () => {
      const features: Feature[] = [
        'save_recipe',
        'unlimited_recipes',
        'export',
        'enhanced_brew_mode',
        'auto_water_calc',
        'fork',
        'publish',
      ];
      for (const feature of features) {
        expect(canAccess(feature, 'premium')).toBe(true);
      }
    });

    // --- Anonymous ---
    test('anonymous cannot save recipes', () => {
      expect(canAccess('save_recipe', 'anonymous')).toBe(false);
    });

    test('anonymous cannot fork', () => {
      expect(canAccess('fork', 'anonymous')).toBe(false);
    });

    test('anonymous cannot publish', () => {
      expect(canAccess('publish', 'anonymous')).toBe(false);
    });

    test('anonymous cannot export', () => {
      expect(canAccess('export', 'anonymous')).toBe(false);
    });

    test('anonymous cannot access premium features', () => {
      expect(canAccess('unlimited_recipes', 'anonymous')).toBe(false);
      expect(canAccess('enhanced_brew_mode', 'anonymous')).toBe(false);
      expect(canAccess('auto_water_calc', 'anonymous')).toBe(false);
    });

    // --- Free ---
    test('free can save recipes', () => {
      expect(canAccess('save_recipe', 'free')).toBe(true);
    });

    test('free can fork', () => {
      expect(canAccess('fork', 'free')).toBe(true);
    });

    test('free can publish', () => {
      expect(canAccess('publish', 'free')).toBe(true);
    });

    test('free cannot export', () => {
      expect(canAccess('export', 'free')).toBe(false);
    });

    test('free cannot access unlimited recipes', () => {
      expect(canAccess('unlimited_recipes', 'free')).toBe(false);
    });

    test('free cannot access enhanced brew mode', () => {
      expect(canAccess('enhanced_brew_mode', 'free')).toBe(false);
    });

    test('free cannot access auto water calc', () => {
      expect(canAccess('auto_water_calc', 'free')).toBe(false);
    });
  });

  describe('canCreateRecipe', () => {
    test('anonymous can never create recipes', () => {
      expect(canCreateRecipe('anonymous', 0)).toBe(false);
    });

    test('premium can always create recipes', () => {
      expect(canCreateRecipe('premium', 0)).toBe(true);
      expect(canCreateRecipe('premium', 100)).toBe(true);
    });

    test('free can create when under limit', () => {
      expect(canCreateRecipe('free', 0)).toBe(true);
      expect(canCreateRecipe('free', 4)).toBe(true);
    });

    test('free cannot create at limit', () => {
      expect(canCreateRecipe('free', RECIPE_LIMIT)).toBe(false);
    });

    test('free cannot create over limit', () => {
      expect(canCreateRecipe('free', RECIPE_LIMIT + 1)).toBe(false);
    });
  });

  describe('RECIPE_LIMIT', () => {
    test('is 5', () => {
      expect(RECIPE_LIMIT).toBe(5);
    });
  });
});
