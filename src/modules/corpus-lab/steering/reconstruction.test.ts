import { describe, test, expect } from "vitest";
import {
  unmappedArchetypes,
  presetForArchetype,
  pickGristBill,
  enforceGristBrewability,
  buildFermentablesFromGristBill,
  blendGristPct,
  bucketForAddition,
  normalizeHopName,
  reconstructHopSchedule,
  materializeHopSchedule,
  scaleHops,
  pickModalYeastName,
  buildYeastFromPresetName,
  yeastTypeOf,
  correctMaltGristToward,
  correctHopScheduleToward,
} from "./reconstruction";
import type { CloudRecord } from "./featureSpace";
import { aggregateMaltFlavor, MALT_ARCHETYPES_BY_SLUG } from "../maltFlavor";

const ZERO9 = new Array(9).fill(0);
function rec(over: Partial<CloudRecord> = {}): CloudRecord {
  return {
    id: 0, s: "American IPA", og: 1.06, fg: 1.012, abv: 6.3, ibu: 60, srm: 6, mb: 0.1,
    m: [...ZERO9], h: [...ZERO9], g: {}, hp: [], yc: null, ys: [], yn: null,
    ...over,
  };
}

// ── grist ────────────────────────────────────────────────────────────────────

describe("archetype -> preset table", () => {
  test("every malt archetype (+ sugar/honey-sugar/lactose) resolves to a real preset", () => {
    expect(unmappedArchetypes()).toEqual([]);
  });

  test("presetForArchetype returns real ppg/color data, not invented numbers", () => {
    const preset = presetForArchetype("base-pale");
    expect(preset?.potentialGu).toBeGreaterThan(30);
    expect(preset?.colorLovibond).toBeLessThan(5);
  });

  test("unknown archetype returns undefined", () => {
    expect(presetForArchetype("not-a-real-archetype")).toBeUndefined();
  });
});

// one-neighbour helper: pickGristBill takes neighbours now (it needs to vote
// on a representative per role), but most pruning/renormalisation tests don't
// care about voting — a single weight-1 neighbour reproduces the old
// "given this blended %, what comes out" shape exactly.
function oneNeighbor(g: Record<string, number>) {
  return [{ rec: rec({ g }), weight: 1 }];
}

describe("pickGristBill", () => {
  test("drops non-reconstructable buckets and renormalises to 100", () => {
    const { items, notes } = pickGristBill(oneNeighbor({ "base-pale": 85, unknown: 10, adjunct: 5 }));
    expect(items).toHaveLength(1);
    expect(items[0].archetype).toBe("base-pale");
    expect(items[0].pct).toBeCloseTo(100, 6);
    expect(notes.length).toBeGreaterThan(0);
  });

  test("keeps multiple roles sorted by share, renormalised", () => {
    const { items } = pickGristBill(oneNeighbor({ "base-pale": 80, "crystal-medium": 20 }));
    expect(items.map((i) => i.archetype)).toEqual(["base-pale", "crystal-medium"]);
    expect(items[0].pct + items[1].pct).toBeCloseTo(100, 6);
    expect(items[0].pct).toBeCloseTo(80, 6);
  });

  test("caps at maxItems, dropping the long tail (at most one candidate per role)", () => {
    // 6 distinct roles: base/crystal/roasted/flaked/toasted/sugar
    const many = { "base-pale": 35, "crystal-medium": 25, "roasted-barley": 15, "flaked-oats": 10, "biscuit-malt": 8, sugar: 7 };
    const { items } = pickGristBill(oneNeighbor(many), { maxItems: 3 });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.archetype)).toEqual(["base-pale", "crystal-medium", "roasted-barley"]);
  });

  test("drops items under minPct but never truncates to zero", () => {
    const { items } = pickGristBill(oneNeighbor({ "base-pale": 97, "smoked-malt": 1 }), { minPct: 2 });
    expect(items).toHaveLength(1);
    expect(items[0].archetype).toBe("base-pale");
    expect(items[0].pct).toBeCloseTo(100, 6);
  });

  test("a single tiny role is kept alone rather than emptied out", () => {
    const { items } = pickGristBill(oneNeighbor({ "smoked-malt": 3 }), { minPct: 50 });
    expect(items).toHaveLength(1);
    expect(items[0].archetype).toBe("smoked-malt");
    expect(items[0].pct).toBeCloseTo(100, 6);
  });
});

