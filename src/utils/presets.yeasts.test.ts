import { describe, it, expect } from "vitest";
import { YEAST_PRESETS } from "./presets";

// Guards the generated yeast database (src/utils/presets.generated.yeasts.json).
// Currently holds name/category/attenuation; BeerJSON-aligned enrichment fields
// (type/form/temp/floc/tolerance/pof, strainGroup, provenance) are optional and
// validated here as they get filled in. See docs/ingredient-data-plan.md.

const STRAIN_TYPES = [
  "ale",
  "lager",
  "kveik",
  "wheat",
  "brett",
  "wild",
  "bacteria",
  "blend",
  "wine",
  "other",
];
const FORMS = ["liquid", "dry"];
const FLOCCULATIONS = [
  "very-low",
  "low",
  "medium-low",
  "medium",
  "medium-high",
  "high",
  "very-high",
];
const CONFIDENCES = ["high", "medium", "low"];

describe("yeast preset database", () => {
  it("loads the expected number of strains (wiring intact)", () => {
    expect(YEAST_PRESETS.length).toBeGreaterThanOrEqual(140);
  });

  it("every yeast has a non-empty name and category", () => {
    for (const y of YEAST_PRESETS) {
      expect(y.name?.trim(), JSON.stringify(y)).toBeTruthy();
      expect(y.category?.trim(), y.name).toBeTruthy();
    }
  });

  it("has no duplicate yeast names", () => {
    const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const y of YEAST_PRESETS) {
      const k = norm(y.name);
      if (seen.has(k)) dups.push(`${y.name} ~ ${seen.get(k)}`);
      seen.set(k, y.name);
    }
    expect(dups).toEqual([]);
  });

  it("attenuation values are sane fractions (0-1) where present", () => {
    for (const y of YEAST_PRESETS) {
      for (const k of [
        "attenuationPercent",
        "attenuationMin",
        "attenuationMax",
      ] as const) {
        const v = y[k];
        if (v === undefined) continue;
        expect(Number.isFinite(v), `${y.name}.${k}=${v}`).toBe(true);
        expect(v, `${y.name}.${k}=${v}`).toBeGreaterThan(0);
        expect(v, `${y.name}.${k}=${v}`).toBeLessThanOrEqual(1);
      }
      if (y.attenuationMin !== undefined && y.attenuationMax !== undefined) {
        expect(y.attenuationMin, y.name).toBeLessThanOrEqual(y.attenuationMax);
      }
    }
  });

  it("temperature range is ordered and plausible where present", () => {
    for (const y of YEAST_PRESETS) {
      if (y.tempMinC === undefined && y.tempMaxC === undefined) continue;
      for (const k of ["tempMinC", "tempMaxC"] as const) {
        const v = y[k];
        if (v === undefined) continue;
        expect(Number.isFinite(v), `${y.name}.${k}=${v}`).toBe(true);
        expect(v, `${y.name}.${k}=${v}`).toBeGreaterThanOrEqual(0);
        expect(v, `${y.name}.${k}=${v}`).toBeLessThan(50);
      }
      if (y.tempMinC !== undefined && y.tempMaxC !== undefined) {
        expect(y.tempMinC, y.name).toBeLessThanOrEqual(y.tempMaxC);
      }
    }
  });

  it("enum fields use valid values where present", () => {
    for (const y of YEAST_PRESETS) {
      if (y.type !== undefined) expect(STRAIN_TYPES, y.name).toContain(y.type);
      if (y.form !== undefined) expect(FORMS, y.name).toContain(y.form);
      if (y.flocculation !== undefined)
        expect(FLOCCULATIONS, y.name).toContain(y.flocculation);
      if (y.sourceConfidence !== undefined)
        expect(CONFIDENCES, y.name).toContain(y.sourceConfidence);
    }
  });

  it("strainGroup is the canonical strain name; aliases are string arrays", () => {
    for (const y of YEAST_PRESETS) {
      if (y.strainGroup !== undefined) {
        expect(typeof y.strainGroup, y.name).toBe("string");
        expect(y.strainGroup.trim(), y.name).toBeTruthy();
      }
      if (y.strainGroupAliases !== undefined) {
        expect(Array.isArray(y.strainGroupAliases), y.name).toBe(true);
        for (const a of y.strainGroupAliases)
          expect(typeof a, `${y.name} alias`).toBe("string");
        // aliases only make sense alongside a group
        expect(
          y.strainGroup,
          `${y.name} has aliases but no strainGroup`
        ).toBeTruthy();
      }
    }
  });

  it("substitutes reference real strains, never self, no duplicates", () => {
    const names = new Set(YEAST_PRESETS.map((y) => y.name));
    for (const y of YEAST_PRESETS) {
      if (y.substitutes === undefined) continue;
      expect(Array.isArray(y.substitutes), y.name).toBe(true);
      expect(y.substitutes.length, y.name).toBeGreaterThan(0);
      expect(new Set(y.substitutes).size, `${y.name} has dup substitutes`).toBe(
        y.substitutes.length
      );
      for (const s of y.substitutes) {
        expect(s, `${y.name} -> "${s}"`).not.toBe(y.name);
        expect(names.has(s), `${y.name} -> missing "${s}"`).toBe(true);
      }
    }
  });
});

