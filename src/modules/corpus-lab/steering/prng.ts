/**
 * Tiny seeded PRNG, so "give me a different recipe" (a variation seed) and
 * "how adventurous" (exploration) can shuffle which of the neighbourhood's real
 * ingredients get picked WITHOUT breaking the engine's two guarantees:
 *   - reproducible: same query + same seed -> byte-identical recipe (no
 *     random-on-refresh), and
 *   - never invents: exploration only ever re-samples candidates that real
 *     neighbours used, so it still can't hallucinate an ingredient.
 *
 * mulberry32 is a well-known 32-bit generator — fast, good enough for picking
 * between a handful of candidates, and fully deterministic from its seed.
 */

/** Fold any label(s) into a stable 32-bit seed (FNV-1a), so each pick slot draws its own independent stream. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261 >>> 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Choose `count` candidates from a scored list.
 *
 * `exploration = 0` (or fewer candidates than `count`) is a plain top-N by
 * score — deterministic, identical to picking the winners outright. Above 0 it
 * becomes a seeded weighted sample that can reach PAST the most-popular option,
 * but stays sane:
 *   - only candidates within `exploration` of the top score are eligible (so a
 *     landslide winner isn't traded for a no-hoper), and
 *   - eligible candidates are weighted by `score^(1/exploration)`, so the top is
 *     still favoured — the higher exploration climbs, the flatter that gets.
 * If more than the eligible pool is needed, the remainder fills in by score.
 */
export function selectExplored<T extends { score: number }>(
  candidates: T[],
  count: number,
  exploration: number,
  rng: () => number,
): T[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  if (exploration <= 0 || sorted.length <= count) return sorted.slice(0, count);

  const top = sorted[0].score;
  const floor = top * (1 - Math.min(1, exploration));
  const gamma = 1 / Math.max(exploration, 0.05);
  const pool = sorted.filter((c) => c.score >= floor && c.score > 0);
  const belowFloor = sorted.filter((c) => !(c.score >= floor && c.score > 0));

  const chosen: T[] = [];
  const work = [...pool];
  while (chosen.length < count && work.length > 0) {
    const weights = work.map((c) => Math.pow(c.score, gamma));
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;
    let r = rng() * totalW;
    let idx = work.length - 1;
    for (let i = 0; i < work.length; i++) {
      r -= weights[i];
      if (r <= 0) { idx = i; break; }
    }
    chosen.push(work[idx]);
    work.splice(idx, 1);
  }
  for (const c of belowFloor) {
    if (chosen.length >= count) break;
    chosen.push(c);
  }
  return chosen.sort((a, b) => b.score - a.score);
}
