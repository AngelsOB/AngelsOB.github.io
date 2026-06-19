import { describe, test, expect } from "vitest";
import { hopFlavorCalculationService as svc } from "./HopFlavorCalculationService";
import type { Hop } from "../models/Recipe";
import type { HopFlavorProfile } from "../models/Presets";

// ── Fixtures & helpers ─────────────────────────────────────────────────────

const ALL_KEYS: (keyof HopFlavorProfile)[] = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  "grassy",
  "herbal",
  "spice",
  "resinPine",
];

/** A flat 0 flavor vector, with overrides applied. */
function flavor(overrides: Partial<HopFlavorProfile> = {}): HopFlavorProfile {
  return {
    citrus: 0,
    tropicalFruit: 0,
    stoneFruit: 0,
    berry: 0,
    floral: 0,
    grassy: 0,
    herbal: 0,
    spice: 0,
    resinPine: 0,
    ...overrides,
  };
}

/** Build a Hop with sensible defaults so fixtures stay short. */
function hop(overrides: Partial<Hop> = {}): Hop {
  return {
    id: "h1",
    name: "Citra",
    alphaAcid: 12,
    grams: 100,
    type: "boil",
    timeMinutes: 0,
    ...overrides,
  };
}

// Tunable constants mirrored from the source (for derivation, not asserted blindly).
const AROMA_DECAY_PER_MINUTE = 0.05;
const LAMBDA = 0.7;

