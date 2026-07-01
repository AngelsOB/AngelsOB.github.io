import { describe, test, expect, beforeAll } from "vitest";
import { RecipeSteeringService, type SteeringQuery } from "./RecipeSteeringService";
import type { CloudRecord } from "./featureSpace";

// ── synthetic fixture: 3 flavour-distinct clusters across 3 style families ──

function malt(over: Partial<Record<string, number>> = {}): number[] {
  // order: grainy, biscuit, caramel, darkFruit, chocolate, coffee, roast, nutty, honey
  const base: Record<string, number> = { grainy: 0.8, biscuit: 0.2, caramel: 0, darkFruit: 0, chocolate: 0, coffee: 0, roast: 0, nutty: 0, honey: 0.1, ...over };
  return ["grainy", "biscuit", "caramel", "darkFruit", "chocolate", "coffee", "roast", "nutty", "honey"].map((k) => base[k] ?? 0);
}
function hop(over: Partial<Record<string, number>> = {}): number[] {
  // order: citrus, tropicalFruit, stoneFruit, berry, floral, grassy, herbal, spice, resinPine
  const base: Record<string, number> = { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0, floral: 0, grassy: 0, herbal: 0, spice: 0, resinPine: 0, ...over };
  return ["citrus", "tropicalFruit", "stoneFruit", "berry", "floral", "grassy", "herbal", "spice", "resinPine"].map((k) => base[k] ?? 0);
}

let idCounter = 0;
function makeCluster(n: number, template: Partial<CloudRecord> & { m: number[]; h: number[] }): CloudRecord[] {
  const baseIbu = template.ibu ?? 55;
  const baseOg = template.og ?? 1.06;
  const baseM = template.m;
  const baseH = template.h;
  // Small deterministic per-axis wobble (no RNG) — a real corpus cluster is
  // never made of literally-identical vectors. Without this, a large,
  // zero-variance synthetic cluster dominates the cloud-wide baseline-density
  // sample (used by the style-fit signal) out of proportion to its size.
  const axisJitter = (i: number, axis: number) => ((((i + axis) * 53) % 5) - 2) * 0.05;
  return Array.from({ length: n }, (_, i) => {
    const jitter = ((i * 37) % 7) - 3; // deterministic +-3 wobble, no RNG
    return {
      id: idCounter++,
      s: "American IPA",
      fg: 1.012,
      abv: 6.3,
      srm: 6,
      mb: 0.12,
      g: { "base-pale": 88, "crystal-light": 8, "wheat-malt": 4 },
      hp: [],
      yc: null,
      ys: [],
      yn: null,
      ...template,
      ibu: baseIbu + jitter,
      og: baseOg + jitter * 0.0003,
      m: baseM.map((v, axis) => Math.max(0, v + axisJitter(i, axis))),
      h: baseH.map((v, axis) => Math.max(0, v + axisJitter(i, axis + 9))),
    } as CloudRecord;
  });
}

const TROPICAL_IPA = makeCluster(15, {
  s: "American IPA",
  og: 1.062, ibu: 60, srm: 6, mb: 0.15,
  m: malt({ grainy: 0.8, biscuit: 0.2 }),
  h: hop({ tropicalFruit: 4.3, citrus: 2.5, resinPine: 0.5 }),
  g: { "base-pale": 88, "crystal-light": 8, "wheat-malt": 4 },
  hp: [["magnum", 0.5, "boil", 60], ["citra", 1.5, "whirlpool", 15], ["mosaic", 1.5, "whirlpool", 15], ["citra", 2, "dry hop", 4320], ["mosaic", 2, "dry hop", 4320]],
  yc: "Chico (American Ale)", ys: ["solo:us-05", "Chico (West Coast)"], yn: "1056 American Ale",
});

const RESIN_IPA = makeCluster(15, {
  s: "American IPA",
  og: 1.062, ibu: 65, srm: 6, mb: 0.13,
  m: malt({ grainy: 0.8, biscuit: 0.2 }),
  h: hop({ resinPine: 4.2, citrus: 2, tropicalFruit: 0.3 }),
  g: { "base-pale": 90, "crystal-light": 6, "wheat-malt": 4 },
  hp: [["columbus", 0.6, "boil", 60], ["simcoe", 1.5, "whirlpool", 15], ["simcoe", 2, "dry hop", 4320]],
  yc: "Chico (West Coast)", ys: ["solo:us-05", "Chico (American Ale)"], yn: "SafAle US-05",
});

