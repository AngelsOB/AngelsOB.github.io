import { describe, test, expect } from "vitest";
import {
  aggregateMaltFlavor,
  aggregateMaltFlavorFrom,
  aggregateMaltBody,
  MALT_ARCHETYPES,
  MALT_ARCHETYPE_SLUGS,
  MALT_FLAVOR_KEYS,
  MALT_INTENSITY_LAMBDA as LAMBDA,
  getMaltArchetype,
  type MaltFlavorProfile,
} from "./maltFlavor";

// ── Fixtures & helpers ─────────────────────────────────────────────────────

const ALL_KEYS = [...MALT_FLAVOR_KEYS] as (keyof MaltFlavorProfile)[];

/** A flat 0 malt flavour vector, with overrides applied. */
function mf(overrides: Partial<MaltFlavorProfile> = {}): MaltFlavorProfile {
  return {
    grainy: 0,
    biscuit: 0,
    caramel: 0,
    darkFruit: 0,
    chocolate: 0,
    coffee: 0,
    roast: 0,
    nutty: 0,
    honey: 0,
    ...overrides,
  };
}

/** magnitude(W) = 5*(1 - exp(-LAMBDA*W)) — the saturating curve under test. */
function magnitude(W: number): number {
  return 5 * (1 - Math.exp(-LAMBDA * W));
}

/** Key with the largest value (the dominant flavour axis). */
function argmax(p: MaltFlavorProfile): keyof MaltFlavorProfile {
  return ALL_KEYS.reduce((best, k) => (p[k] > p[best] ? k : best), ALL_KEYS[0]);
}

