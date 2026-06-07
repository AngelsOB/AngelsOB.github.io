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

  it("strainGroup, when set, is a kebab-case slug", () => {
    for (const y of YEAST_PRESETS) {
      if (y.strainGroup === undefined) continue;
      expect(y.strainGroup, y.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
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
