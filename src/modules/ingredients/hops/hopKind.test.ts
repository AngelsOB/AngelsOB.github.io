import { describe, test, expect } from "vitest";

import { HOP_PRESETS } from "@/modules/recipe/data/hopPresets";
import { hopRows, hopFlavorFilter, getHop } from "./hopKind";

describe("hopFlavorFilter — the flavor filter row", () => {
  const filter = hopFlavorFilter();

  test("labels the dimension and lists only axes some hop reaches", () => {
    expect(filter.label).toBe("Flavor");
    expect(filter.options.length).toBeGreaterThan(0);
    for (const o of filter.options) expect(o.count).toBeGreaterThan(0);
  });

  test("uses graded matching (present-all ≥1, prominent-one ≥3)", () => {
    expect(filter.graded).toEqual({ presentMin: 1, prominentMin: 3 });
  });

  test("a chip's count equals the hops with that axis at the prominent threshold", () => {
    const citrus = filter.options.find((o) => o.value === "citrus")!;
    const expected = HOP_PRESETS.filter((h) => (h.flavor?.citrus ?? 0) >= 3).length;
    expect(citrus.count).toBe(expected);
  });

  test("every flavored hop carries its per-axis weights for graded matching", () => {
    const flavored = HOP_PRESETS.filter((h) => h.flavor).length;
    const withWeights = hopRows().filter((r) => r.subWeights).length;
    expect(withWeights).toBe(flavored);
  });

  test("weights mirror the preset's flavor vector (so 0 = absent is honored)", () => {
    for (const r of hopRows()) {
      const h = getHop(r.slug);
      if (!h?.flavor) continue;
      // The citrus weight matches the source value, including a literal 0.
      expect(r.subWeights?.citrus ?? 0).toBe(h.flavor.citrus ?? 0);
    }
  });
});
