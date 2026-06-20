import { describe, test, expect } from "vitest";

import { stripUndefined } from "./firestore";

describe("stripUndefined", () => {
  test("drops keys whose value is undefined", () => {
    expect(stripUndefined({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  test("strips undefined at nested levels", () => {
    const input = { a: { b: undefined, c: 2 }, d: [1, undefined, 3] };
    // JSON round-trip turns array holes of undefined into null (Firestore-safe)
    expect(stripUndefined(input)).toEqual({ a: { c: 2 }, d: [1, null, 3] });
  });

  test("preserves defined falsy values", () => {
    expect(stripUndefined({ a: 0, b: false, c: "" })).toEqual({ a: 0, b: false, c: "" });
  });
});