// Guards for the POF (phenolic / 4-VG) and STA-1 (diastaticus) trait data folded
// in June 2026 (collection + verification in docs/yeast-trait-research/). These pin
// the trait facts so a future dataset regen can't silently break them.
//
// NOTE on consistency checks: the plan also floated style-based rules ("pof=true ⇒
// phenolic-leaning style"). We DON'T use those — ~14 legit POF+ Belgian/saison
// strains carry empty or generic `styles`, and WLP885 Zurich is a genuine phenolic
// LAGER, so a style rule would false-fail on good data. The strainGroup-identity
// check below is the principled, non-fuzzy equivalent: same isolate ⇒ same genes.
describe("POF / STA-1 genetic traits", () => {
  type YP = (typeof YEAST_PRESETS)[number];

  it("pof and sta1 are booleans wherever present", () => {
    for (const y of YEAST_PRESETS) {
      for (const f of ["pof", "sta1"] as const) {
        if (y[f] === undefined) continue;
        expect(typeof y[f], `${y.name}.${f}=${y[f]}`).toBe("boolean");
      }
    }
  });

  // Indisputable, independently-verified facts (manufacturer specs + genomics) plus
  // the corrections this work landed. A regen that flips one of these fails CI —
  // the held-out regression check. null = trait deliberately not anchored.
  it("anchor strains keep their known POF / STA-1", () => {
    const P = true;
    const N = false;
    const ANCHORS: [string, boolean | null, boolean | null][] = [
      // clean ales + lagers — POF− / STA-1−
      ["SafAle US-05", N, N],
      ["WLP001 California Ale Yeast", N, N],
      ["1056 American Ale", N, N],
      ["SafLager W-34/70", N, N],
      ["LalBrew BRY-97 American West Coast Ale", N, N],
      ["SafAle S-04", N, N],
      ["OYL-071DRY Dried Lutra", N, N],
      // wheat / hefe — POF+
      ["SafAle WB-06", P, P], // var. diastaticus (Fermentis)
      ["WLP300 Hefeweizen Ale Yeast", P, N],
      ["3068 Weihenstephan Weizen", P, N],
      ["3638 Bavarian Wheat", P, P], // corrected STA-1+ (promoter-deleted variant)
      // phenolic Belgian — POF+
      ["SafAle T-58", P, null],
      ["WLP570 Belgian Golden Ale Yeast", P, null],
      ["1214 Belgian Abbey Style Ale", P, null],
      // saisons — diastatic
      ["LalBrew Belle Saison", P, P],
      ["3724 Belgian Saison", P, P],
      ["WLP565 Belgian Saison I Ale Yeast", P, P],
      ["3711 French Saison", null, P],
      ["LalBrew Farmhouse", P, N], // POF+ but non-diastatic (engineered STA1-knockout)
      ["WLP561 Non STA1son Ale Yeast Blend", null, N],
      ["OYL-500 Saisonstein", P, P], // Omega saison hybrid — diastatic + phenolic
      ["OYL-101 Pilsner I", N, N], // NOT Saisonstein (name was scrambled) — clean lager
      // adjudicated Rochefort group → POF−
      ["OYL-020 Belgian Ale R", N, null],
      ["1762 Belgian Abbey Style Ale II", N, null],
    ];
    const byName = new Map(YEAST_PRESETS.map((y) => [y.name, y]));
    const fails: string[] = [];
    for (const [name, ep, es] of ANCHORS) {
      const y = byName.get(name);
      if (!y) {
        fails.push(`${name}: MISSING from dataset`);
        continue;
      }
      if (ep !== null && y.pof !== ep)
        fails.push(`${name}: pof expected ${ep}, got ${y.pof}`);
      if (es !== null && y.sta1 !== es)
        fails.push(`${name}: sta1 expected ${es}, got ${y.sta1}`);
    }
    expect(fails, fails.join(" | ")).toEqual([]);
  });

  // POF and STA-1 are genetic, so every lab's copy of one isolate must match.
  // Disagreement = a wrong trait value OR a wrong strainGroup (mis-grouping).
  it("strains sharing a strainGroup agree on POF and STA-1", () => {
    const groups = new Map<string, YP[]>();
    for (const y of YEAST_PRESETS) {
      if (!y.strainGroup) continue;
      const arr = groups.get(y.strainGroup) ?? [];
      arr.push(y);
      groups.set(y.strainGroup, arr);
    }
    const conflicts: string[] = [];
    for (const [slug, members] of groups) {
      for (const f of ["pof", "sta1"] as const) {
        const known = members.filter((m) => typeof m[f] === "boolean");
        if (new Set(known.map((m) => m[f])).size > 1) {
          conflicts.push(
            `${slug}/${f}: ${known.map((m) => `${m.name}=${m[f]}`).join(" · ")}`
          );
        }
      }
    }
    expect(conflicts, conflicts.join(" || ")).toEqual([]);
  });

  // A diastatic strain super-attenuates by definition. A published STA-1+ strain
  // that barely attenuates is almost certainly a mis-assignment. (Floor kept
  // generous — the promoter-deleted weizen strains attenuate a normal ~74%.)
  it("STA-1+ strains attenuate at least 68% where published", () => {
    for (const y of YEAST_PRESETS) {
      if (y.sta1 === true && y.attenuationMax != null) {
        expect(
          y.attenuationMax,
          `${y.name} is STA-1+ but attenuationMax=${y.attenuationMax}`
        ).toBeGreaterThanOrEqual(0.68);
      }
    }
  });
});
