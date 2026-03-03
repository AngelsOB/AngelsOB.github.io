import { describe, it, expect } from "vitest";
import { gravityPoints, totalVolumeAtTarget, dilutionWater } from "./dilution";

describe("gravityPoints", () => {
  it("converts SG to points", () => {
    expect(gravityPoints(1.06)).toBeCloseTo(60);
    expect(gravityPoints(1.05)).toBeCloseTo(50);
    expect(gravityPoints(1.0)).toBeCloseTo(0);
  });
});

describe("totalVolumeAtTarget", () => {
  // PDF Example 1: 20L @ 1.060, target 1.050 → 24L
  it("matches PDF example 1 (SG / Litres)", () => {
    expect(totalVolumeAtTarget(20, 1.06, 1.05)).toBeCloseTo(24);
  });

  it("returns Infinity when target is 1.000", () => {
    expect(totalVolumeAtTarget(20, 1.06, 1.0)).toBe(Infinity);
  });

  it("returns same volume when gravities match", () => {
    expect(totalVolumeAtTarget(20, 1.05, 1.05)).toBeCloseTo(20);
  });
});

describe("dilutionWater", () => {
  // PDF Example 1: 20L @ 1.060, target 1.050 → 4L water
  it("matches PDF example 1", () => {
    expect(dilutionWater(20, 1.06, 1.05)).toBeCloseTo(4);
  });

  it("returns 0 when gravities match", () => {
    expect(dilutionWater(20, 1.05, 1.05)).toBeCloseTo(0);
  });

  it("returns negative when target is higher (wort too dilute)", () => {
    expect(dilutionWater(20, 1.04, 1.05)).toBeLessThan(0);
  });
});