const STOUT = makeCluster(10, {
  s: "American Stout",
  og: 1.08, ibu: 45, srm: 40, mb: 0.35,
  m: malt({ grainy: 0.5, roast: 3.5, chocolate: 2.2, coffee: 1.8 }),
  h: hop({ herbal: 0.5 }),
  g: { "base-pale": 80, "roasted-barley": 8, "chocolate-malt": 6, "crystal-dark": 6 },
  hp: [["magnum", 1.0, "boil", 60]],
  yc: "Chico (American Ale)", ys: [], yn: "1056 American Ale",
});

const PILS = makeCluster(10, {
  s: "German Pils",
  og: 1.048, ibu: 30, srm: 3, mb: 0.02,
  m: malt({ grainy: 2.2, biscuit: 0, honey: 0.3 }),
  h: hop({ floral: 2, herbal: 1.5, grassy: 1 }),
  g: { pilsner: 100 },
  hp: [["saaz", 1.0, "boil", 60], ["saaz", 0.5, "boil", 10]],
  yc: "German Lager", ys: [], yn: null,
});

// Same coarse family ("Lager") but different specific BJCP styles, each with
// enough records (>=30) to clear the style-centroid floor — for testing that
// distinct styles sharing a family stop colliding on the same output.
const MUNICH_HELLES = makeCluster(35, {
  s: "Munich Helles",
  og: 1.048, ibu: 18, srm: 4, mb: 0.05,
  m: malt({ grainy: 2.5, biscuit: 0.5, honey: 1.0 }),
  h: hop({ herbal: 1.0, floral: 0.5 }),
  g: { "munich-light": 70, pilsner: 30 },
  hp: [["hallertau", 1.0, "boil", 60]],
  yc: "German Lager", ys: [], yn: null,
});

const AMERICAN_LAGER = makeCluster(35, {
  s: "American Lager",
  og: 1.045, ibu: 10, srm: 2, mb: -0.1,
  m: malt({ grainy: 1.0 }),
  h: hop({ herbal: 0.3 }),
  g: { "base-pale": 70, "flaked-corn": 30 },
  hp: [["cluster", 0.6, "boil", 60]],
  yc: "German Lager", ys: [], yn: null,
});

const CLOUD: CloudRecord[] = [...TROPICAL_IPA, ...RESIN_IPA, ...STOUT, ...PILS, ...MUNICH_HELLES, ...AMERICAN_LAGER];

let service: RecipeSteeringService;
beforeAll(() => {
  service = new RecipeSteeringService(CLOUD);
});

// ── basic shape ──────────────────────────────────────────────────────────────

describe("RecipeSteeringService — basic query", () => {
  test("throws on an empty cloud rather than misbehaving silently", () => {
    expect(() => new RecipeSteeringService([])).toThrow();
  });

  test("returns a fully calculated recipe with ingredients", () => {
    const result = service.steer({ style: "American IPA" });
    expect(result.recipe.fermentables.length).toBeGreaterThan(0);
    expect(result.recipe.hops.length).toBeGreaterThan(0);
    expect(result.recipe.yeasts).toHaveLength(1);
    expect(result.calculations.og).toBeGreaterThan(1.0);
    expect(result.calculations.abv).toBeGreaterThan(0);
    expect(result.style.matchedCode).toBe("21A");
    expect(result.style.family).toBe("IPA");
  });

  test("with no target, ABV defaults to the style's own BJCP guideline midpoint, not the corpus's self-reported average", () => {
    // both IPA clusters sit at abv 6.3 in the fixture, but 21A's real BJCP
    // range is [5.5, 7.5] -> midpoint 6.5. ABV is fully determined by
    // ingredients+process, so a real guideline number beats averaging noisy
    // self-reported corpus data.
    const result = service.steer({ style: "American IPA" });
    expect(result.calculations.abv).toBeCloseTo(6.5, 1);
  });

  test("falls back to the corpus average when the style has no BJCP spec to anchor to", () => {
    const result = service.steer({ style: "Definitely Not A Real Style Name Xyz" });
    expect(result.calculations.abv).toBeCloseTo(6.3, 1);
  });

  test("an unresolvable style still returns a result, falling back to family = Other with a note", () => {
    const result = service.steer({ style: "Definitely Not A Real Style Name Xyz" });
    expect(result.style.matchedCode).toBeUndefined();
    expect(result.style.family).toBe("Other");
    expect(result.notes.some((n) => n.includes("didn't resolve"))).toBe(true);
  });
});

