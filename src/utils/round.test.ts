import { describe, test, expect } from "vitest";

import { round } from "./round";

describe("round", () => {
  test("rounds to the given number of decimals", () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(1.2349, 3)).toBe(1.235);
    expect(round(10, 0)).toBe(10);
  });

  test("matches the inline Math.round(n*f)/f form", () => {
    for (const [n, d] of [[1.005, 2], [2.5, 0], [-1.2345, 2], [0, 4]] as const) {
      expect(round(n, d)).toBe(Math.round(n * Math.pow(10, d)) / Math.pow(10, d));
    }
  });
});