describe("pickGristBill — role-first reconstruction avoids vote-splitting", () => {
  test("a role split across near-equivalent archetypes doesn't vanish (the original bug)", () => {
    // 4 neighbours all use SOME base malt (different specific ones) plus the
    // same 30% flaked oats. A flat blend ranks flaked-oats (30, everyone
    // agrees) above every INDIVIDUAL base malt (17.5 each) — that's the bug:
    // "some base malt" was in 100% of the neighbourhood yet lost the flat
    // vote to a single, consistently-named adjunct. Role rollup must catch it.
    const neighbors = [
      { rec: rec({ g: { "base-pale": 70, "flaked-oats": 30 } }), weight: 0.25 },
      { rec: rec({ g: { pilsner: 70, "flaked-oats": 30 } }), weight: 0.25 },
      { rec: rec({ g: { "maris-otter": 70, "flaked-oats": 30 } }), weight: 0.25 },
      { rec: rec({ g: { "wheat-malt": 70, "flaked-oats": 30 } }), weight: 0.25 },
    ];
    const { items } = pickGristBill(neighbors);
    const BASE = new Set(["base-pale", "pilsner", "maris-otter", "wheat-malt"]);
    const base = items.find((i) => BASE.has(i.archetype));
    const flaked = items.find((i) => i.archetype === "flaked-oats");
    expect(base).toBeDefined();
    expect(base!.pct).toBeCloseTo(70, 6); // full role total survives, not split into quarters
    expect(base!.pct).toBeGreaterThan(flaked!.pct);
  });

  test("picks the role representative by how many neighbours reach for it, not by average volume contributed", () => {
    // 3 neighbours make pilsner a small (20%) part of their grist; 1 neighbour
    // makes base-pale a huge (90%) part of its own. By blended magnitude,
    // base-pale (0.4*90=36) would beat pilsner (0.2*20*3=12) — but 3 separate
    // brewers reaching for pilsner is more "commonly represented" than 1
    // reaching for base-pale, so the weighted vote (0.6 vs 0.4) should win instead.
    const neighbors = [
      { rec: rec({ g: { pilsner: 20, "crystal-light": 80 } }), weight: 0.2 },
      { rec: rec({ g: { pilsner: 20, "crystal-light": 80 } }), weight: 0.2 },
      { rec: rec({ g: { pilsner: 20, "crystal-light": 80 } }), weight: 0.2 },
      { rec: rec({ g: { "base-pale": 90, "crystal-light": 10 } }), weight: 0.4 },
    ];
    const { items } = pickGristBill(neighbors);
    const baseRoleItem = items.find((i) => i.archetype === "pilsner" || i.archetype === "base-pale");
    expect(baseRoleItem?.archetype).toBe("pilsner");
  });
});

describe("pickGristBill — genuine two-malt roles survive (but naming variance still collapses)", () => {
  test("a role every neighbour genuinely blends (pils+wheat) keeps both malts, split by share", () => {
    // Every neighbour is 55% wheat + 45% pilsner — both base malts, co-used in
    // the same recipe. A single-max vote would drop pilsner (wheat is always
    // the max); the co-use vote must keep both, roughly 55/45.
    const neighbors = [
      { rec: rec({ g: { "wheat-malt": 55, pilsner: 45 } }), weight: 0.34 },
      { rec: rec({ g: { "wheat-malt": 55, pilsner: 45 } }), weight: 0.33 },
      { rec: rec({ g: { "wheat-malt": 55, pilsner: 45 } }), weight: 0.33 },
    ];
    const { items } = pickGristBill(neighbors);
    const names = items.map((i) => i.archetype).sort();
    expect(names).toEqual(["pilsner", "wheat-malt"]);
    const wheat = items.find((i) => i.archetype === "wheat-malt")!;
    const pils = items.find((i) => i.archetype === "pilsner")!;
    expect(wheat.pct).toBeGreaterThan(pils.pct);
    expect(wheat.pct).toBeCloseTo(55, 0);
  });

  test("the same base role, but each neighbour uses a DIFFERENT single base, still collapses to one (no false split)", () => {
    // This is the naming-variance case — nobody actually blends two bases, the
    // neighbours just disagree on which one. Co-use count is 1 per neighbour, so
    // the role must stay a single representative at the full role total.
    const neighbors = [
      { rec: rec({ g: { "base-pale": 100 } }), weight: 0.25 },
      { rec: rec({ g: { pilsner: 100 } }), weight: 0.25 },
      { rec: rec({ g: { "maris-otter": 100 } }), weight: 0.25 },
      { rec: rec({ g: { "wheat-malt": 100 } }), weight: 0.25 },
    ];
    const { items } = pickGristBill(neighbors);
    expect(items).toHaveLength(1);
    expect(items[0].pct).toBeCloseTo(100, 6);
  });
});

describe("pickGristBill — brewability floor", () => {
  const DIASTATIC = ["base-pale", "pilsner", "maris-otter", "vienna", "munich-light", "munich-dark", "wheat-malt", "rye-malt", "smoked-malt"];
  const diastaticPct = (items: Array<{ archetype: string; pct: number }>) =>
    items.filter((i) => DIASTATIC.includes(i.archetype)).reduce((s, i) => s + i.pct, 0);

  test("repairs the real un-mashable high-body-hazy grist (95% oats+carapils, ~3% base)", () => {
    // the exact bill the engine produced from a hard body push — physically
    // won't convert. It must come back with enough diastatic base to mash.
    const neighbors = [{ rec: rec({ g: { "flaked-oats": 58.9, dextrine: 36.4, "wheat-malt": 2.7, lactose: 2 } }), weight: 1 }];
    const { items, notes } = pickGristBill(neighbors);
    expect(diastaticPct(items)).toBeGreaterThanOrEqual(54.9);
    expect(items.find((i) => i.archetype === "dextrine")?.pct ?? 0).toBeLessThanOrEqual(10.5);
    expect(items.find((i) => i.archetype === "flaked-oats")?.pct ?? 0).toBeLessThanOrEqual(40.5);
    const totalPct = items.reduce((s, i) => s + i.pct, 0);
    expect(totalPct).toBeCloseTo(100, 4);
    expect(notes.some((n) => /convert|mash|base/i.test(n))).toBe(true);
  });

  test("injects a clean base when the neighbourhood chose none at all", () => {
    const { items, notes } = pickGristBill([{ rec: rec({ g: { "flaked-oats": 100 } }), weight: 1 }]);
    expect(items.some((i) => i.archetype === "base-pale")).toBe(true);
    expect(diastaticPct(items)).toBeGreaterThanOrEqual(54.9);
    expect(notes.some((n) => /convert|mash|base/i.test(n))).toBe(true);
  });

  test("leaves a normal base-heavy bill untouched", () => {
    const { items, notes } = pickGristBill(oneNeighbor({ "base-pale": 80, "crystal-medium": 20 }));
    expect(items.find((i) => i.archetype === "base-pale")!.pct).toBeCloseTo(80, 6);
    expect(items.find((i) => i.archetype === "crystal-medium")!.pct).toBeCloseTo(20, 6);
    expect(notes.some((n) => /convert|mash/i.test(n))).toBe(false);
  });

  test("enforceGristBrewability is a no-op on an already-brewable bill", () => {
    const brewable = pickGristBill(oneNeighbor({ pilsner: 90, "crystal-light": 10 })).items;
    const { items, notes } = enforceGristBrewability(brewable);
    expect(items.map((i) => [i.archetype, Math.round(i.pct)])).toEqual(brewable.map((i) => [i.archetype, Math.round(i.pct)]));
    expect(notes).toHaveLength(0);
  });
});

