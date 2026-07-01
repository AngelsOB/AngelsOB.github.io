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

/** Round a raw p99 ceiling up to a tidy radar max (nearest 0.5, floor 1). */
export const niceMax = (v: number) => Math.max(1, Math.ceil(v * 2) / 2);

/** Attach each axis's own display ceiling — live engine axisMax if present, else the audited fallback. */
export function axesWithMax(
  axes: FlavorAxis[],
  live: Record<string, number> | undefined,
  fallback: Record<string, number>,
): FlavorAxis[] {
  return axes.map((a) => ({ ...a, max: niceMax(live?.[a.key] ?? fallback[a.key] ?? 5) }));
}
