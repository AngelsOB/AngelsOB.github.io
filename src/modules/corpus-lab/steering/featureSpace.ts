/**
 * Phase 2 — cloud feature-space math.
 *
 * Pure vector logic shared by every query the steering engine runs: the same
 * 23 z-scored continuous dims + weighted yeast multi-hot block validated in
 * `offline/neighborPurity.test.ts` (W≈3 is the tuned sweet spot — see
 * docs/corpus-lab-build.md §5-7). No corpus/cloud I/O here — see `loadCloud.ts`.
 */

/** One persisted cloud record (see `offline/cloudViz.test.ts` for the writer). */
export type CloudRecord = {
  id: number;
  s: string; // style (raw corpus string)
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  mb: number; // maltBody
  m: number[]; // 9 malt flavour axes, MALT_FLAVOR_KEYS order
  h: number[]; // 9 hop flavour axes, HOP_FLAVOR_KEYS order
  g: Record<string, number>; // grist archetype -> % of grist
  hp: Array<[name: string, gpl: number, type: string, timeMin: number]>;
  yc: string | null; // own yeast base class (strainGroup or solo:key)
  ys: string[]; // substitute base classes
  yn: string | null; // yeast preset name, for reconstruction
  srb?: boolean; // souring: Brett detected in yeast/other text
  srl?: boolean; // souring: Lacto/Pedio detected
};

/** The subset of fields needed to place a point in the 23-dim continuous space. */
export type ContinuousFeatures = {
  m: number[]; // 9
  h: number[]; // 9
  og: number;
  ibu: number;
  srm: number;
  mb: number;
};

export const CONTINUOUS_DIMS = 23;

/** gravity "points" = (OG-1)*1000 — matches the rest of the app's GU convention. */
export function gravityPoints(og: number): number {
  return (og - 1) * 1000;
}

/**
 * The fixed 23-dim row layout: [9 malt axes, 9 hop axes, gravity, ibu, srm,
 * buGu, maltBody]. Positional and axis-name-agnostic on purpose — callers own
 * the MALT_FLAVOR_KEYS/HOP_FLAVOR_KEYS ordering when they build `m`/`h`.
 */
export function continuousRow(f: ContinuousFeatures): number[] {
  const grav = gravityPoints(f.og);
  const buGu = grav > 0 ? f.ibu / grav : 0;
  return [...f.m, ...f.h, grav, f.ibu, f.srm, buGu, f.mb];
}

export type Stats = { mean: number[]; std: number[] };

/** Per-dimension mean over a set of equal-length rows (e.g. a style-family centroid). */
export function componentwiseMean(rows: number[][]): number[] {
  const D = rows[0]?.length ?? 0;
  const mean = new Array(D).fill(0);
  for (const r of rows) for (let j = 0; j < D; j++) mean[j] += r[j];
  for (let j = 0; j < D; j++) mean[j] /= rows.length || 1;
  return mean;
}

/** Per-dimension mean/std over a set of rows (population std, floor 1 to avoid div-by-0). */
export function computeStats(rows: number[][]): Stats {
  const D = rows[0]?.length ?? 0;
  const mean = componentwiseMean(rows);
  const std = new Array(D).fill(0);
  for (const r of rows) for (let j = 0; j < D; j++) { const d = r[j] - mean[j]; std[j] += d * d; }
  for (let j = 0; j < D; j++) std[j] = Math.sqrt(std[j] / (rows.length || 1)) || 1;
  return { mean, std };
}

export function zScore(row: number[], stats: Stats): Float64Array {
  const D = row.length;
  const z = new Float64Array(D);
  for (let j = 0; j < D; j++) z[j] = (row[j] - stats.mean[j]) / stats.std[j];
  return z;
}

// ── Yeast multi-hot block ────────────────────────────────────────────────────

export const YEAST_OWN_WEIGHT = 1.0;
export const YEAST_SUB_WEIGHT = 0.5;
/** Tuned sweet spot from the purity sweep (docs/corpus-lab-build.md §7). */
export const YEAST_BLOCK_WEIGHT = 3;

export type YeastVocab = {
  index: Map<string, number>;
  brettIdx: number;
  lactoIdx: number;
  size: number;
};

