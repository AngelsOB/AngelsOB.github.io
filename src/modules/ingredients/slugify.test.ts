import { describe, test, expect } from "vitest";

import { slugify, buildSlugIndex } from "./slugify";
import { HOP_PRESETS } from "@/modules/recipe/data/hopPresets";

describe("slugify", () => {
  test("lowercases and hyphenates words", () => {
    expect(slugify("Citra")).toBe("citra");
    expect(slugify("El Dorado")).toBe("el-dorado");
  });

  test("strips punctuation and collapses separators", () => {
    expect(slugify("Hallertauer Mittelfrüh")).toBe("hallertauer-mittelfruh");
    expect(slugify("Saaz (Žatec)")).toBe("saaz-zatec");
    expect(slugify("  Spalt   Select  ")).toBe("spalt-select");
    expect(slugify("Styrian Golding / Bobek")).toBe("styrian-golding-bobek");
  });

  test("strips diacritics rather than dropping the letter", () => {
    expect(slugify("Hüll Melon")).toBe("hull-melon");
  });

  test("is deterministic — no random suffix (unlike generateShareSlug)", () => {
    expect(slugify("Cascade")).toBe(slugify("Cascade"));
    expect(slugify("Cascade")).toBe("cascade");
  });

  test("handles empty / junk input without throwing", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("buildSlugIndex", () => {
  const item = (name: string, origin?: string) => ({ name, origin });

  test("assigns the bare slug when there is no collision", () => {
    const items = [item("Cascade"), item("Mosaic")];
    const { slugOf } = buildSlugIndex(items, { baseName: (i) => i.name });
    expect(slugOf.get(items[0])).toBe("cascade");
    expect(slugOf.get(items[1])).toBe("mosaic");
  });

  test("disambiguates a duplicate name with the origin suffix", () => {
    const items = [item("Cascade", "US"), item("Cascade", "NZ")];
    const { slugOf } = buildSlugIndex(items, {
      baseName: (i) => i.name,
      disambiguator: (i) => i.origin,
    });
    // First occurrence keeps the bare slug; the second gets -origin.
    expect(slugOf.get(items[0])).toBe("cascade");
    expect(slugOf.get(items[1])).toBe("cascade-nz");
  });

  test("falls back to a numeric suffix when no disambiguator resolves", () => {
    const items = [item("Cascade"), item("Cascade"), item("Cascade")];
    const { slugOf } = buildSlugIndex(items, { baseName: (i) => i.name });
    expect(slugOf.get(items[0])).toBe("cascade");
    expect(slugOf.get(items[1])).toBe("cascade-2");
    expect(slugOf.get(items[2])).toBe("cascade-3");
  });

  test("keeps incrementing when the disambiguated slug also collides", () => {
    const items = [
      item("Cascade", "US"),
      item("Cascade", "NZ"),
      item("Cascade", "NZ"),
    ];
    const { slugOf } = buildSlugIndex(items, {
      baseName: (i) => i.name,
      disambiguator: (i) => i.origin,
    });
    expect(slugOf.get(items[0])).toBe("cascade");
    expect(slugOf.get(items[1])).toBe("cascade-nz");
    expect(slugOf.get(items[2])).toBe("cascade-nz-2");
  });

  test("forward and reverse maps agree", () => {
    const items = [item("Cascade", "US"), item("Cascade", "NZ")];
    const { slugOf, bySlug } = buildSlugIndex(items, {
      baseName: (i) => i.name,
      disambiguator: (i) => i.origin,
    });
    for (const it of items) {
      expect(bySlug.get(slugOf.get(it)!)).toBe(it);
    }
  });

  test("every real hop gets a unique, non-empty slug", () => {
    const { slugOf, bySlug } = buildSlugIndex(HOP_PRESETS, {
      baseName: (h) => h.name,
      disambiguator: (h) => h.originCode,
    });
    expect(slugOf.size).toBe(HOP_PRESETS.length);
    // No collapsed/empty slugs, and the reverse map proves uniqueness.
    expect(bySlug.size).toBe(HOP_PRESETS.length);
    for (const h of HOP_PRESETS) {
      expect(slugOf.get(h)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
