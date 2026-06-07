// Shared formatters + lookups for the hop hover preview surfaces.
// Mirrors `yeastDetails.ts` — keeps the hop hover surfaces (picker
// modal + builder rows) reading the same single source of truth.

import type {
  HopFlavorProfile,
  HopPreset,
} from "@/modules/beta-builder/domain/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/beta-builder/domain/models/Presets";

/**
 * Cosine similarity between two HopFlavorProfile vectors. Returns
 * 1.0 for identical direction, 0 for orthogonal, -1 for opposite —
 * though our axes are all ≥0 so the realistic range is [0, 1].
 *
 * Missing axes default to 0. Returns 0 when either vector has zero
 * magnitude (no usable signal to compare).
 */
export function cosineFlavor(
  a: HopFlavorProfile,
  b: HopFlavorProfile
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k of HOP_FLAVOR_KEYS) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** 1.0 at zero diff, falls linearly to 0 at `falloff` diff. Used by
 *  the similar-hops weighting so close-on-alpha gets full credit. */
function diffScore(diff: number, falloff: number): number {
  if (!Number.isFinite(diff)) return 0;
  return Math.max(0, 1 - Math.abs(diff) / falloff);
}

export type SimilarHop = {
  hop: HopPreset;
  /** Composite similarity in [0, 1]. Combines flavor cosine with
   *  alpha-acid + oil proximity — see `findSimilarHops` for weights. */
  score: number;
  /** Raw cosine component, useful for diagnostics / future UI. */
  flavorScore: number;
};

/**
 * Top-N hops most similar to `source`, scored on a weighted blend of:
 *   • flavor cosine (75%)    — primary; matches aroma/taste character
 *   • alpha-acid proximity (17%) — so a 12% Citra → 13% Mosaic ranks
 *                                  above a 4% Hallertau even when the
 *                                  noble's tropical-vibes happen to match
 *   • oil-total proximity (8%)   — bolder-aroma vs. delicate matters too
 *
 * Weights renormalize when a candidate is missing alpha or oil data,
 * so a flavor-only match still scores cleanly (just on the flavor
 * component). Source self + flavor-less library entries excluded.
 *
 * Tuned for the brewer's actual question: "what tastes like this AND
 * can I swap it in without re-tooling the bittering schedule?"
 */
export function findSimilarHops(
  source: HopPreset,
  library: HopPreset[],
  limit = 8
): SimilarHop[] {
  if (!source.flavor) return [];
  const scored: SimilarHop[] = [];

  const FLAVOR_W = 0.75;
  const ALPHA_W = 0.17;
  const OIL_W = 0.08;
  // Hops within ~3% AA of each other are interchangeable for bittering
  // (one weight tweak away). Beyond ~8% AA the punch is meaningfully
  // different. Same shape for oil: ~2 mL/100g spans dainty→bold.
  const ALPHA_FALLOFF = 8;
  const OIL_FALLOFF = 2;

  for (const candidate of library) {
    if (!candidate.flavor) continue;
    if (candidate.name === source.name) continue;
    const flavor = cosineFlavor(source.flavor, candidate.flavor);

    let num = FLAVOR_W * flavor;
    let denom = FLAVOR_W;

    if (
      source.alphaAcidPercent != null &&
      candidate.alphaAcidPercent != null
    ) {
      const alpha = diffScore(
        source.alphaAcidPercent - candidate.alphaAcidPercent,
        ALPHA_FALLOFF
      );
      num += ALPHA_W * alpha;
      denom += ALPHA_W;
    }

    if (
      source.oilTotalMlPer100g != null &&
      candidate.oilTotalMlPer100g != null
    ) {
      const oil = diffScore(
        source.oilTotalMlPer100g - candidate.oilTotalMlPer100g,
        OIL_FALLOFF
      );
      num += OIL_W * oil;
      denom += OIL_W;
    }

    scored.push({
      hop: candidate,
      score: denom > 0 ? num / denom : flavor,
      flavorScore: flavor,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Whether this hop carries enough enrichment to bother showing the
 * hover preview. Hops without a flavor vector get only the row's
 * default behavior (no preview surface).
 */
export function hasHopDetails(preset: HopPreset): boolean {
  return Boolean(preset.flavor);
}

// ─── Display formatters ────────────────────────────────────────────

/** "11.0–14.0%" range, or "12.5%" point fallback, or null. Uses one
 *  decimal because growers publish hop AA to 0.1% precision. */
export function formatAlphaRange(preset: HopPreset): string | null {
  const lo = preset.alphaLow;
  const hi = preset.alphaHigh;
  if (lo != null && hi != null && lo !== hi) {
    return `${lo.toFixed(1)}–${hi.toFixed(1)}%`;
  }
  const single = lo ?? hi ?? preset.alphaAcidPercent;
  return single != null ? `${single.toFixed(1)}%` : null;
}

/** "3.0–5.0%" beta-acid range, or "3.5%" point, or null. */
export function formatBetaRange(preset: HopPreset): string | null {
  const lo = preset.betaLow;
  const hi = preset.betaHigh;
  if (lo != null && hi != null && lo !== hi) {
    return `${lo.toFixed(1)}–${hi.toFixed(1)}%`;
  }
  const single = lo ?? hi ?? preset.betaAcidPercent;
  return single != null ? `${single.toFixed(1)}%` : null;
}

/** "2.4 mL/100g" — total essential oil content, the bulk indicator of
 *  aroma intensity. <1 reads as delicate, 2-3 standard, >3 punchy. */
export function formatOilTotal(preset: HopPreset): string | null {
  const v = preset.oilTotalMlPer100g;
  return v != null ? `${v.toFixed(1)} mL/100g` : null;
}

/** "22%" — cohumulone share of the alpha pool. Low = smoother
 *  bitterness (nobles ~20%), high = harsher (some C-hops ~40%). */
export function formatCohumulone(preset: HopPreset): string | null {
  const v = preset.cohumulonePercent;
  return v != null ? `${Math.round(v)}%` : null;
}

/** "2.4 : 1" alpha-to-beta ratio. Dictates how bitterness ages — 1:1
 *  is common in aroma hops, higher ratios are bitter-leaning. Uses the
 *  point alpha/beta values; returns null if either is missing. */
export function formatAlphaBetaRatio(preset: HopPreset): string | null {
  const a = preset.alphaAcidPercent;
  const b = preset.betaAcidPercent;
  if (a == null || b == null || b <= 0) return null;
  return `${(a / b).toFixed(1)} : 1`;
}
