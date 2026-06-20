/**
 * Glue between a ParsedRecipeDraft (deterministic text parser OR the AI
 * cleanup endpoint) and the existing import pipeline. Produces the same
 * { recipe, pendingMatches } shape as BeerXmlImportService so the review
 * modal and commit flow are reused untouched.
 *
 * Unlike BeerXML, pasted text rarely carries numerics (color, ppg, alpha,
 * attenuation) — those are sourced from the matched preset. We use the BEST
 * candidate's numerics even when the match isn't auto-accepted so the recipe
 * calculates sensibly; the review modal then lets the user re-point the name,
 * and applyResolutions here re-sources the numerics from the chosen preset
 * (BeerXML's applyResolutions only patches the name, because its numerics
 * came from the XML).
 */

import type { Recipe, Fermentable, Hop, Yeast } from '../models/Recipe';
import { uid } from '@/utils/uid';
import { round } from '@/utils/round';
import { hopEnrichmentService } from './HopEnrichmentService';
import { recipeCalculationService } from './RecipeCalculationService';
import {
  matchGrain,
  matchHop,
  matchYeast,
} from '@/utils/ingredientMatching';
import { matchBjcpStyle } from '@/utils/bjcpMatching';
import { getGrainPresets, HOP_PRESETS, YEAST_PRESETS, type GrainPreset } from '@/utils/presets';
import { getFermentability, inferFermentability } from '../data/fermentablePresets';
import { resolveCanonicalGrain } from '../data/canonicalGrains';
import type {
  BeerXmlImportResult,
  PendingMatch,
  MatchResolution,
} from './BeerXmlImportService';
import type { ParsedRecipeDraft } from './recipeTextParser';

/**
 * Process values surfaced for user confirmation in the import review modal.
 * Pre-filled from the parsed recipe (vitalsFromRecipe), edited by the user,
 * applied back via applyVitals before commit.
 */
export type ImportVitals = {
  batchVolumeL: number;
  boilTimeMin: number;
  efficiencyPercent: number;
  mashSteps: { temperatureC: number; durationMinutes: number }[];
  fermentTempC: number;
  fermentDays: number;
};

/**
 * Per-ingredient amount edits from the review sheet, keyed by ingredient id.
 * timeMinutes routes to boil/first-wort time or whirlpool stand time based
 * on the hop's type.
 */
export type ImportAmountEdits = Record<
  string,
  { weightKg?: number; grams?: number; timeMinutes?: number; dryHopDays?: number }
>;

/** Everything the review sheet can change besides match resolutions + vitals. */
export type ImportSheetEdits = {
  /** Recipe title (editable in the sheet). */
  name: string;
  amounts: ImportAmountEdits;
  /** Ingredients the user denied — removed before commit. */
  removedIngredientIds: string[];
};

/** Look up a preset by exact name. Shared across hop/grain/yeast resolution. */
function getPreset<T extends { name: string }>(presets: T[], name: string): T | undefined {
  return presets.find((p) => p.name === name);
}

/** Name a mash rest: a single rest is "Saccharification", else "Step N". */
const mashStepName = (index: number, total: number): string =>
  total === 1 ? 'Saccharification' : `Step ${index + 1}`;

/** Default total grist when a percentage bill gives us nothing to anchor on: ~5 kg per 20 L. */
const DEFAULT_GRIST_KG_PER_L = 0.25;

/** getFermentability wants the models/Presets shape where `type` is required. */
const grainFermentability = (preset: GrainPreset): number =>
  getFermentability({ ...preset, type: preset.type ?? 'grain' });

/**
 * Grain matching for pasted text. Books word grains in ways fuzzy matching
 * alone can't bridge ("45°L crystal malt"), so when the raw name doesn't
 * auto-accept we retry through the canonical grain table ("Crystal 45L"),
 * and as a last resort against the generic US caramel series
 * ("Caramel / Crystal 80L" — there's no bare "Crystal 80L" preset).
 */
function matchGrainWithCanonicalFallback(rawName: string) {
  let match = matchGrain(rawName);
  if (match.autoAccept) return match;

  const { canonical } = resolveCanonicalGrain(rawName);
  if (canonical !== rawName) {
    const viaCanonical = matchGrain(canonical);
    if (
      viaCanonical.autoAccept ||
      (viaCanonical.best?.score ?? 0) > (match.best?.score ?? 0)
    ) {
      match = viaCanonical;
    }
  }
  if (!match.autoAccept) {
    const generic = canonical.match(/^Crystal (\d+)L$/i);
    if (generic) {
      const viaGeneric = matchGrain(`Caramel / Crystal ${generic[1]}L`);
      if (viaGeneric.autoAccept) match = viaGeneric;
    }
  }
  return match;
}

