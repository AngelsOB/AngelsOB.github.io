import { describe, it, expect } from "vitest";
import { HOP_PRESETS, HOP_FLAVOR_KEYS } from "./presets";

// Guards the generated hop database (src/utils/presets.generated.hops.json),
// merged from curated house data + kasperg3 (MIT) grower facts. See
// project memory: project_ingredient_data_expansion.

describe("hop preset database", () => {
  it("loads a substantial number of hops (wiring intact)", () => {
    expect(HOP_PRESETS.length).toBeGreaterThan(200);
  });

  it("every hop has a name and a numeric alpha acid", () => {
    for (const h of HOP_PRESETS) {
      expect(h.name?.trim()).toBeTruthy();
      expect(typeof h.alphaAcidPercent).toBe("number");
      expect(Number.isFinite(h.alphaAcidPercent)).toBe(true);
    }
  });

  it("has no duplicate hop names", () => {
    const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const h of HOP_PRESETS) {
      const k = norm(h.name);
      if (seen.has(k)) dups.push(`${h.name} ~ ${seen.get(k)}`);
      seen.set(k, h.name);
    }
    expect(dups).toEqual([]);
  });

  it("no junk/scraper-artifact names remain", () => {
    const junk = HOP_PRESETS.filter((h) => /machops|^blend$|\bblend\b/i.test(h.name));
    expect(junk.map((h) => h.name)).toEqual([]);
  });

  it("every flavor profile is complete with integer values 0-5", () => {
    for (const h of HOP_PRESETS) {
      if (!h.flavor) continue;
      for (const ax of HOP_FLAVOR_KEYS) {
        const v = (h.flavor as Record<string, number>)[ax];
        expect(Number.isInteger(v), `${h.name}.${ax}=${v}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  it("flavor provenance is tracked and valid", () => {
    for (const h of HOP_PRESETS) {
      if (h.flavorSource !== undefined) {
        expect(["curated", "derived"]).toContain(h.flavorSource);
      }
      if (h.flavor) expect(h.flavorSource).toBeDefined();
    }
    // curated house vectors must survive the merge
    const curated = HOP_PRESETS.filter((h) => h.flavorSource === "curated");
    expect(curated.length).toBeGreaterThanOrEqual(60);
  });
});
