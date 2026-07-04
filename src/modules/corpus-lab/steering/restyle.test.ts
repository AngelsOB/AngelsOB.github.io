import { describe, test, expect, beforeAll } from "vitest";
import type { Recipe, Fermentable, Hop } from "../../recipe/models/Recipe";
import { restyleTier1, gristBillFromRecipe } from "./restyle";
import { correctMaltGristToward, presetForArchetype } from "./reconstruction";
import { aggregateMaltFlavor } from "../maltFlavor";
import { RecipeSteeringService } from "./RecipeSteeringService";
import type { CloudRecord } from "./featureSpace";

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
  return { id: partial.id ?? partial.name, ppg: 36, efficiencyPercent: 80, ...partial };
}
function hop(partial: Partial<Hop> & Pick<Hop, "name" | "grams" | "type">): Hop {
  return { id: partial.id ?? partial.name, alphaAcid: 12, ...partial };
}
function recipe(overrides: Partial<Recipe> & Pick<Recipe, "fermentables" | "hops">): Recipe {
  const now = new Date().toISOString();
  return {
    id: "test", name: "Test", currentVersion: 1, batchVolumeL: 20, equipment: EQUIPMENT,
    yeasts: [], otherIngredients: [],
    mashSteps: [{ id: "m1", name: "Sacch", temperatureC: 67, durationMinutes: 60 }],
    fermentationSteps: [], createdAt: now, updatedAt: now, ...overrides,
  };
}

describe("correctMaltGristToward — reduce direction", () => {
  const item = (archetype: string, pct: number) => ({
    archetype,
    pct,
    preset: presetForArchetype(archetype)!,
  });

  test("allowReduce lowers caramel by trimming crystal", () => {
    const start = [item("base-pale", 85), item("crystal-medium", 15)];
    const before = aggregateMaltFlavor(start.map((i) => ({ archetype: i.archetype, amount: i.pct }))).caramel;
    const { items } = correctMaltGristToward(
      start,
      new Set(["base-pale", "crystal-medium"]),
      { caramel: Math.max(0, before - 0.5) },
      { allowReduce: true, minDeficit: 0.05 },
    );
    const after = aggregateMaltFlavor(items.map((i) => ({ archetype: i.archetype, amount: i.pct }))).caramel;
    expect(after).toBeLessThan(before);
  });

  test("without allowReduce, surplus target is a no-op", () => {
    const start = [item("base-pale", 80), item("crystal-medium", 20)];
    const before = aggregateMaltFlavor(start.map((i) => ({ archetype: i.archetype, amount: i.pct }))).caramel;
    const { items } = correctMaltGristToward(
      start,
      new Set(["base-pale", "crystal-medium"]),
      { caramel: Math.max(0, before - 1) },
      { allowReduce: false },
    );
    expect(items).toEqual(start);
  });
});

