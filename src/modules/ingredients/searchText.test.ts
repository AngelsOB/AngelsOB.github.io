import { describe, test, expect } from "vitest";

import type { HopPreset, YeastPreset } from "@/modules/recipe/models/Presets";
import { fuzzyIncludes } from "@/utils/ingredientMatching";

import { hopSearchText, yeastSearchText } from "./searchText";

describe("hopSearchText", () => {
  test("includes name, category, origin, and present flavors — but not absent ones", () => {
    const citra = {
      name: "Citra",
      category: "US Hops",
      originCode: "US",
      flavor: {
        citrus: 4,
        tropicalFruit: 3,
        stoneFruit: 1,
        berry: 0,
        floral: 0,
        spice: 0,
        herbal: 0,
        grassy: 0,
        resinPine: 0,
      },
    } as HopPreset;
    const text = hopSearchText(citra);
    expect(text).toContain("citra");
    expect(text).toContain("us hops");
    expect(text).toContain("citrus");
    expect(text).toContain("tropical");
    expect(text).toContain("stone fruit");
    expect(text).not.toContain("grassy"); // value 0 → not in the haystack
    expect(text).toBe(text.toLowerCase());
  });

  test("a hop with no flavor vector still yields its name/origin", () => {
    const bare = { name: "Mystery", originCode: "NZ" } as HopPreset;
    expect(hopSearchText(bare)).toContain("mystery");
  });
});

describe("yeastSearchText", () => {
  test("includes name, lab, producer, id, strain group, aliases, and styles", () => {
    const us05 = {
      name: "SafAle US-05",
      category: "Fermentis",
      producer: "Fermentis",
      type: "ale",
      labProductId: "US-05",
      strainGroup: "Chico (American Ale)",
      strainGroupAliases: ["Sierra Nevada", "WLP001", "1056"],
      styles: ["American IPA", "Pale Ale"],
    } as YeastPreset;
    const text = yeastSearchText(us05);
    expect(text).toContain("safale us-05");
    expect(text).toContain("fermentis");
    expect(text).toContain("chico");
    expect(text).toContain("sierra nevada");
    expect(text).toContain("american ipa");
  });

  test("a Chico-family strain is findable by a sibling's code — the reason 'us 05' surfaces it", () => {
    const cali = {
      name: "California Ale",
      category: "Wyeast",
      labProductId: "1056",
      strainGroup: "Chico (American Ale)",
      strainGroupAliases: ["US-05", "WLP001", "Sierra Nevada"],
    } as YeastPreset;
    // The alias carries the sibling code, so the full haystack matches "us 05"…
    expect(fuzzyIncludes("us 05", yeastSearchText(cali))).toBe(true);
    // …but its name does not, which is what makes it the weaker (dimmed) hit,
    // ranked below the strain actually named US-05.
    expect(fuzzyIncludes("us 05", cali.name)).toBe(false);
  });
});
