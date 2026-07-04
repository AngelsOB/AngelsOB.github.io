// Flavour-wheel axis definitions for the Brew Studio steering UI.
//
// The key order mirrors HOP_FLAVOR_KEYS (Presets.ts) and MALT_FLAVOR_KEYS
// (corpus-lab/maltFlavor.ts) — the same order the engine's radar vectors use.
// Only TYPES are pulled from corpus-lab here (maltFlavor); the runtime engine
// stays behind the /api/lab/steering route, per docs/corpus-lab-build.md.

import type { HopFlavorProfile } from "@/modules/recipe/models/Presets";
import type { MaltFlavorProfile } from "@/modules/corpus-lab/maltFlavor";

export type HopKey = keyof HopFlavorProfile;
export type MaltKey = keyof MaltFlavorProfile;

export type FlavorAxis = { key: string; label: string; color: string; max?: number };

// Per-axis label colours are the flavour's own identity colour, not an HS
// token — a citrus axis reads as citrus. They sit on labels only; the wheel's
// structural chrome (rings, spokes, handles) is pure HS ink.
export const HOP_AXES: FlavorAxis[] = [
  { key: "citrus", label: "Citrus", color: "#e0a419" },
  { key: "tropicalFruit", label: "Tropical", color: "#e07b2e" },
  { key: "stoneFruit", label: "Stone", color: "#dd6a1f" },
  { key: "berry", label: "Berry", color: "#9a4bc4" },
  { key: "floral", label: "Floral", color: "#d9558f" },
  { key: "grassy", label: "Grassy", color: "#6f9e2e" },
  { key: "herbal", label: "Herbal", color: "#2f9e5b" },
  { key: "spice", label: "Spice", color: "#cf3f2f" },
  { key: "resinPine", label: "Resin", color: "#2b7a3e" },
];

export const MALT_AXES: FlavorAxis[] = [
  { key: "grainy", label: "Grainy", color: "#c99a2e" },
  { key: "biscuit", label: "Biscuit", color: "#b9781f" },
  { key: "caramel", label: "Caramel", color: "#cf8f1a" },
  { key: "darkFruit", label: "Dark fruit", color: "#8a4bb0" },
  { key: "chocolate", label: "Chocolate", color: "#6b3410" },
  { key: "coffee", label: "Coffee", color: "#4a4038" },
  { key: "roast", label: "Roast", color: "#241c16" },
  { key: "nutty", label: "Nutty", color: "#9a5a1f" },
  { key: "honey", label: "Honey", color: "#d9a531" },
];

// Fallback per-axis ceilings (cloud p99 audit, rounded) used before the live
// axisMax arrives from the engine. Malt axes are heavily compressed — a shared
// 0-5 radar would squash every malt polygon into a tiny centre blob.
export const DEFAULT_HOP_MAX: Record<string, number> = {
  citrus: 5, tropicalFruit: 4.5, stoneFruit: 3, berry: 3, floral: 3.5, spice: 3, herbal: 3, grassy: 2, resinPine: 4,
};
export const DEFAULT_MALT_MAX: Record<string, number> = {
  grainy: 1.5, biscuit: 2.5, caramel: 2.5, darkFruit: 2, chocolate: 2.5, coffee: 2.5, roast: 2.5, nutty: 1.5, honey: 2,
};

/**
 * How far past the rim a wheel lets a value go — the "off the charts" push zone.
 * The rim is each axis's typical ceiling (`axisMax`); a deliberate push can run
 * out to `axisMax × PUSH_HEADROOM`, which is exactly `axisDialMax` — the extreme
 * residual correction (#3) can actually reach. Mirrors the engine's
 * AXIS_DIAL_HEADROOM so the wheel never lets you ask for more than #3 can hit.
 */
export const PUSH_HEADROOM = 1.25;

/**
 * Attach each axis's own rim ceiling — the live engine `axisMax` (p99 of real
 * recipes) if present, else the audited fallback. NOT rounded up: the rim is the
 * RAW p99 so a strong-but-normal recipe reaches the rim (fills the radar) and a
 * push runs a consistent PUSH_HEADROOM past it. Rounding to the nearest 0.5 used
 * to inflate the rim (citrus 4.67→5.0), which both under-filled typical recipes
 * and ate the "off the charts" overflow so pushes never visibly cleared the rim.
 * Floored at 1 to guard a dead/tiny axis (div-by-zero in the wheel's scaling).
 */
export function axesWithMax(
  axes: FlavorAxis[],
  live: Record<string, number> | undefined,
  fallback: Record<string, number>,
): FlavorAxis[] {
  return axes.map((a) => ({ ...a, max: Math.max(1, live?.[a.key] ?? fallback[a.key] ?? 5) }));
}
