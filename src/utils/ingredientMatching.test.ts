import { describe, test, expect } from "vitest";

import { fuzzyIncludes, fuzzyScore, rankBySearch } from "./ingredientMatching";

/**
 * fuzzyIncludes is the single search pipeline behind every ingredient picker
 * (hops, yeast, fermentables, water, equipment, styles) AND the /hops and
 * /yeast resource pages. These tests pin the existing substring/separator/
 * multi-word behavior and lock in the added typo tolerance.
 */
describe("fuzzyIncludes", () => {
  describe("empty / no-op cases", () => {
    test("empty or whitespace query matches anything", () => {
      expect(fuzzyIncludes("", "Citra")).toBe(true);
      expect(fuzzyIncludes("   ", "Citra")).toBe(true);
    });

    test("non-empty query with no usable candidates does not match", () => {
      expect(fuzzyIncludes("citra")).toBe(false);
      expect(fuzzyIncludes("citra", null, undefined, "")).toBe(false);
    });
  });

  describe("substring matching (existing behavior)", () => {
    test("case-insensitive substring hit", () => {
      expect(fuzzyIncludes("cit", "Citra")).toBe(true);
      expect(fuzzyIncludes("CITRA", "Citra")).toBe(true);
    });

    test("matches a hit in any candidate field, not just the first", () => {
      expect(fuzzyIncludes("fermentis", "SafAle US-05", "Fermentis")).toBe(true);
    });

    test("unrelated query does not match", () => {
      expect(fuzzyIncludes("nelson", "Citra")).toBe(false);
    });
  });

  describe("separator-insensitive matching (existing behavior)", () => {
    test("lab codes match regardless of separators", () => {
      expect(fuzzyIncludes("us05", "SafAle US-05")).toBe(true);
      expect(fuzzyIncludes("us-05", "US 05")).toBe(true);
      expect(fuzzyIncludes("wlp001", "White Labs WLP 001")).toBe(true);
    });
  });

  describe("multi-word matching (existing behavior)", () => {
    test("every query word must be present, order-independent", () => {
      expect(fuzzyIncludes("american ale", "Ale, American Style")).toBe(true);
      expect(fuzzyIncludes("ale american", "American Ale")).toBe(true);
    });

    test("a missing word fails the whole query", () => {
      expect(fuzzyIncludes("belgian ale", "American Ale")).toBe(false);
    });
  });

  describe("typo tolerance (new behavior)", () => {
    test("single-edit substitution on a mid-length word", () => {
      expect(fuzzyIncludes("galexy", "Galaxy")).toBe(true);
    });

    test("single-edit deletion", () => {
      expect(fuzzyIncludes("citrra", "Citra")).toBe(true);
    });

    test("typo against a non-name field in the haystack", () => {
      expect(fuzzyIncludes("galexy", "Nelson Sauvin", "galaxy tropical")).toBe(
        true
      );
    });

    test("two edits allowed once the word is long enough", () => {
      // "elefant" → "elephant": substitute f→p and insert h (2 edits, len 7).
      expect(fuzzyIncludes("elefant", "Elephant")).toBe(true);
    });

    test("edit budget scales with length — two edits rejected on a short word", () => {
      // "galexi" → "galaxy" is 2 edits; at length 6 the budget is only 1.
      expect(fuzzyIncludes("galexi", "Galaxy")).toBe(false);
    });

    test("a correctly-typed short word still passes inside a multi-word typo query", () => {
      // "americen" is a typo of "american"; "ale" is exact. Both must pass.
      expect(fuzzyIncludes("americen ale", "American Ale")).toBe(true);
    });
  });

  describe("short-query guards (no false positives)", () => {
    test("no edits are tolerated on words shorter than 4 chars", () => {
      expect(fuzzyIncludes("alw", "Ale")).toBe(false);
      expect(fuzzyIncludes("ipb", "IPA")).toBe(false);
    });

    test("a short exact substring still matches", () => {
      expect(fuzzyIncludes("ipa", "Hazy IPA")).toBe(true);
    });
  });
});

/**
 * fuzzyScore ranks the survivors of fuzzyIncludes. The resource pages call it as
 * fuzzyScore(q, row.name, row.keywords) — name first, so a name hit outranks a
 * row that only matches on an alias/equivalent buried in its keywords. Tests use
 * that same 2-candidate shape.
 */
