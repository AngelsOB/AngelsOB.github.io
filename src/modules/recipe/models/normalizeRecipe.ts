import type { Recipe } from "./Recipe";

/** Legacy equipment field names this normalizer knows how to migrate. */
type LegacyEquipment = {
  /** Renamed June 2026 → brewhouseEfficiencyPercent. */
  mashEfficiencyPercent?: number;
};

/**
 * Normalize a recipe loaded from storage or an import so legacy documents keep
 * working after field renames. Pure and server-safe (no browser deps) — call it
 * at every deserialization boundary (Firestore loads, public-recipe fetch,
 * version snapshots, file imports).
 *
 * Migrations applied:
 *  - equipment.mashEfficiencyPercent → equipment.brewhouseEfficiencyPercent
 *    (renamed June 2026; the field was always used as brewhouse efficiency —
 *    OG referenced to post-boil/fermenter volume). Once all stored docs are
 *    backfilled, this mapping (and the call sites) can be removed.
 */
export function normalizeRecipe(raw: Recipe): Recipe {
  const eq = raw.equipment as (Recipe["equipment"] & LegacyEquipment) | undefined;

  if (
    eq &&
    eq.brewhouseEfficiencyPercent == null &&
    typeof eq.mashEfficiencyPercent === "number"
  ) {
    return {
      ...raw,
      equipment: {
        ...eq,
        brewhouseEfficiencyPercent: eq.mashEfficiencyPercent,
      },
    };
  }

  return raw;
}
