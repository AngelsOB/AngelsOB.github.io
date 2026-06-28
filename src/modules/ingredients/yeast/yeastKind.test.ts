import { describe, test, expect } from "vitest";

import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { YEAST_PRESETS } from "@/modules/recipe/data/yeastPresets";
import {
  yeastSlugs,
  yeastSlug,
  getYeast,
  yeastRows,
  isYeastIndexable,
  indexableYeastItems,
  yeastGauge,
  yeastTempBar,
  flocPosition,
  tolerancePosition,
  yeastEquivalents,
  yeastEquivalenceLine,
  yeastFaq,
  yeastMeta,
  yeastTypeFilter,
} from "./yeastKind";

// Minimal synthetic strain for testing pure gate/shape logic in isolation
// (only name + category are required on YeastPreset).
const mk = (over: Partial<YeastPreset>): YeastPreset => ({
  name: "Test Strain",
  category: "Test Lab",
  ...over,
});

describe("yeast catalog / slugs", () => {
  test("every real strain gets a unique, non-empty, url-safe slug", () => {
    expect(yeastSlugs.length).toBe(YEAST_PRESETS.length);
    expect(new Set(yeastSlugs).size).toBe(yeastSlugs.length);
    for (const s of yeastSlugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  test("slug round-trips back to the same strain object", () => {
    const y = YEAST_PRESETS[0];
    expect(getYeast(yeastSlug(y))).toBe(y);
  });
});

describe("isYeastIndexable — the quality gate (attenuation + temp + floc)", () => {
  test("passes when all three are present", () => {
    expect(
      isYeastIndexable(
        mk({ attenuationPercent: 0.75, tempMinC: 18, flocculation: "medium" })
      )
    ).toBe(true);
    // A range (no headline percent) still counts as attenuation.
    expect(
      isYeastIndexable(
        mk({
          attenuationMin: 0.73,
          attenuationMax: 0.8,
          tempMaxC: 22,
          flocculation: "high",
        })
      )
    ).toBe(true);
  });

  test("fails when any one of the three is missing", () => {
    expect(
      isYeastIndexable(mk({ tempMinC: 18, flocculation: "medium" }))
    ).toBe(false); // no attenuation
    expect(
      isYeastIndexable(mk({ attenuationPercent: 0.75, flocculation: "medium" }))
    ).toBe(false); // no temp
    expect(
      isYeastIndexable(mk({ attenuationPercent: 0.75, tempMinC: 18 }))
    ).toBe(false); // no floc
  });

  test("indexableYeastItems is a non-empty subset with /yeast/ paths", () => {
    const items = indexableYeastItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(YEAST_PRESETS.length);
    for (const it of items) expect(it.path).toMatch(/^\/yeast\/[a-z0-9-]+$/);
  });
});

describe("meter geometry — the compact spec sliders", () => {
  test("attenuation → whole-percent 0–100 band + point", () => {
    expect(
      yeastGauge(
        mk({ attenuationMin: 0.73, attenuationMax: 0.8, attenuationPercent: 0.77 })
      )
    ).toEqual({ low: 73, high: 80, point: 77 });
  });

  test("attenuation collapses to a point, clamps, and is null when absent", () => {
    expect(yeastGauge(mk({ attenuationPercent: 0.77 }))).toEqual({
      low: 77,
      high: 77,
      point: 77,
    });
    expect(yeastGauge(mk({ attenuationPercent: 1.2 }))?.point).toBe(100);
    expect(yeastGauge(mk({}))).toBeNull();
  });

  test("temp bar normalises inverted ranges and is null when absent", () => {
    expect(yeastTempBar(mk({ tempMinC: 16, tempMaxC: 22 }))).toEqual({
      minC: 16,
      maxC: 22,
    });
    expect(yeastTempBar(mk({ tempMinC: 22, tempMaxC: 16 }))).toEqual({
      minC: 16,
      maxC: 22,
    });
    expect(yeastTempBar(mk({}))).toBeNull();
  });

  test("flocculation maps grades to an ascending low→high position", () => {
    const low = flocPosition(mk({ flocculation: "low" }))!;
    const high = flocPosition(mk({ flocculation: "high" }))!;
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThan(100);
    expect(high).toBeGreaterThan(low);
    expect(flocPosition(mk({}))).toBeNull();
  });

  test("alcohol tolerance maps % onto a 0–20 rule, clamped, null when absent", () => {
    expect(tolerancePosition(mk({ alcoholTolerance: 10 }))).toBe(50);
    expect(tolerancePosition(mk({ alcoholTolerance: 25 }))).toBe(100);
    expect(tolerancePosition(mk({}))).toBeNull();
  });
});

describe("cross-lab equivalence — the wedge", () => {
  const withPeers = YEAST_PRESETS.find((y) => yeastEquivalents(y).length > 0);
  const singleton = YEAST_PRESETS.find(
    (y) => yeastEquivalents(y).length === 0
  );

  test("the dataset actually contains multi-lab strain groups", () => {
    expect(withPeers).toBeDefined();
  });

  test("a grouped strain produces an 'A = B' equivalence line", () => {
    const line = yeastEquivalenceLine(withPeers!);
    expect(line).toContain(" = ");
  });

  test("a singleton has no equivalence line", () => {
    expect(singleton).toBeDefined();
    expect(yeastEquivalenceLine(singleton!)).toBeNull();
  });

  test("the FAQ LEADS with the equivalence question when peers exist", () => {
    const faq = yeastFaq(withPeers!);
    expect(faq[0].q).toMatch(/equivalent/i);
  });

  test("the FAQ does NOT lead with equivalence for a singleton", () => {
    const faq = yeastFaq(singleton!);
    expect(faq[0]?.q ?? "").not.toMatch(/equivalent/i);
  });

  test("meta description leads with equivalence + keywords carry it", () => {
    const meta = yeastMeta(withPeers!);
    expect(meta.description.startsWith(`${withPeers!.name} is the same strain as`)).toBe(
      true
    );
    expect(meta.keywords).toContain(`${withPeers!.name} equivalent`);
  });
});

describe("yeastRows — index cards", () => {
  test("one row per strain, no radar chart, url-safe slug", () => {
    const rows = yeastRows();
    expect(rows.length).toBe(YEAST_PRESETS.length);
    for (const r of rows) {
      expect(r.chart).toBeUndefined();
      expect(r.slug).toMatch(/^[a-z0-9-]+$/);
      expect(r.keywords.length).toBeGreaterThan(0);
    }
  });

  test("each row carries its strain type as the secondary-filter subGroup", () => {
    const rows = yeastRows();
    for (const r of rows) {
      const preset = getYeast(r.slug);
      expect(r.subGroups).toEqual(preset?.type ? [preset.type] : undefined);
    }
  });
});

describe("yeastTypeFilter — the strain-type filter row", () => {
  const filter = yeastTypeFilter();

  test("labels the dimension and lists only types present, ale first", () => {
    expect(filter.label).toBe("Type");
    expect(filter.options.length).toBeGreaterThan(0);
    expect(filter.options[0].value).toBe("ale");
    for (const o of filter.options) expect(o.count).toBeGreaterThan(0);
  });

  test("type stays cumulative — plain OR membership, no graded matching", () => {
    expect(filter.graded).toBeUndefined();
  });

  test("the option counts cover every typed strain exactly once", () => {
    const typed = YEAST_PRESETS.filter((y) => y.type).length;
    const sum = filter.options.reduce((n, o) => n + o.count, 0);
    expect(sum).toBe(typed);
  });

  test("every option value is a real subGroup a row can match", () => {
    const subGroups = new Set(yeastRows().flatMap((r) => r.subGroups ?? []));
    for (const o of filter.options) expect(subGroups.has(o.value)).toBe(true);
  });
});