describe("maltFlavor — aggregateMaltFlavorFrom (core math)", () => {
  test("LAMBDA is the documented value", () => {
    expect(LAMBDA).toBe(1.6);
  });

  test("single component, single axis: matches clamp(M * flavor/5) by hand", () => {
    // intensity 1, fraction 1 (amount sole) → W = 1; M = 5*(1-exp(-1)) = 3.160603.
    // grainy = 5 → proportion = (1*(5/5))/1 = 1 → grainy = M.
    const result = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
    ]);
    expect(result.grainy).toBeCloseTo(magnitude(1), 6);
    expect(result.roast).toBe(0);
  });

  test("partial axis: proportion scales the magnitude (flavor 2.5 → half)", () => {
    // proportion = (1*(2.5/5))/1 = 0.5 → grainy = M(1) * 0.5 = 1.580301.
    const result = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 2.5 }), intensity: 1, amount: 1 },
    ]);
    expect(result.grainy).toBeCloseTo(magnitude(1) * 0.5, 6);
  });

  test("magnitude saturates: doubling intensity grows flavour SUB-linearly", () => {
    // Single component, fraction 1 → W = intensity. M(2) < 2*M(1).
    const one = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
    ]).grainy;
    const two = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 2, amount: 1 },
    ]).grainy;
    expect(two).toBeCloseTo(magnitude(2), 6);
    expect(two).toBeLessThan(2 * one); // the whole point of the saturating curve
  });

  test("potency dominance: a tiny potent minority outweighs a large mild majority", () => {
    // 90% of intensity-0.5 grainy vs 10% of intensity-10 roast.
    // W = 0.9*0.5 + 0.1*10 = 0.45 + 1.0 = 1.45.
    // roast proportion = 1.0/1.45 = 0.6897 > grainy 0.45/1.45 = 0.3103.
    const result = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 0.5, amount: 0.9 },
      { flavor: mf({ roast: 5 }), intensity: 10, amount: 0.1 },
    ]);
    const M = magnitude(1.45);
    expect(result.roast).toBeCloseTo(M * (1.0 / 1.45), 4);
    expect(result.grainy).toBeCloseTo(M * (0.45 / 1.45), 4);
    expect(result.roast).toBeGreaterThan(result.grainy);
  });

  test("blend: equal-weight components split the direction 50/50", () => {
    // Two components, intensity 1, amounts 1 & 1 → fractions 0.5/0.5, W = 1.
    const result = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
      { flavor: mf({ roast: 5 }), intensity: 1, amount: 1 },
    ]);
    expect(result.grainy).toBeCloseTo(magnitude(1) * 0.5, 6);
    expect(result.roast).toBeCloseTo(magnitude(1) * 0.5, 6);
    expect(result.grainy).toBeCloseTo(result.roast, 9);
  });

  test("scale-invariant: depends on proportions, not absolute weights", () => {
    const small = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
      { flavor: mf({ roast: 5 }), intensity: 3, amount: 2 },
    ]);
    const big = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 10 },
      { flavor: mf({ roast: 5 }), intensity: 3, amount: 20 },
    ]);
    for (const k of ALL_KEYS) expect(big[k]).toBeCloseTo(small[k], 9);
  });

  test("clamp upper bound fires when an out-of-range flavor drives the value above 5", () => {
    // flavor grainy = 50 → proportion = 10 → pre-clamp = M(1)*10 ≈ 31.6 → clamp to 5.
    const result = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 50 }), intensity: 1, amount: 1 },
    ]);
    expect(magnitude(1) * (50 / 5)).toBeGreaterThan(5);
    expect(result.grainy).toBe(5);
  });

  test("output is bounded within [0,5] for a maximal grist", () => {
    const result = aggregateMaltFlavorFrom([
      {
        flavor: mf({ grainy: 5, biscuit: 5, caramel: 5, darkFruit: 5, chocolate: 5, coffee: 5, roast: 5, nutty: 5, honey: 5 }),
        intensity: 100,
        amount: 1,
      },
    ]);
    for (const k of ALL_KEYS) {
      expect(result[k]).toBeGreaterThanOrEqual(0);
      expect(result[k]).toBeLessThanOrEqual(5);
    }
  });

  test("empty input → all-zero profile", () => {
    const result = aggregateMaltFlavorFrom([]);
    for (const k of ALL_KEYS) expect(result[k]).toBe(0);
  });

  test("components with amount <= 0 are ignored and do not dilute real ones", () => {
    const both = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
      { flavor: mf({ roast: 5 }), intensity: 1, amount: 0 },
    ]);
    const onlyA = aggregateMaltFlavorFrom([
      { flavor: mf({ grainy: 5 }), intensity: 1, amount: 1 },
    ]);
    for (const k of ALL_KEYS) expect(both[k]).toBeCloseTo(onlyA[k], 9);
  });

  test("all-zero flavor with positive weight → zeros (no NaN from axisSum/W)", () => {
    const result = aggregateMaltFlavorFrom([
      { flavor: mf(), intensity: 5, amount: 1 },
    ]);
    for (const k of ALL_KEYS) expect(result[k]).toBe(0);
  });

  test("returns a fresh object each call", () => {
    const a = aggregateMaltFlavorFrom([]);
    const b = aggregateMaltFlavorFrom([]);
    expect(a).not.toBe(b);
    a.grainy = 99;
    expect(aggregateMaltFlavorFrom([]).grainy).toBe(0);
  });

  test("output has exactly the nine canonical malt keys", () => {
    const result = aggregateMaltFlavorFrom([]);
    expect(ALL_KEYS.length).toBe(9);
    expect(Object.keys(result).sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe("maltFlavor — aggregateMaltFlavor (slug resolution)", () => {
  test("unknown archetype slugs are skipped", () => {
    const result = aggregateMaltFlavor([{ archetype: "not-a-malt", amount: 1 }]);
    for (const k of ALL_KEYS) expect(result[k]).toBe(0);
  });

  test("mixing an unknown slug with a known one equals the known one alone", () => {
    const mixed = aggregateMaltFlavor([
      { archetype: "pilsner", amount: 1 },
      { archetype: "not-a-malt", amount: 1 },
    ]);
    const alone = aggregateMaltFlavor([{ archetype: "pilsner", amount: 1 }]);
    for (const k of ALL_KEYS) expect(mixed[k]).toBeCloseTo(alone[k], 9);
  });

  test("slug path matches the resolved-core path for the same data", () => {
    const pilsner = getMaltArchetype("pilsner")!;
    const viaSlug = aggregateMaltFlavor([{ archetype: "pilsner", amount: 2 }]);
    const viaCore = aggregateMaltFlavorFrom([
      { flavor: pilsner.flavor, intensity: pilsner.intensity, amount: 2 },
    ]);
    for (const k of ALL_KEYS) expect(viaSlug[k]).toBeCloseTo(viaCore[k], 9);
  });
});

describe("maltFlavor — lexicon sanity (relational, real archetypes)", () => {
  test("a pure Pilsner grist reads as grainy-dominant", () => {
    const result = aggregateMaltFlavor([{ archetype: "pilsner", amount: 1 }]);
    expect(argmax(result)).toBe("grainy");
  });

  test("a stout grist is roasty-dominant even though base malt is the majority", () => {
    // 75% base, 8% roasted barley, 7% chocolate, 10% flaked oats.
    const stout = aggregateMaltFlavor([
      { archetype: "base-pale", amount: 75 },
      { archetype: "roasted-barley", amount: 8 },
      { archetype: "chocolate-malt", amount: 7 },
      { archetype: "flaked-oats", amount: 10 },
    ]);
    // The dark/roasty cluster (coffee/roast/chocolate) dominates the base grainy note;
    // roasted barley makes coffee the lead descriptor (cocoa-mocha), not acrid roast.
    expect(["coffee", "roast", "chocolate"]).toContain(argmax(stout));
    expect(stout.coffee + stout.roast).toBeGreaterThan(stout.grainy);
    expect(stout.coffee).toBeGreaterThan(stout.grainy);
  });

  test("a crystal-heavy grist is caramel-forward", () => {
    const amber = aggregateMaltFlavor([
      { archetype: "base-pale", amount: 80 },
      { archetype: "crystal-medium", amount: 20 },
    ]);
    expect(argmax(amber)).toBe("caramel");
    expect(amber.caramel).toBeGreaterThan(amber.grainy);
  });

  test("potency dominance holds on real data: 10% roasted barley beats 90% base", () => {
    const result = aggregateMaltFlavor([
      { archetype: "base-pale", amount: 90 },
      { archetype: "roasted-barley", amount: 10 },
    ]);
    expect(result.roast).toBeGreaterThan(result.grainy);
  });

  test("more roasted barley → more roast (monotone) but saturating", () => {
    const five = aggregateMaltFlavor([
      { archetype: "base-pale", amount: 95 },
      { archetype: "roasted-barley", amount: 5 },
    ]).roast;
    const ten = aggregateMaltFlavor([
      { archetype: "base-pale", amount: 90 },
      { archetype: "roasted-barley", amount: 10 },
    ]).roast;
    expect(ten).toBeGreaterThan(five); // monotone
    expect(ten).toBeLessThan(2 * five); // but sub-linear (diminishing returns)
  });
});

describe("maltFlavor — lexicon data integrity", () => {
  test("every archetype has valid axes (0-5) and positive intensity", () => {
    for (const a of MALT_ARCHETYPES) {
      expect(a.intensity).toBeGreaterThan(0);
      for (const k of ALL_KEYS) {
        expect(a.flavor[k]).toBeGreaterThanOrEqual(0);
        expect(a.flavor[k]).toBeLessThanOrEqual(5);
      }
    }
  });

  test("slugs are unique", () => {
    expect(new Set(MALT_ARCHETYPE_SLUGS).size).toBe(MALT_ARCHETYPE_SLUGS.length);
  });

  test("getMaltArchetype resolves every published slug", () => {
    for (const slug of MALT_ARCHETYPE_SLUGS) {
      expect(getMaltArchetype(slug)?.slug).toBe(slug);
    }
  });
});

describe("maltFlavor — aggregateMaltBody (mouthfeel)", () => {
  test("empty grist → 0", () => {
    expect(aggregateMaltBody([])).toBe(0);
  });

  test("all base malt → neutral 0", () => {
    expect(aggregateMaltBody([{ archetype: "base-pale", amount: 100 }])).toBe(0);
  });

  test("dextrine and flaked oats add body (positive)", () => {
    expect(
      aggregateMaltBody([
        { archetype: "base-pale", amount: 90 },
        { archetype: "dextrine", amount: 10 },
      ])
    ).toBeGreaterThan(0);
    expect(
      aggregateMaltBody([
        { archetype: "base-pale", amount: 90 },
        { archetype: "flaked-oats", amount: 10 },
      ])
    ).toBeGreaterThan(0);
  });

  test("rice thins the body (negative)", () => {
    expect(
      aggregateMaltBody([
        { archetype: "base-pale", amount: 80 },
        { archetype: "flaked-rice", amount: 20 },
      ])
    ).toBeLessThan(0);
  });

  test("more oats → more body, and LINEARLY (no saturation, unlike flavour)", () => {
    const five = aggregateMaltBody([
      { archetype: "base-pale", amount: 95 },
      { archetype: "flaked-oats", amount: 5 },
    ]);
    const ten = aggregateMaltBody([
      { archetype: "base-pale", amount: 90 },
      { archetype: "flaked-oats", amount: 10 },
    ]);
    expect(ten).toBeGreaterThan(five);
    expect(ten).toBeCloseTo(2 * five, 9);
  });

  test("scale-invariant (depends on proportions, not absolute weights)", () => {
    const a = aggregateMaltBody([
      { archetype: "flaked-oats", amount: 1 },
      { archetype: "base-pale", amount: 4 },
    ]);
    const b = aggregateMaltBody([
      { archetype: "flaked-oats", amount: 10 },
      { archetype: "base-pale", amount: 40 },
    ]);
    expect(b).toBeCloseTo(a, 9);
  });

  test("plain sugar thins the body (matcher tags non-malt sugars 'sugar')", () => {
    expect(
      aggregateMaltBody([
        { archetype: "base-pale", amount: 80 },
        { archetype: "sugar", amount: 20 },
      ])
    ).toBeLessThan(0);
  });

  test("unknown slug contributes 0 body", () => {
    expect(aggregateMaltBody([{ archetype: "not-a-malt", amount: 100 }])).toBe(0);
  });
});