class TextRecipeImportService {
  fromDraft(draft: ParsedRecipeDraft): BeerXmlImportResult {
    const now = new Date().toISOString();
    const pendingMatches: PendingMatch[] = [];

    // Style — same flow as BeerXML import.
    let resolvedStyle = draft.style;
    if (draft.style) {
      const styleMatch = matchBjcpStyle(draft.style);
      if (styleMatch.autoAccept && styleMatch.canonical) {
        resolvedStyle = styleMatch.canonical;
      } else if (styleMatch.best) {
        pendingMatches.push({
          kind: 'style',
          imported: draft.style,
          best: styleMatch.best,
          candidates: styleMatch.candidates,
          reason: styleMatch.reason,
        });
      }
    }

    const fermentables: Fermentable[] = draft.fermentables.map((item) => {
      const id = uid();
      const match = matchGrainWithCanonicalFallback(item.rawName);
      const preset = match.best?.preset ?? null;
      const name = match.autoAccept && match.best ? match.best.presetName : item.rawName;
      if (!match.autoAccept && match.best) {
        pendingMatches.push({
          kind: 'grain',
          ingredientId: id,
          imported: item.rawName,
          best: match.best,
          candidates: match.candidates,
          reason: match.reason,
        });
      }
      const colorLovibond = preset?.colorLovibond ?? 2;
      return {
        id,
        name,
        weightKg: item.weightKg ?? 0, // percentage bills resolved below
        colorLovibond,
        ppg: preset?.potentialGu ?? 36,
        efficiencyPercent:
          preset && (preset.type === 'extract' || preset.type === 'sugar')
            ? 100
            : draft.efficiencyPercent ?? 75,
        originCode: preset?.originCode,
        fermentability: preset
          ? grainFermentability(preset)
          : inferFermentability({ name: item.rawName, colorLovibond }),
      };
    });

    const hops: Hop[] = draft.hops.map((item) => {
      const id = uid();
      const match = matchHop(item.rawName);
      const preset = match.best?.preset ?? null;
      const name = match.autoAccept && match.best ? match.best.presetName : item.rawName;
      if (!match.autoAccept && match.best) {
        pendingMatches.push({
          kind: 'hop',
          ingredientId: id,
          imported: item.rawName,
          best: match.best,
          candidates: match.candidates,
          reason: match.reason,
        });
      }
      return hopEnrichmentService.enrichHop({
        id,
        name,
        alphaAcid: item.alphaAcid ?? preset?.alphaAcidPercent ?? 0,
        grams: item.grams ?? 0,
        type: item.type,
        timeMinutes:
          item.type === 'boil' || item.type === 'first wort' ? item.timeMinutes : undefined,
        // Drop a non-positive stand time to undefined so the IBU calc applies its
        // default stand (a 0-min flameout would otherwise compute zero IBU).
        whirlpoolTimeMinutes:
          item.type === 'whirlpool' && item.timeMinutes && item.timeMinutes > 0
            ? item.timeMinutes
            : undefined,
        temperatureC: item.type === 'whirlpool' ? item.temperatureC : undefined,
        dryHopStartDay: item.type === 'dry hop' ? 7 : undefined,
        dryHopDays: item.type === 'dry hop' ? item.dryHopDays ?? 3 : undefined,
      });
    });

    const yeastRows = draft.yeasts.map((item) => {
      const id = uid();
      const match = matchYeast(item.rawName, item.laboratory);
      const preset = match.best?.preset ?? null;
      const name = match.autoAccept && match.best ? match.best.presetName : item.rawName;
      if (!match.autoAccept && match.best) {
        pendingMatches.push({
          kind: 'yeast',
          ingredientId: id,
          imported: item.rawName,
          best: match.best,
          candidates: match.candidates,
          reason: match.reason,
        });
      }
      // When the yeast doesn't resolve to a preset but OG and FG were both
      // stated, the apparent attenuation is right there in the text.
      const derivedAttenuation =
        draft.targetOg && draft.targetFg && draft.targetOg > 1
          ? Math.min(0.95, Math.max(0.5, (draft.targetOg - draft.targetFg) / (draft.targetOg - 1)))
          : undefined;
      const yeast: Yeast = {
        id,
        name,
        attenuation:
          preset?.attenuationPercent ??
          (derivedAttenuation !== undefined ? Math.round(derivedAttenuation * 1000) / 1000 : 0.75),
        laboratory: item.laboratory ?? preset?.category,
      };
      return { yeast, hasMatch: match.best !== null };
    });
    // Prose pastes shed noise rows ("pitching yeast" → "pitching") that match
    // nothing. When at least one yeast resolved against the library, drop the
    // matchless ones — they never reach the review modal (no candidates), so
    // they'd silently import as junk. All-matchless bills (wild blends) keep
    // everything.
    const anyYeastMatched = yeastRows.some((r) => r.hasMatch);
    const yeasts: Yeast[] = yeastRows
      .filter((r) => r.hasMatch || !anyYeastMatched)
      .map((r) => r.yeast);

    const recipe: Recipe = {
      id: uid(),
      name: draft.name?.trim() || 'Pasted recipe',
      style: resolvedStyle,
      tags: [],
      currentVersion: 1,
      batchVolumeL: draft.batchVolumeL ?? 20,
      // Same equipment defaults as recipeStore.createNewRecipe.
      equipment: {
        boilTimeMin: draft.boilTimeMin ?? 60,
        boilOffRateLPerHour: 4,
        brewhouseEfficiencyPercent: draft.efficiencyPercent ?? 75,
        mashThicknessLPerKg: 2.7,
        grainAbsorptionLPerKg: 0.8,
        mashTunDeadspaceLiters: 2.0,
        mashTunLossLiters: 0,
        kettleLossLiters: 1.0,
        hopsAbsorptionLPerKg: 0.7,
        chillerLossLiters: 0,
        fermenterLossLiters: 0.5,
        coolingShrinkagePercent: 4.0,
      },
      fermentables,
      hops,
      yeasts,
      otherIngredients: [],
      // Mash rests from directions prose, when stated (multi-step supported).
      mashSteps: (draft.mashSteps ?? []).map((step, i, all) => ({
        id: uid(),
        name: mashStepName(i, all.length),
        temperatureC: step.temperatureC,
        durationMinutes: step.durationMinutes ?? 60,
      })),
      fermentationSteps: [
        {
          id: uid(),
          name: 'Primary',
          type: 'primary',
          durationDays: draft.fermentDays ?? 10,
          temperatureC: draft.fermentTempC ?? 20,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.resolvePercentageWeights(draft, recipe);

    return { recipe, pendingMatches };
  }

  /**
   * Derives absolute weights for percentage grain bills.
   *
   * Mixed bills (some weights, some %): the % values are shares of the TOTAL
   * grist, so total = knownWeight / (1 − pctShare).
   * Pure % bills: start from a volume-scaled default grist, then scale to the
   * stated OG when one was parsed (OG points are ~linear in grain mass; two
   * passes absorb any second-order effects).
   */
  private resolvePercentageWeights(draft: ParsedRecipeDraft, recipe: Recipe): void {
    const pctIdx: number[] = [];
    let knownKg = 0;
    let pctShare = 0;
    draft.fermentables.forEach((item, i) => {
      if (item.weightKg == null && item.relativePct != null) {
        pctIdx.push(i);
        pctShare += item.relativePct / 100;
      } else {
        knownKg += item.weightKg ?? 0;
      }
    });
    if (pctIdx.length === 0) return;

    let totalKg: number;
    if (knownKg > 0 && pctShare < 1) {
      totalKg = knownKg / (1 - pctShare);
    } else {
      totalKg = DEFAULT_GRIST_KG_PER_L * recipe.batchVolumeL;
    }
    for (const i of pctIdx) {
      recipe.fermentables[i].weightKg = round(
        ((draft.fermentables[i].relativePct ?? 0) / 100) * totalKg,
        4,
      );
    }

    // Pure-% bill with a stated OG: scale the whole grist onto the target.
    if (knownKg === 0 && draft.targetOg && draft.targetOg > 1) {
      const targetPoints = draft.targetOg - 1;
      for (let pass = 0; pass < 2; pass++) {
        const trialPoints = recipeCalculationService.calculate(recipe).og - 1;
        if (trialPoints <= 0.0005) return;
        const scale = targetPoints / trialPoints;
        if (!Number.isFinite(scale) || scale <= 0) return;
        recipe.fermentables.forEach((f) => {
          f.weightKg = round(f.weightKg * scale, 4);
        });
      }
    }
  }

  /**
   * Pre-fill for the review modal's Process & Vitals section, derived from
   * the recipe fromDraft() built (parsed values where stated, defaults
   * elsewhere — what you see is exactly what will be imported).
   */
  vitalsFromRecipe(recipe: Recipe): ImportVitals {
    const primary = recipe.fermentationSteps.find((s) => s.type === 'primary');
    return {
      batchVolumeL: recipe.batchVolumeL,
      boilTimeMin: recipe.equipment.boilTimeMin,
      efficiencyPercent: recipe.equipment.brewhouseEfficiencyPercent,
      mashSteps: recipe.mashSteps.map((s) => ({
        temperatureC: s.temperatureC,
        durationMinutes: s.durationMinutes,
      })),
      fermentTempC: primary?.temperatureC ?? 20,
      fermentDays: primary?.durationDays ?? 10,
    };
  }

  /** Apply per-ingredient amount edits from the review sheet. */
  applyAmountEdits(recipe: Recipe, edits: ImportAmountEdits): Recipe {
    const next: Recipe = JSON.parse(JSON.stringify(recipe));
    for (const f of next.fermentables) {
      const e = edits[f.id];
      if (e?.weightKg !== undefined && e.weightKg >= 0) f.weightKg = e.weightKg;
    }
    for (const h of next.hops) {
      const e = edits[h.id];
      if (!e) continue;
      if (e.grams !== undefined && e.grams >= 0) h.grams = e.grams;
      if (e.timeMinutes !== undefined && e.timeMinutes >= 0) {
        if (h.type === 'whirlpool') h.whirlpoolTimeMinutes = e.timeMinutes;
        else if (h.type !== 'dry hop') h.timeMinutes = e.timeMinutes;
      }
      if (e.dryHopDays !== undefined && e.dryHopDays >= 0 && h.type === 'dry hop') {
        h.dryHopDays = e.dryHopDays;
      }
    }
    return next;
  }

  /** Apply title, amount edits, and row removals from the review sheet. */
  applySheetEdits(recipe: Recipe, edits: ImportSheetEdits): Recipe {
    const next = this.applyAmountEdits(recipe, edits.amounts);
    if (edits.name.trim()) next.name = edits.name.trim();
    if (edits.removedIngredientIds.length > 0) {
      const removed = new Set(edits.removedIngredientIds);
      next.fermentables = next.fermentables.filter((f) => !removed.has(f.id));
      next.hops = next.hops.filter((h) => !removed.has(h.id));
      next.yeasts = next.yeasts.filter((y) => !removed.has(y.id));
    }
    return next;
  }

  /** Apply user-confirmed (possibly edited) vitals back onto the recipe. */
  applyVitals(recipe: Recipe, vitals: ImportVitals): Recipe {
    const next: Recipe = JSON.parse(JSON.stringify(recipe));
    next.batchVolumeL = vitals.batchVolumeL;
    next.equipment.boilTimeMin = vitals.boilTimeMin;
    next.equipment.brewhouseEfficiencyPercent = vitals.efficiencyPercent;
    // Per-grain efficiency mirrors the recipe efficiency, except for
    // extracts/sugars which stay at 100.
    for (const grain of next.fermentables) {
      if (grain.efficiencyPercent !== 100) grain.efficiencyPercent = vitals.efficiencyPercent;
    }
    next.mashSteps = vitals.mashSteps.map((step, i, all) => ({
      id: uid(),
      name: mashStepName(i, all.length),
      temperatureC: step.temperatureC,
      durationMinutes: step.durationMinutes,
    }));
    const primary = next.fermentationSteps.find((s) => s.type === 'primary');
    if (primary) {
      primary.temperatureC = vitals.fermentTempC;
      primary.durationDays = vitals.fermentDays;
    }
    return next;
  }

  /**
   * Apply user-confirmed resolutions from the review modal. Patches the name
   * AND re-sources numerics from the chosen preset (text imports get their
   * numerics from the matcher's best guess, which the user just overrode).
   */
  applyResolutions(recipe: Recipe, resolutions: MatchResolution[]): Recipe {
    const next: Recipe = JSON.parse(JSON.stringify(recipe));
    for (const r of resolutions) {
      if (r.kind === 'style') {
        if (r.canonical) next.style = r.canonical;
        continue;
      }
      if (!r.presetName) continue;

      if (r.kind === 'hop') {
        const hop = next.hops.find((h) => h.id === r.ingredientId);
        if (!hop) continue;
        hop.name = r.presetName;
        const preset = getPreset(HOP_PRESETS, r.presetName);
        if (preset) hop.alphaAcid = preset.alphaAcidPercent;
        // Drop the old flavor so enrichment re-resolves for the new name.
        delete hop.flavor;
        Object.assign(hop, hopEnrichmentService.enrichHop(hop));
      } else if (r.kind === 'grain') {
        const grain = next.fermentables.find((g) => g.id === r.ingredientId);
        if (!grain) continue;
        grain.name = r.presetName;
        const preset = getPreset(getGrainPresets(), r.presetName);
        if (preset) {
          grain.colorLovibond = preset.colorLovibond;
          grain.ppg = preset.potentialGu;
          grain.efficiencyPercent =
            preset.type === 'extract' || preset.type === 'sugar' ? 100 : 75;
          grain.originCode = preset.originCode;
          grain.fermentability = grainFermentability(preset);
        }
      } else if (r.kind === 'yeast') {
        const yeast = next.yeasts.find((y) => y.id === r.ingredientId);
        if (!yeast) continue;
        yeast.name = r.presetName;
        const preset = getPreset(YEAST_PRESETS, r.presetName);
        if (preset) {
          if (preset.attenuationPercent != null) yeast.attenuation = preset.attenuationPercent;
          yeast.laboratory = preset.category;
        }
      }
    }
    return next;
  }
}

export const textRecipeImportService = new TextRecipeImportService();
