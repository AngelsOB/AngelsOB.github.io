/**
 * Sugar is conserved during the boil — only water evaporates.
 * Pre-boil Volume × Pre-boil Points = Post-boil Volume × Post-boil Points
 *
 * Gravity "points" = (SG - 1) × 1000  e.g. 1.042 → 42
 */

export function gravityPoints(sg: number): number {
  return (sg - 1) * 1000;
}

/** Post-boil volume needed to hit a target OG. */
export function postBoilVolume(
  preBoilVol: number,
  preBoilSG: number,
  targetOG: number,
): number {
  const prePoints = gravityPoints(preBoilSG);
  const targetPoints = gravityPoints(targetOG);
  if (targetPoints === 0) return Infinity;
  return (preBoilVol * prePoints) / targetPoints;
}