describe("HopFlavorCalculationService", () => {
  // ── timingAromaFactor (exercised through calculateCombinedFlavor) ─────────
  //
  // For a SINGLE hop the axis proportion collapses to flavor[k]/5, so:
  //   result[k] = clamp( 5*(1 - exp(-LAMBDA * W)) * (flavor[k]/5) )
  // where W = (grams/batchL) * aromaFactor(type, time, ...).
  // We pick a hop with one axis = 5, so result[axis] = magnitude directly,
  // which lets us back out the aroma factor.

  describe("timingAromaFactor via calculateCombinedFlavor", () => {
    // Helper: given a single hop, return the citrus axis (== magnitude when
    // citrus flavor == 5, since proportion = 5/5 = 1).
    function magnitudeFor(h: Hop): number {
      const flavors = new Map<string, HopFlavorProfile>([
        [h.name, flavor({ citrus: 5 })],
      ]);
      // batchVolumeL = grams numerically so that gpl = grams/batchL = 1.0,
      // making W == aromaFactor and magnitude a clean function of the factor.
      return svc.calculateCombinedFlavor([h], flavors, h.grams).citrus;
    }

    // magnitude(W) = 5*(1 - exp(-0.7*W)); with gpl forced to 1, W = factor.
    function expectedMagnitude(factor: number): number {
      return 5 * (1 - Math.exp(-LAMBDA * factor));
    }

    test("dry hop uses fixed aroma factor 0.8", () => {
      // factor = 0.8 → W = 1*0.8 = 0.8 → M = 5*(1-exp(-0.7*0.8)) = 5*(1-exp(-0.56))
      // = 5*(1-0.571209) = 2.14395
      const m = magnitudeFor(hop({ type: "dry hop" }));
      expect(m).toBeCloseTo(expectedMagnitude(0.8), 4);
      expect(m).toBeCloseTo(2.14395, 3);
    });

    test("boil at 0 min has aroma factor exp(0) = 1.0", () => {
      // factor = max(0.03, exp(-0.05*0)) = 1.0 → W = 1
      // M = 5*(1-exp(-0.7)) = 5*(1-0.4965853) = 5*0.5034147 = 2.517073
      const m = magnitudeFor(hop({ type: "boil", timeMinutes: 0 }));
      expect(m).toBeCloseTo(expectedMagnitude(1.0), 4);
      expect(m).toBeCloseTo(2.517073, 3);
    });

    test("boil at 60 min decays to exp(-3) = 0.049787", () => {
      // factor = max(0.03, exp(-0.05*60)) = exp(-3) = 0.0497871
      const expectedFactor = Math.exp(-AROMA_DECAY_PER_MINUTE * 60);
      const m = magnitudeFor(hop({ type: "boil", timeMinutes: 60 }));
      expect(m).toBeCloseTo(expectedMagnitude(expectedFactor), 4);
    });

    test("boil aroma factor floors at 0.03 for very long boils", () => {
      // exp(-0.05*200) = exp(-10) ≈ 4.5e-5 < 0.03, so factor clamps to 0.03.
      // W = 0.03 → M = 5*(1-exp(-0.021)) = 0.103904
      const m = magnitudeFor(hop({ type: "boil", timeMinutes: 200 }));
      expect(m).toBeCloseTo(expectedMagnitude(0.03), 4);
      expect(m).toBeCloseTo(0.103904, 4);
    });

    test("first wort uses fixed aroma factor 0.08", () => {
      // factor = 0.08 → M = 5*(1-exp(-0.7*0.08)) = 5*(1-exp(-0.056)) = 0.272314
      const m = magnitudeFor(hop({ type: "first wort" }));
      expect(m).toBeCloseTo(expectedMagnitude(0.08), 4);
      expect(m).toBeCloseTo(0.272314, 4);
    });

    test("mash uses fixed aroma factor 0.05", () => {
      // factor = 0.05 → M = 5*(1-exp(-0.7*0.05)) = 5*(1-exp(-0.035)) = 0.171973
      const m = magnitudeFor(hop({ type: "mash" }));
      expect(m).toBeCloseTo(expectedMagnitude(0.05), 4);
      expect(m).toBeCloseTo(0.171973, 4);
    });

    test("whirlpool default (80C, 15 min) factor ≈ 0.6862", () => {
      // temp=80: tempFactor = 0.6 + 0.4*clamp01((95-80)/20) = 0.6 + 0.4*0.75 = 0.9
      // time=15: timeFactor = 1 - exp(-0.06*15) = 1 - exp(-0.9) = 0.593430
      // factor = min(1, 0.5 + 0.5*0.9*0.593430) = 0.5 + 0.5*0.534087 = 0.767043... wait recompute:
      //   0.9*0.593430 = 0.534087; *0.5 = 0.267044; +0.5 = 0.767044
      const expectedFactor = 0.5 + 0.5 * 0.9 * (1 - Math.exp(-0.06 * 15));
      const m = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 15 })
      );
      expect(m).toBeCloseTo(expectedMagnitude(expectedFactor), 4);
    });

    test("whirlpool cooler temp → higher aroma factor (more retention)", () => {
      const cool = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 60, whirlpoolTimeMinutes: 20 })
      );
      const hot = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 95, whirlpoolTimeMinutes: 20 })
      );
      expect(cool).toBeGreaterThan(hot);
    });

    test("whirlpool longer steep → higher aroma factor (monotone in time)", () => {
      const short = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 5 })
      );
      const long = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 60 })
      );
      expect(long).toBeGreaterThan(short);
    });

    test("whirlpool tempFactor saturates: temps >=95C clamp the (95-temp)/20 term to 0", () => {
      // At 95C: (95-95)/20 = 0 → tempFactor = 0.6. At 110C: (95-110)/20 = -0.75 → clamp(0).
      // Both give tempFactor 0.6, so factor (and magnitude) must be identical.
      const at95 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 95, whirlpoolTimeMinutes: 30 })
      );
      const at110 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 110, whirlpoolTimeMinutes: 30 })
      );
      expect(at110).toBeCloseTo(at95, 6);
    });

    test("whirlpool tempFactor saturates: temps <=75C clamp the (95-temp)/20 term to 1", () => {
      // At 75C: (95-75)/20 = 1 → tempFactor = 1.0. At 40C: (95-40)/20 = 2.75 → clamp(1).
      const at75 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 75, whirlpoolTimeMinutes: 30 })
      );
      const at40 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 40, whirlpoolTimeMinutes: 30 })
      );
      expect(at40).toBeCloseTo(at75, 6);
    });

    test("whirlpool falls back to default 80C when temperatureC omitted", () => {
      // tempC undefined → temp = 80 (via `tempC || 80`).
      const withDefault = magnitudeFor(
        hop({ type: "whirlpool", whirlpoolTimeMinutes: 20 })
      );
      const explicit80 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 20 })
      );
      expect(withDefault).toBeCloseTo(explicit80, 6);
    });

    test("whirlpool temperatureC:0 is coerced to the 80C default (falsy || not nullish ??)", () => {
      // Pins the `tempC || 80` semantics: 0 is falsy, so `0 || 80` = 80 (hot default),
      // NOT 0. A 0°C whirlpool is physically nonsensical, and the source deliberately
      // treats 0 as "unset". Under `??` this would instead keep 0 (→ tempFactor = 1.0,
      // max retention) and produce a strictly larger magnitude. Asserting equality with
      // the explicit-80 case locks in the chosen `||` behavior and would fail if someone
      // "fixed" it to `??`.
      const atZero = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 0, whirlpoolTimeMinutes: 20 })
      );
      const explicit80 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 20 })
      );
      expect(atZero).toBeCloseTo(explicit80, 6);
      // Sanity: the `??` counterfactual (temp=0 → tempFactor=1.0) would be strictly larger.
      const explicit75 = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 75, whirlpoolTimeMinutes: 20 })
      );
      expect(atZero).toBeLessThan(explicit75);
    });

    test("whirlpool falls back to boil timeMinutes when whirlpoolTimeMinutes omitted", () => {
      // whirlpoolTimeMin ?? timeMin ?? 15: with whirlpoolTime undefined, uses timeMinutes.
      const viaTimeMinutes = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, timeMinutes: 25 })
      );
      const explicit = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 25 })
      );
      expect(viaTimeMinutes).toBeCloseTo(explicit, 6);
    });

    test("with BOTH whirlpool and boil times omitted, the public API supplies time=0 (the `?? 15` literal is unreachable)", () => {
      // The source computes `whirlpoolTimeMin ?? timeMin ?? 15`, BUT the call site in
      // calculateCombinedFlavor passes `hop.timeMinutes || 0` as timeMin — coercing an
      // undefined timeMinutes to the NUMBER 0 *before* the `??` chain sees it. So
      //   whirlpoolTimeMin ?? timeMin ?? 15  =  undefined ?? 0 ?? 15  =  0
      // The middle term is always a number, so the final `?? 15` default is dead code
      // through this public method (reachable only by calling the private
      // timingAromaFactor directly). Effective time is therefore 0, not 15:
      //   time=0 → timeFactor = 1 - exp(0) = 0 → factor = min(1, 0.5+0) = 0.5
      //   W = 1*0.5 → M = 5*(1 - exp(-0.35)) = 1.476560
      // (Were `?? 15` actually reachable, factor would be 0.767044 and M = 2.077301.)
      const m = magnitudeFor(
        hop({ type: "whirlpool", timeMinutes: undefined, whirlpoolTimeMinutes: undefined })
      );
      expect(m).toBeCloseTo(expectedMagnitude(0.5), 4);
      expect(m).toBeCloseTo(1.476560, 4);
    });

    test("whirlpoolTimeMinutes:0 is honored as 0 (nullish ?? not falsy ||), collapsing timeFactor to 0", () => {
      // Pins the `??`-vs-`||` semantics of `whirlpoolTimeMin ?? timeMin ?? 15`.
      // 0 ?? timeMin = 0 (nullish keeps 0); 0 || timeMin would instead skip to timeMin.
      // time=0 → timeFactor = 1 - exp(0) = 0 → factor = min(1, 0.5 + 0) = 0.5 (floor).
      // W = 1*0.5 → M = 5*(1-exp(-0.35)) = 1.476560.
      // This value ONLY holds under `??`; under `||` (using timeMinutes default 0 then
      // the literal 15) the factor would be 0.767044 and M would be 2.077301.
      const m = magnitudeFor(
        hop({ type: "whirlpool", temperatureC: 80, whirlpoolTimeMinutes: 0 })
      );
      expect(m).toBeCloseTo(expectedMagnitude(0.5), 4);
      expect(m).toBeCloseTo(1.476560, 4);
    });

    test("boil retention strictly decreases with longer boil time (aroma boils off)", () => {
      const early = magnitudeFor(hop({ type: "boil", timeMinutes: 10 }));
      const late = magnitudeFor(hop({ type: "boil", timeMinutes: 45 }));
      expect(late).toBeLessThan(early);
    });

    test("dry hop retains more aroma than a 60-min boil", () => {
      // dry hop factor 0.8 >> boil 60min factor exp(-3)=0.0498 → larger magnitude.
      const dry = magnitudeFor(hop({ type: "dry hop" }));
      const boil60 = magnitudeFor(hop({ type: "boil", timeMinutes: 60 }));
      expect(dry).toBeGreaterThan(boil60);
    });

    test("unknown addition type hits the defensive default factor 0.5", () => {
      // Documents the `default: return 0.5` guard in timingAromaFactor. This branch is
      // currently UNREACHABLE in production: Hop['type'] is a closed 5-member union
      // (Recipe.ts) all handled by explicit cases. We force it here by casting an
      // out-of-union string so the guard's behavior is pinned rather than silently
      // uncovered. factor = 0.5 → W = 1*0.5 → M = 5*(1-exp(-0.35)) = 1.476560.
      const rogue = hop({ type: "unknown" as Hop["type"] });
      const m = magnitudeFor(rogue);
      expect(m).toBeCloseTo(expectedMagnitude(0.5), 4);
      expect(m).toBeCloseTo(1.476560, 4);
    });
  });

  // ── calculateCombinedFlavor: core algorithm ───────────────────────────────

  describe("calculateCombinedFlavor", () => {
    test("single dry-hop, single axis: matches clamp(M * flavor/5) by hand", () => {
      // 50 g into 20 L → gpl = 2.5; dry hop factor = 0.8 → W = 2.5*0.8 = 2.0
      // M = 5*(1 - exp(-0.7*2.0)) = 5*(1 - exp(-1.4)) = 5*(1-0.246597) = 3.767016
      // citrus flavor = 4 → proportion = 4/5 = 0.8 → axis = 3.767016 * 0.8 = 3.013613
      const hops = [hop({ type: "dry hop", grams: 50 })];
      const flavors = new Map([["Citra", flavor({ citrus: 4 })]]);
      const result = svc.calculateCombinedFlavor(hops, flavors, 20);

      const W = (50 / 20) * 0.8;
      const M = 5 * (1 - Math.exp(-LAMBDA * W));
      expect(result.citrus).toBeCloseTo(M * (4 / 5), 4);
      expect(result.citrus).toBeCloseTo(3.013613, 4);
      // Untouched axes stay 0.
      expect(result.berry).toBe(0);
      expect(result.resinPine).toBe(0);
    });

    test("two equal-flavor hops: magnitude grows with combined weight, axis ratios preserved", () => {
      // Two identical dry hops, each 50 g into 20 L → each W = 2.5*0.8 = 2.0; sum W = 4.0
      // M = 5*(1 - exp(-0.7*4.0)) = 5*(1 - exp(-2.8)) = 5*(1-0.0608101) = 4.695950
      // Both have citrus=5 → proportion = (2*2.0*1)/(4.0) = 1.0 → citrus = M = 4.695950
      const hops = [
        hop({ id: "a", type: "dry hop", grams: 50 }),
        hop({ id: "b", name: "Citra2", type: "dry hop", grams: 50 }),
      ];
      const flavors = new Map([
        ["Citra", flavor({ citrus: 5 })],
        ["Citra2", flavor({ citrus: 5 })],
      ]);
      const result = svc.calculateCombinedFlavor(hops, flavors, 20);

      const W = 2 * ((50 / 20) * 0.8);
      const M = 5 * (1 - Math.exp(-LAMBDA * W));
      expect(result.citrus).toBeCloseTo(M, 4);
      expect(result.citrus).toBeCloseTo(4.695950, 4);
    });

    test("blend: axis is weighted average of the two hops' normalized flavors", () => {
      // Hop A (citrus 5, tropical 0), Hop B (citrus 0, tropical 5), both 50 g / 20 L dry hop.
      // Each W = 2.0; total W = 4.0; M = 4.695950 (as above).
      // axisSum.citrus = 2.0*(5/5) + 2.0*(0/5) = 2.0 → proportion = 2.0/4.0 = 0.5
      //   citrus = M*0.5 = 2.347975
      // axisSum.tropical = 2.0*0 + 2.0*1 = 2.0 → proportion 0.5 → tropical = 2.347975
      const hops = [
        hop({ id: "a", name: "A", type: "dry hop", grams: 50 }),
        hop({ id: "b", name: "B", type: "dry hop", grams: 50 }),
      ];
      const flavors = new Map([
        ["A", flavor({ citrus: 5 })],
        ["B", flavor({ tropicalFruit: 5 })],
      ]);
      const result = svc.calculateCombinedFlavor(hops, flavors, 20);

      const M = 5 * (1 - Math.exp(-LAMBDA * 4.0));
      expect(result.citrus).toBeCloseTo(M * 0.5, 4);
      expect(result.tropicalFruit).toBeCloseTo(M * 0.5, 4);
      expect(result.citrus).toBeCloseTo(2.347975, 4);
    });

    test("mixed addition types contributing to the SAME axis sum their weighted contributions", () => {
      // Hop A = dry hop (factor 0.8), Hop B = 60-min boil (factor exp(-3) = 0.0497871),
      // both citrus 5, both 50 g into 20 L → gpl = 2.5 each.
      //   W_A = 2.5 * 0.8        = 2.000000
      //   W_B = 2.5 * exp(-3)    = 0.124468
      //   W   = 2.124468
      // Both axes are citrus 5 → axisSum.citrus = W_A*1 + W_B*1 = W → proportion = 1.
      //   citrus = M(W) = 5*(1 - exp(-0.7*2.124468)) = 3.869895
      // A bug that dropped the boil hop's aromaFactor (used gpl directly, W_B = 2.5)
      // would give W = 4.5 and citrus = M(4.5) = 4.78779 — caught here because the two
      // factors differ (0.8 vs 0.0498), unlike the existing all-0.8 multi-hop tests.
      const hops = [
        hop({ id: "a", name: "A", type: "dry hop", grams: 50 }),
        hop({ id: "b", name: "B", type: "boil", grams: 50, timeMinutes: 60 }),
      ];
      const flavors = new Map([
        ["A", flavor({ citrus: 5 })],
        ["B", flavor({ citrus: 5 })],
      ]);
      const result = svc.calculateCombinedFlavor(hops, flavors, 20);

      const WA = (50 / 20) * 0.8;
      const WB = (50 / 20) * Math.exp(-AROMA_DECAY_PER_MINUTE * 60);
      const W = WA + WB;
      expect(result.citrus).toBeCloseTo(5 * (1 - Math.exp(-LAMBDA * W)), 4);
      expect(result.citrus).toBeCloseTo(3.869895, 4);
    });

    test("mixed addition types on DIFFERENT axes: per-type factor sets the axis proportion", () => {
      // Same two hops as above, but now A carries citrus and B carries tropicalFruit.
      // This is the test that ISOLATES the per-type aroma factor in the weight: the
      // proportion of each axis is exactly that hop's share of total weight.
      //   W_A = 2.5*0.8 = 2.000000 (dry hop, citrus 5)
      //   W_B = 2.5*exp(-3) = 0.124468 (60-min boil, tropicalFruit 5)
      //   W   = 2.124468 ; M = M(W) = 3.869895
      //   citrus proportion    = W_A/W = 0.941412 → citrus    = 3.869895*0.941412 = 3.643167
      //   tropical proportion  = W_B/W = 0.058588 → tropical  = 3.869895*0.058588 = 0.226728
      // The dry hop dominates because boil aroma has largely boiled off — exactly the
      // behavior the per-addition weighting exists to model. If the boil factor were
      // ignored (W_B = 2.5), the proportions would be 0.444/0.556 — a very different split.
      const hops = [
        hop({ id: "a", name: "A", type: "dry hop", grams: 50 }),
        hop({ id: "b", name: "B", type: "boil", grams: 50, timeMinutes: 60 }),
      ];
      const flavors = new Map([
        ["A", flavor({ citrus: 5 })],
        ["B", flavor({ tropicalFruit: 5 })],
      ]);
      const result = svc.calculateCombinedFlavor(hops, flavors, 20);

      const WA = (50 / 20) * 0.8;
      const WB = (50 / 20) * Math.exp(-AROMA_DECAY_PER_MINUTE * 60);
      const W = WA + WB;
      const M = 5 * (1 - Math.exp(-LAMBDA * W));
      expect(result.citrus).toBeCloseTo(M * (WA / W), 4);
      expect(result.tropicalFruit).toBeCloseTo(M * (WB / W), 4);
      expect(result.citrus).toBeCloseTo(3.643167, 4);
      expect(result.tropicalFruit).toBeCloseTo(0.226728, 4);
      // The citrus proportion is the dry hop's share of total weight, independent of M.
      expect(result.citrus / (result.citrus + result.tropicalFruit)).toBeCloseTo(
        WA / W,
        6
      );
    });

    test("dose-response: more grams of the same hop → stronger flavor (monotone)", () => {
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const low = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 25 })],
        flavors,
        20
      );
      const high = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 100 })],
        flavors,
        20
      );
      expect(high.citrus).toBeGreaterThan(low.citrus);
    });

    test("dilution: larger batch volume → weaker flavor (lower g/L)", () => {
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const small = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        10
      );
      const large = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        40
      );
      expect(large.citrus).toBeLessThan(small.citrus);
    });

    test("all output axes are bounded within [0, 5]", () => {
      // A maximal dose: huge g/L and all axes at 5 should still stay within [0,5].
      // NOTE: with in-range flavors (≤5) the clamp's UPPER bound never actually binds —
      // M is asymptotic to 5 from below and proportion = axisSum/W ≤ 1, so M*proportion
      // < 5 always. This case rides the asymptote to ~5 rather than being clamped DOWN
      // from above. The targeted clamp-firing test below forces the over-5 path.
      const flavors = new Map([
        [
          "Citra",
          flavor({
            citrus: 5,
            tropicalFruit: 5,
            stoneFruit: 5,
            berry: 5,
            floral: 5,
            grassy: 5,
            herbal: 5,
            spice: 5,
            resinPine: 5,
          }),
        ],
      ]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 5000 })],
        flavors,
        20
      );
      for (const k of ALL_KEYS) {
        expect(result[k]).toBeGreaterThanOrEqual(0);
        expect(result[k]).toBeLessThanOrEqual(5);
      }
    });

    test("clamp upper bound fires when an out-of-range flavor drives the value above 5", () => {
      // The clamp's max=5 is only reachable when proportion = axisSum/W > 1, which
      // requires a flavor axis > 5 (axis = flavor/5 > 1). Feed citrus = 50 (10x the
      // nominal scale) so proportion = 10 and the pre-clamp value far exceeds 5:
      //   50 g dry hop / 20 L → gpl = 2.5, factor 0.8 → W = 2.0; M = M(2.0) = 3.767016
      //   pre-clamp citrus = M * (50/5) = 3.767016 * 10 = 37.67 → clamp(·, 0, 5) = 5.
      const flavors = new Map([["Citra", flavor({ citrus: 50 })]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        20
      );
      // The pre-clamp magnitude*proportion (≈37.67) is well above 5, so the clamp binds.
      const W = (50 / 20) * 0.8;
      const preClamp = 5 * (1 - Math.exp(-LAMBDA * W)) * (50 / 5);
      expect(preClamp).toBeGreaterThan(5);
      expect(result.citrus).toBe(5);
    });

    test("magnitude saturates toward 5 but stays strictly below it for finite weight", () => {
      // M = 5*(1-exp(-0.7*W)); as W→∞, M→5 from below, and M < 5 strictly for finite W.
      // The previous 100000 g case floats M to exactly 5.0 in double precision, so it
      // can't demonstrate the strict inequality. Use a MODERATE dose where the gap is
      // observable: 250 g dry hop into 20 L → gpl = 12.5, factor 0.8 → W = 10.
      //   M = 5*(1 - exp(-0.7*10)) = 5*(1 - exp(-7)) = 4.995441
      // citrus flavor 5 → proportion 1 → citrus = M = 4.995441, and crucially < 5.
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 250 })],
        flavors,
        20
      );
      const W = (250 / 20) * 0.8;
      expect(W).toBeCloseTo(10, 6);
      expect(result.citrus).toBeLessThan(5);
      expect(result.citrus).toBeCloseTo(5 * (1 - Math.exp(-LAMBDA * W)), 4);
      expect(result.citrus).toBeCloseTo(4.995441, 4);
    });
  });

  // ── Edge cases & guards ────────────────────────────────────────────────────

  describe("calculateCombinedFlavor edge cases", () => {
    test("empty hop list → all-zero flavor profile", () => {
      const result = svc.calculateCombinedFlavor([], new Map(), 20);
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("hop with no matching flavor entry is skipped → empty profile", () => {
      // hopFlavors has no entry for "Citra" → flavor lookup fails, hop skipped.
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        new Map(),
        20
      );
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("zero batch volume → gpl forced to 0 → empty profile (no division by zero)", () => {
      // batchVolumeL = 0 takes the `batchVolumeL > 0 ? ... : 0` false branch.
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        0
      );
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("negative batch volume → gpl forced to 0 → empty profile", () => {
      // batchVolumeL = -10 is not > 0, so gpl = 0.
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        -10
      );
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("zero grams → weight <= 0 → hop skipped → empty profile", () => {
      const flavors = new Map([["Citra", flavor({ citrus: 5 })]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 0 })],
        flavors,
        20
      );
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("flavor vector of all zeros → magnitude>0 but every axis proportion 0 → empty", () => {
      // overallWeight > 0 so we do not early-return, but axisSum is all 0.
      const flavors = new Map([["Citra", flavor()]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        20
      );
      for (const k of ALL_KEYS) expect(result[k]).toBe(0);
    });

    test("missing flavor axis (undefined) is treated as 0", () => {
      // Supply a partial object missing some keys; `flavor[k] || 0` should coerce.
      const partial = { citrus: 5 } as unknown as HopFlavorProfile;
      const flavors = new Map([["Citra", partial]]);
      const result = svc.calculateCombinedFlavor(
        [hop({ type: "dry hop", grams: 50 })],
        flavors,
        20
      );
      // citrus present and positive; an absent axis must be exactly 0.
      expect(result.citrus).toBeGreaterThan(0);
      expect(result.berry).toBe(0);
    });

    test("a zero-weight hop (boil-off / 0 g) does not dilute a real addition", () => {
      // Hop A: real dry hop, citrus 5. Hop B: 0 g (skipped). Result should equal
      // the single-hop result, NOT be averaged down by B.
      const flavors = new Map([
        ["A", flavor({ citrus: 5 })],
        ["B", flavor({ citrus: 0 })],
      ]);
      const both = svc.calculateCombinedFlavor(
        [
          hop({ id: "a", name: "A", type: "dry hop", grams: 50 }),
          hop({ id: "b", name: "B", type: "dry hop", grams: 0 }),
        ],
        flavors,
        20
      );
      const onlyA = svc.calculateCombinedFlavor(
        [hop({ id: "a", name: "A", type: "dry hop", grams: 50 })],
        flavors,
        20
      );
      expect(both.citrus).toBeCloseTo(onlyA.citrus, 6);
    });

    test("returns a fresh object each call (no shared mutable EMPTY_FLAVOR)", () => {
      const a = svc.calculateCombinedFlavor([], new Map(), 20);
      const b = svc.calculateCombinedFlavor([], new Map(), 20);
      expect(a).not.toBe(b);
      a.citrus = 99; // mutating one must not leak into the next
      const c = svc.calculateCombinedFlavor([], new Map(), 20);
      expect(c.citrus).toBe(0);
    });

    test("idempotent: same inputs yield equal results across calls", () => {
      const flavors = new Map([["Citra", flavor({ citrus: 3, floral: 2 })]]);
      const hops = [hop({ type: "whirlpool", temperatureC: 75, whirlpoolTimeMinutes: 30 })];
      const first = svc.calculateCombinedFlavor(hops, flavors, 19);
      const second = svc.calculateCombinedFlavor(hops, flavors, 19);
      expect(second).toEqual(first);
    });

    test("output has exactly the nine canonical flavor keys", () => {
      const result = svc.calculateCombinedFlavor([], new Map(), 20);
      expect(Object.keys(result).sort()).toEqual([...ALL_KEYS].sort());
    });
  });
});