// ── solvers ──────────────────────────────────────────────────────────────────

describe("RecipeSteeringService — target ABV solver", () => {
  test("hits an explicit target ABV precisely via the reverse grain-weight solver", () => {
    const result = service.steer({ style: "American IPA", target: { abv: 8.2 } });
    expect(result.calculations.abv).toBeCloseTo(8.2, 1);
  });

  test("a lower target ABV also solves precisely", () => {
    const result = service.steer({ style: "American IPA", target: { abv: 4.5 } });
    expect(result.calculations.abv).toBeCloseTo(4.5, 1);
  });
});

describe("RecipeSteeringService — target IBU solver", () => {
  test("hits an explicit target IBU via the hop-grams bisection solve", () => {
    const result = service.steer({ style: "American IPA", target: { ibu: 90 } });
    expect(result.calculations.ibu).toBeCloseTo(90, 0);
  });

  test("a much lower target IBU also solves", () => {
    const result = service.steer({ style: "American IPA", target: { ibu: 20 } });
    expect(result.calculations.ibu).toBeCloseTo(20, 0);
  });
});

// ── flavour steering ─────────────────────────────────────────────────────────

describe("RecipeSteeringService — flavour steering pulls toward the matching cluster", () => {
  test("pushing tropicalFruit hard finds the tropical-IPA cluster, not the resin cluster", () => {
    const result = service.steer({ style: "American IPA", target: { hop: { tropicalFruit: 4.5 } }, k: 10 });
    expect(result.requestedFlavor.hop.tropicalFruit).toBe(4.5); // override applied verbatim
    // every neighbour pulled in should be from the tropical cluster (ids 0-14), not resin (15-29)
    for (const id of result.neighborhood.recordIds) expect(id).toBeLessThan(15);
    expect(result.achievedFlavor.hop.tropicalFruit).toBeGreaterThan(result.achievedFlavor.hop.resinPine);
  });

  test("pushing resinPine hard finds the resin-IPA cluster instead", () => {
    const result = service.steer({ style: "American IPA", target: { hop: { resinPine: 4.5, tropicalFruit: 0 } }, k: 10 });
    for (const id of result.neighborhood.recordIds) {
      expect(id).toBeGreaterThanOrEqual(15);
      expect(id).toBeLessThan(30);
    }
    expect(result.achievedFlavor.hop.resinPine).toBeGreaterThan(result.achievedFlavor.hop.tropicalFruit);
  });
});

// ── style gating ─────────────────────────────────────────────────────────────

describe("RecipeSteeringService — style gate modes", () => {
  test("strict gate restricts candidates to the matched family only", () => {
    // ask for a roasty malt push while gated to IPA -- strict must stay in the IPA family
    // even though the stout cluster is a much closer flavour match.
    const result = service.steer({
      style: "American IPA",
      styleGate: "strict",
      target: { malt: { roast: 3.5, chocolate: 2.2 } },
      k: 10,
    });
    for (const id of result.neighborhood.recordIds) expect(id).toBeLessThan(30); // IPA-only ids
  });

  test("family gate (default) allows a strong enough push to cross into a different family", () => {
    const result = service.steer({
      style: "American IPA",
      target: { malt: { roast: 3.5, chocolate: 2.2, coffee: 1.8 }, hop: { herbal: 0.5, citrus: 0, tropicalFruit: 0, resinPine: 0 } },
      k: 10,
    });
    // the stout cluster (ids 30-39) is flavour-nearest to a roast+chocolate+coffee push
    expect(result.neighborhood.recordIds.some((id) => id >= 30 && id < 40)).toBe(true);
  });
});

describe("RecipeSteeringService — style-specific centroid avoids same-family collisions", () => {
  test("two distinct styles sharing a coarse family produce different recipes with no explicit override", () => {
    // Munich Helles and American Lager both classify as family "Lager" —
    // before the style-specific centroid, both would steer from the exact
    // same family median and produce the same recipe.
    const helles = service.steer({ style: "Munich Helles" });
    const lager = service.steer({ style: "American Lager" });
    expect(helles.style.family).toBe("Lager");
    expect(lager.style.family).toBe("Lager");
    expect(helles.calculations.ibu).not.toBeCloseTo(lager.calculations.ibu, 0);
    expect(helles.recipe.fermentables.map((f) => f.name)).not.toEqual(lager.recipe.fermentables.map((f) => f.name));
    // each pulled from its OWN 35-record cluster, not a blend of both
    for (const id of helles.neighborhood.recordIds) expect(id).toBeGreaterThanOrEqual(50);
    for (const id of lager.neighborhood.recordIds) expect(id).toBeGreaterThanOrEqual(50);
  });

  test("falls back to the family median (with a note) when the matched style has too few records", () => {
    // the German Pils cluster only has 10 records — below the style-centroid floor.
    const result = service.steer({ style: "German Pils" });
    expect(result.notes.some((n) => n.includes("fewer than"))).toBe(true);
  });
});

