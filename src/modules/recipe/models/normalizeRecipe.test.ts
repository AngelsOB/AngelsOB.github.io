import { describe, test, expect } from "vitest";
import { normalizeRecipe } from "./normalizeRecipe";
import type { Recipe } from "./Recipe";

// Minimal recipe whose equipment carries an arbitrary efficiency key, so we can
// exercise the legacy → current field migration without a full fixture.
function recipeWithEquipment(equipment: Record<string, unknown>): Recipe {
  return {
    id: "r1",
    name: "R",
    batchVolumeL: 20,
    fermentables: [],
    hops: [],
    yeasts: [],
    mashSteps: [],
    fermentationSteps: [],
    otherIngredients: [],
    equipment,
  } as unknown as Recipe;
}

describe("normalizeRecipe", () => {
  test("maps legacy mashEfficiencyPercent → brewhouseEfficiencyPercent", () => {
    const legacy = recipeWithEquipment({ mashEfficiencyPercent: 68 });
    const out = normalizeRecipe(legacy);
    expect(out.equipment.brewhouseEfficiencyPercent).toBe(68);
  });

  test("does not overwrite an existing brewhouseEfficiencyPercent", () => {
    const current = recipeWithEquipment({
      brewhouseEfficiencyPercent: 72,
      mashEfficiencyPercent: 80, // stale legacy key present too
    });
    const out = normalizeRecipe(current);
    expect(out.equipment.brewhouseEfficiencyPercent).toBe(72);
  });

  test("leaves an already-current recipe untouched (same reference)", () => {
    const current = recipeWithEquipment({ brewhouseEfficiencyPercent: 75 });
    expect(normalizeRecipe(current)).toBe(current);
  });

  test("ignores a non-numeric legacy value (no bogus brewhouse field)", () => {
    const weird = recipeWithEquipment({ mashEfficiencyPercent: undefined });
    const out = normalizeRecipe(weird);
    expect(out.equipment.brewhouseEfficiencyPercent).toBeUndefined();
  });

  test("does not mutate the input recipe", () => {
    const legacy = recipeWithEquipment({ mashEfficiencyPercent: 68 });
    normalizeRecipe(legacy);
    expect(
      (legacy.equipment as Record<string, unknown>).brewhouseEfficiencyPercent
    ).toBeUndefined();
  });
});