describe("fuzzyScore", () => {
  test("empty query and non-matches score 0", () => {
    expect(fuzzyScore("", "Citra")).toBe(0);
    expect(fuzzyScore("nelson", "Citra", "citra citrus tropical")).toBe(0);
  });

  test("anything fuzzyIncludes accepts scores above 0", () => {
    expect(fuzzyScore("galexy", "Galaxy", "galaxy hops")).toBeGreaterThan(0);
    expect(fuzzyScore("us05", "SafAle US-05", "fermentis")).toBeGreaterThan(0);
  });

  test("the us 05 case: the named product outranks the strain that lists it as an equivalent", () => {
    const us05 = fuzzyScore("us 05", "SafAle US-05", "safale us-05 fermentis american ale");
    const cali = fuzzyScore("us 05", "California Ale", "california ale chico us-05 wlp001 1056");
    expect(us05).toBeGreaterThan(cali);
    expect(cali).toBeGreaterThan(0); // still a match, just ranked lower
  });

  test("a name hit always outranks a keyword-only hit for the same query", () => {
    const nameHit = fuzzyScore("chico", "Chico Ale", "chico ale");
    const keywordOnly = fuzzyScore("chico", "California Ale", "california ale chico strain");
    expect(nameHit).toBeGreaterThan(keywordOnly);
    expect(keywordOnly).toBeGreaterThan(0);
  });

  test("field dominance holds even when the name hit is weaker than the keyword hit", () => {
    // "galexy" is only a typo of the name Galaxy (weakest tier); the other row
    // has an exact substring hit — but in a keyword field, so it still loses.
    const weakNameHit = fuzzyScore("galexy", "Galaxy", "galaxy");
    const strongKeywordHit = fuzzyScore("galexy", "Nelson", "nelson galexy blend");
    expect(weakNameHit).toBeGreaterThan(strongKeywordHit);
  });

  test("within a field, stronger match types rank higher", () => {
    const exact = fuzzyScore("citra", "Citra", "citra usa");
    const prefix = fuzzyScore("citra", "Citra Cryo", "citra cryo usa");
    const substring = fuzzyScore("citra", "Mega Citra Blend", "mega citra blend");
    const typo = fuzzyScore("citrra", "Citra", "citra usa");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
  });
});

/** The list-level ranker the picker modals use to sort search results. */
describe("rankBySearch", () => {
  type Item = { name: string; lab?: string };
  const fields = (i: Item) => [i.name, i.lab];

  test("empty query leaves order untouched", () => {
    const items: Item[] = [{ name: "B" }, { name: "A" }];
    expect(rankBySearch(items, "", fields)).toEqual(items);
    expect(rankBySearch(items, "   ", fields)).toBe(items); // same reference, no work
  });

  test("best match sorts first regardless of input order", () => {
    const items: Item[] = [
      { name: "Cascade Cryo" },
      { name: "Ella" },
      { name: "Cascade" },
    ];
    // exact "Cascade" beats prefix "Cascade Cryo"; "Ella" (no hit) trails.
    expect(rankBySearch(items, "cascade", fields).map((i) => i.name)).toEqual([
      "Cascade",
      "Cascade Cryo",
      "Ella",
    ]);
  });

  test("a name hit outranks a same-query hit that lands in a later field", () => {
    const items: Item[] = [
      { name: "California Ale", lab: "us-05 equivalent" },
      { name: "SafAle US-05", lab: "Fermentis" },
    ];
    expect(rankBySearch(items, "us 05", fields)[0].name).toBe("SafAle US-05");
  });

  test("stable: equal-score items keep input order", () => {
    const items: Item[] = [{ name: "Citra A" }, { name: "Citra B" }, { name: "Citra C" }];
    expect(rankBySearch(items, "citra", fields).map((i) => i.name)).toEqual([
      "Citra A",
      "Citra B",
      "Citra C",
    ]);
  });

  test("does not mutate the input array", () => {
    const items: Item[] = [{ name: "B" }, { name: "A cascade" }];
    const before = [...items];
    rankBySearch(items, "cascade", fields);
    expect(items).toEqual(before);
  });
});