describe("restyleTier1", () => {
  test("more tropical: pushes hop axis with own hops only", () => {
    const r = recipe({
      fermentables: [ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 5, colorLovibond: 1.8 })],
      hops: [
        hop({ name: "Citra", grams: 30, type: "whirlpool", whirlpoolTimeMinutes: 20, temperatureC: 80 }),
        hop({ name: "Citra", grams: 50, type: "dry hop", dryHopDays: 3 }),
      ],
    });
    const base = restyleTier1(r, {}).achievedFlavor.hop.tropicalFruit;
    const result = restyleTier1(r, { hop: { tropicalFruit: +1.0 } }, { editBudget: 4 });
    expect(result.achievedFlavor.hop.tropicalFruit).toBeGreaterThan(base);
    expect(result.edits.length).toBeGreaterThan(0);
    expect(result.edits.every((e) => e.kind !== "add" || e.ingredient.toLowerCase().includes("citra"))).toBe(true);
  });

  test("less caramel: reduces crystal share, preserves total grain weight", () => {
    const r = recipe({
      fermentables: [
        ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 4, colorLovibond: 1.8 }),
        ferm({ name: "Caramel / Crystal 60L", weightKg: 0.8, colorLovibond: 60 }),
      ],
      hops: [],
    });
    const beforeTotal = r.fermentables.reduce((s, f) => s + f.weightKg, 0);
    const beforeCaramel = restyleTier1(r, {}).achievedFlavor.malt.caramel;
    const result = restyleTier1(r, { malt: { caramel: -0.4 } }, { editBudget: 3 });
    const afterTotal = result.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
    expect(afterTotal).toBeCloseTo(beforeTotal, 2);
    expect(result.achievedFlavor.malt.caramel).toBeLessThan(beforeCaramel);
    expect(result.edits.some((e) => e.kind === "adjust")).toBe(true);
  });

  test("preserves batch volume and bittering IBU when IBU not retargeted", () => {
    const r = recipe({
      fermentables: [ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 5, colorLovibond: 1.8 })],
      hops: [
        hop({ name: "Magnum", grams: 20, type: "boil", timeMinutes: 60, alphaAcid: 12 }),
        hop({ name: "Citra", grams: 40, type: "dry hop", dryHopDays: 3 }),
      ],
    });
    const result = restyleTier1(r, { hop: { tropicalFruit: +0.8 } }, { editBudget: 4 });
    expect(result.recipe.batchVolumeL).toBe(20);
    const magnumBefore = r.hops.find((h) => h.name === "Magnum")!.grams;
    const magnumAfter = result.recipe.hops.find((h) => h.name === "Magnum")!.grams;
    expect(magnumAfter).toBe(magnumBefore);
  });

  test("grist bill groups by archetype", () => {
    const r = recipe({
      fermentables: [
        ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 3, colorLovibond: 1.8 }),
        ferm({ name: "Caramel / Crystal 60L", weightKg: 1, colorLovibond: 60 }),
      ],
      hops: [],
    });
    const { items, totalKg } = gristBillFromRecipe(r);
    expect(totalKg).toBeCloseTo(4, 3);
    expect(items.length).toBe(2);
  });
});

// ── service integration (synthetic cloud) ───────────────────────────────────

function malt(over: Partial<Record<string, number>> = {}): number[] {
  const base: Record<string, number> = { grainy: 0.8, biscuit: 0.2, caramel: 0, darkFruit: 0, chocolate: 0, coffee: 0, roast: 0, nutty: 0, honey: 0.1, ...over };
  return ["grainy", "biscuit", "caramel", "darkFruit", "chocolate", "coffee", "roast", "nutty", "honey"].map((k) => base[k] ?? 0);
}
function hopVec(over: Partial<Record<string, number>> = {}): number[] {
  const base: Record<string, number> = { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0, floral: 0, grassy: 0, herbal: 0, spice: 0, resinPine: 0, ...over };
  return ["citrus", "tropicalFruit", "stoneFruit", "berry", "floral", "grassy", "herbal", "spice", "resinPine"].map((k) => base[k] ?? 0);
}

let idCounter = 0;
function makeCluster(n: number, template: Partial<CloudRecord> & { m: number[]; h: number[] }): CloudRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: idCounter++,
    s: "American IPA",
    fg: 1.012, abv: 6.3, srm: 6, mb: 0.12,
    g: { "base-pale": 88, "crystal-light": 8, "wheat-malt": 4 },
    hp: [], yc: null, ys: [], yn: null,
    og: 1.062, ibu: 60,
    ...template,
    m: template.m,
    h: template.h,
  } as CloudRecord));
}

const CLOUD = makeCluster(35, {
  s: "American IPA",
  m: malt({ grainy: 0.8 }),
  h: hopVec({ tropicalFruit: 4, citrus: 2 }),
});

describe("RecipeSteeringService.restyle", () => {
  let service: RecipeSteeringService;
  beforeAll(() => { service = new RecipeSteeringService(CLOUD); });

  test("returns edits + style context", () => {
    const r = recipe({
      style: "21A. American IPA",
      fermentables: [ferm({ name: "Briess - Brewers Malt 2-Row", weightKg: 5, colorLovibond: 1.8 })],
      hops: [hop({ name: "Citra", grams: 40, type: "dry hop", dryHopDays: 3 })],
    });
    const result = service.restyle(r, { hop: { tropicalFruit: +1.0 } });
    expect(result.edits.length).toBeGreaterThan(0);
    expect(result.styleNorms.level).toBe("style");
    expect(result.axisMax.hop.tropicalFruit).toBeGreaterThan(0);
  });
});