describe("RecipeSteeringService — mash-temp solver", () => {
  // Each test gets its own single-cluster cloud (only OG/FG differ) so the
  // k-NN search can't blend across clusters — there's nothing else to find.
  function singleClusterService(fg: number): RecipeSteeringService {
    const cloud = makeCluster(20, {
      s: "Test Style", og: 1.06, fg, srm: 6, mb: 0.1,
      m: malt(), h: hop(),
      g: { "base-pale": 100 },
      hp: [["magnum", 0.5, "boil", 60]],
      yc: null, ys: [], yn: "SafAle US-05",
    });
    return new RecipeSteeringService(cloud);
  }

  test("infers a cooler mash for a drier (higher-attenuation) neighbourhood, hotter for a sweeter one", () => {
    const dry = singleClusterService(1.006).steer({ style: "Test Style" }); // ~90% apparent attenuation
    const sweet = singleClusterService(1.020).steer({ style: "Test Style" }); // ~67% apparent attenuation
    expect(dry.recipe.mashSteps[0].temperatureC).toBeLessThan(sweet.recipe.mashSteps[0].temperatureC);
  });

  test("stays within the practical mash-temp range even when the target is unreachable", () => {
    // ~98% attenuation — the kinetic model itself caps effective attenuation
    // at 95%, so this is unreachable for any mash temp; the solver should
    // still settle on a real temp within range, not something degenerate.
    const result = singleClusterService(1.001).steer({ style: "Test Style" });
    const temp = result.recipe.mashSteps[0].temperatureC;
    expect(temp).toBeGreaterThanOrEqual(62.5);
    expect(temp).toBeLessThanOrEqual(72.5);
    expect(result.notes.some((n) => n.includes("outside what a single-infusion mash can reach"))).toBe(true);
  });

  test("a comfortably achievable target gets no boundary note", () => {
    const result = singleClusterService(1.014).steer({ style: "Test Style" }); // ~77%, well within reach
    expect(result.notes.some((n) => n.includes("outside what a single-infusion mash can reach"))).toBe(false);
  });
});

// ── yeast override ───────────────────────────────────────────────────────────

describe("RecipeSteeringService — yeast override", () => {
  test("a valid preset name locks the final recipe's yeast", () => {
    const result = service.steer({ style: "German Pils", yeastName: "SafAle US-05" });
    expect(result.recipe.yeasts[0].name).toBe("SafAle US-05");
  });

  test("an unknown preset name falls back to the neighbourhood's modal yeast with a note", () => {
    const result = service.steer({ style: "American IPA", yeastName: "Not A Real Yeast Preset" });
    expect(result.recipe.yeasts[0].name).not.toBe("Not A Real Yeast Preset");
    expect(result.notes.some((n) => n.includes("not found"))).toBe(true);
  });
});

// ── style-fit signal ─────────────────────────────────────────────────────────

describe("RecipeSteeringService — style-fit signal", () => {
  test("a query well inside a dense cluster reports in-bounds", () => {
    const result = service.steer({ style: "American IPA", target: { hop: { tropicalFruit: 4.3, citrus: 2.5 } } });
    expect(result.styleFit.meanNeighborDistance).toBeGreaterThanOrEqual(0);
    expect(result.styleFit.baselineDistance).toBeGreaterThanOrEqual(0);
    expect(result.styleFit.inBounds).toBe(true);
  });

  test("reports a graded ratio + band consistent with inBounds", () => {
    const result = service.steer({ style: "American IPA" });
    const { ratio, band, meanNeighborDistance, baselineDistance, inBounds } = result.styleFit;
    expect(ratio).toBeCloseTo(baselineDistance > 0 ? meanNeighborDistance / baselineDistance : 0, 6);
    expect(["typical", "stretch", "experimental"]).toContain(band);
    expect(inBounds).toBe(band !== "experimental");
  });

  const target: SteeringQuery["target"] = {
    hop: { tropicalFruit: 5, resinPine: 5, citrus: 5, floral: 5, grassy: 5, herbal: 5, spice: 5, berry: 5, stoneFruit: 5 },
    malt: { roast: 5, chocolate: 5, coffee: 5, caramel: 5, darkFruit: 5, nutty: 5, honey: 5, biscuit: 5, grainy: 5 },
    ibu: 5,
    srm: 45,
  };
  test("a self-contradictory, maxed-out target reports a real (non-NaN) distance", () => {
    const result = service.steer({ style: "American IPA", target });
    expect(Number.isFinite(result.styleFit.meanNeighborDistance)).toBe(true);
    expect(Number.isFinite(result.styleFit.baselineDistance)).toBe(true);
  });
});

