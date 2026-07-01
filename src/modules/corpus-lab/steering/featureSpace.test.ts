import { describe, test, expect } from "vitest";
import {
  CONTINUOUS_DIMS,
  continuousRow,
  gravityPoints,
  computeStats,
  zScore,
  buildYeastVocab,
  yeastBlockFromClass,
  blendYeastBlocks,
  yeastNorm2,
  weightedDistance2,
  kNearestByDistance,
  kernelWeights,
  YEAST_OWN_WEIGHT,
  YEAST_SUB_WEIGHT,
  type CloudRecord,
} from "./featureSpace";

const ZERO9 = new Array(9).fill(0);

function rec(over: Partial<CloudRecord> = {}): CloudRecord {
  return {
    id: 0, s: "American IPA", og: 1.06, fg: 1.012, abv: 6.3, ibu: 60, srm: 6, mb: 0.1,
    m: [...ZERO9], h: [...ZERO9], g: {}, hp: [], yc: null, ys: [], yn: null,
    ...over,
  };
}

// ── continuousRow / gravityPoints ───────────────────────────────────────────

describe("continuousRow", () => {
  test("gravityPoints matches the app's GU convention", () => {
    expect(gravityPoints(1.06)).toBeCloseTo(60, 9);
    expect(gravityPoints(1.0)).toBeCloseTo(0, 9);
  });

  test("produces exactly 23 dims: 9 malt + 9 hop + gravity/ibu/srm/buGu/maltBody", () => {
    const row = continuousRow({ m: [1, 2, 3, 4, 5, 6, 7, 8, 9], h: [9, 8, 7, 6, 5, 4, 3, 2, 1], og: 1.05, ibu: 40, srm: 8, mb: 0.2 });
    expect(row).toHaveLength(CONTINUOUS_DIMS);
    expect(row.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(row.slice(9, 18)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const [grav, ibu, srm, buGu, mb] = row.slice(18);
    expect(grav).toBeCloseTo(50, 9);
    expect(ibu).toBe(40);
    expect(srm).toBe(8);
    expect(buGu).toBeCloseTo(40 / 50, 9);
    expect(mb).toBe(0.2);
  });

  test("buGu is 0 when gravity is 0 (no divide-by-zero)", () => {
    const row = continuousRow({ m: ZERO9, h: ZERO9, og: 1.0, ibu: 20, srm: 3, mb: 0 });
    expect(row[21]).toBe(0);
  });
});

// ── stats / z-score ──────────────────────────────────────────────────────────

describe("computeStats / zScore", () => {
  test("mean and population std over simple rows", () => {
    const rows = [[0, 10], [2, 10], [4, 10]];
    const stats = computeStats(rows);
    expect(stats.mean).toEqual([2, 10]);
    // variance of [0,2,4] = 8/3, std = sqrt(8/3)
    expect(stats.std[0]).toBeCloseTo(Math.sqrt(8 / 3), 9);
    // constant column: std would be 0 -> floored to 1
    expect(stats.std[1]).toBe(1);
  });

  test("zScore centers and scales by the stats", () => {
    const stats = computeStats([[0], [2], [4]]);
    const z = zScore([2], stats);
    expect(z[0]).toBeCloseTo(0, 9); // exactly the mean
    const zHigh = zScore([4], stats);
    expect(zHigh[0]).toBeGreaterThan(0);
  });
});

// ── yeast vocab / blocks ─────────────────────────────────────────────────────

describe("buildYeastVocab", () => {
  test("ranks base classes by usage frequency and always appends brett/lacto", () => {
    const cloud = [
      rec({ yc: "A" }), rec({ yc: "A" }), rec({ yc: "A" }),
      rec({ yc: "B" }), rec({ yc: "B" }),
      rec({ yc: "C" }),
      rec({ yc: null }),
    ];
    const vocab = buildYeastVocab(cloud, 2);
    expect(vocab.index.get("A")).toBe(0);
    expect(vocab.index.get("B")).toBe(1);
    expect(vocab.index.has("C")).toBe(false); // pushed out by topN=2
    expect(vocab.index.get("__brett")).toBe(vocab.brettIdx);
    expect(vocab.index.get("__lacto")).toBe(vocab.lactoIdx);
    expect(vocab.size).toBe(4); // A, B, brett, lacto
  });
});

describe("yeastBlockFromClass", () => {
  const vocab = buildYeastVocab([rec({ yc: "Chico" }), rec({ yc: "Kolsch" })], 10);

  test("own class gets OWN weight, subs get SUB weight", () => {
    const block = yeastBlockFromClass({ yc: "Chico", ys: ["Kolsch"] }, vocab);
    expect(block.get(vocab.index.get("Chico")!)).toBe(YEAST_OWN_WEIGHT);
    expect(block.get(vocab.index.get("Kolsch")!)).toBe(YEAST_SUB_WEIGHT);
  });

  test("unknown classes (outside the vocab) are dropped, not thrown", () => {
    const block = yeastBlockFromClass({ yc: "SomeObscureStrain", ys: ["AlsoObscure"] }, vocab);
    expect(block.size).toBe(0);
  });

  test("a sub that collides with an already-set slot does not overwrite OWN", () => {
    const block = yeastBlockFromClass({ yc: "Chico", ys: ["Chico"] }, vocab);
    expect(block.get(vocab.index.get("Chico")!)).toBe(YEAST_OWN_WEIGHT);
  });

  test("souring flags set dedicated brett/lacto dims at OWN weight", () => {
    const block = yeastBlockFromClass({ yc: null, ys: [], srb: true, srl: true }, vocab);
    expect(block.get(vocab.brettIdx)).toBe(YEAST_OWN_WEIGHT);
    expect(block.get(vocab.lactoIdx)).toBe(YEAST_OWN_WEIGHT);
  });

  test("yeastNorm2 is the sum of squared weights", () => {
    const block = yeastBlockFromClass({ yc: "Chico", ys: ["Kolsch"] }, vocab);
    expect(yeastNorm2(block)).toBeCloseTo(YEAST_OWN_WEIGHT ** 2 + YEAST_SUB_WEIGHT ** 2, 9);
  });
});

describe("blendYeastBlocks", () => {
  test("weighted average of sparse blocks", () => {
    const a: Map<number, number> = new Map([[0, 1.0]]);
    const b: Map<number, number> = new Map([[0, 0.0], [1, 1.0]]);
    const blended = blendYeastBlocks([a, b], [3, 1]); // 3:1 favouring `a`
    expect(blended.get(0)).toBeCloseTo(0.75, 9);
    expect(blended.get(1)).toBeCloseTo(0.25, 9);
  });

  test("all-zero weights don't divide by zero and blend to nothing", () => {
    const blended = blendYeastBlocks([new Map([[0, 1]])], [0]);
    expect(blended.size).toBe(0);
  });
});

// ── distance ─────────────────────────────────────────────────────────────────

describe("weightedDistance2", () => {
  test("continuous-only distance when yeast blocks are empty", () => {
    const qz = new Float64Array([0, 0]);
    const cz = new Float64Array([3, 4]);
    const d = weightedDistance2(qz, new Map(), 0, cz, new Map(), 0);
    expect(d).toBeCloseTo(25, 9); // 3^2 + 4^2, no yeast term
  });

  test("identical yeast class contributes 0 to the yeast term", () => {
    const qz = new Float64Array([0]);
    const cz = new Float64Array([0]);
    const block: Map<number, number> = new Map([[5, 1.0]]);
    const d = weightedDistance2(qz, block, 1, cz, block, 1, 3);
    expect(d).toBeCloseTo(0, 9);
  });

  test("mismatched classes cost the full weighted squared-distance between them", () => {
    const qz = new Float64Array([0]);
    const cz = new Float64Array([0]);
    const qy: Map<number, number> = new Map([[0, 1.0]]);
    const cy: Map<number, number> = new Map([[1, 1.0]]);
    // no overlap -> dot=0 -> yeast term = W^2 * (1 + 1 - 0) = 2*W^2
    const d = weightedDistance2(qz, qy, 1, cz, cy, 1, 3);
    expect(d).toBeCloseTo(2 * 9, 9);
  });

  test("is symmetric regardless of which side's sparse map is smaller", () => {
    const qz = new Float64Array([1, 2]);
    const cz = new Float64Array([4, 6]);
    const small: Map<number, number> = new Map([[0, 1]]);
    const large: Map<number, number> = new Map([[0, 0.5], [1, 1], [2, 0.5]]);
    const d1 = weightedDistance2(qz, small, yeastNorm2(small), cz, large, yeastNorm2(large), 3);
    const d2 = weightedDistance2(qz, large, yeastNorm2(large), cz, small, yeastNorm2(small), 3);
    expect(d1).toBeCloseTo(d2, 9);
  });
});

// ── k-NN selection ───────────────────────────────────────────────────────────

describe("kNearestByDistance", () => {
  test("finds the K smallest, ascending, correct indices", () => {
    const distances = new Float64Array([5, 1, 9, 3, 7, 0, 8]);
    const neighbors = kNearestByDistance(distances, 3);
    expect(neighbors.map((n) => n.index)).toEqual([5, 1, 3]); // values 0, 1, 3
    expect(neighbors.map((n) => n.distance)).toEqual([0, 1, 3]);
  });

  test("k larger than the candidate pool returns everything available", () => {
    const distances = new Float64Array([2, 1]);
    const neighbors = kNearestByDistance(distances, 5);
    expect(neighbors).toHaveLength(2);
  });

  test("handles duplicate distances without dropping candidates", () => {
    const distances = new Float64Array([1, 1, 1, 1]);
    const neighbors = kNearestByDistance(distances, 2);
    expect(neighbors).toHaveLength(2);
    expect(neighbors.every((n) => n.distance === 1)).toBe(true);
  });
});

// ── kernel weights ───────────────────────────────────────────────────────────

describe("kernelWeights", () => {
  test("weights sum to 1 and decrease monotonically with distance", () => {
    const weights = kernelWeights([0, 1, 2, 3]);
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeLessThan(weights[i - 1]);
  });

  test("all-equal distances get equal weight", () => {
    const weights = kernelWeights([4, 4, 4]);
    expect(weights[0]).toBeCloseTo(1 / 3, 9);
    expect(weights[1]).toBeCloseTo(1 / 3, 9);
    expect(weights[2]).toBeCloseTo(1 / 3, 9);
  });

  test("empty input returns empty output", () => {
    expect(kernelWeights([])).toEqual([]);
  });
});