describe("pickGristBill — exploration (seeded variety)", () => {
  // crystal-light is the popular crystal (3 neighbours) vs crystal-medium (2).
  const neighbors = [
    { rec: rec({ g: { "base-pale": 80, "crystal-light": 20 } }), weight: 0.2 },
    { rec: rec({ g: { "base-pale": 80, "crystal-light": 20 } }), weight: 0.2 },
    { rec: rec({ g: { "base-pale": 80, "crystal-light": 20 } }), weight: 0.2 },
    { rec: rec({ g: { "base-pale": 80, "crystal-medium": 20 } }), weight: 0.2 },
    { rec: rec({ g: { "base-pale": 80, "crystal-medium": 20 } }), weight: 0.2 },
  ];
  const crystalOf = (r: ReturnType<typeof pickGristBill>) => r.items.find((i) => i.archetype.startsWith("crystal"))?.archetype;

  test("exploration=0 is the deterministic popular pick, whatever the seed", () => {
    for (let s = 0; s < 6; s++) {
      expect(crystalOf(pickGristBill(neighbors, { exploration: 0, seed: s }))).toBe("crystal-light");
    }
  });

  test("high exploration reaches the less-popular crystal on some rerolls, but never invents one", () => {
    const seen = new Set<string | undefined>();
    for (let s = 0; s < 20; s++) seen.add(crystalOf(pickGristBill(neighbors, { exploration: 0.9, seed: s })));
    expect(seen.size).toBeGreaterThan(1);
    for (const c of seen) expect(["crystal-light", "crystal-medium"]).toContain(c); // only archetypes the neighbourhood used
  });

  test("a given (exploration, seed) is reproducible", () => {
    const a = crystalOf(pickGristBill(neighbors, { exploration: 0.9, seed: 3 }));
    const b = crystalOf(pickGristBill(neighbors, { exploration: 0.9, seed: 3 }));
    expect(a).toBe(b);
  });
});

describe("reconstructHopSchedule — exploration (seeded variety)", () => {
  const neighbors = [
    { rec: rec({ hp: [["citra", 1.0, "boil", 5]] }), weight: 0.2 },
    { rec: rec({ hp: [["citra", 1.0, "boil", 5]] }), weight: 0.2 },
    { rec: rec({ hp: [["citra", 1.0, "boil", 5]] }), weight: 0.2 },
    { rec: rec({ hp: [["cascade", 1.0, "boil", 5]] }), weight: 0.2 },
    { rec: rec({ hp: [["cascade", 1.0, "boil", 5]] }), weight: 0.2 },
  ];
  const varietyOf = (opts: Parameters<typeof reconstructHopSchedule>[1]) =>
    reconstructHopSchedule(neighbors, { maxVarietiesPerBucket: 1, maxTotalAdditions: 10, ...opts }).templates[0]?.name;

  test("exploration=0 is the deterministic popular hop", () => {
    for (let s = 0; s < 6; s++) expect(varietyOf({ exploration: 0, seed: s })).toBe("citra");
  });

  test("high exploration surfaces the less-popular hop on some rerolls, only from the menu", () => {
    const seen = new Set<string | undefined>();
    for (let s = 0; s < 20; s++) seen.add(varietyOf({ exploration: 0.9, seed: s }));
    expect(seen.size).toBeGreaterThan(1);
    for (const v of seen) expect(["citra", "cascade"]).toContain(v);
  });

  test("a wider identityNeighbors pool can add a variety the tight set never used", () => {
    // tight set is all citra; the wider menu also knows mosaic.
    const tight = [{ rec: rec({ hp: [["citra", 1.0, "boil", 5]] }), weight: 1 }];
    const wide = [
      { rec: rec({ hp: [["citra", 1.0, "boil", 5]] }), weight: 0.5 },
      { rec: rec({ hp: [["mosaic", 1.0, "boil", 5]] }), weight: 0.5 },
    ];
    const seen = new Set<string | undefined>();
    for (let s = 0; s < 20; s++) {
      seen.add(reconstructHopSchedule(tight, { identityNeighbors: wide, maxVarietiesPerBucket: 1, maxTotalAdditions: 10, exploration: 0.9, seed: s }).templates[0]?.name);
    }
    expect(seen.has("mosaic")).toBe(true);
  });
});

