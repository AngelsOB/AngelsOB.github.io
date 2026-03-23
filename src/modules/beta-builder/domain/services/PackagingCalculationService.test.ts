import { describe, test, expect } from "vitest";
import { packagingCalculationService as svc } from "./PackagingCalculationService";
import type { FermentationStep } from "../models/Recipe";

describe("PackagingCalculationService", () => {
  // ── Residual CO2 ────────────────────────────────────────────────────────

  describe("residualCo2", () => {
    test("at 20°C (68°F) ≈ 0.85 vol", () => {
      const result = svc.residualCo2(20);
      expect(result).toBeCloseTo(0.85, 1);
    });

    test("at 10°C (50°F) ≈ 1.18 vol", () => {
      const result = svc.residualCo2(10);
      expect(result).toBeCloseTo(1.18, 1);
    });

    test("higher temp → less residual CO2", () => {
      expect(svc.residualCo2(25)).toBeLessThan(svc.residualCo2(15));
    });
  });

  // ── Highest Fermentation Temperature ────────────────────────────────────

  describe("highestFermTemp", () => {
    test("returns max temp from steps", () => {
      const steps: FermentationStep[] = [
        { id: "1", name: "Primary", type: "primary", durationDays: 14, temperatureC: 18 },
        { id: "2", name: "D-rest", type: "diacetyl-rest", durationDays: 2, temperatureC: 22 },
        { id: "3", name: "Cold crash", type: "cold-crash", durationDays: 3, temperatureC: 1 },
      ];
      expect(svc.highestFermTemp(steps)).toBe(22);
    });

    test("defaults to 20°C when no steps", () => {
      expect(svc.highestFermTemp([])).toBe(20);
    });
  });

  // ── Priming Sugar ───────────────────────────────────────────────────────

  describe("primingSugarGrams", () => {
    test("corn sugar for 19L at 2.4 vol with residual 0.85", () => {
      // (2.4 - 0.85) * 19 * 4.0 = 117.8g
      const result = svc.primingSugarGrams(2.4, 0.85, 19, "corn-sugar");
      expect(result).toBeCloseTo(117.8, 0);
    });

    test("table sugar uses lower factor than corn sugar", () => {
      const corn = svc.primingSugarGrams(2.5, 0.85, 19, "corn-sugar");
      const table = svc.primingSugarGrams(2.5, 0.85, 19, "table-sugar");
      expect(table).toBeLessThan(corn);
    });

    test("DME requires more grams than corn sugar", () => {
      const corn = svc.primingSugarGrams(2.5, 0.85, 19, "corn-sugar");
      const dme = svc.primingSugarGrams(2.5, 0.85, 19, "dme");
      expect(dme).toBeGreaterThan(corn);
    });

    test("returns 0 if target <= residual", () => {
      const result = svc.primingSugarGrams(0.5, 0.85, 19, "corn-sugar");
      expect(result).toBe(0);
    });
  });

  // ── Unit Conversion ─────────────────────────────────────────────────────

  describe("gramsToOz", () => {
    test("28.35g ≈ 1 oz", () => {
      expect(svc.gramsToOz(28.3495)).toBeCloseTo(1, 2);
    });
  });

  // ── Forced Carbonation PSI ──────────────────────────────────────────────

  describe("forcedCarbonationPsi", () => {
    test("at 4°C (38°F) / 2.5 vol ≈ 11-12 PSI", () => {
      const psi = svc.forcedCarbonationPsi(4, 2.5);
      expect(psi).toBeGreaterThan(10);
      expect(psi).toBeLessThan(14);
    });

    test("higher temp requires higher PSI", () => {
      const coldPsi = svc.forcedCarbonationPsi(2, 2.5);
      const warmPsi = svc.forcedCarbonationPsi(10, 2.5);
      expect(warmPsi).toBeGreaterThan(coldPsi);
    });

    test("higher CO2 target requires higher PSI", () => {
      const lowVol = svc.forcedCarbonationPsi(4, 2.0);
      const highVol = svc.forcedCarbonationPsi(4, 3.0);
      expect(highVol).toBeGreaterThan(lowVol);
    });

    test("never returns negative", () => {
      expect(svc.forcedCarbonationPsi(0, 0.5)).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Burst Carbonation ───────────────────────────────────────────────────

  describe("burstCarbonationSchedule", () => {
    test("returns burst at 30 PSI for 24 hours", () => {
      const schedule = svc.burstCarbonationSchedule(12);
      expect(schedule.burstPsi).toBe(30);
      expect(schedule.burstDurationHours).toBe(24);
      expect(schedule.finalPsi).toBe(12);
    });
  });

  // ── Bottle Count ────────────────────────────────────────────────────────

  describe("numberOfBottles", () => {
    test("19L in 330ml bottles = 58", () => {
      expect(svc.numberOfBottles(19, "330ml")).toBe(58);
    });

    test("19L in 500ml bottles = 38", () => {
      expect(svc.numberOfBottles(19, "500ml")).toBe(38);
    });

    test("rounds up partial bottles", () => {
      // 20L / 750ml = 26.67 → 27
      expect(svc.numberOfBottles(20, "750ml")).toBe(27);
    });
  });

  // ── Multi-Bottle Helpers ────────────────────────────────────────────────

  describe("totalBottleCount", () => {
    test("sums counts across entries", () => {
      expect(svc.totalBottleCount([
        { size: "330ml", count: 20 },
        { size: "750ml", count: 10 },
      ])).toBe(30);
    });

    test("returns 0 for empty array", () => {
      expect(svc.totalBottleCount([])).toBe(0);
    });
  });

  describe("totalBottleVolumeL", () => {
    test("calculates combined volume in liters", () => {
      // 20 x 330ml + 10 x 750ml = 6600 + 7500 = 14100ml = 14.1L
      expect(svc.totalBottleVolumeL([
        { size: "330ml", count: 20 },
        { size: "750ml", count: 10 },
      ])).toBeCloseTo(14.1, 1);
    });
  });

  describe("defaultBottleEntry", () => {
    test("fills remaining batch volume", () => {
      const entry = svc.defaultBottleEntry(19, "500ml", [
        { size: "330ml", count: 20 },
      ]);
      // 20 x 330ml = 6600ml used, remaining = 12400ml, 12400/500 = 24.8 → 25
      expect(entry.size).toBe("500ml");
      expect(entry.count).toBe(25);
    });

    test("returns 0 count when batch is already filled", () => {
      const entry = svc.defaultBottleEntry(5, "500ml", [
        { size: "500ml", count: 10 },
      ]);
      expect(entry.count).toBe(0);
    });
  });

  // ── Conditioning Days ───────────────────────────────────────────────────

  describe("estimatedConditioningDays", () => {
    test("warm (24°C+) → 7 days", () => {
      expect(svc.estimatedConditioningDays(25)).toBe(7);
    });

    test("room temp (20°C) → 14 days", () => {
      expect(svc.estimatedConditioningDays(20)).toBe(14);
    });

    test("cool (15°C) → 28 days", () => {
      expect(svc.estimatedConditioningDays(15)).toBe(28);
    });
  });

  // ── Style CO2 Range ─────────────────────────────────────────────────────

  describe("styleCo2Range", () => {
    test("exact match: American IPA", () => {
      const range = svc.styleCo2Range("American IPA");
      expect(range).not.toBeNull();
      expect(range!.typical).toBe(2.4);
    });

    test("case-insensitive match", () => {
      const range = svc.styleCo2Range("american ipa");
      expect(range).not.toBeNull();
    });

    test("substring match: IPA matches American IPA", () => {
      const range = svc.styleCo2Range("IPA");
      expect(range).not.toBeNull();
    });

    test("returns null for unknown style", () => {
      expect(svc.styleCo2Range("Completely Made Up Style")).toBeNull();
    });

    test("Hefeweizen has high carbonation", () => {
      const range = svc.styleCo2Range("Hefeweizen");
      expect(range!.typical).toBeGreaterThanOrEqual(3.5);
    });
  });
});
