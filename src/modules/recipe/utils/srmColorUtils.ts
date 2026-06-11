/**
 * SRM Color Utilities
 *
 * Utilities for converting SRM (Standard Reference Method) color values
 * to RGB colors for visual display.
 */

/**
 * Convert SRM color value to RGB string
 * Based on SRM color approximations from brewing literature
 */
export function srmToRgb(srm: number): string {
  // Clamp SRM value to reasonable range
  const clampedSrm = Math.max(1, Math.min(40, srm));

  // SRM to RGB approximation using polynomial fit
  // These values are based on the Morey SRM color chart
  const srmColors: Record<number, [number, number, number]> = {
    1: [255, 230, 153],
    2: [255, 216, 120],
    3: [255, 202, 90],
    4: [255, 191, 66],
    5: [251, 177, 35],
    6: [248, 166, 0],
    7: [243, 156, 0],
    8: [234, 143, 0],
    9: [229, 133, 0],
    10: [222, 124, 0],
    12: [205, 104, 0],
    14: [187, 85, 0],
    16: [173, 71, 0],
    18: [160, 58, 0],
    20: [149, 48, 0],
    24: [122, 25, 0],
    28: [105, 13, 0],
    32: [92, 6, 0],
    36: [80, 2, 0],
    40: [68, 0, 0],
  };

  // Find the two nearest SRM values for interpolation
  const srmKeys = Object.keys(srmColors).map(Number).sort((a, b) => a - b);
  let lower = srmKeys[0];
  let upper = srmKeys[srmKeys.length - 1];

  for (let i = 0; i < srmKeys.length - 1; i++) {
    if (clampedSrm >= srmKeys[i] && clampedSrm <= srmKeys[i + 1]) {
      lower = srmKeys[i];
      upper = srmKeys[i + 1];
      break;
    }
  }

  // Interpolate between the two colors
  const t = (clampedSrm - lower) / (upper - lower);
  const [r1, g1, b1] = srmColors[lower];
  const [r2, g2, b2] = srmColors[upper];

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `rgb(${r}, ${g}, ${b})`;
}