describe("buildFermentablesFromGristBill", () => {
  test("builds Fermentable[] with real preset data and a matching percentById", () => {
    const { items } = pickGristBill(oneNeighbor({ "base-pale": 90, "crystal-medium": 10 }));
    const { fermentables, percentById } = buildFermentablesFromGristBill(items);
    expect(fermentables).toHaveLength(2);
    for (const f of fermentables) {
      expect(f.weightKg).toBe(0); // placeholder — filled by the ABV solver
      expect(percentById[f.id]).toBeGreaterThan(0);
    }
    const totalPct = Object.values(percentById).reduce((a, b) => a + b, 0);
    expect(totalPct).toBeCloseTo(100, 6);
  });
});

describe("blendGristPct", () => {
  test("weighted-averages each neighbour's archetype% map, missing keys treated as 0", () => {
    const neighbors = [
      { rec: rec({ g: { "base-pale": 90, "crystal-medium": 10 } }), weight: 0.5 },
      { rec: rec({ g: { "base-pale": 100 } }), weight: 0.5 },
    ];
    const blended = blendGristPct(neighbors);
    expect(blended["base-pale"]).toBeCloseTo(95, 6);
    expect(blended["crystal-medium"]).toBeCloseTo(5, 6);
  });
});

// ── hops ─────────────────────────────────────────────────────────────────────

describe("bucketForAddition", () => {
  test("boil additions split into bittering/flavor/aroma by time", () => {
    expect(bucketForAddition("boil", 60)).toBe("bittering");
    expect(bucketForAddition("boil", 40)).toBe("bittering"); // boundary, inclusive
    expect(bucketForAddition("boil", 39)).toBe("flavor");
    expect(bucketForAddition("boil", 10)).toBe("flavor"); // boundary, inclusive
    expect(bucketForAddition("boil", 9)).toBe("aroma");
    expect(bucketForAddition("boil", 0)).toBe("aroma");
  });

  test("non-boil types map 1:1 to their own bucket", () => {
    expect(bucketForAddition("whirlpool", 15)).toBe("whirlpool");
    expect(bucketForAddition("dry hop", 4320)).toBe("dry-hop");
    expect(bucketForAddition("first wort", 0)).toBe("first-wort");
    expect(bucketForAddition("mash", 5)).toBe("mash");
  });

  test("unrecognised type returns null", () => {
    expect(bucketForAddition("steep", 5)).toBeNull();
  });
});

describe("normalizeHopName", () => {
  test("strips inline AA%/form annotations that corpus free text carries", () => {
    expect(normalizeHopName("Cascade (7% AA)")).toBe("cascade");
    expect(normalizeHopName("cascade (7 aa)")).toBe("cascade");
    expect(normalizeHopName("Citra (T-90 Pellet)")).toBe("citra");
  });

  test("leaves a clean name untouched apart from casing", () => {
    expect(normalizeHopName("Galaxy")).toBe("galaxy");
  });
});

describe("reconstructHopSchedule — hop name normalization", () => {
  test("merges corpus name-variants of the same hop into one line with the real preset's alpha acid", () => {
    // "cascade (7 aa)" is exactly the kind of free-text noise real corpus
    // entries carry — without normalization this fragments into a second
    // "variety" and misses the HOP_PRESETS lookup, falling back to a generic
    // 10% AA instead of Cascade's real alpha acid.
    const neighbors = [
      { rec: rec({ hp: [["cascade (7 aa)", 1.0, "boil", 60]] }), weight: 0.5 },
      { rec: rec({ hp: [["Cascade", 1.0, "boil", 60]] }), weight: 0.5 },
    ];
    const { templates } = reconstructHopSchedule(neighbors);
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("cascade");
    const hops = materializeHopSchedule(templates, 20);
    expect(hops[0].name).toBe("Cascade"); // real preset casing
    expect(hops[0].alphaAcid).not.toBe(10); // real AA%, not the unmatched-name fallback
  });
});

