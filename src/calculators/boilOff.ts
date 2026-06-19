/**
 * Sugar is conserved during the boil — only water evaporates.
 * Pre-boil Volume × Pre-boil Points = Post-boil Volume × Post-boil Points
 *
 * Gravity "points" = (SG - 1) × 1000  e.g. 1.042 → 42
 */

import { gravityPoints } from "./units";

export { gravityPoints };

/** Post-boil volume needed to hit a target OG. */
export function postBoilVolume(
  preBoilVol: number,
  preBoilSG: number,
  targetOG: number,
): number {
  const prePoints = gravityPoints(preBoilSG);
  const targetPoints = gravityPoints(targetOG);
  // No physical answer when the volume is non-positive or either gravity is at
  // or below water (points <= 0). Return NaN so callers — which guard on
  // Number.isFinite — never propagate a negative or Infinite "volume".
  if (!(preBoilVol > 0) || !(prePoints > 0) || !(targetPoints > 0)) return NaN;
  return (preBoilVol * prePoints) / targetPoints;
}
