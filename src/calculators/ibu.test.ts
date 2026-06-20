import { describe, test, expect } from "vitest";

import { tinsethUtilization, singleHopIBU } from "./ibu";
import type { Hop } from "@/modules/recipe/models/Recipe";

const hop = (over: Partial<Hop>): Hop =>
  ({ id: "h", name: "Test", grams: 0, alphaAcid: 0, type: "boil", form: "pellet", ...over } as Hop);

describe("ibu", () => {
  test("tinsethUtilization", () => {
    expect(tinsethUtilization(60, 1.05)).toBeCloseTo(0.230664, 6);
    expect(tinsethUtilization(0, 1.05)).toBe(0);
  });

  // Golden-master values pinned from the pre-extraction service implementation.
  test("boil addition", () => {
    const ibu = singleHopIBU(hop({ alphaAcid: 10, grams: 28.3495, type: "boil", timeMinutes: 60 }), 1.05, 5, 1.05, 60);
    expect(ibu).toBeCloseTo(38.0595727, 5);
  });

  test("dry hop (humulinone model)", () => {
    const ibu = singleHopIBU(hop({ alphaAcid: 12, grams: 100, type: "dry hop" }), 1.05, 5, 1.05, 60);
    expect(ibu).toBeCloseTo(12.0617333, 5);
  });

  test("whirlpool addition", () => {
    const ibu = singleHopIBU(
      hop({ alphaAcid: 10, grams: 50, type: "whirlpool", whirlpoolTimeMinutes: 20, temperatureC: 80 }),
      1.05,
      5,
      1.05,
      60,
    );
    expect(ibu).toBeCloseTo(11.674227, 5);
  });
});