describe("reconstructHopSchedule", () => {
  test("only includes a bucket when enough of the neighbourhood uses it", () => {
    const neighbors = [
      { rec: rec({ hp: [["cascade", 1.0, "boil", 60]] }), weight: 0.9 },
      { rec: rec({ hp: [["cascade", 1.0, "boil", 60], ["citra", 0.5, "dry hop", 4320]] }), weight: 0.1 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25 });
    expect(templates.some((t) => t.type === "boil")).toBe(true);
    expect(templates.some((t) => t.type === "dry hop")).toBe(false); // only 10% presence, below threshold
  });

  test("keeps a genuine 2-hop blend when both varieties carry a real share", () => {
    const neighbors = [
      { rec: rec({ hp: [["citra", 2.0, "dry hop", 4320]] }), weight: 0.6 },
      { rec: rec({ hp: [["mosaic", 2.0, "dry hop", 4320]] }), weight: 0.4 },
    ];
    // maxTotalAdditions disables the (separately-tested) average-count cap —
    // this test is specifically about the per-bucket share logic.
    const { templates } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25, maxVarietiesPerBucket: 2, maxTotalAdditions: 10 });
    const names = templates.map((t) => t.name).sort();
    expect(names).toEqual(["citra", "mosaic"]);
    const citra = templates.find((t) => t.name === "citra")!;
    const mosaic = templates.find((t) => t.name === "mosaic")!;
    expect(citra.gpl).toBeGreaterThan(mosaic.gpl);
    expect(citra.gpl + mosaic.gpl).toBeCloseTo(2.0, 6);
  });

  test("collapses a minority variety below minVarietyShare into just the dominant one", () => {
    // mosaic is only 20% of this bucket's usage — a corpus outlier, not a real
    // blend — so it shouldn't earn its own line; its share folds into citra.
    const neighbors = [
      { rec: rec({ hp: [["citra", 2.0, "dry hop", 4320]] }), weight: 0.5 },
      { rec: rec({ hp: [["citra", 2.0, "dry hop", 4320]] }), weight: 0.3 },
      { rec: rec({ hp: [["mosaic", 2.0, "dry hop", 4320]] }), weight: 0.2 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25, maxVarietiesPerBucket: 2, minVarietyShare: 0.3 });
    expect(templates.map((t) => t.name)).toEqual(["citra"]);
    // the dropped mosaic share folds back in — the bucket's total gpl is preserved
    expect(templates[0].gpl).toBeCloseTo(2.0, 6);
  });

  test("caps at maxVarietiesPerBucket even with more distinct names present", () => {
    const neighbors = [
      { rec: rec({ hp: [["citra", 1, "whirlpool", 15], ["mosaic", 1, "whirlpool", 15], ["galaxy", 1, "whirlpool", 15]] }), weight: 1 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { maxVarietiesPerBucket: 2 });
    expect(templates).toHaveLength(2);
  });

  test("empty neighbourhood produces no templates and a note", () => {
    const { templates, notes } = reconstructHopSchedule([]);
    expect(templates).toEqual([]);
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe("reconstructHopSchedule — total-additions cap", () => {
  test("trims to the neighbourhood's own average addition count, keeping the most typical buckets first", () => {
    // every neighbour uses exactly 2 additions (a boil + a dry hop) even
    // though 3 buckets each individually clear the presence threshold —
    // whirlpool is only ever used by the minority (0.3 of the weight).
    const neighbors = [
      { rec: rec({ hp: [["magnum", 1, "boil", 60], ["citra", 2, "dry hop", 4320]] }), weight: 0.7 },
      { rec: rec({ hp: [["magnum", 1, "boil", 60], ["citra", 1, "whirlpool", 15], ["citra", 2, "dry hop", 4320]] }), weight: 0.3 },
    ];
    const { templates, notes } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25 });
    // avg additions = 0.7*2 + 0.3*3 = 2.3 -> rounds to 2
    expect(templates).toHaveLength(2);
    expect(templates.some((t) => t.type === "whirlpool")).toBe(false); // least typical, dropped first
    expect(templates.some((t) => t.type === "boil")).toBe(true);
    expect(templates.some((t) => t.type === "dry hop")).toBe(true);
    expect(notes.some((n) => n.includes("averages"))).toBe(true);
  });

  test("an explicit maxTotalAdditions overrides the computed average", () => {
    const neighbors = [
      { rec: rec({ hp: [["magnum", 1, "boil", 60], ["citra", 2, "dry hop", 4320], ["mosaic", 1, "whirlpool", 15]] }), weight: 1 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25, maxTotalAdditions: 1 });
    expect(templates).toHaveLength(1);
  });
});

describe("reconstructHopSchedule — timing snap", () => {
  test("snaps a boil bucket's weighted-average time to the nearest checkpoint", () => {
    // raw weighted average lands on 3min — an honest average, but not a
    // number anyone actually sets a timer for.
    const neighbors = [
      { rec: rec({ hp: [["citra", 1, "boil", 0]] }), weight: 0.5 },
      { rec: rec({ hp: [["citra", 1, "boil", 5]] }), weight: 0.5 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { maxTotalAdditions: 10 });
    expect(templates[0].timeMinutes).toBe(0); // nearest of [0,10,15,30,45,60] to 2.5
  });

  test("snaps a whirlpool bucket to its own (shorter) checkpoint set", () => {
    const neighbors = [{ rec: rec({ hp: [["citra", 1, "whirlpool", 17]] }), weight: 1 }];
    const { templates } = reconstructHopSchedule(neighbors, { maxTotalAdditions: 10 });
    expect(templates[0].timeMinutes).toBe(15); // nearest of [0,5,10,15,20,30] to 17
  });
});

describe("reconstructHopSchedule — presence-normalised dosing", () => {
  test("doses a partially-present bucket as its actual users dose it, not diluted by presence", () => {
    // The dry hop is used by only half the neighbourhood (presence 0.5), at
    // 4 g/L. Summed over the whole weight-1 neighbourhood that's 0.5*4 = 2 g/L
    // — the old, diluted dose. Normalised by presence it's the 4 g/L its actual
    // users pour. The bittering charge is universal (presence 1) so it's
    // unchanged, proving the normalisation only touches partial buckets.
    const neighbors = [
      { rec: rec({ hp: [["magnum", 1, "boil", 60], ["citra", 4, "dry hop", 4320]] }), weight: 0.5 },
      { rec: rec({ hp: [["magnum", 1, "boil", 60]] }), weight: 0.5 },
    ];
    const { templates } = reconstructHopSchedule(neighbors, { presenceThreshold: 0.25, maxTotalAdditions: 10 });
    const dry = templates.find((t) => t.type === "dry hop")!;
    const bittering = templates.find((t) => t.type === "boil")!;
    expect(dry.gpl).toBeCloseTo(4, 6);
    expect(bittering.gpl).toBeCloseTo(1, 6);
  });
});

describe("reconstructHopSchedule — bittering ranked by IBU potential", () => {
  // Saaz (4.2% AA) is poured in more grams for bittering than Magnum (13.5% AA),
  // so by raw dose Saaz "wins" the bittering slot — but a 60-min Saaz charge
  // barely bitters, which is exactly how the bill came out badly under-bittered.
  // The bittering slot should go to the hop that actually delivers the
  // bitterness (g/L × alpha), i.e. Magnum.
  const bittering = [
    { rec: rec({ hp: [["saaz", 1.5, "boil", 60]] }), weight: 0.6 },
    { rec: rec({ hp: [["magnum", 1.0, "boil", 60]] }), weight: 0.4 },
  ];

  test("bitters with the higher-alpha hop even when a low-alpha hop is poured in more grams", () => {
    const { templates } = reconstructHopSchedule(bittering, { maxVarietiesPerBucket: 1, maxTotalAdditions: 10 });
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("magnum");
  });

  test("the SAME contest in an aroma bucket still ranks by dose (only bittering weights by alpha)", () => {
    // identical shares, but now at a 5-min (aroma) timing — aroma is about
    // flavour/quantity, not bitterness, so the more-poured Saaz wins here.
    const aroma = [
      { rec: rec({ hp: [["saaz", 1.5, "boil", 5]] }), weight: 0.6 },
      { rec: rec({ hp: [["magnum", 1.0, "boil", 5]] }), weight: 0.4 },
    ];
    const { templates } = reconstructHopSchedule(aroma, { maxVarietiesPerBucket: 1, maxTotalAdditions: 10 });
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("saaz");
  });
});

describe("materializeHopSchedule", () => {
  test("converts gpl to grams at the given batch volume and looks up real alpha acid", () => {
    const hops = materializeHopSchedule([{ name: "cascade", type: "boil", gpl: 0.5, timeMinutes: 60 }], 20);
    expect(hops[0].grams).toBeCloseTo(10, 6);
    expect(hops[0].alphaAcid).toBeGreaterThan(0); // real Cascade AA%, not the fallback
    expect(hops[0].alphaAcid).not.toBe(10); // (10 is the fallback default; Cascade's real AA differs)
  });

  test("falls back to a default alpha acid for an unrecognised hop name", () => {
    const hops = materializeHopSchedule([{ name: "totally-made-up-hop", type: "boil", gpl: 0.5, timeMinutes: 60 }], 20);
    expect(hops[0].alphaAcid).toBe(10);
  });

  test("dry hop gets dryHopDays, whirlpool gets whirlpoolTimeMinutes", () => {
    const hops = materializeHopSchedule([
      { name: "citra", type: "dry hop", gpl: 1, timeMinutes: 4320 },
      { name: "citra", type: "whirlpool", gpl: 1, timeMinutes: 15 },
    ], 20);
    expect(hops[0].dryHopDays).toBe(3);
    expect(hops[1].whirlpoolTimeMinutes).toBe(15);
  });
});

describe("scaleHops", () => {
  test("scales grams only, leaving everything else untouched", () => {
    const hops = materializeHopSchedule([{ name: "cascade", type: "boil", gpl: 0.5, timeMinutes: 60 }], 20);
    const scaled = scaleHops(hops, 2);
    expect(scaled[0].grams).toBeCloseTo(hops[0].grams * 2, 6);
    expect(scaled[0].alphaAcid).toBe(hops[0].alphaAcid);
    expect(scaled[0].timeMinutes).toBe(hops[0].timeMinutes);
  });
});

// ── yeast ────────────────────────────────────────────────────────────────────

describe("pickModalYeastName", () => {
  test("picks the highest-weighted vote", () => {
    const neighbors = [
      { rec: rec({ yn: "SafAle US-05" }), weight: 0.3 },
      { rec: rec({ yn: "1056 American Ale" }), weight: 0.2 },
      { rec: rec({ yn: "SafAle US-05" }), weight: 0.3 },
    ];
    expect(pickModalYeastName(neighbors)).toBe("SafAle US-05");
  });

  test("ignores neighbours with no yeast info", () => {
    const neighbors = [
      { rec: rec({ yn: null }), weight: 0.9 },
      { rec: rec({ yn: "SafAle US-05" }), weight: 0.1 },
    ];
    expect(pickModalYeastName(neighbors)).toBe("SafAle US-05");
  });

  test("empty neighbourhood returns null", () => {
    expect(pickModalYeastName([])).toBeNull();
  });

  test("an allow predicate filters candidates out of the vote entirely", () => {
    // US-05 is the popular vote but it's an ale — for a lager style it must not
    // win, even though it's the modal choice. The lager yeast wins instead.
    const neighbors = [
      { rec: rec({ yn: "SafAle US-05" }), weight: 0.6 },
      { rec: rec({ yn: "SafLager W-34/70" }), weight: 0.4 },
    ];
    const lagerOnly = (name: string) => yeastTypeOf(name) === "lager";
    expect(pickModalYeastName(neighbors, { allow: lagerOnly })).toBe("SafLager W-34/70");
    // …and with no filter the popular ale still wins, unchanged.
    expect(pickModalYeastName(neighbors)).toBe("SafAle US-05");
  });

  test("returns null when nothing survives the allow filter (caller applies its own fallback)", () => {
    const neighbors = [{ rec: rec({ yn: "SafAle US-05" }), weight: 1 }];
    expect(pickModalYeastName(neighbors, { allow: (n) => yeastTypeOf(n) === "lager" })).toBeNull();
  });
});

describe("yeastTypeOf", () => {
  test("returns the strain type for known presets and undefined otherwise", () => {
    expect(yeastTypeOf("SafAle US-05")).toBe("ale");
    expect(yeastTypeOf("Not A Real Yeast")).toBeUndefined();
  });
});

describe("buildYeastFromPresetName", () => {
  test("builds a real Yeast object from a known preset", () => {
    const yeast = buildYeastFromPresetName("SafAle US-05");
    expect(yeast).not.toBeNull();
    expect(yeast!.attenuation).toBeGreaterThan(0.5);
    expect(yeast!.attenuation).toBeLessThan(1);
    expect(yeast!.laboratory).toBe("Fermentis");
  });

  test("unknown preset name returns null", () => {
    expect(buildYeastFromPresetName("Not A Real Yeast")).toBeNull();
  });
});

// ── residual correction (#3) ──────────────────────────────────────────────────

describe("correctMaltGristToward", () => {
  const item = (archetype: string, pct: number) => ({ archetype, pct, preset: presetForArchetype(archetype)! });
  const caramelOf = (items: Array<{ archetype: string; pct: number }>) =>
    aggregateMaltFlavor(items.map((i) => ({ archetype: i.archetype, amount: i.pct }))).caramel;

  test("uses more of a sanctioned caramel malt to raise the caramel axis", () => {
    const start = [item("base-pale", 100)];
    const sanctioned = new Set(["base-pale", "crystal-medium"]);
    const before = caramelOf(start);
    const { items } = correctMaltGristToward(start, sanctioned, { caramel: 3 });
    expect(caramelOf(items)).toBeGreaterThan(before);
    expect(items.some((i) => i.archetype === "crystal-medium")).toBe(true);
  });

  test("never invents a grain the neighbourhood didn't use", () => {
    // Special B is the strongest caramel/dark-fruit donor, but it's not sanctioned
    // here — the correction must reach only for crystal-light, which IS.
    const start = [item("base-pale", 100)];
    const { items } = correctMaltGristToward(start, new Set(["base-pale", "crystal-light"]), { caramel: 3 });
    expect(items.some((i) => i.archetype === "crystal-light")).toBe(true);
    expect(items.some((i) => i.archetype === "special-b")).toBe(false);
  });

  test("keeps the diastatic base floor (stays brewable)", () => {
    const start = [item("base-pale", 100)];
    const { items } = correctMaltGristToward(start, new Set(["base-pale", "crystal-dark"]), { caramel: 5 });
    const total = items.reduce((s, i) => s + i.pct, 0);
    const base = items.filter((i) => i.archetype === "base-pale").reduce((s, i) => s + i.pct, 0);
    expect(base / total).toBeGreaterThanOrEqual(0.55 - 1e-6);
  });

  test("caps the corrective donor's share (no cloying 45% crystal bill)", () => {
    const start = [item("base-pale", 100)];
    const { items } = correctMaltGristToward(start, new Set(["base-pale", "crystal-dark"]), { caramel: 5 }, { maxDonorShare: 0.2 });
    const total = items.reduce((s, i) => s + i.pct, 0);
    const crystal = items.filter((i) => i.archetype === "crystal-dark").reduce((s, i) => s + i.pct, 0);
    expect(crystal / total).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  test("no-op when no axis is pushed or the deficit is already met", () => {
    const start = [item("base-pale", 80), item("crystal-medium", 20)];
    expect(correctMaltGristToward(start, new Set(["base-pale", "crystal-medium"]), {}).items).toEqual(start);
    // caramel already well above a tiny target -> nothing to do
    const met = correctMaltGristToward(start, new Set(["base-pale", "crystal-medium"]), { caramel: 0.01 });
    expect(met.items).toEqual(start);
  });

  test("stops when the malt aggregator saturates (donor no longer helps)", () => {
    // Sanity: the loop terminates and the donor never exceeds its cap even for an
    // unreachable target, because each pass must strictly improve the axis.
    const start = [item("base-pale", 100)];
    const arch = MALT_ARCHETYPES_BY_SLUG.get("crystal-dark")!;
    expect(arch.flavor.caramel).toBeGreaterThan(0); // guards the fixture
    const { items } = correctMaltGristToward(start, new Set(["base-pale", "crystal-dark"]), { caramel: 99 });
    const total = items.reduce((s, i) => s + i.pct, 0);
    const crystal = items.filter((i) => i.archetype === "crystal-dark").reduce((s, i) => s + i.pct, 0);
    expect(crystal / total).toBeLessThanOrEqual(0.3 + 1e-6);
  });
});

// ── hop residual correction (#3 for hops) ─────────────────────────────────────

describe("correctHopScheduleToward", () => {
  // A tiny stand-in flavour model: each variety drives ONE axis, and the
  // schedule's achieved value on an axis is a saturating function of the total
  // dry-hop g/L of varieties that drive it — enough to exercise the greedy loop.
  const VARIETY_AXIS: Record<string, keyof import("../../recipe/models/Presets").HopFlavorProfile> = {
    galaxy: "berry", cascade: "citrus", mosaic: "berry",
  };
  const flavorOf = (name: string) => {
    const axis = VARIETY_AXIS[name];
    if (!axis) return undefined;
    const p = { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0, floral: 0, spice: 0, herbal: 0, grassy: 0, resinPine: 0 };
    p[axis] = 5;
    return p;
  };
  const evaluate = (tpls: Array<{ name: string; type: string; gpl: number }>) => {
    const p = { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0, floral: 0, spice: 0, herbal: 0, grassy: 0, resinPine: 0 };
    for (const t of tpls) {
      const axis = VARIETY_AXIS[t.name];
      if (axis && t.type === "dry hop") p[axis] += t.gpl; // linear-ish; capped below by donor limits
    }
    return p;
  };

  test("adds a dry-hop of the strongest-on-axis sanctioned variety to raise the axis", () => {
    const start = [{ name: "cascade", type: "boil" as const, gpl: 2, timeMinutes: 60 }];
    const { templates, notes } = correctHopScheduleToward(start, ["galaxy", "cascade"], flavorOf, { berry: 4 }, evaluate);
    const galaxy = templates.find((t) => t.name === "galaxy");
    expect(galaxy).toBeDefined();
    expect(galaxy!.type).toBe("dry hop");
    expect(evaluate(templates).berry).toBeGreaterThan(evaluate(start).berry);
    expect(notes.length).toBeGreaterThan(0);
  });

  test("never invents a hop the neighbourhood didn't use", () => {
    // mosaic drives berry too, but only cascade is sanctioned here -> no berry donor available.
    const start = [{ name: "cascade", type: "boil" as const, gpl: 2, timeMinutes: 60 }];
    const { templates } = correctHopScheduleToward(start, ["cascade"], flavorOf, { berry: 4 }, evaluate);
    expect(templates.some((t) => t.name === "mosaic" || t.name === "galaxy")).toBe(false);
  });

  test("respects the per-donor dose cap", () => {
    const start: Array<{ name: string; type: "boil"; gpl: number; timeMinutes: number }> = [];
    const { templates } = correctHopScheduleToward(start, ["galaxy"], flavorOf, { berry: 99 }, evaluate, { donorMaxGpl: 4 });
    const galaxy = templates.find((t) => t.name === "galaxy");
    expect(galaxy!.gpl).toBeLessThanOrEqual(4 + 1e-9);
  });

  test("respects the total-added cap across varieties", () => {
    const { templates } = correctHopScheduleToward([], ["galaxy", "mosaic"], flavorOf, { berry: 99 }, evaluate, { addedMaxGpl: 3, donorMaxGpl: 10 });
    const added = templates.filter((t) => t.type === "dry hop").reduce((s, t) => s + t.gpl, 0);
    expect(added).toBeLessThanOrEqual(3 + 1e-9);
  });

  test("no-op when no hop axis is pushed", () => {
    const start = [{ name: "cascade", type: "boil" as const, gpl: 2, timeMinutes: 60 }];
    expect(correctHopScheduleToward(start, ["galaxy"], flavorOf, {}, evaluate).templates).toEqual(start);
  });
});

// ── collateral-aware donor selection (avoidCollateral toggle) ──────────────────

describe("residual correction — avoidCollateral", () => {
  const item = (archetype: string, pct: number) => ({ archetype, pct, preset: presetForArchetype(archetype)! });

  test("MALT: picks the purest caramel donor when dark fruit was pulled down", () => {
    // crystal-dark drives caramel hardest but also carries dark fruit; crystal-
    // medium is nearly as caramel-forward with far less dark fruit. Pushing
    // caramel UP + dark fruit DOWN should switch the pick only when the toggle is on.
    const start = [item("base-pale", 100)];
    const sanctioned = new Set(["base-pale", "crystal-medium", "crystal-dark"]);
    const target = { caramel: 5, darkFruit: 0 };
    const off = correctMaltGristToward(start, sanctioned, target, { avoidCollateral: false });
    const on = correctMaltGristToward(start, sanctioned, target, { avoidCollateral: true });
    expect(off.items.some((i) => i.archetype === "crystal-dark")).toBe(true);
    expect(on.items.some((i) => i.archetype === "crystal-medium")).toBe(true);
    expect(on.items.some((i) => i.archetype === "crystal-dark")).toBe(false);
  });

  test("HOP: picks the purer berry donor when stone fruit was pulled down", () => {
    const VEC: Record<string, import("../../recipe/models/Presets").HopFlavorProfile> = {
      galaxy: { citrus: 0, tropicalFruit: 0, stoneFruit: 4, berry: 5, floral: 0, spice: 0, herbal: 0, grassy: 0, resinPine: 0 },
      nelson: { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 4, floral: 0, spice: 0, herbal: 0, grassy: 0, resinPine: 0 },
    };
    const flavorOf = (name: string) => VEC[name];
    const evaluate = (tpls: Array<{ name: string; type: string; gpl: number }>) => {
      const p = { citrus: 0, tropicalFruit: 0, stoneFruit: 0, berry: 0, floral: 0, spice: 0, herbal: 0, grassy: 0, resinPine: 0 };
      for (const t of tpls) {
        const v = VEC[t.name];
        if (v && t.type === "dry hop") for (const k of Object.keys(p) as Array<keyof typeof p>) p[k] += (v[k] / 5) * t.gpl * 0.3;
      }
      return p;
    };
    const target = { berry: 5, stoneFruit: 0 }; // berry up, stone fruit down
    const off = correctHopScheduleToward([], ["galaxy", "nelson"], flavorOf, target, evaluate, { avoidCollateral: false });
    const on = correctHopScheduleToward([], ["galaxy", "nelson"], flavorOf, target, evaluate, { avoidCollateral: true });
    // off = strongest berry outright (galaxy, which also carries stone fruit)
    expect(off.templates.some((t) => t.name === "galaxy")).toBe(true);
    // on = the purer berry donor (nelson), avoiding the stone-fruit collateral
    expect(on.templates.some((t) => t.name === "nelson")).toBe(true);
    expect(on.templates.some((t) => t.name === "galaxy")).toBe(false);
  });

  test("default (toggle off) is unchanged from before", () => {
    // With avoidCollateral unset, malt correction still reaches for the hardest
    // caramel driver (crystal-dark) exactly as the earlier tests expect.
    const start = [item("base-pale", 100)];
    const res = correctMaltGristToward(start, new Set(["base-pale", "crystal-medium", "crystal-dark"]), { caramel: 5 });
    expect(res.items.some((i) => i.archetype === "crystal-dark")).toBe(true);
  });
});
