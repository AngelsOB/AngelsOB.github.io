import { describe, test, expect } from "vitest";
import { hashSeed, mulberry32, selectExplored } from "./prng";

describe("mulberry32 / hashSeed", () => {
  test("same seed reproduces the same stream", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const as = [a(), a(), a()];
    const bs = [b(), b(), b()];
    expect(as).toEqual(bs);
  });

  test("different seeds diverge", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  test("outputs are in [0, 1)", () => {
    const r = mulberry32(hashSeed("hop", "bittering", 7));
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("hashSeed is stable and order-sensitive", () => {
    expect(hashSeed("grist", "base")).toBe(hashSeed("grist", "base"));
    expect(hashSeed("grist", "base")).not.toBe(hashSeed("base", "grist"));
    expect(hashSeed(0, "hop", "aroma")).not.toBe(hashSeed(1, "hop", "aroma"));
  });
});

describe("selectExplored", () => {
  const cands = [
    { key: "a", score: 0.5 },
    { key: "b", score: 0.3 },
    { key: "c", score: 0.15 },
    { key: "d", score: 0.05 },
  ];

  test("exploration=0 is a deterministic top-N by score", () => {
    const rng = () => 0.999; // would matter if it sampled; it must not
    expect(selectExplored(cands, 1, 0, rng).map((c) => c.key)).toEqual(["a"]);
    expect(selectExplored(cands, 2, 0, rng).map((c) => c.key)).toEqual(["a", "b"]);
  });

  test("fewer-or-equal candidates than count returns them all, top-first", () => {
    expect(selectExplored(cands, 9, 0.8, () => 0.5).map((c) => c.key)).toEqual(["a", "b", "c", "d"]);
  });

  test("same seed reproduces the same pick (reproducible reroll)", () => {
    const pick = () => selectExplored(cands, 1, 0.6, mulberry32(hashSeed(7, "grist", "crystal")))[0].key;
    expect(pick()).toBe(pick());
  });

  test("high exploration can reach past the most popular option", () => {
    // draw many seeds; at exploration 0.9 the winner should sometimes NOT be 'a'.
    const winners = new Set<string>();
    for (let s = 0; s < 40; s++) winners.add(selectExplored(cands, 1, 0.9, mulberry32(s))[0].key);
    expect(winners.size).toBeGreaterThan(1);
    expect(winners.has("a")).toBe(true); // still favours the top overall
  });

  test("never selects a candidate outside the eligibility floor at low exploration", () => {
    // at exploration 0.2 only scores within 20% of the top (>=0.4) are eligible: just 'a'.
    for (let s = 0; s < 30; s++) {
      expect(selectExplored(cands, 1, 0.2, mulberry32(s))[0].key).toBe("a");
    }
  });
});
