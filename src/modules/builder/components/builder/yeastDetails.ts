// Shared formatters + lookups for the new yeast enrichment fields.
// Used by both the YeastPresetModal hover preview and the StrainCard
// "Same strain / Substitute with" lines so the two surfaces always
// describe a strain the same way.

import type {
  YeastFlocculation,
  YeastPreset,
} from "@/modules/recipe/models/Presets";
import type { YeastType } from "@/modules/recipe/models/Recipe";

// Categories that ship exclusively/predominantly dry yeast — used only
// as the category-fallback when a preset has no `form` (legacy custom
// strains). Every shipped preset in our library carries `form`, so this
// is defensive.
const DRY_CATEGORY_HINTS = ["fermentis", "lallemand", "lalbrew", "mangrove"];

/**
 * Map a strain preset to its recommended packaging YeastType, used to
 * pre-fill the source chip on the StrainCard when a strain is pitched.
 * Authoritative on `preset.form` when present; falls back to the lab
 * name otherwise. Brewer can still override afterwards.
 */
export function inferDefaultYeastType(
  preset?: YeastPreset | null
): YeastType {
  if (preset?.form === "dry") return "dry";
  if (preset?.form === "liquid") return "liquid-100";
  const cat = (preset?.category ?? "").toLowerCase();
  if (DRY_CATEGORY_HINTS.some((c) => cat.includes(c))) return "dry";
  return "liquid-100";
}

const FLOC_LABEL: Record<YeastFlocculation, string> = {
  "very-low": "Very low",
  low: "Low",
  "medium-low": "Med-low",
  medium: "Medium",
  "medium-high": "Med-high",
  high: "High",
  "very-high": "Very high",
};

export function formatFlocculation(level?: YeastFlocculation | null): string | null {
  if (!level) return null;
  return FLOC_LABEL[level] ?? null;
}

export function formatTempRange(
  minC?: number | null,
  maxC?: number | null
): string | null {
  if (minC == null && maxC == null) return null;
  if (minC != null && maxC != null && minC !== maxC) {
    return `${Math.round(minC)}–${Math.round(maxC)}°C`;
  }
  const single = minC ?? maxC;
  return single != null ? `${Math.round(single)}°C` : null;
}

/**
 * Format the published attenuation range. Falls back to the headline
 * single value when no range is published; returns null when neither.
 */
export function formatAttenuationRange(
  minPct?: number | null,
  maxPct?: number | null,
  fallbackPct?: number | null
): string | null {
  const lo = minPct != null ? Math.round(minPct * 100) : null;
  const hi = maxPct != null ? Math.round(maxPct * 100) : null;
  if (lo != null && hi != null && lo !== hi) return `${lo}–${hi}%`;
  if (lo != null) return `${lo}%`;
  if (hi != null) return `${hi}%`;
  if (fallbackPct != null) return `${Math.round(fallbackPct * 100)}%`;
  return null;
}

const TYPE_LABEL: Record<NonNullable<YeastPreset["type"]>, string> = {
  ale: "Ale",
  lager: "Lager",
  kveik: "Kveik",
  wheat: "Wheat",
  brett: "Brett",
  wild: "Wild",
  bacteria: "Bacteria",
  blend: "Blend",
  wine: "Wine",
  other: "Other",
};

export function formatStrainType(t?: YeastPreset["type"] | null): string | null {
  if (!t) return null;
  return TYPE_LABEL[t] ?? null;
}

export function formatForm(f?: YeastPreset["form"] | null): string | null {
  if (!f) return null;
  return f === "liquid" ? "Liquid" : "Dry";
}

/**
 * Resolved peer/substitute entry. `preset` is null when the strain name
 * isn't carried in the live library (we still surface the name as text
 * so the brewer at least sees what to look for elsewhere).
 */
export type ResolvedYeastRef = {
  name: string;
  preset: YeastPreset | null;
};

/**
 * Other strains sharing this strain's strainGroup, excluding the strain
 * itself. Empty if the strain is a singleton or has no group assigned.
 *
 * `library` is whatever flat list of presets the caller has on hand
 * (typically the live yeast library or all grouped items flattened).
 */
export function findStrainPeers(
  preset: YeastPreset,
  library: YeastPreset[]
): YeastPreset[] {
  const group = preset.strainGroup;
  if (!group) return [];
  const peers: YeastPreset[] = [];
  for (const candidate of library) {
    if (candidate.strainGroup !== group) continue;
    if (candidate.name === preset.name) continue;
    peers.push(candidate);
  }
  return peers;
}

/**
 * Substitutes resolved against the live library. Each entry surfaces
 * its preset when present so the UI can wire a click → swap; otherwise
 * the name is shown as plain text.
 */
export function resolveSubstitutes(
  preset: YeastPreset,
  library: YeastPreset[]
): ResolvedYeastRef[] {
  if (!preset.substitutes || preset.substitutes.length === 0) return [];
  const byName = new Map<string, YeastPreset>();
  for (const p of library) byName.set(p.name, p);
  return preset.substitutes.map((name) => ({
    name,
    preset: byName.get(name) ?? null,
  }));
}

/**
 * Whether the preset carries enough enriched data to be worth showing
 * a hover/details panel for. Used to gate the YeastPresetModal preview
 * (sparse legacy entries fall back to the old plain-row behavior).
 */
export function hasYeastDetails(preset: YeastPreset): boolean {
  return Boolean(
    preset.type ||
      preset.form ||
      preset.tempMinC != null ||
      preset.tempMaxC != null ||
      preset.flocculation ||
      preset.attenuationMin != null ||
      preset.attenuationMax != null ||
      preset.alcoholTolerance != null ||
      preset.strainGroup ||
      (preset.substitutes && preset.substitutes.length > 0)
  );
}
