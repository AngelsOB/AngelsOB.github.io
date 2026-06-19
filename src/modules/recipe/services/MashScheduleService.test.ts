import { describe, test, expect } from "vitest";
import { mashScheduleService as svc, MashScheduleService } from "./MashScheduleService";
import type { MashStep } from "../models/Recipe";

describe("MashScheduleService", () => {
  // ── Strike Water Temperature ────────────────────────────────────────────
  //
  // Palmer "How to Brew" strike-water formula:
  //   Tw = (0.41 / r) * (T2 - T1) + T2
  // where r = water:grain ratio (L/kg), T2 = target mash temp, T1 = grain temp,
  // and 0.41 = c_grain/c_water heat-capacity ratio.
  // The full heat-balance branch reduces to the SAME expression because grain
  // mass cancels (waterVolume = grainKg * thickness), so both branches must agree.

  describe("calculateStrikeTemp", () => {
    test("simplified branch (no grain mass): target 67°C, 3 L/kg, grain 20°C", () => {
      // (0.41/3) * (67 - 20) + 67 = 0.1366667 * 47 + 67
      //   = 6.423333 + 67 = 73.42333 → rounded to 1 dp = 73.4
      const result = svc.calculateStrikeTemp(67, 3, 20);
      expect(result).toBeCloseTo(73.4, 1);
    });

    test("default grain temp of 20°C is applied when omitted", () => {
      // Same anchor as above but relying on the grainTempC default (20).
      // (0.41/3) * (67 - 20) + 67 = 73.4
      expect(svc.calculateStrikeTemp(67, 3)).toBeCloseTo(73.4, 1);
    });

    test("thicker mash (lower L/kg) needs hotter strike water", () => {
      // r in the denominator: smaller r => larger correction term => hotter strike.
      // r=2: (0.41/2)*47 + 67 = 9.635 + 67 = 76.635 → 76.6
      const thick = svc.calculateStrikeTemp(67, 2, 20);
      expect(thick).toBeCloseTo(76.6, 1);
      // r=4: (0.41/4)*47 + 67 = 4.8175 + 67 = 71.8175 → 71.8
      const thin = svc.calculateStrikeTemp(67, 4, 20);
      expect(thin).toBeCloseTo(71.8, 1);
      // Monotonicity: thicker (less water per kg) => hotter strike.
      expect(thick).toBeGreaterThan(thin);
    });

    test("colder grain needs hotter strike water (monotonic in grain temp)", () => {
      // T1=10: (0.41/3)*(67-10)+67 = 0.1366667*57+67 = 7.79+67 = 74.79 → 74.8
      const coldGrain = svc.calculateStrikeTemp(67, 3, 10);
      expect(coldGrain).toBeCloseTo(74.8, 1);
      // T1=25: (0.41/3)*(67-25)+67 = 0.1366667*42+67 = 5.74+67 = 72.74 → 72.7
      const warmGrain = svc.calculateStrikeTemp(67, 3, 25);
      expect(warmGrain).toBeCloseTo(72.7, 1);
      expect(coldGrain).toBeGreaterThan(warmGrain);
    });

    test("full heat-balance branch (with grain mass) equals simplified branch", () => {
      // waterVolume = grainKg * thickness, so grainKg cancels:
      //   target + (grainKg*0.41*(target-grainTemp))/(grainKg*thickness)
      //   = target + 0.41*(target-grainTemp)/thickness  == simplified formula.
      // 67 + (5*0.41*47)/(5*3) = 67 + 96.35/15 = 67 + 6.42333 = 73.42333 → 73.4
      const withMass = svc.calculateStrikeTemp(67, 3, 20, 5);
      expect(withMass).toBeCloseTo(73.4, 1);
      // Must match the no-mass branch exactly (both round to 1 dp).
      const withoutMass = svc.calculateStrikeTemp(67, 3, 20, 0);
      expect(withMass).toBe(withoutMass);
    });

    test("grain mass is irrelevant: any positive mass gives the same strike temp", () => {
      // Because grainKg cancels, the result is invariant to grain mass.
      const m1 = svc.calculateStrikeTemp(67, 3, 20, 2);
      const m2 = svc.calculateStrikeTemp(67, 3, 20, 8);
      expect(m1).toBe(m2);
    });

    test("strike temp equals target when grain is already at target (no correction)", () => {
      // target - grainTemp = 0 => correction term = 0 => strike == target.
      expect(svc.calculateStrikeTemp(67, 3, 67)).toBeCloseTo(67, 1);
    });

    test("result is rounded to one decimal place", () => {
      // 73.42333 must be rounded to 73.4 (one decimal), not left at full precision.
      const result = svc.calculateStrikeTemp(67, 3, 20);
      expect(result).toBe(73.4);
      // Verify rounding granularity: result * 10 is an integer.
      expect(Number.isInteger(result * 10)).toBe(true);
    });

    test("strike temp always exceeds target when grain is colder than target", () => {
      // Physical sanity: water must be hotter than the mash target to heat the grain.
      expect(svc.calculateStrikeTemp(67, 3, 20)).toBeGreaterThan(67);
      expect(svc.calculateStrikeTemp(50, 2.5, 18)).toBeGreaterThan(50);
    });

    // ── Edge / bad-input behavior (no guard in source) ──────────────────────
    // These pin the CURRENT (unguarded) behavior so a future guard change is
    // caught. Math is derived from the same Palmer expression, not copied output.

    test("zero thickness divides by zero and returns Infinity (no guard in source)", () => {
      // thickness = 0 in simplified branch: 47 * (0.41 / 0) + 67 = +Infinity.
      // A user clearing the L/kg field hits this. The source has NO divide guard,
      // so the result is mathematically Infinity. This locks that fact.
      expect(svc.calculateStrikeTemp(67, 0, 20)).toBe(Infinity);
    });

    test("negative thickness yields a strike BELOW target (physically impossible, unguarded)", () => {
      // thickness = -3: (0.41 / -3) * (67 - 20) + 67
      //   = -0.136667 * 47 + 67 = -6.42333 + 67 = 60.57667 → 60.6
      // Strike water colder than the mash target cannot heat grain to target;
      // the source accepts it silently. Locked so a future sanity guard is caught.
      expect(svc.calculateStrikeTemp(67, -3, 20)).toBeCloseTo(60.6, 1);
      expect(svc.calculateStrikeTemp(67, -3, 20)).toBeLessThan(67);
    });

    test("grain mass given but zero thickness still falls into the divide-by-zero path", () => {
      // Exercises the SECOND guard clause `waterVolumeLiters === 0`:
      // totalGrainKg = 5 (≠ 0) but waterVolume = 5 * 0 = 0, so the full-balance
      // branch is skipped and the simplified branch runs, dividing by thickness=0.
      // Combined behavior of both guard predicates → Infinity.
      expect(svc.calculateStrikeTemp(67, 0, 20, 5)).toBe(Infinity);
    });
  });

  // ── Total Mash Time ─────────────────────────────────────────────────────

  describe("calculateTotalMashTime", () => {
    test("sums durations across all steps", () => {
      const steps: MashStep[] = [
        { id: "a", name: "Protein Rest", temperatureC: 52, durationMinutes: 15 },
        { id: "b", name: "Sacc", temperatureC: 67, durationMinutes: 60 },
        { id: "c", name: "Mash Out", temperatureC: 76, durationMinutes: 10 },
      ];
      // 15 + 60 + 10 = 85
      expect(svc.calculateTotalMashTime(steps)).toBe(85);
    });

    test("returns 0 for an empty schedule", () => {
      // reduce over [] with seed 0 => 0
      expect(svc.calculateTotalMashTime([])).toBe(0);
    });

    test("single step returns its own duration", () => {
      const steps: MashStep[] = [
        { id: "a", name: "Sacc", temperatureC: 67, durationMinutes: 60 },
      ];
      expect(svc.calculateTotalMashTime(steps)).toBe(60);
    });

    test("matches sum of generateStepMash durations (15+30+15+10 = 70)", () => {
      // Cross-check against the canned step-mash schedule.
      expect(svc.calculateTotalMashTime(svc.generateStepMash())).toBe(70);
    });

    test("raw sum does not sanitize: negative and fractional durations pass through", () => {
      // The reduce blindly adds durationMinutes with no validation, so a negative
      // step subtracts and fractions accumulate. This documents that totalling is
      // a pure arithmetic sum and does NOT coordinate with validateMashStep.
      const steps: MashStep[] = [
        { id: "a", name: "A", temperatureC: 50, durationMinutes: 15 },
        { id: "b", name: "B", temperatureC: 60, durationMinutes: -5 },
        { id: "c", name: "C", temperatureC: 67, durationMinutes: 60 },
      ];
      // 15 + (-5) + 60 = 70
      expect(svc.calculateTotalMashTime(steps)).toBe(70);

      const fractional: MashStep[] = [
        { id: "a", name: "A", temperatureC: 50, durationMinutes: 12.5 },
        { id: "b", name: "B", temperatureC: 67, durationMinutes: 7.25 },
      ];
      // 12.5 + 7.25 = 19.75
      expect(svc.calculateTotalMashTime(fractional)).toBeCloseTo(19.75, 5);
    });
  });

  // ── Default Single Infusion ─────────────────────────────────────────────

  describe("generateDefaultSingleInfusion", () => {
    test("rest temperature sits in the saccharification band (Palmer/BJCP 64-72°C)", () => {
      // Independent anchor: a single-infusion mash rest must fall in the combined
      // beta+alpha saccharification window (~64-72°C per Palmer "How to Brew" /
      // BJCP step-mash guidance). An out-of-band typo (e.g. 73°C or 60°C) must fail.
      const step = svc.generateDefaultSingleInfusion();
      expect(step.temperatureC).toBeGreaterThanOrEqual(64);
      expect(step.temperatureC).toBeLessThanOrEqual(72);
      // Name describes the converted-starch rest.
      expect(step.name).toBe("Saccharification");
      // Snapshot pin of the exact config values (guards accidental edits only).
      expect(step.temperatureC).toBe(67);
      expect(step.durationMinutes).toBe(60);
    });

    test("assigns a non-empty unique id", () => {
      const a = svc.generateDefaultSingleInfusion();
      const b = svc.generateDefaultSingleInfusion();
      expect(a.id).toBeTruthy();
      expect(typeof a.id).toBe("string");
      // uid() must be unique across calls.
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── Step Mash ───────────────────────────────────────────────────────────

  describe("generateStepMash", () => {
    test("each rest temperature sits in its enzyme's documented band", () => {
      // Independent anchors from Palmer "How to Brew" / BJCP step-mash references.
      // An out-of-band typo (e.g. Beta Rest bumped to 73°C) fails here regardless
      // of whether someone re-typed the snapshot literals below.
      //   Protein/proteolytic rest:  45-55°C
      //   Beta-amylase rest:         60-65°C
      //   Alpha-amylase rest:        66-72°C
      //   Mash out (denature):       75-78°C
      const bands: Record<string, [number, number]> = {
        "Protein Rest": [45, 55],
        "Beta Rest": [60, 65],
        "Alpha Rest": [66, 72],
        "Mash Out": [75, 78],
      };
      const steps = svc.generateStepMash();
      expect(steps).toHaveLength(4);
      for (const step of steps) {
        const band = bands[step.name];
        expect(band, `unexpected rest name: ${step.name}`).toBeDefined();
        expect(step.temperatureC).toBeGreaterThanOrEqual(band[0]);
        expect(step.temperatureC).toBeLessThanOrEqual(band[1]);
      }
    });

    test("rests run in ascending order: protein → beta → alpha → mash out", () => {
      // A step mash heats upward; the enzyme rests must be ordered by temperature.
      // This is the brewing invariant (rising mash) and is independent of the exact
      // magnitudes — it would catch a re-ordered or non-rising schedule.
      const steps = svc.generateStepMash();
      expect(steps.map((s) => s.name)).toEqual([
        "Protein Rest",
        "Beta Rest",
        "Alpha Rest",
        "Mash Out",
      ]);
      const temps = steps.map((s) => s.temperatureC);
      for (let i = 1; i < temps.length; i++) {
        expect(temps[i]).toBeGreaterThan(temps[i - 1]);
      }
    });

    test("snapshot of exact config values (guards accidental edits only)", () => {
      // Explicit snapshot: these literals only protect against unintended edits to
      // the canned schedule; correctness is enforced by the band test above.
      const steps = svc.generateStepMash();
      expect(steps.map((s) => s.temperatureC)).toEqual([52, 63, 70, 76]);
      expect(steps.map((s) => s.durationMinutes)).toEqual([15, 30, 15, 10]);
    });

    test("every step has a unique id", () => {
      const ids = svc.generateStepMash().map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ── Decoction ───────────────────────────────────────────────────────────

  describe("generateDecoction", () => {
    test("each rest temperature sits in its enzyme's documented band", () => {
      // Independent anchors from Palmer "How to Brew" / BJCP classic-decoction refs.
      //   Acid/phytase rest:         35-45°C
      //   Protein/proteolytic rest:  45-55°C
      //   Saccharification rest:     64-72°C
      //   Mash out (denature):       75-78°C
      const bands: Record<string, [number, number]> = {
        "Acid Rest": [35, 45],
        "Protein Rest": [45, 55],
        "Saccharification": [64, 72],
        "Mash Out": [75, 78],
      };
      const steps = svc.generateDecoction();
      expect(steps).toHaveLength(4);
      for (const step of steps) {
        const band = bands[step.name];
        expect(band, `unexpected rest name: ${step.name}`).toBeDefined();
        expect(step.temperatureC).toBeGreaterThanOrEqual(band[0]);
        expect(step.temperatureC).toBeLessThanOrEqual(band[1]);
      }
    });

    test("rests run in ascending order: acid → protein → sacc → mash out", () => {
      // Classic decoction climbs through each rest; temps must rise. Independent of
      // exact magnitudes, so a re-ordered or non-rising schedule fails here.
      const steps = svc.generateDecoction();
      expect(steps.map((s) => s.name)).toEqual([
        "Acid Rest",
        "Protein Rest",
        "Saccharification",
        "Mash Out",
      ]);
      const temps = steps.map((s) => s.temperatureC);
      for (let i = 1; i < temps.length; i++) {
        expect(temps[i]).toBeGreaterThan(temps[i - 1]);
      }
    });

    test("snapshot of exact config values (guards accidental edits only)", () => {
      // Explicit snapshot of the canned schedule's literals; correctness of the
      // temperatures is enforced by the band test above.
      const steps = svc.generateDecoction();
      expect(steps.map((s) => s.temperatureC)).toEqual([40, 52, 67, 76]);
      expect(steps.map((s) => s.durationMinutes)).toEqual([15, 15, 60, 10]);
      // Cross-check the duration sum via the time calculator: 15+15+60+10 = 100.
      expect(svc.calculateTotalMashTime(steps)).toBe(100);
    });

    test("every step has a unique id", () => {
      const ids = svc.generateDecoction().map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────

  describe("validateMashStep", () => {
    test("valid step yields no errors", () => {
      const step: MashStep = {
        id: "x",
        name: "Saccharification",
        temperatureC: 67,
        durationMinutes: 60,
      };
      expect(svc.validateMashStep(step)).toEqual([]);
    });

    test("empty name produces a name-required error", () => {
      const step: MashStep = {
        id: "x",
        name: "",
        temperatureC: 67,
        durationMinutes: 60,
      };
      expect(svc.validateMashStep(step)).toContain("Step name is required");
    });

    test("whitespace-only name is treated as empty", () => {
      // step.name.trim() === '' branch
      const step: MashStep = {
        id: "x",
        name: "   ",
        temperatureC: 67,
        durationMinutes: 60,
      };
      expect(svc.validateMashStep(step)).toContain("Step name is required");
    });

    test("temperature below 0°C is rejected", () => {
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: -1,
        durationMinutes: 60,
      };
      expect(svc.validateMashStep(step)).toContain(
        "Temperature must be between 0°C and 100°C"
      );
    });

    test("temperature above 100°C is rejected", () => {
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: 101,
        durationMinutes: 60,
      };
      expect(svc.validateMashStep(step)).toContain(
        "Temperature must be between 0°C and 100°C"
      );
    });

    test("boundary temps 0°C and 100°C are accepted (inclusive range)", () => {
      // Condition is < 0 || > 100, so exactly 0 and 100 are valid.
      const at0: MashStep = { id: "x", name: "Sacc", temperatureC: 0, durationMinutes: 60 };
      const at100: MashStep = { id: "y", name: "Sacc", temperatureC: 100, durationMinutes: 60 };
      expect(svc.validateMashStep(at0)).toEqual([]);
      expect(svc.validateMashStep(at100)).toEqual([]);
    });

    test("zero duration is rejected (must be > 0)", () => {
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: 67,
        durationMinutes: 0,
      };
      expect(svc.validateMashStep(step)).toContain(
        "Duration must be greater than 0 minutes"
      );
    });

    test("negative duration is rejected", () => {
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: 67,
        durationMinutes: -5,
      };
      expect(svc.validateMashStep(step)).toContain(
        "Duration must be greater than 0 minutes"
      );
    });

    test("accumulates all three errors for a fully invalid step", () => {
      // empty name + out-of-range temp + non-positive duration => 3 errors.
      const step: MashStep = {
        id: "x",
        name: "",
        temperatureC: 150,
        durationMinutes: 0,
      };
      const errors = svc.validateMashStep(step);
      expect(errors).toHaveLength(3);
      expect(errors).toContain("Step name is required");
      expect(errors).toContain("Temperature must be between 0°C and 100°C");
      expect(errors).toContain("Duration must be greater than 0 minutes");
    });

    test("NaN temperature is rejected (Number.isNaN guard)", () => {
      // A cleared/garbage numeric field arrives as NaN. The guard catches it so
      // an invalid step can't pass validation and poison downstream calcs.
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: NaN,
        durationMinutes: 60,
      };
      const errors = svc.validateMashStep(step);
      expect(errors).toContain("Temperature must be between 0°C and 100°C");
    });

    test("NaN duration is rejected (Number.isNaN guard)", () => {
      // Same guard for a cleared duration field.
      const step: MashStep = {
        id: "x",
        name: "Sacc",
        temperatureC: 67,
        durationMinutes: NaN,
      };
      const errors = svc.validateMashStep(step);
      expect(errors).toContain("Duration must be greater than 0 minutes");
    });

    test("generated default single infusion validates cleanly", () => {
      // The service's own canned step must pass its own validator.
      expect(svc.validateMashStep(svc.generateDefaultSingleInfusion())).toEqual([]);
    });

    test("every generated step-mash step validates cleanly", () => {
      for (const step of svc.generateStepMash()) {
        expect(svc.validateMashStep(step)).toEqual([]);
      }
    });
  });

  // ── Module Shape ────────────────────────────────────────────────────────

  describe("module exports", () => {
    test("exports a singleton instance of MashScheduleService", () => {
      expect(svc).toBeInstanceOf(MashScheduleService);
    });
  });
});
