import { describe, test, expect } from "vitest";
import type { Recipe, Fermentable, Hop } from "../../recipe/models/Recipe";
import { MALT_FLAVOR_KEYS, type MaltFlavorProfile } from "../maltFlavor";
import { HOP_FLAVOR_KEYS, type HopFlavorProfile } from "../../recipe/models/Presets";
import { CONTINUOUS_DIMS } from "./featureSpace";
import { featurize, classifyGrist } from "./featurize";

// ── fixtures ────────────────────────────────────────────────────────────────

const EQUIPMENT: Recipe["equipment"] = {
  boilTimeMin: 60,
  boilOffRateLPerHour: 4,
  brewhouseEfficiencyPercent: 75,
  mashThicknessLPerKg: 2.7,
  grainAbsorptionLPerKg: 0.8,
  mashTunDeadspaceLiters: 2.0,
  mashTunLossLiters: 0,
  kettleLossLiters: 1.0,
  hopsAbsorptionLPerKg: 0.7,
  chillerLossLiters: 0,
  fermenterLossLiters: 0.5,
  coolingShrinkagePercent: 4.0,
};

function ferm(partial: Partial<Fermentable> & Pick<Fermentable, "name" | "weightKg" | "colorLovibond">): Fermentable {
  return {
    id: partial.id ?? partial.name,
    ppg: partial.ppg ?? 36,
    efficiencyPercent: partial.efficiencyPercent ?? 80,
    ...partial,
  };
}

function hop(partial: Partial<Hop> & Pick<Hop, "name" | "grams" | "type">): Hop {
  return {
    id: partial.id ?? partial.name,
    alphaAcid: partial.alphaAcid ?? 12,
    ...partial,
  };
}

function recipe(overrides: Partial<Recipe> & Pick<Recipe, "fermentables" | "hops">): Recipe {
  const now = new Date().toISOString();
  return {
    id: "test",
    name: "Test",
    currentVersion: 1,
    batchVolumeL: 20,
    equipment: EQUIPMENT,
    yeasts: [],
    otherIngredients: [],
    mashSteps: [{ id: "m1", name: "Sacch", temperatureC: 67, durationMinutes: 60 }],
    fermentationSteps: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Canonical dry stout — roast/coffee-forward, near-zero hop aroma. */
function dryStout(): Recipe {
  return recipe({
    name: "Dry Stout",
    style: "15B. Irish Stout",
    fermentables: [
      ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 3.5, colorLovibond: 1.8 }),
      ferm({ name: "Flaked Barley", weightKg: 1.0, colorLovibond: 1.5 }),
      ferm({ name: "Roasted Barley", weightKg: 0.5, colorLovibond: 450 }),
    ],
    hops: [hop({ name: "East Kent Goldings", grams: 30, type: "boil", timeMinutes: 60, alphaAcid: 5 })],
  });
}

/** Hazy IPA — tropical/citrus hop character, soft malt, ~zero caramel. */
function hazyIpa(): Recipe {
  return recipe({
    name: "Hazy IPA",
    style: "21C. Hazy IPA",
    fermentables: [
      ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 4.5, colorLovibond: 1.8 }),
      ferm({ name: "Wheat Malt", weightKg: 0.8, colorLovibond: 2 }),
      ferm({ name: "Flaked Oats", weightKg: 0.7, colorLovibond: 1 }),
    ],
    hops: [
      hop({ name: "Citra", grams: 20, type: "whirlpool", whirlpoolTimeMinutes: 20, temperatureC: 80, alphaAcid: 12 }),
      hop({ name: "Mosaic", grams: 20, type: "whirlpool", whirlpoolTimeMinutes: 20, temperatureC: 80, alphaAcid: 12 }),
      hop({ name: "Citra", grams: 40, type: "dry hop", dryHopDays: 3, alphaAcid: 12 }),
      hop({ name: "Mosaic", grams: 40, type: "dry hop", dryHopDays: 3, alphaAcid: 12 }),
    ],
  });
}

function argmaxMalt(p: MaltFlavorProfile): keyof MaltFlavorProfile {
  let best = MALT_FLAVOR_KEYS[0] as keyof MaltFlavorProfile;
  for (const k of MALT_FLAVOR_KEYS) if (p[k] > p[best]) best = k;
  return best;
}

function argmaxHop(p: HopFlavorProfile): keyof HopFlavorProfile {
  let best = HOP_FLAVOR_KEYS[0] as keyof HopFlavorProfile;
  for (const k of HOP_FLAVOR_KEYS) if (p[k] > p[best]) best = k;
  return best;
}