/** Top-N base classes by usage frequency, + dedicated __brett/__lacto dims. */
export function buildYeastVocab(cloud: CloudRecord[], topN = 40): YeastVocab {
  const counts = new Map<string, number>();
  for (const r of cloud) if (r.yc) counts.set(r.yc, (counts.get(r.yc) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  const index = new Map<string, number>(top.map(([cls], i) => [cls, i]));
  const brettIdx = index.size;
  index.set("__brett", brettIdx);
  const lactoIdx = index.size;
  index.set("__lacto", lactoIdx);
  return { index, brettIdx, lactoIdx, size: index.size };
}

/** A sparse yeast-block vector: vocab index -> weight. */
export type YeastBlock = Map<number, number>;

/** Squared L2 norm of a sparse block (shared by candidates and blended queries). */
export function yeastNorm2(block: YeastBlock): number {
  let n2 = 0;
  for (const w of block.values()) n2 += w * w;
  return n2;
}

/**
 * Build the sparse multi-hot block for one class assignment (a cloud record,
 * or a query locked to a specific yeast). Unknown classes (not in vocab, e.g.
 * long-tail base classes past the top-40) are silently dropped — same
 * defensive behaviour as the hop/malt aggregators skipping unknown names.
 */
export function yeastBlockFromClass(
  cls: { yc: string | null; ys: string[]; srb?: boolean; srl?: boolean },
  vocab: YeastVocab,
): YeastBlock {
  const block: YeastBlock = new Map();
  if (cls.yc && vocab.index.has(cls.yc)) block.set(vocab.index.get(cls.yc)!, YEAST_OWN_WEIGHT);
  for (const s of cls.ys) {
    if (!vocab.index.has(s)) continue;
    const idx = vocab.index.get(s)!;
    if (!block.has(idx)) block.set(idx, YEAST_SUB_WEIGHT);
  }
  if (cls.srb) block.set(vocab.brettIdx, YEAST_OWN_WEIGHT);
  if (cls.srl) block.set(vocab.lactoIdx, YEAST_OWN_WEIGHT);
  return block;
}

/** Weighted average of several sparse blocks (e.g. a style family's soft yeast centroid). */
export function blendYeastBlocks(blocks: YeastBlock[], weights: number[]): YeastBlock {
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const blended: YeastBlock = new Map();
  for (let i = 0; i < blocks.length; i++) {
    const w = weights[i] / totalWeight;
    if (w <= 0) continue;
    for (const [idx, val] of blocks[i]) blended.set(idx, (blended.get(idx) ?? 0) + val * w);
  }
  return blended;
}

/**
 * Squared weighted distance between a query and a candidate: the 23
 * z-scored continuous dims plus the yeast block scaled by `blockWeight²`
 * (weighted directly, not z-scored — see docs/corpus-lab-build.md §5).
 */
export function weightedDistance2(
  queryZ: Float64Array,
  queryYeast: YeastBlock,
  queryYeastNorm2: number,
  candidateZ: Float64Array,
  candidateYeast: YeastBlock,
  candidateYeastNorm2: number,
  blockWeight: number = YEAST_BLOCK_WEIGHT,
): number {
  let d = 0;
  for (let j = 0; j < queryZ.length; j++) {
    const diff = queryZ[j] - candidateZ[j];
    d += diff * diff;
  }
  const w2 = blockWeight * blockWeight;
  if (w2 > 0) {
    let dot = 0;
    const [small, large] = queryYeast.size <= candidateYeast.size
      ? [queryYeast, candidateYeast]
      : [candidateYeast, queryYeast];
    for (const [k, w] of small) {
      const ow = large.get(k);
      if (ow) dot += w * ow;
    }
    d += w2 * (queryYeastNorm2 + candidateYeastNorm2 - 2 * dot);
  }
  return d;
}

export type Neighbor = { index: number; distance: number };

/**
 * The K candidates (by index into `distances`) with the smallest distance,
 * ascending. O(N*K) "track the current worst of K" selection — fine for K in
 * the tens against the full ~149k cloud (mirrors neighborPurity.test.ts).
 */
export function kNearestByDistance(distances: Float64Array, k: number): Neighbor[] {
  const kd = new Float64Array(k).fill(Infinity);
  const ki = new Int32Array(k).fill(-1);
  let worst = Infinity;
  let worstSlot = 0;
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i];
    if (d < worst) {
      kd[worstSlot] = d;
      ki[worstSlot] = i;
      worst = -1;
      for (let s = 0; s < k; s++) {
        if (kd[s] > worst) { worst = kd[s]; worstSlot = s; }
      }
    }
  }
  const out: Neighbor[] = [];
  for (let s = 0; s < k; s++) if (ki[s] >= 0) out.push({ index: ki[s], distance: kd[s] });
  out.sort((a, b) => a.distance - b.distance);
  return out;
}

/**
 * Gaussian kernel weights from distances, normalised to sum to 1. Bandwidth
 * defaults to the mean distance in the set ("sharp kernel" per
 * docs/corpus-lab-build.md §6 — the closest neighbours dominate the average).
 */
export function kernelWeights(distances: number[]): number[] {
  if (distances.length === 0) return [];
  const bandwidth = distances.reduce((a, b) => a + b, 0) / distances.length || 1;
  const raw = distances.map((d) => Math.exp(-d / bandwidth));
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / total);
}
