import { describe, test, expect } from "vitest";
import { fermentableCalculationService as svc } from "./FermentableCalculationService";
import type { Fermentable } from "../models/Recipe";

// ── Fixture helper ──────────────────────────────────────────────────────────
// Build a minimally-valid Fermentable. id / weightKg / ppg drive the math; the
// `name` now matters too — the weight solver infers type from it (sugar/extract
// vs grain) to pick the extraction efficiency. The default "Test Malt" infers as
// a grain. `efficiencyPercent` is required by the type but no longer read by the
// solver (the equipment mash efficiency drives grain extraction).
function makeFermentable(overrides: Partial<Fermentable> & { id: string }): Fermentable {
  return {
    name: "Test Malt",
    weightKg: 0,
    colorLovibond: 2,
    ppg: 36,
    efficiencyPercent: 75,
    ...overrides,
  };
}

describe("FermentableCalculationService", () => {
  // ── calculatePercentsFromWeights ──────────────────────────────────────────

  describe("calculatePercentsFromWeights", () => {
    test("two equal weights → 50% / 50%", () => {
      // total = 2 + 2 = 4kg; each = 2/4 * 100 = 50.0%
      const ferms = [
        makeFermentable({ id: "a", weightKg: 2 }),
        makeFermentable({ id: "b", weightKg: 2 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms);
      expect(pct["a"]).toBe(50.0);
      expect(pct["b"]).toBe(50.0);
    });

    test("unequal weights → weighted percentages summing to 100", () => {
      // total = 4 + 1 = 5kg; a = 4/5*100 = 80.0, b = 1/5*100 = 20.0
      const ferms = [
        makeFermentable({ id: "a", weightKg: 4 }),
        makeFermentable({ id: "b", weightKg: 1 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms);
      expect(pct["a"]).toBe(80.0);
      expect(pct["b"]).toBe(20.0);
      expect(pct["a"] + pct["b"]).toBe(100.0);
    });

    test("rounds to one decimal place", () => {
      // total = 1 + 2 = 3kg; a = 1/3*100 = 33.333... → toFixed(1) = 33.3
      const ferms = [
        makeFermentable({ id: "a", weightKg: 1 }),
        makeFermentable({ id: "b", weightKg: 2 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms);
      expect(pct["a"]).toBe(33.3);
      expect(pct["b"]).toBe(66.7);
    });

    test("single fermentable → 100%", () => {
      // total = 5kg; 5/5*100 = 100.0
      const ferms = [makeFermentable({ id: "only", weightKg: 5 })];
      const pct = svc.calculatePercentsFromWeights(ferms);
      expect(pct["only"]).toBe(100.0);
    });

    test("zero total weight → all 0 (division-by-zero guard)", () => {
      // totalKg = 0 → guard returns 0 for each rather than NaN
      const ferms = [
        makeFermentable({ id: "a", weightKg: 0 }),
        makeFermentable({ id: "b", weightKg: 0 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms);
      expect(pct["a"]).toBe(0);
      expect(pct["b"]).toBe(0);
    });

    test("empty input → empty record", () => {
      const pct = svc.calculatePercentsFromWeights([]);
      expect(pct).toEqual({});
    });

    test("percentages are finite, non-negative, and sum to ~100", () => {
      // Invariant of a percentage function over a non-degenerate (total > 0)
      // bill: every share is finite and >= 0, AND the shares sum to 100.
      // The sum-to-100 check is the load-bearing one — it fails for an impl
      // that returns raw weights or all-zeros. (One-decimal rounding means the
      // sum can drift a touch off 100, so allow a small tolerance.)
      const ferms = [
        makeFermentable({ id: "a", weightKg: 3.7 }),
        makeFermentable({ id: "b", weightKg: 0.1 }),
        makeFermentable({ id: "c", weightKg: 0 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms);
      let sum = 0;
      for (const v of Object.values(pct)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        sum += v;
      }
      // total = 3.7 + 0.1 + 0 = 3.8kg; the c=0 grain adds 0, a+b cover the rest
      expect(sum).toBeCloseTo(100, 1);
    });

    test("more weight on a grain → higher percentage (monotonicity)", () => {
      // Same partner grain; raising one grain's weight raises its share.
      const low = svc.calculatePercentsFromWeights([
        makeFermentable({ id: "a", weightKg: 1 }),
        makeFermentable({ id: "b", weightKg: 4 }),
      ]);
      const high = svc.calculatePercentsFromWeights([
        makeFermentable({ id: "a", weightKg: 3 }),
        makeFermentable({ id: "b", weightKg: 4 }),
      ]);
      expect(high["a"]).toBeGreaterThan(low["a"]);
    });
  });

  // ── calculateTotalPercent ─────────────────────────────────────────────────

  describe("calculateTotalPercent", () => {
    test("sums supplied percentages for present ids", () => {
      // 80 + 20 = 100
      const ferms = [
        makeFermentable({ id: "a" }),
        makeFermentable({ id: "b" }),
      ];
      const total = svc.calculateTotalPercent(ferms, { a: 80, b: 20 });
      expect(total).toBe(100);
    });

    test("treats a missing id as 0 (nullish coalescing)", () => {
      // a=60 present, b absent → 60 + 0 = 60
      const ferms = [
        makeFermentable({ id: "a" }),
        makeFermentable({ id: "b" }),
      ];
      const total = svc.calculateTotalPercent(ferms, { a: 60 });
      expect(total).toBe(60);
    });

    test("empty fermentables → 0", () => {
      expect(svc.calculateTotalPercent([], { a: 50 })).toBe(0);
    });

    test("can exceed or fall short of 100 (no clamping)", () => {
      // 70 + 70 = 140; service does not normalise
      const ferms = [
        makeFermentable({ id: "a" }),
        makeFermentable({ id: "b" }),
      ];
      expect(svc.calculateTotalPercent(ferms, { a: 70, b: 70 })).toBe(140);
    });

    test("only counts ids present in the fermentables list", () => {
      // percentById has an extra id "c" not in the list → ignored
      const ferms = [makeFermentable({ id: "a" })];
      const total = svc.calculateTotalPercent(ferms, { a: 25, c: 999 });
      expect(total).toBe(25);
    });
  });

  // ── calculateWeightsFromPercentsAndABV ────────────────────────────────────

  describe("calculateWeightsFromPercentsAndABV", () => {
    // Shared physical constants used to hand-derive expected grain weights.
    const galPerL = 0.264172; // US gal per litre
    const lbsPerKg = 2.20462; // lb per kg

    test("single all-base-malt bill hits the hand-derived total weight", () => {
      // Target: 5% ABV, 20L post-boil, 75% mash eff (drives the grain's 0.75
      // extraction), atten 0.75.
      // OG = 1 + 5 / (131.25 * 0.75) = 1 + 5/98.4375 = 1.050793...
      //   points/gal = 50.793...
      //   volumeGal = 20 * 0.264172 = 5.28344 gal
      //   totalGuNeeded = 50.793... * 5.28344 = 268.37... GU
      // effectiveGuPerLb = pct(1.0) * ppg(36) * eff(0.75) = 27.0 GU/lb
      // totalLb = 268.37 / 27.0 = 9.9396 lb
      // totalKg = 9.9396 / 2.20462 = 4.5085 kg
      const og = 1 + 5 / (131.25 * 0.75);
      const totalGuNeeded = (og - 1) * 1000 * (20 * galPerL);
      const effectiveGuPerLb = 1.0 * 36 * 0.75;
      const expectedKg = totalGuNeeded / effectiveGuPerLb / lbsPerKg;

      const ferms = [makeFermentable({ id: "base", weightKg: 0, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.75);
      expect(result[0].weightKg).toBeCloseTo(expectedKg, 4);
      expect(expectedKg).toBeCloseTo(4.5085, 3); // sanity anchor
    });

    test("splits total weight across grains in proportion to percentages", () => {
      // Two grains, identical ppg/eff so effectiveGuPerLb is the average,
      // 70/30 split → grain A weighs exactly (70/30) times grain B.
      const ferms = [
        makeFermentable({ id: "a", ppg: 36, efficiencyPercent: 75 }),
        makeFermentable({ id: "b", ppg: 36, efficiencyPercent: 75 }),
      ];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { a: 70, b: 30 }, 5.5, 19, 70, 0.78);
      const a = result.find(f => f.id === "a")!;
      const b = result.find(f => f.id === "b")!;
      expect(a.weightKg / b.weightKg).toBeCloseTo(70 / 30, 5);
    });

    test("matches full hand calculation for a two-grain bill", () => {
      // 6% ABV, 19L post-boil, atten 0.80, 90% base @ ppg 37, 10% crystal @ ppg 34.
      // Both are grains (name → grain), so both extract at the 90% mash efficiency
      // — the per-grain efficiencyPercent field is no longer consulted.
      // OG = 1 + 6 / (131.25 * 0.80) = 1 + 6/105 = 1.0571428...
      //   points/gal = 57.142857...
      //   volumeGal = 19 * 0.264172 = 5.019268 gal
      //   totalGuNeeded = 57.142857 * 5.019268 = 286.81530... GU
      // effectiveGuPerLb = 0.9*37*0.90 + 0.1*34*0.90
      //                  = 29.97 + 3.06 = 33.03 GU/lb
      // totalLb = 286.8153 / 33.03 = 8.68348 lb
      // totalKg = 8.68348 / 2.20462 = 3.93876 kg
      // base = 0.9 * totalKg, crystal = 0.1 * totalKg
      const og = 1 + 6 / (131.25 * 0.8);
      const totalGuNeeded = (og - 1) * 1000 * (19 * galPerL);
      const effectiveGuPerLb = 0.9 * 37 * 0.9 + 0.1 * 34 * 0.9;
      const totalKg = totalGuNeeded / effectiveGuPerLb / lbsPerKg;

      const ferms = [
        makeFermentable({ id: "base", ppg: 37, efficiencyPercent: 80 }),
        makeFermentable({ id: "crystal", ppg: 34, efficiencyPercent: 70 }),
      ];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 90, crystal: 10 }, 6, 19, 90, 0.8);
      const base = result.find(f => f.id === "base")!;
      const crystal = result.find(f => f.id === "crystal")!;
      // Independent literal anchors (computed once by hand / external reference,
      // NOT re-derived from the inline formula). These are what catch a
      // structural formula bug that the inline re-derivation would mirror:
      //   totalKg ≈ 3.93876, base = 0.9*total ≈ 3.54489, crystal = 0.1*total ≈ 0.39388
      expect(base.weightKg + crystal.weightKg).toBeCloseTo(3.93876, 4);
      expect(base.weightKg).toBeCloseTo(3.54489, 4);
      expect(crystal.weightKg).toBeCloseTo(0.39388, 4);
      // Cross-check against the inline derivation too (proportional split).
      expect(base.weightKg).toBeCloseTo(0.9 * totalKg, 4);
      expect(crystal.weightKg).toBeCloseTo(0.1 * totalKg, 4);
      expect(base.weightKg + crystal.weightKg).toBeCloseTo(totalKg, 4);
    });

    test("lower mash efficiency → more grain for the same ABV (monotonic in efficiency)", () => {
      // Equipment mash efficiency now drives grain extraction (mirroring the
      // forward OG calc). A lower brewhouse efficiency requires MORE grain for the
      // same target ABV: weight ∝ 1/efficiency, so 60% vs 90% differ by 90/60 = 1.5.
      const ferms = [makeFermentable({ id: "base", ppg: 36 })];
      const lowMashEff = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 60, 0.75);
      const highMashEff = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 90, 0.75);
      expect(lowMashEff[0].weightKg).toBeGreaterThan(highMashEff[0].weightKg);
      expect(lowMashEff[0].weightKg / highMashEff[0].weightKg).toBeCloseTo(90 / 60, 4);
    });

    test("per-grain efficiencyPercent is ignored; equipment mash efficiency drives extraction", () => {
      // The grain solver mirrors the OG calc: grains extract at the SYSTEM mash
      // efficiency, never the per-grain efficiencyPercent field. So two grains
      // differing ONLY in efficiencyPercent compute the same weight at fixed mashEff…
      const fermsLowField = [makeFermentable({ id: "x", ppg: 36, efficiencyPercent: 50 })];
      const fermsHighField = [makeFermentable({ id: "x", ppg: 36, efficiencyPercent: 95 })];
      const rLow = svc.calculateWeightsFromPercentsAndABV(fermsLowField, { x: 100 }, 5, 20, 75, 0.75);
      const rHigh = svc.calculateWeightsFromPercentsAndABV(fermsHighField, { x: 100 }, 5, 20, 75, 0.75);
      expect(rLow[0].weightKg).toBeCloseTo(rHigh[0].weightKg, 9);
      // …whereas changing the equipment mashEff DOES move the weight.
      const rDiffEff = svc.calculateWeightsFromPercentsAndABV(fermsLowField, { x: 100 }, 5, 20, 60, 0.75);
      expect(rDiffEff[0].weightKg).not.toBeCloseTo(rLow[0].weightKg, 3);
    });

    test("non-fermentable extract (lactose) raises the total bill to still hit ABV", () => {
      // Lactose (fermentability 0) contributes OG but no alcohol, so the solver
      // must build a bigger bill than an all-fermentable bill of the same %s —
      // the average-fermentability weighting in the OG inversion.
      const withLactose = svc.calculateWeightsFromPercentsAndABV(
        [
          makeFermentable({ id: "base", name: "Pale Malt", ppg: 36 }),
          makeFermentable({ id: "lac", name: "Lactose", ppg: 35 }),
        ],
        { base: 85, lac: 15 }, 5.5, 20, 75, 0.75,
      );
      const allFermentable = svc.calculateWeightsFromPercentsAndABV(
        [
          makeFermentable({ id: "base", name: "Pale Malt", ppg: 36 }),
          makeFermentable({ id: "x", name: "Pale Malt", ppg: 35 }),
        ],
        { base: 85, x: 15 }, 5.5, 20, 75, 0.75,
      );
      const totLactose = withLactose.reduce((s, f) => s + f.weightKg, 0);
      const totFermentable = allFermentable.reduce((s, f) => s + f.weightKg, 0);
      expect(totLactose).toBeGreaterThan(totFermentable);
    });

    test("sugar/extract extract at 100%, unaffected by mash efficiency", () => {
      // Corn Sugar → type 'sugar' → 100% efficiency regardless of mashEff, mirroring
      // the forward OG calc; so two mashEff values give the SAME sugar weight.
      const sugar = [makeFermentable({ id: "s", name: "Corn Sugar", ppg: 46 })];
      const at60 = svc.calculateWeightsFromPercentsAndABV(sugar, { s: 100 }, 5, 20, 60, 0.75);
      const at90 = svc.calculateWeightsFromPercentsAndABV(sugar, { s: 100 }, 5, 20, 90, 0.75);
      expect(at60[0].weightKg).toBeCloseTo(at90[0].weightKg, 9);
      // Control: a grain at the same nominal ppg WOULD differ across mashEff.
      const grain = [makeFermentable({ id: "g", name: "Pale Malt", ppg: 46 })];
      const g60 = svc.calculateWeightsFromPercentsAndABV(grain, { g: 100 }, 5, 20, 60, 0.75);
      const g90 = svc.calculateWeightsFromPercentsAndABV(grain, { g: 100 }, 5, 20, 90, 0.75);
      expect(g60[0].weightKg).not.toBeCloseTo(g90[0].weightKg, 3);
    });

    test("higher target ABV → more grain (monotonic in ABV)", () => {
      // totalGuNeeded scales with (OG-1) which rises with targetABV.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const low = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 4, 20, 75, 0.75);
      const high = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 8, 20, 75, 0.75);
      expect(high[0].weightKg).toBeGreaterThan(low[0].weightKg);
    });

    test("larger post-boil volume → more grain (monotonic in volume)", () => {
      // totalGuNeeded scales linearly with volumeGal.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const small = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 10, 75, 0.75);
      const large = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 40, 75, 0.75);
      // Volume 4x → grain 4x (purely linear at fixed everything else)
      expect(large[0].weightKg).toBeCloseTo(small[0].weightKg * 4, 4);
    });

    test("higher attenuation → less grain needed for same ABV (monotonic)", () => {
      // OG = 1 + ABV/(131.25*atten): higher atten → lower required OG → less grain.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const lowAtten = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.6);
      const highAtten = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.9);
      expect(highAtten[0].weightKg).toBeLessThan(lowAtten[0].weightKg);
    });

    test("higher PPG grain → less weight for same ABV (monotonic in ppg)", () => {
      // effectiveGuPerLb rises with ppg → totalLb falls.
      const lowPpg = svc.calculateWeightsFromPercentsAndABV(
        [makeFermentable({ id: "x", ppg: 30, efficiencyPercent: 75 })], { x: 100 }, 5, 20, 75, 0.75
      );
      const highPpg = svc.calculateWeightsFromPercentsAndABV(
        [makeFermentable({ id: "x", ppg: 40, efficiencyPercent: 75 })], { x: 100 }, 5, 20, 75, 0.75
      );
      expect(highPpg[0].weightKg).toBeLessThan(lowPpg[0].weightKg);
    });

    test("attenuation is clamped to a max of 0.98", () => {
      // atten 5.0 clamps to 0.98; result must equal an explicit 0.98 call.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const clamped = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 5.0);
      const explicit = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.98);
      expect(clamped[0].weightKg).toBeCloseTo(explicit[0].weightKg, 6);
    });

    test("attenuation is clamped to a min of 0.40", () => {
      // atten 0.1 clamps to 0.40; result must equal an explicit 0.40 call.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const clamped = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.1);
      const explicit = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.4);
      expect(clamped[0].weightKg).toBeCloseTo(explicit[0].weightKg, 6);
    });

    test("in-range attenuation passes through UNCLAMPED at the upper boundary", () => {
      // 0.97 and 0.98 are both <= 0.98, so neither is clamped: they must give
      // DIFFERENT weights. OG = 1 + ABV/(131.25*atten) → higher atten = lower OG
      // = less grain, so the 0.98 run must weigh strictly less than the 0.97 run.
      // This pins that the upper clamp is exactly 0.98 and does not fire early.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const at97 = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.97);
      const at98 = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.98);
      expect(at98[0].weightKg).toBeLessThan(at97[0].weightKg);
      // Quantify the gap so an "everything clamps to 0.98" bug can't hide:
      // ratio of grain weights = (1/0.97)/(1/0.98) = 0.98/0.97 ≈ 1.010309
      expect(at97[0].weightKg / at98[0].weightKg).toBeCloseTo(0.98 / 0.97, 4);
    });

    test("in-range attenuation passes through UNCLAMPED at the lower boundary", () => {
      // 0.40 and 0.41 are both >= 0.40, so neither is clamped: they must give
      // DIFFERENT weights. This pins that the lower clamp is exactly 0.40 and
      // does not fire inside the valid range.
      const ferms = [makeFermentable({ id: "base", ppg: 36, efficiencyPercent: 75 })];
      const at40 = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.40);
      const at41 = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.41);
      expect(at41[0].weightKg).toBeLessThan(at40[0].weightKg);
      // ratio = (1/0.40)/(1/0.41) = 0.41/0.40 = 1.025
      expect(at40[0].weightKg / at41[0].weightKg).toBeCloseTo(0.41 / 0.40, 4);
    });

    test("zero post-boil volume → returns fermentables unchanged (guard)", () => {
      // volumeGal = 0 fails the (volumeGal > 0) guard → identical reference back.
      const ferms = [makeFermentable({ id: "base", weightKg: 3.21, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 0, 75, 0.75);
      expect(result).toBe(ferms); // same array reference, untouched
      expect(result[0].weightKg).toBe(3.21);
    });

    test("zero mash efficiency → returns fermentables unchanged (guard)", () => {
      // efficiency = 0 fails the (efficiency > 0) guard → unchanged.
      const ferms = [makeFermentable({ id: "base", weightKg: 2.5, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 0, 0.75);
      expect(result).toBe(ferms);
      expect(result[0].weightKg).toBe(2.5);
    });

    test("all percentages zero → effectiveGuPerLb is 0 → unchanged (guard)", () => {
      // No grain carries any share → effectiveGuPerLb = 0 fails its guard.
      const ferms = [makeFermentable({ id: "base", weightKg: 4.0, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 0 }, 5, 20, 75, 0.75);
      expect(result).toBe(ferms);
      expect(result[0].weightKg).toBe(4.0);
    });

    test("zero target ABV → zero grain weight", () => {
      // max(0, targetABV)=0 → OG=1 → pointsPerGal=0 → totalGuNeeded=0 → 0kg.
      const ferms = [makeFermentable({ id: "base", weightKg: 5, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 0, 20, 75, 0.75);
      expect(result[0].weightKg).toBe(0);
    });

    test("negative target ABV is floored to 0 → zero grain weight", () => {
      // max(0, -3) = 0, same as zero ABV.
      const ferms = [makeFermentable({ id: "base", weightKg: 5, ppg: 36, efficiencyPercent: 75 })];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, -3, 20, 75, 0.75);
      expect(result[0].weightKg).toBe(0);
    });

    test("negative percentage for a grain is floored to 0 weight", () => {
      // Math.max(0, pct) clamps a negative share → that grain gets 0 kg,
      // but it still contributes 0 to GU so the positive grain absorbs the bill.
      const ferms = [
        makeFermentable({ id: "good", ppg: 36, efficiencyPercent: 75 }),
        makeFermentable({ id: "bad", ppg: 36, efficiencyPercent: 75 }),
      ];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { good: 100, bad: -50 }, 5, 20, 75, 0.75);
      const bad = result.find(f => f.id === "bad")!;
      expect(bad.weightKg).toBe(0);
    });

    test("output weights are never negative (invariant)", () => {
      const ferms = [
        makeFermentable({ id: "a", ppg: 36, efficiencyPercent: 80 }),
        makeFermentable({ id: "b", ppg: 30, efficiencyPercent: 70 }),
      ];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { a: 60, b: 40 }, 6.5, 23, 72, 0.77);
      for (const f of result) {
        expect(f.weightKg).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(f.weightKg)).toBe(true);
      }
    });

    test("preserves non-weight fields and id ordering", () => {
      // Only weightKg should change; name/ppg/colorLovibond/order intact.
      const ferms = [
        makeFermentable({ id: "a", name: "Pilsner", ppg: 37, colorLovibond: 1.6, efficiencyPercent: 80 }),
        makeFermentable({ id: "b", name: "Munich", ppg: 35, colorLovibond: 9, efficiencyPercent: 78 }),
      ];
      const result = svc.calculateWeightsFromPercentsAndABV(ferms, { a: 80, b: 20 }, 5, 20, 75, 0.75);
      expect(result.map(f => f.id)).toEqual(["a", "b"]);
      expect(result[0].name).toBe("Pilsner");
      expect(result[0].ppg).toBe(37);
      expect(result[0].colorLovibond).toBe(1.6);
      expect(result[1].name).toBe("Munich");
    });

    test("does not mutate the input array's fermentables", () => {
      // Service returns new objects via spread; originals keep their weightKg.
      const ferms = [makeFermentable({ id: "base", weightKg: 0, ppg: 36, efficiencyPercent: 75 })];
      svc.calculateWeightsFromPercentsAndABV(ferms, { base: 100 }, 5, 20, 75, 0.75);
      expect(ferms[0].weightKg).toBe(0); // untouched original
    });

    test("round-trip from a known bill solves to independently hand-derived weights", () => {
      // Stronger than a percent-recovery round-trip (which is a proportional-split
      // identity independent of the gravity inversion). Here we derive percents
      // from a known bill, feed them back into the ABV solver, and assert the
      // ABSOLUTE solved weights against literals computed by hand from brewing
      // formulas — so a bug in the OG inversion / 131.25 constant / volume
      // conversion would actually fail this.
      //
      // Bill: a=4kg, b=1kg of identical ppg36 grain → percents a:80, b:20.
      // Target: 5% ABV, 20L post-boil, atten 0.75, mash eff 75 (drives the 0.75
      // grain extraction).
      //   OG = 1 + 5/(131.25*0.75) = 1.050793...
      //   volumeGal = 20 * 0.264172 = 5.28344 gal
      //   totalGuNeeded = 50.793... * 5.28344 = 268.37... GU
      //   effGuPerLb = (0.8+0.2)*36*0.75 = 27.0  → totalLb = 9.9396, totalKg = 4.5085
      //   a = 0.80 * 4.5085 = 3.6068 kg ; b = 0.20 * 4.5085 = 0.9017 kg
      const ferms = [
        makeFermentable({ id: "a", weightKg: 4, ppg: 36, efficiencyPercent: 75 }),
        makeFermentable({ id: "b", weightKg: 1, ppg: 36, efficiencyPercent: 75 }),
      ];
      const pct = svc.calculatePercentsFromWeights(ferms); // a:80, b:20
      const solved = svc.calculateWeightsFromPercentsAndABV(ferms, pct, 5, 20, 75, 0.75);
      const a = solved.find(f => f.id === "a")!;
      const b = solved.find(f => f.id === "b")!;
      // Independent literal anchors (hand-derived, NOT lifted from code output):
      expect(a.weightKg).toBeCloseTo(3.6068, 3);
      expect(b.weightKg).toBeCloseTo(0.9017, 3);
      expect(a.weightKg + b.weightKg).toBeCloseTo(4.5085, 3);
      // The proportional-split identity still holds as a secondary check.
      const pct2 = svc.calculatePercentsFromWeights(solved);
      expect(pct2["a"]).toBeCloseTo(80.0, 1);
      expect(pct2["b"]).toBeCloseTo(20.0, 1);
    });
  });
});
