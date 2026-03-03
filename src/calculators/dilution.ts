/**
 * Wort dilution calculator — find how much water to add to hit a target OG.
 *
 * Gravity points are conserved when diluting:
 *   Current Volume × Current Points = Total Volume × Target Points
 *
 * Gravity "points" = (SG - 1) × 1000  e.g. 1.060 → 60
 */

export function gravityPoints(sg: number): number {
  return (sg - 1) * 1000;
}

/** Total volume needed to reach the target gravity. */
export function totalVolumeAtTarget(
  currentVolume: number,
  currentSG: number,
  targetSG: number,
): number {
  const currentPts = gravityPoints(currentSG);
  const targetPts = gravityPoints(targetSG);
  if (targetPts === 0) return Infinity;
  return (currentVolume * currentPts) / targetPts;
}

/** Volume of water to add to dilute to the target gravity. */
export function dilutionWater(
  currentVolume: number,
  currentSG: number,
  targetSG: number,
): number {
  return totalVolumeAtTarget(currentVolume, currentSG, targetSG) - currentVolume;
}