// ── classifyGrist ───────────────────────────────────────────────────────────

describe("classifyGrist", () => {
  test("uses the runtime classifier, not the generator's preset-only map", () => {
    // Brand-prefixed names the generator never emits — must still classify.
    const { classifications } = classifyGrist([
      ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 4, colorLovibond: 1.8 }),
      ferm({ name: "Weyermann - Carafa Special Type II", weightKg: 0.2, colorLovibond: 415 }),
    ]);
    expect(classifications.map((c) => c.archetype)).toEqual(["base-pale", "carafa-dehusked"]);
  });
});

// ── featurize round-trips ───────────────────────────────────────────────────

describe("featurize — canonical recipes", () => {
  test("returns a 23-dim continuous row and calculator stats", () => {
    const f = featurize(dryStout());
    expect(f.row).toHaveLength(CONTINUOUS_DIMS);
    expect(f.og).toBeGreaterThan(1.03);
    expect(f.srm).toBeGreaterThan(20);
    expect(f.calculations.og).toBe(f.og);
  });

  test("dry stout scores high roast/coffee, not caramel-led", () => {
    const f = featurize(dryStout());
    // Roasted barley anchors coffee; the dark cluster dominates grainy.
    expect(["coffee", "roast", "chocolate"]).toContain(argmaxMalt(f.malt));
    expect(f.malt.coffee + f.malt.roast).toBeGreaterThan(f.malt.grainy);
    expect(f.malt.coffee).toBeGreaterThan(0.5);
    expect(f.malt.roast).toBeGreaterThan(0.3);
    // A stout is not a crystal beer.
    expect(f.malt.caramel).toBeLessThan(f.malt.coffee);
  });

  test("hazy IPA scores tropical/citrus, ~zero caramel", () => {
    const f = featurize(hazyIpa());
    // Soft pale grist — grainy/biscuit, not roast or caramel.
    expect(f.malt.caramel).toBeLessThan(0.15);
    expect(f.malt.roast).toBe(0);
    expect(f.malt.coffee).toBe(0);
    // Big late/dry-hop Citra+Mosaic → tropical or citrus leads.
    expect(["tropicalFruit", "citrus"]).toContain(argmaxHop(f.hop));
    expect(f.hop.tropicalFruit + f.hop.citrus).toBeGreaterThan(1.5);
    expect(f.hop.resinPine).toBeLessThan(f.hop.tropicalFruit);
  });

  test("unmatched fermentables contribute zero flavour and raise unmatchedRate", () => {
    const r = recipe({
      fermentables: [
        ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 4, colorLovibond: 1.8 }),
        // Brand-only name in the 7–34°L gap — deliberately unknown.
        ferm({ name: "Admiral - Kilnsmith", weightKg: 1, colorLovibond: 20 }),
      ],
      hops: [],
    });
    const f = featurize(r);
    expect(f.unmatchedRate).toBeCloseTo(0.2, 5);
    expect(f.classifications.some((c) => c.archetype === "unknown")).toBe(true);
    expect(f.notes.some((n) => /unmatched/i.test(n))).toBe(true);
    // The unknown grain is skipped by aggregateMaltFlavor — profile is pure base-pale.
    expect(argmaxMalt(f.malt)).toBe("grainy");
  });

  test("inline hop.flavor overrides the preset map", () => {
    const r = recipe({
      fermentables: [ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 5, colorLovibond: 1.8 })],
      hops: [
        hop({
          name: "Mystery Hop",
          grams: 50,
          type: "dry hop",
          dryHopDays: 3,
          flavor: {
            citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0,
            floral: 0, grassy: 0, herbal: 0, spice: 0, resinPine: 5,
          },
        }),
      ],
    });
    const f = featurize(r);
    expect(argmaxHop(f.hop)).toBe("resinPine");
    expect(f.hop.resinPine).toBeGreaterThan(1);
  });

  test("maltBody rises with flaked oats", () => {
    const thin = featurize(recipe({
      fermentables: [ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 5, colorLovibond: 1.8 })],
      hops: [],
    }));
    const full = featurize(recipe({
      fermentables: [
        ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 4, colorLovibond: 1.8 }),
        ferm({ name: "Flaked Oats", weightKg: 1, colorLovibond: 1 }),
      ],
      hops: [],
    }));
    expect(full.maltBody).toBeGreaterThan(thin.maltBody);
  });
});
