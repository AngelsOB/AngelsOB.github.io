/**
 * SRM to OKLCH Mapping
 *
 * Maps SRM (Standard Reference Method) beer color values to OKLCH parameters
 * for the Reactive theme palette. Uses piecewise linear interpolation.
 *
 * Strategy: Keep hue in a tight warm range (65→48) so it always looks like
 * amber/copper. Drive visual difference primarily through chroma (saturation)
 * and lightness — pale ales are bright and vibrant, stouts are dark and muted.
 */

const HUE_STOPS: [number, number][] = [
  [1, 65],   // pale straw — warm golden
  [5, 62],   // gold
  [10, 58],  // deep gold
  [15, 55],  // amber
  [20, 52],  // copper
  [28, 50],  // deep brown
  [35, 49],  // very dark
  [40, 48],  // black — deep warm
];

export function srmToOklchHue(srm: number): number {
  const clamped = Math.max(1, Math.min(40, srm));

  for (let i = 0; i < HUE_STOPS.length - 1; i++) {
    const [srmLow, hueLow] = HUE_STOPS[i];
    const [srmHigh, hueHigh] = HUE_STOPS[i + 1];
    if (clamped >= srmLow && clamped <= srmHigh) {
      const t = (clamped - srmLow) / (srmHigh - srmLow);
      return hueLow + (hueHigh - hueLow) * t;
    }
  }

  return 48;
}

/**
 * Chroma scale: always 1.0. Full vibrancy at every SRM.
 */
export function srmToOklchChromaScale(_srm: number): number {
  return 1.0;
}

/**
 * Background chroma boost: tints backgrounds towards the palette accent colour.
 * `floor` = minimum chroma scale even for pale beers (prevents grey wash when
 * bg lightness is shifted). `boost` = maximum scale for stouts.
 * Background base chroma is very low (~0.007–0.013), so 2–5× multipliers
 * create subtle but visible warm/cool tints rather than pure grey.
 */
export function srmToBgChromaScale(
  srm: number,
  boost = 5.0,
  floor = 2.0,
): number {
  if (srm <= 4) return floor;
  if (srm >= 35) return boost;
  return floor + ((srm - 4) / 31) * (boost - floor);
}

/**
 * Lightness scale: configurable per palette.
 * `bright` = scale for very pale beers (SRM ≤ 4), `dark` = scale for stouts (SRM ≥ 35).
 * Linear interpolation between them. Default range: 1.15 → 0.6.
 */
export function srmToOklchLightnessScale(
  srm: number,
  bright = 1.15,
  dark = 0.6,
): number {
  if (srm <= 4) return bright;
  if (srm >= 35) return dark;
  return bright - ((srm - 4) / 31) * (bright - dark);
}
