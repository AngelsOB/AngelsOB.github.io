import { describe, test, expect } from "vitest";
import { volumeCalculationService as svc } from "./VolumeCalculationService";
import type { Recipe, Fermentable, Hop } from "../models/Recipe";

// ── Fixture helpers ─────────────────────────────────────────────────────────
// Equipment defaults chosen as round numbers so expected volumes are hand-derivable.
function createEquipment(
  overrides: Partial<Recipe["equipment"]> = {}
): Recipe["equipment"] {
  return {
    boilTimeMin: 60,
    boilOffRateLPerHour: 4,
    brewhouseEfficiencyPercent: 75,
    mashThicknessLPerKg: 3,
    grainAbsorptionLPerKg: 1,
    mashTunDeadspaceLiters: 0,
    mashTunLossLiters: 0,
    kettleLossLiters: 0,
    hopsAbsorptionLPerKg: 0,
    chillerLossLiters: 0,
    fermenterLossLiters: 0,
    coolingShrinkagePercent: 0,
    ...overrides,
  };
}

function createRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "test-recipe",
    name: "Test Recipe",
    currentVersion: 1,
    batchVolumeL: 20,
    fermentables: [],
    hops: [],
    yeasts: [],
    otherIngredients: [],
    mashSteps: [],
    fermentationSteps: [],
    equipment: createEquipment(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createFermentable(overrides: Partial<Fermentable> = {}): Fermentable {
  return {
    id: "ferm-1",
    name: "Pale Malt 2-Row",
    weightKg: 5,
    colorLovibond: 2,
    ppg: 37,
    efficiencyPercent: 75,
    ...overrides,
  };
}

function createHop(overrides: Partial<Hop> = {}): Hop {
  return {
    id: "hop-1",
    name: "Cascade",
    alphaAcid: 6,
    grams: 100,
    type: "boil",
    timeMinutes: 60,
    ...overrides,
  };
}

describe("VolumeCalculationService", () => {
  // ── calculatePreBoilVolume ────────────────────────────────────────────────
  describe("calculatePreBoilVolume", () => {
    test("batch + boil-off only, no losses/shrinkage", () => {
      // boilOff = 4 L/hr * 60 min / 60 = 4 L
      // shrinkage = 1 + 0/100 = 1
      // preBoil = (20 + 0) * 1 + 4 = 24
      const recipe = createRecipe();
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24, 3);
    });

    test("90 min boil scales boil-off proportionally", () => {
      // boilOff = 4 * 90 / 60 = 6 L
      // preBoil = (20 + 0) * 1 + 6 = 26
      const recipe = createRecipe({
        equipment: createEquipment({ boilTimeMin: 90 }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(26, 3);
    });

    test("adds fixed losses (kettle + chiller + fermenter) before shrinkage", () => {
      // losses = kettle 1 + chiller 0.5 + fermenter 0.5 = 2 (no hops)
      // shrinkage = 1, boilOff = 4
      // preBoil = (20 + 2) * 1 + 4 = 26
      const recipe = createRecipe({
        equipment: createEquipment({
          kettleLossLiters: 1,
          chillerLossLiters: 0.5,
          fermenterLossLiters: 0.5,
        }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(26, 3);
    });

    test("cooling shrinkage scales batch + losses but not boil-off", () => {
      // losses = 0, shrinkage = 1 + 4/100 = 1.04, boilOff = 4
      // preBoil = (20 + 0) * 1.04 + 4 = 20.8 + 4 = 24.8
      const recipe = createRecipe({
        equipment: createEquipment({ coolingShrinkagePercent: 4 }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24.8, 3);
    });

    test("kettle hops add absorption loss (1kg hops @ 0.7 L/kg = 0.7 L)", () => {
      // 1000g boil hops = 1 kg, absorption = 1 * 0.7 = 0.7 L
      // losses = 0.7, shrinkage = 1, boilOff = 4
      // preBoil = (20 + 0.7) * 1 + 4 = 24.7
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.7 }),
        hops: [createHop({ grams: 1000, type: "boil" })],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24.7, 3);
    });

    test("dry-hop and mash hops are excluded from kettle absorption", () => {
      // Only boil/whirlpool/first-wort hops absorb wort in the kettle.
      // dry hop + mash hops here → 0 absorption → preBoil = 20*1 + 4 = 24
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.7 }),
        hops: [
          createHop({ id: "h1", grams: 1000, type: "dry hop" }),
          createHop({ id: "h2", grams: 1000, type: "mash" }),
        ],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24, 3);
    });

    test("whirlpool and first-wort hops ARE counted as kettle absorption", () => {
      // 500g whirlpool + 500g first wort = 1 kg total @ 0.7 = 0.7 L
      // preBoil = (20 + 0.7) * 1 + 4 = 24.7
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.7 }),
        hops: [
          createHop({ id: "h1", grams: 500, type: "whirlpool" }),
          createHop({ id: "h2", grams: 500, type: "first wort" }),
        ],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24.7, 3);
    });

    test("mixed list: only the boil hop absorbs, the dry hop is excluded", () => {
      // The filter line (type === 'boil' || 'whirlpool' || 'first wort') is the most
      // bug-prone branch; exercise it with a HETEROGENEOUS list:
      //   boil hop 700g = 0.7 kg  → counted
      //   dry hop 900g            → excluded
      // absorption = 0.7 kg * 0.7 L/kg = 0.49 L (NOT (0.7+0.9)*0.7 = 1.12)
      // preBoil = (20 + 0.49) * 1 + 4 = 24.49 → rounds to 24.5
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.7 }),
        hops: [
          createHop({ id: "boil", grams: 700, type: "boil" }),
          createHop({ id: "dry", grams: 900, type: "dry hop" }),
        ],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24.5, 3);
    });

    test("mixed list: a 'mash' hop is excluded while a 'boil' hop is counted", () => {
      // boil 1000g = 1 kg counted; mash 1000g excluded.
      // absorption = 1 * 0.5 = 0.5 ; preBoil = (20 + 0.5)*1 + 4 = 24.5
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.5 }),
        hops: [
          createHop({ id: "boil", grams: 1000, type: "boil" }),
          createHop({ id: "mash", grams: 1000, type: "mash" }),
        ],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(24.5, 3);
    });

    test("documents behavior for negative boil-off rate (no guard in source)", () => {
      // The source applies no negative-input guard, so a negative boilOffRate flows
      // straight through the arithmetic: boilOff = (-2 * 60)/60 = -2.
      // preBoil = (20 + 0) * 1 + (-2) = 18. This test PINS the (currently unguarded)
      // behavior so a future guard/clamp change is caught rather than passing silently.
      const recipe = createRecipe({
        equipment: createEquipment({ boilOffRateLPerHour: -2 }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(18, 3);
    });

    test("documents behavior for negative hop weight (no guard in source)", () => {
      // Negative grams → negative kg → negative absorption flows through unguarded:
      //   -500g = -0.5 kg ; absorption = -0.5 * 0.7 = -0.35
      //   preBoil = (20 + (-0.35)) * 1 + 4 = 23.65 → rounds to 23.7 (half-up at .65→.7)
      const recipe = createRecipe({
        equipment: createEquipment({ hopsAbsorptionLPerKg: 0.7 }),
        hops: [createHop({ grams: -500, type: "boil" })],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(23.7, 3);
    });

    test("full combined formula matches hand calculation", () => {
      // batch 20, kettle 1.5, chiller 0.5, fermenter 0.5, hopAbs (2kg*0.7=1.4)
      // losses = 1.5 + 1.4 + 0.5 + 0.5 = 3.9
      // shrinkage = 1.04, boilOff = 4*60/60 = 4
      // preBoil = (20 + 3.9) * 1.04 + 4 = 23.9*1.04 + 4 = 24.856 + 4 = 28.856 → 28.9
      const recipe = createRecipe({
        equipment: createEquipment({
          kettleLossLiters: 1.5,
          chillerLossLiters: 0.5,
          fermenterLossLiters: 0.5,
          hopsAbsorptionLPerKg: 0.7,
          coolingShrinkagePercent: 4,
        }),
        hops: [createHop({ grams: 2000, type: "boil" })],
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBeCloseTo(28.9, 3);
    });

    test("result is rounded to 1 decimal place", () => {
      // boilOff = 4 * 70 / 60 = 4.6666... → contributes a long decimal
      // preBoil = 20 + 4.6666... = 24.6666... → rounds to 24.7
      const recipe = createRecipe({
        equipment: createEquipment({ boilTimeMin: 70 }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBe(24.7);
    });

    test("monotonic: more boil-off → larger pre-boil volume", () => {
      const low = svc.calculatePreBoilVolume(
        createRecipe({ equipment: createEquipment({ boilOffRateLPerHour: 3 }) })
      );
      const high = svc.calculatePreBoilVolume(
        createRecipe({ equipment: createEquipment({ boilOffRateLPerHour: 6 }) })
      );
      expect(high).toBeGreaterThan(low);
    });

    test("zero batch with zero boil/losses → 0", () => {
      const recipe = createRecipe({
        batchVolumeL: 0,
        equipment: createEquipment({ boilOffRateLPerHour: 0 }),
      });
      expect(svc.calculatePreBoilVolume(recipe)).toBe(0);
    });
  });

  // ── calculatePostBoilVolume ───────────────────────────────────────────────
  describe("calculatePostBoilVolume", () => {
    test("equals batch + losses when no shrinkage (= preBoil − boilOff)", () => {
      // preBoil = 24 (batch 20 + boilOff 4), boilOff = 4, shrinkage = 1
      // post = (24 - 4) / 1 = 20
      const recipe = createRecipe();
      expect(svc.calculatePostBoilVolume(recipe)).toBeCloseTo(20, 3);
    });

    test("post-boil with losses + shrinkage = exact value incl. preBoil rounding", () => {
      // EXACT expected, computed from raw inputs (precision 3, not tolerance-padded):
      //   losses    = kettle 1 + chiller 0.5 + fermenter 0.5 = 2
      //   shrinkage = 1.04, boilOff = 4
      //   preBoil   = (20 + 2) * 1.04 + 4 = 22.88 + 4 = 26.88 → round 1dp = 26.9
      //   post      = (26.9 - 4) / 1.04 = 22.9 / 1.04 = 22.0192307692...
      // The ~0.019 offset from batch+losses (22) is the intermediate 1-dp rounding of
      // preBoil; asserting the EXACT 22.019... at precision 3 (tolerance < 0.0005) means
      // a real off-by-a-loss bug (e.g. dropping the 0.5 chiller term) would shift this by
      // ~0.5/1.04 ≈ 0.48 L and fail, instead of being masked by a loose precision-1 band.
      const recipe = createRecipe({
        equipment: createEquipment({
          kettleLossLiters: 1,
          chillerLossLiters: 0.5,
          fermenterLossLiters: 0.5,
          coolingShrinkagePercent: 4,
        }),
      });
      // 22.9 / 1.04 = 22.019230769230766
      expect(svc.calculatePostBoilVolume(recipe)).toBeCloseTo(22.9 / 1.04, 3);
    });

    test("post-boil pinned to raw-input number with shrinkage; NOT trivially = preBoil", () => {
      // Independent check that the shrinkage term has the correct SIGN/OPERATION.
      // With 10% shrinkage and no rounding drift (preBoil lands on an exact 1dp):
      //   shrinkage = 1.10, boilOff = 4, losses = 0
      //   preBoil   = (20 + 0) * 1.10 + 4 = 22 + 4 = 26.0 (exact, no rounding loss)
      //   CORRECT post = (preBoil - boilOff) / shrinkage = (26 - 4) / 1.10 = 20.0
      // If the code divided where it should multiply (or vice-versa) in the shrinkage
      // term, preBoil would instead be (20)/1.1 + 4 = 22.18 and post would be ~16.5,
      // so this exact 20.0 expectation catches a flipped shrinkage operation.
      const recipe = createRecipe({
        equipment: createEquipment({ coolingShrinkagePercent: 10 }),
      });
      const post = svc.calculatePostBoilVolume(recipe);
      const preBoil = svc.calculatePreBoilVolume(recipe);
      // (a) exact value from raw inputs
      expect(post).toBeCloseTo(20, 3);
      // (b) post and preBoil are genuinely different (boil-off + shrinkage applied),
      //     so the round-trip is doing real work, not an identity no-op.
      expect(preBoil).toBeCloseTo(26, 3);
      expect(Math.abs(preBoil - post)).toBeGreaterThan(5);
    });

    test("post-boil is smaller than pre-boil (boil-off removed)", () => {
      const recipe = createRecipe();
      expect(svc.calculatePostBoilVolume(recipe)).toBeLessThan(
        svc.calculatePreBoilVolume(recipe)
      );
    });

    test("never returns negative (clamped to 0)", () => {
      // huge boil-off relative to volume would push (preBoil - boilOff) negative;
      // but preBoil itself includes boilOff so it can't actually go below 0 here —
      // verify the Math.max(0,...) guard with a tiny batch.
      const recipe = createRecipe({
        batchVolumeL: 0,
        equipment: createEquipment({ boilOffRateLPerHour: 0 }),
      });
      expect(svc.calculatePostBoilVolume(recipe)).toBeGreaterThanOrEqual(0);
    });

    test("shrinkage divisor reduces post-boil for the same pre-boil reference", () => {
      // With shrinkage, dividing by >1 shrinks the dissolved-extract volume.
      const noShrink = svc.calculatePostBoilVolume(
        createRecipe({
          equipment: createEquipment({ coolingShrinkagePercent: 0 }),
        })
      );
      const withShrink = svc.calculatePostBoilVolume(
        createRecipe({
          equipment: createEquipment({ coolingShrinkagePercent: 10 }),
        })
      );
      // noShrink: (24-4)/1 = 20 ; withShrink: preBoil=(20)*1.1+4=26 (exact 1dp) → (26-4)/1.1=20
      // Both reconstruct batch=20. The 10% case lands on an exact 1-dp preBoil (26.0) so
      // there is NO rounding drift here — assert exact at precision 3, not a slack band.
      expect(noShrink).toBeCloseTo(20, 3);
      expect(withShrink).toBeCloseTo(20, 3);
    });
  });

  // ── calculateMashWater ────────────────────────────────────────────────────
  describe("calculateMashWater", () => {
    test("grain × thickness + deadspace (5kg @ 3 L/kg + 0 = 15 L)", () => {
      // 5 kg * 3 L/kg + 0 deadspace = 15 L
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      expect(svc.calculateMashWater(recipe)).toBeCloseTo(15, 3);
    });

    test("adds deadspace on top of the strike volume", () => {
      // 5 kg * 3 + 3.5 deadspace = 15 + 3.5 = 18.5 L
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        equipment: createEquipment({ mashTunDeadspaceLiters: 3.5 }),
      });
      expect(svc.calculateMashWater(recipe)).toBeCloseTo(18.5, 3);
    });

    test("sums weight across multiple fermentables", () => {
      // (4 + 1) kg * 3 L/kg + 0 = 15 L
      const recipe = createRecipe({
        fermentables: [
          createFermentable({ id: "f1", weightKg: 4 }),
          createFermentable({ id: "f2", weightKg: 1 }),
        ],
      });
      expect(svc.calculateMashWater(recipe)).toBeCloseTo(15, 3);
    });

    test("empty grist → only deadspace remains", () => {
      // 0 kg * 3 + 2 deadspace = 2 L
      const recipe = createRecipe({
        fermentables: [],
        equipment: createEquipment({ mashTunDeadspaceLiters: 2 }),
      });
      expect(svc.calculateMashWater(recipe)).toBeCloseTo(2, 3);
    });

    test("empty grist and no deadspace → 0", () => {
      const recipe = createRecipe({ fermentables: [] });
      expect(svc.calculateMashWater(recipe)).toBe(0);
    });

    test("monotonic: thicker mash (higher L/kg) → more water", () => {
      const thin = svc.calculateMashWater(
        createRecipe({
          fermentables: [createFermentable({ weightKg: 5 })],
          equipment: createEquipment({ mashThicknessLPerKg: 2.5 }),
        })
      );
      const thick = svc.calculateMashWater(
        createRecipe({
          fermentables: [createFermentable({ weightKg: 5 })],
          equipment: createEquipment({ mashThicknessLPerKg: 4 }),
        })
      );
      expect(thick).toBeGreaterThan(thin);
    });

    test("rounds to 1 decimal place", () => {
      // 3.33 kg * 3 L/kg = 9.99 → rounds to 10.0
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 3.33 })],
      });
      expect(svc.calculateMashWater(recipe)).toBe(10);
    });

    test("half-up rounding boundary: raw value of exactly x.x5 rounds UP", () => {
      // Lock the rounding DIRECTION at the 1-dp boundary (the classic rounding-bug surface).
      // 3.35 kg * 3 L/kg = 10.05 exactly (10.05 is representable here, and 10.05*10 = 100.5).
      // Math.round(100.5) = 101 (round-half-UP), so the result must be 10.1, NOT 10.0.
      // A round-half-to-even or floor implementation would give 10.0 and fail this.
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 3.35 })],
      });
      expect(svc.calculateMashWater(recipe)).toBe(10.1);
    });
  });

  // ── calculateSpargeWater ──────────────────────────────────────────────────
  describe("calculateSpargeWater", () => {
    test("sparge = preBoil − (mashWater − grainAbs − mashTunLoss)", () => {
      // grain 5kg: mashWater = 5*3 + 0 = 15, grainAbs = 5*1 = 5, tunLoss = 0
      // mashRunoff = 15 - 5 - 0 = 10
      // preBoil = (20 + 0)*1 + 4 = 24
      // sparge = 24 - 10 = 14
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      expect(svc.calculateSpargeWater(recipe)).toBeCloseTo(14, 3);
    });

    test("deadspace is recovered (does NOT reduce runoff)", () => {
      // Adding 3.5 L deadspace raises mashWater by 3.5 AND runoff by 3.5,
      // so sparge DROPS by 3.5 vs the no-deadspace case (14 → 10.5).
      // mashWater = 15 + 3.5 = 18.5, grainAbs = 5, tunLoss = 0
      // runoff = 18.5 - 5 - 0 = 13.5 ; sparge = 24 - 13.5 = 10.5
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        equipment: createEquipment({ mashTunDeadspaceLiters: 3.5 }),
      });
      expect(svc.calculateSpargeWater(recipe)).toBeCloseTo(10.5, 3);
    });

    test("mashTunLoss reduces runoff → increases sparge requirement", () => {
      // tunLoss = 1: runoff = 15 - 5 - 1 = 9 ; sparge = 24 - 9 = 15
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        equipment: createEquipment({ mashTunLossLiters: 1 }),
      });
      expect(svc.calculateSpargeWater(recipe)).toBeCloseTo(15, 3);
    });

    test("higher grain absorption → less runoff → more sparge", () => {
      // grainAbs at 1.2 L/kg: 5*1.2 = 6 ; runoff = 15 - 6 = 9 ; sparge = 24 - 9 = 15
      const lowAbs = svc.calculateSpargeWater(
        createRecipe({
          fermentables: [createFermentable({ weightKg: 5 })],
          equipment: createEquipment({ grainAbsorptionLPerKg: 1 }),
        })
      );
      const highAbs = svc.calculateSpargeWater(
        createRecipe({
          fermentables: [createFermentable({ weightKg: 5 })],
          equipment: createEquipment({ grainAbsorptionLPerKg: 1.2 }),
        })
      );
      expect(highAbs).toBeGreaterThan(lowAbs);
    });

    test("clamps to 0 when runoff exceeds pre-boil need", () => {
      // Tiny grist absorbs little, mashWater big from deadspace, so runoff > preBoil.
      // 1kg: mashWater = 1*3 + 30 deadspace = 33, grainAbs = 1, tunLoss = 0
      // runoff = 33 - 1 = 32 ; preBoil = 24 ; sparge = 24 - 32 = -8 → clamped to 0
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 1 })],
        equipment: createEquipment({ mashTunDeadspaceLiters: 30 }),
      });
      expect(svc.calculateSpargeWater(recipe)).toBe(0);
    });

    test("handles missing mashTunLossLiters via ?? 0", () => {
      // Drop mashTunLossLiters entirely; service should treat it as 0.
      // Build equipment without the field, cast to satisfy the type.
      const eq = createEquipment({ mashTunLossLiters: 0 }) as Record<
        string,
        number
      >;
      delete eq.mashTunLossLiters;
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        equipment: eq as unknown as Recipe["equipment"],
      });
      // runoff = 15 - 5 - 0 = 10 ; sparge = 24 - 10 = 14
      expect(svc.calculateSpargeWater(recipe)).toBeCloseTo(14, 3);
    });

    test("never negative", () => {
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 1 })],
        equipment: createEquipment({ mashTunDeadspaceLiters: 100 }),
      });
      expect(svc.calculateSpargeWater(recipe)).toBeGreaterThanOrEqual(0);
    });
  });

  // ── calculateTotalWater ───────────────────────────────────────────────────
  describe("calculateTotalWater", () => {
    test("total = mashWater + spargeWater", () => {
      // mashWater = 15, sparge = 14 → total = 29
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      expect(svc.calculateTotalWater(recipe)).toBeCloseTo(29, 3);
    });

    test("total water equals preBoil + grainAbs + mashTunLoss (mass balance)", () => {
      // Independent literal from raw inputs (NOT routed through svc.calculatePreBoilVolume):
      //   preBoil  = (batch 20 + losses 0) * shrinkage 1 + boilOff 4         = 24
      //   grainAbs = grain 5 kg * grainAbsorptionLPerKg 1                     = 5
      //   tunLoss  = 0
      //   total    = preBoil + grainAbs + tunLoss = 24 + 5 + 0               = 29
      // This is the same 29 the sibling test derives from mashWater + sparge,
      // proving the mass-balance identity against a hard-coded number, not the code.
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      expect(svc.calculateTotalWater(recipe)).toBeCloseTo(29, 3);
    });

    test("mass balance with losses + shrinkage = independently-computed literal", () => {
      // A second mass-balance check where every term is non-trivial, hand-derived
      // from raw inputs with shrinkage present (no svc call on the expected side):
      //   losses    = kettle 1 + chiller 0.5 + fermenter 0.5                 = 2
      //   shrinkage = 1 + 4/100                                              = 1.04
      //   boilOff   = 4 L/hr * 60 min / 60                                   = 4
      //   preBoil   = (20 + 2) * 1.04 + 4 = 22.88 + 4 = 26.88 → round 1dp    = 26.9
      //   grain 5 kg: mashWater = 5*3 + 0 = 15, grainAbs = 5*1 = 5, tunLoss 0
      //   runoff    = 15 - 5 - 0 = 10 ; sparge = 26.9 - 10 = 16.9
      //   total     = mashWater 15 + sparge 16.9                            = 31.9
      const recipe = createRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        equipment: createEquipment({
          kettleLossLiters: 1,
          chillerLossLiters: 0.5,
          fermenterLossLiters: 0.5,
          coolingShrinkagePercent: 4,
        }),
      });
      expect(svc.calculateTotalWater(recipe)).toBeCloseTo(31.9, 3);
    });

    test("empty grist: mash water 0, sparge = preBoil", () => {
      // mashWater = 0, runoff = 0, sparge = 24 - 0 = 24 → total = 24
      const recipe = createRecipe({ fermentables: [] });
      expect(svc.calculateTotalWater(recipe)).toBeCloseTo(24, 3);
    });
  });

  // ── calculateStrikeTemp ───────────────────────────────────────────────────
  describe("calculateStrikeTemp", () => {
    test("matches Palmer's published imperial strike formula via unit conversion", () => {
      // INDEPENDENT REFERENCE — does NOT echo the source's 0.41 constant.
      //
      // Palmer ("How to Brew") publishes the strike-water formula in IMPERIAL units:
      //   Tw = (0.2 / r)(T2 - T1) + T2
      // where r is mash thickness in QUARTS PER POUND and temps are in °F. The 0.2 is
      // the grain:water heat-capacity ratio expressed for qt/lb thickness.
      //
      // Reconstruct the same physical answer from that published imperial form, converting
      // the metric inputs (67°C, 3 L/kg, 20°C grain) using only external unit constants:
      //   1 quart  = 0.946353 L      1 pound = 0.453592 kg
      //   °F = °C * 9/5 + 32
      const L_PER_QUART = 0.946353;
      const KG_PER_POUND = 0.453592;
      const cToF = (c: number) => (c * 9) / 5 + 32;
      const fToC = (f: number) => ((f - 32) * 5) / 9;

      const targetC = 67;
      const grainC = 20;
      const thicknessLPerKg = 3;

      // metric L/kg → imperial qt/lb
      const qtPerLb_to_LperKg = L_PER_QUART / KG_PER_POUND; // 2.08635...
      const rQtPerLb = thicknessLPerKg / qtPerLb_to_LperKg;

      const TwF = (0.2 / rQtPerLb) * (cToF(targetC) - cToF(grainC)) + cToF(targetC);
      const referenceStrikeC = fToC(TwF); // Palmer-imperial answer ≈ 73.5°C

      // The service's metric constant (0.41) is a rounding of the exact converted constant
      // 0.2 * (0.946353/0.453592) = 0.4173 L/kg, so the two agree to within ~0.15°C.
      // A grossly wrong constant (e.g. 0.30 → ~71.7 or 0.55 → ~75.6) would blow past this.
      expect(svc.calculateStrikeTemp(targetC, thicknessLPerKg, grainC)).toBeCloseTo(
        referenceStrikeC,
        0
      );
    });

    test("reverse-solved heat-capacity constant ≈ 0.417 (Palmer imperial 0.2 → metric)", () => {
      // Verify the OPAQUE constant directly, against an external reference, by reverse-
      // solving it from two function calls instead of reading it off the source.
      //   strike = (T - g) * (k / R) + T   ⇒   k = (strike - T) * R / (T - g)
      // Use the rounded outputs; solve k from each and require they agree, AND that the
      // recovered value matches the independently-derived metric constant.
      //   Independent target: Palmer's imperial 0.2 (qt/lb) converted with exact unit
      //   factors = 0.2 * (0.946353 / 0.453592) = 0.41727 L/kg.
      const REFERENCE_K = 0.2 * (0.946353 / 0.453592); // 0.41727...

      const solveK = (target: number, R: number, grain: number) => {
        const strike = svc.calculateStrikeTemp(target, R, grain);
        return ((strike - target) * R) / (target - grain);
      };

      // Two independent operating points (different thickness AND grain temp).
      const k1 = solveK(67, 3, 20); // larger ΔT, thicker mash
      const k2 = solveK(70, 2, 12); // different target, thinner mash, colder grain

      // (a) the constant is the SAME at both points (it is not thickness/temp dependent).
      //     Tolerance 0.02 absorbs the 1-dp output rounding (≈ ±0.05°C / typical ΔT).
      expect(k1).toBeCloseTo(k2, 1);
      // (b) it matches the externally-derived metric heat ratio ~0.417 (source uses 0.41).
      expect(k1).toBeCloseTo(REFERENCE_K, 1);
      expect(k1).toBeGreaterThan(0.38);
      expect(k1).toBeLessThan(0.45);
    });

    test("explicit hand calc: target 67°C, thickness 3 L/kg, grain 20°C", () => {
      // T = (k / R)(T_target - T_grain) + T_target with the module's metric k = 0.41
      // (verified against Palmer's imperial 0.2 above):
      //   = (0.41/3)(67 - 20) + 67 = 0.136667 * 47 + 67 = 6.4233 + 67 = 73.4233 → 73.4
      expect(svc.calculateStrikeTemp(67, 3)).toBeCloseTo(73.4, 2);
    });

    test("default grain temp is 20°C", () => {
      // Passing grainTemp=20 explicitly must equal the defaulted call.
      expect(svc.calculateStrikeTemp(67, 3)).toBe(
        svc.calculateStrikeTemp(67, 3, 20)
      );
    });

    test("colder grain → higher strike temp needed", () => {
      // (0.41/3)(67-10) + 67 = 0.136667*57 + 67 = 7.79 + 67 = 74.79 → 74.8
      expect(svc.calculateStrikeTemp(67, 3, 10)).toBeCloseTo(74.8, 1);
    });

    test("monotonic: colder grain raises strike temp", () => {
      const warmGrain = svc.calculateStrikeTemp(67, 3, 22);
      const coldGrain = svc.calculateStrikeTemp(67, 3, 10);
      expect(coldGrain).toBeGreaterThan(warmGrain);
    });

    test("thinner mash (lower L/kg) → higher strike temp", () => {
      // 0.41/R grows as R shrinks, so thinner mash needs hotter strike water.
      const thick = svc.calculateStrikeTemp(67, 4); // 0.41/4 * 47 + 67
      const thin = svc.calculateStrikeTemp(67, 2); // 0.41/2 * 47 + 67
      expect(thin).toBeGreaterThan(thick);
    });

    test("grain already at target → strike equals target", () => {
      // tempDiff = 0 → strike = 0 + target = target
      expect(svc.calculateStrikeTemp(65, 3, 65)).toBe(65);
    });

    test("strike temp is always above target when grain is colder", () => {
      // Physical sanity: you must overshoot mash temp because cold grain pulls it down.
      const target = 66;
      const strike = svc.calculateStrikeTemp(target, 3, 18);
      expect(strike).toBeGreaterThan(target);
    });

    test("rounds a long-decimal raw result to 1 decimal place", () => {
      // Raw (unrounded) strike for 67°C / 3 L/kg / 20°C grain:
      //   (0.41/3)(67-20) + 67 = 0.136666... * 47 + 67 = 6.42333... + 67 = 73.42333...
      // A correctly-rounding implementation returns exactly 73.4 (not 73.42, not 73.5).
      // This is a non-trivial case: an unrounded result (73.4233...) or a wrongly-rounded
      // one would differ from 73.4, so unlike `Number.isInteger(result*10)` this CAN fail.
      expect(svc.calculateStrikeTemp(67, 3, 20)).toBe(73.4);
    });
  });

  // ── singleton export ──────────────────────────────────────────────────────
  describe("singleton export", () => {
    test("volumeCalculationService is an instance with the expected methods", () => {
      expect(typeof svc.calculatePreBoilVolume).toBe("function");
      expect(typeof svc.calculatePostBoilVolume).toBe("function");
      expect(typeof svc.calculateMashWater).toBe("function");
      expect(typeof svc.calculateSpargeWater).toBe("function");
      expect(typeof svc.calculateTotalWater).toBe("function");
      expect(typeof svc.calculateStrikeTemp).toBe("function");
    });
  });
});