// ── reconstruction picks the popular ingredient ──────────────────────────────

describe("RecipeSteeringService — reconstruction follows neighbourhood popularity", () => {
  // An isolated 20-record cloud: identical continuous vectors (so k pulls all of
  // them at equal kernel weight, isolating reconstruction from k-NN search),
  // one hop addition each, split citra:cascade 12:8. The popular hop wins; a
  // flavour push does NOT re-rank ingredients (steering happens via the k-NN
  // neighbourhood, not per-ingredient scoring — see reconstruction.ts).
  function popularityCloud(): CloudRecord[] {
    const common = { id: 0, s: "Creativity Test Style", og: 1.05, fg: 1.012, abv: 5.0, ibu: 40, srm: 6, mb: 0.1, m: malt(), h: hop(), g: { "base-pale": 100 }, yc: null, ys: [], yn: "SafAle US-05" };
    const citra: CloudRecord[] = Array.from({ length: 12 }, () => ({ ...common, hp: [["citra", 1.0, "boil", 5]] }));
    const cascade: CloudRecord[] = Array.from({ length: 8 }, () => ({ ...common, hp: [["cascade", 1.0, "boil", 5]] }));
    return [...citra, ...cascade].map((r, i) => ({ ...r, id: i }));
  }

  test("the popular hop wins, and a flavour push doesn't re-rank ingredients within the neighbourhood", () => {
    const cloud = popularityCloud();
    expect(new RecipeSteeringService(cloud).steer({ style: "Creativity Test Style", k: 20 }).recipe.hops.map((h) => h.name.toLowerCase())).toEqual(["citra"]);
    // a floral push (cascade is the floral hop) still leaves citra — no per-ingredient flavour match
    expect(new RecipeSteeringService(cloud).steer({ style: "Creativity Test Style", k: 20, target: { hop: { floral: 5 } } }).recipe.hops.map((h) => h.name.toLowerCase())).toEqual(["citra"]);
  });
});

// ── style norms ──────────────────────────────────────────────────────────────

describe("RecipeSteeringService — styleNorms (the style's own typical flavour range)", () => {
  test("uses the specific-style level and its real record count when there's enough data", () => {
    // TROPICAL_IPA (15) + RESIN_IPA (15) both resolve to 21A -> exactly the 30-record floor.
    const result = service.steer({ style: "American IPA" });
    expect(result.styleNorms.level).toBe("style");
    expect(result.styleNorms.recordCount).toBe(30);
  });

  test("falls back to the family level (and its wider record count) when the style itself is too thin", () => {
    const result = service.steer({ style: "German Pils" }); // only 10 records, below the floor
    expect(result.styleNorms.level).toBe("family");
    expect(result.styleNorms.recordCount).toBeGreaterThan(10);
  });

  test("styleGate 'none' reports the global level across the whole cloud", () => {
    const result = service.steer({ style: "American IPA", styleGate: "none" });
    expect(result.styleNorms.level).toBe("global");
    expect(result.styleNorms.recordCount).toBe(CLOUD.length);
  });

  test("p75 is never below p25 on any axis — well-formed percentile ranges", () => {
    const result = service.steer({ style: "American IPA" });
    for (const key of Object.keys(result.styleNorms.malt.p25) as Array<keyof typeof result.styleNorms.malt.p25>) {
      expect(result.styleNorms.malt.p75[key]).toBeGreaterThanOrEqual(result.styleNorms.malt.p25[key]);
    }
    for (const key of Object.keys(result.styleNorms.hop.p25) as Array<keyof typeof result.styleNorms.hop.p25>) {
      expect(result.styleNorms.hop.p75[key]).toBeGreaterThanOrEqual(result.styleNorms.hop.p25[key]);
    }
  });
});
