import { describe, test, expect } from "vitest";

import { deduplicateBy } from "./array";

describe("deduplicateBy", () => {
  test("keeps the first occurrence of each key", () => {
    const items = [
      { name: "a", v: 1 },
      { name: "b", v: 2 },
      { name: "a", v: 3 },
    ];
    expect(deduplicateBy(items, (x) => x.name)).toEqual([
      { name: "a", v: 1 },
      { name: "b", v: 2 },
    ]);
  });

  test("preserves insertion order", () => {
    const items = [{ id: 3 }, { id: 1 }, { id: 3 }, { id: 2 }];
    expect(deduplicateBy(items, (x) => x.id)).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
  });

  test("returns an empty array unchanged", () => {
    expect(deduplicateBy([], (x: { name: string }) => x.name)).toEqual([]);
  });
});
