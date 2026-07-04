/**
 * PRD-009 Phase 1 — Tier-1 restyle (own ingredients only).
 *
 * Minimal flavour-directed edits on an imported recipe: delta targets from the
 * recipe's own achieved profile, corrections limited to ingredients already in
 * the bill, absolute batch/grain totals preserved, optional IBU retarget only.
 */
import type { Recipe, Fermentable, Hop } from "../../recipe/models/Recipe";
import type { HopFlavorProfile } from "../../recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import {
  MALT_FLAVOR_KEYS,
  maltArchetypeForFermentable,
  MALT_ARCHETYPES_BY_SLUG,
  type MaltFlavorProfile,
} from "../maltFlavor";
import { HOP_PRESETS } from "../../recipe/data/hopPresets";
import { hopFlavorCalculationService } from "../../recipe/services/HopFlavorCalculationService";
import { recipeCalculationService } from "../../recipe/services/RecipeCalculationService";
import {
  correctMaltGristToward,
  correctHopScheduleToward,
  enforceGristBrewability,
  normalizeHopName,
  materializeHopSchedule,
  presetForArchetype,
  type GristBillItem,
  type HopTemplate,
} from "./reconstruction";
import { featurize, hopFlavorMapFor, type FeaturizedRecipe } from "./featurize";

/** A single changelog entry for the UI. */
export type RecipeEdit =
  | { kind: "adjust"; ingredient: string; from: number; to: number; unit: "kg" | "g"; reason: string }
  | { kind: "add"; ingredient: string; amount: number; unit: "kg" | "g"; reason: string }
  | { kind: "remove"; ingredient: string; reason: string };

/** Flavour deltas relative to the recipe's current profile (not absolute targets). */
export type RestyleTweak = {
  malt?: Partial<MaltFlavorProfile>;
  hop?: Partial<HopFlavorProfile>;
  /** Absolute secondary asks — only these trigger solvers. */
  abv?: number;
  ibu?: number;
  srm?: number;
};

export type RestyleOpts = {
  /** Max distinct ingredients touched. Default 3. */
  editBudget?: number;
  /** Phase 1 implements Tier 1 only; 2–3 deferred to Phase 2. */
  sanctionTier?: 1 | 2 | 3;
  style?: string;
};

export type RestyleTier1Result = {
  recipe: Recipe;
  edits: RecipeEdit[];
  baseline: FeaturizedRecipe;
  requestedFlavor: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  achievedFlavor: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  tooLargeForTweak: boolean;
  notes: string[];
};

const DEFAULT_EDIT_BUDGET = 3;
const WEIGHT_EPS_KG = 0.005;
const GRAMS_EPS = 0.5;
/** Pushed axis must close at least this fraction of the requested delta. */
const MIN_REACH_FRACTION = 0.35;
/** Non-pushed axes may drift at most this much (flavour units). */
const NON_PUSHED_EPS = 0.2;
/** Remaining pushed-axis gap (normalised) above which we flag tooLargeForTweak. */
const TOO_LARGE_NORM_GAP = 0.45;

type ArchetypeGroup = {
  archetype: string;
  fermentableIndices: number[];
  totalKg: number;
  preset: NonNullable<ReturnType<typeof presetForArchetype>>;
};

/** Group fermentables by malt archetype for correction + redistribution. */
export function gristBillFromRecipe(recipe: Recipe): { items: GristBillItem[]; groups: ArchetypeGroup[]; totalKg: number } {
  const totalKg = (recipe.fermentables ?? []).reduce((s, f) => s + Math.max(0, f.weightKg), 0);
  const byArch = new Map<string, ArchetypeGroup>();

  (recipe.fermentables ?? []).forEach((f, idx) => {
    if (f.weightKg <= 0) return;
    const { archetype } = maltArchetypeForFermentable(f.name, f.colorLovibond);
    const preset = presetForArchetype(archetype);
    if (!preset || !MALT_ARCHETYPES_BY_SLUG.has(archetype)) return;
    let g = byArch.get(archetype);
    if (!g) {
      g = { archetype, fermentableIndices: [], totalKg: 0, preset };
      byArch.set(archetype, g);
    }
    g.fermentableIndices.push(idx);
    g.totalKg += f.weightKg;
  });

  const groups = [...byArch.values()];
  const items: GristBillItem[] = groups.map((g) => ({
    archetype: g.archetype,
    pct: totalKg > 0 ? (g.totalKg / totalKg) * 100 : 0,
    preset: g.preset,
  }));
  return { items, groups, totalKg };
}

/** Apply corrected grist shares back to fermentables; total grain weight preserved. */
export function applyGristToFermentables(
  original: Fermentable[],
  groups: ArchetypeGroup[],
  corrected: GristBillItem[],
  totalKg: number,
): Fermentable[] {
  const out = original.map((f) => ({ ...f }));
  const shareByArch = new Map(corrected.map((i) => [i.archetype, i.pct / 100]));
  for (const g of groups) {
    const newGroupKg = totalKg * (shareByArch.get(g.archetype) ?? 0);
    const oldGroupKg = g.totalKg || 1;
    for (const idx of g.fermentableIndices) {
      out[idx] = { ...out[idx], weightKg: newGroupKg * (original[idx].weightKg / oldGroupKg) };
    }
  }
  return out;
}

export function hopTemplatesFromRecipe(recipe: Recipe): HopTemplate[] {
  const batchL = recipe.batchVolumeL > 0 ? recipe.batchVolumeL : 20;
  return (recipe.hops ?? []).map((h) => ({
    name: normalizeHopName(h.name),
    type: h.type,
    gpl: h.grams / batchL,
    timeMinutes: h.type === "whirlpool" ? (h.whirlpoolTimeMinutes ?? h.timeMinutes ?? 15) : (h.timeMinutes ?? 0),
  }));
}

/** Merge corrected hop templates back into the recipe hop list by normalised name+type. */
export function applyHopTemplates(
  original: Hop[],
  templates: HopTemplate[],
  batchL: number,
): Hop[] {
  const key = (t: HopTemplate) => `${t.type}:${t.name}`;
  const tplByKey = new Map<string, HopTemplate>();
  for (const t of templates) tplByKey.set(key(t), t);

  const used = new Set<string>();
  const out: Hop[] = [];

  for (const h of original) {
    const k = `${h.type}:${normalizeHopName(h.name)}`;
    const tpl = tplByKey.get(k);
    if (tpl) {
      used.add(k);
      out.push({ ...h, grams: tpl.gpl * batchL });
    } else {
      out.push({ ...h });
    }
  }

  // New dry-hop / whirlpool lines the correction added.
  for (const [k, tpl] of tplByKey) {
    if (used.has(k)) continue;
    if (tpl.gpl <= 1e-6) continue;
    const preset = HOP_PRESETS.find((p) => p.name.toLowerCase() === tpl.name.toLowerCase());
    out.push({
      id: `restyle-hop-${k.replace(/:/g, "-")}`,
      name: preset?.name ?? tpl.name,
      alphaAcid: preset?.alphaAcidPercent ?? 10,
      grams: tpl.gpl * batchL,
      type: tpl.type,
      timeMinutes: tpl.type === "boil" || tpl.type === "mash" ? tpl.timeMinutes : undefined,
      whirlpoolTimeMinutes: tpl.type === "whirlpool" ? tpl.timeMinutes : undefined,
      dryHopDays: tpl.type === "dry hop" ? Math.max(1, Math.round(tpl.timeMinutes / 1440)) : undefined,
    });
  }

  return out;
}

function buildDeltaTargets(
  baseline: { malt: MaltFlavorProfile; hop: HopFlavorProfile },
  tweak: RestyleTweak,
): {
  requestedMalt: MaltFlavorProfile;
  requestedHop: HopFlavorProfile;
  maltTarget: Partial<MaltFlavorProfile>;
  hopTarget: Partial<HopFlavorProfile>;
  pushedMalt: Set<string>;
  pushedHop: Set<string>;
} {
  const requestedMalt = { ...baseline.malt };
  const requestedHop = { ...baseline.hop };
  const maltTarget: Partial<MaltFlavorProfile> = {};
  const hopTarget: Partial<HopFlavorProfile> = {};
  const pushedMalt = new Set<string>();
  const pushedHop = new Set<string>();

  for (const k of MALT_FLAVOR_KEYS) {
    const delta = tweak.malt?.[k];
    if (delta == null || delta === 0) continue;
    requestedMalt[k] = Math.max(0, baseline.malt[k] + delta);
    maltTarget[k] = requestedMalt[k];
    pushedMalt.add(k);
  }
  for (const k of HOP_FLAVOR_KEYS) {
    const delta = tweak.hop?.[k];
    if (delta == null || delta === 0) continue;
    requestedHop[k] = Math.max(0, baseline.hop[k] + delta);
    hopTarget[k] = requestedHop[k];
    pushedHop.add(k);
  }

  return { requestedMalt, requestedHop, maltTarget, hopTarget, pushedMalt, pushedHop };
}

function maltPrevalenceFromGroups(groups: ArchetypeGroup[], totalKg: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of groups) out[g.archetype] = totalKg > 0 ? g.totalKg / totalKg : 0;
  return out;
}

function hopPrevalenceFromRecipe(recipe: Recipe): Record<string, number> {
  const batchL = recipe.batchVolumeL > 0 ? recipe.batchVolumeL : 20;
  const out: Record<string, number> = {};
  for (const h of recipe.hops ?? []) {
    const n = normalizeHopName(h.name);
    out[n] = (out[n] ?? 0) + h.grams / batchL;
  }
  return out;
}

function countTouchedEdits(before: Recipe, after: Recipe): number {
  const touched = new Set<string>();
  for (let i = 0; i < before.fermentables.length; i++) {
    const a = before.fermentables[i];
    const b = after.fermentables[i];
    if (b && Math.abs(a.weightKg - b.weightKg) > WEIGHT_EPS_KG) touched.add(`malt:${a.name}`);
  }
  const beforeHops = before.hops ?? [];
  const afterHops = after.hops ?? [];
  const afterById = new Map(afterHops.map((h) => [h.id, h]));
  for (const h of beforeHops) {
    const b = afterById.get(h.id);
    if (b && Math.abs(h.grams - b.grams) > GRAMS_EPS) touched.add(`hop:${h.name}`);
  }
  for (const h of afterHops) {
    if (!beforeHops.some((x) => x.id === h.id)) touched.add(`hop:${h.name}`);
  }
  return touched.size;
}

export function diffRecipe(before: Recipe, after: Recipe, reason: string): RecipeEdit[] {
  const edits: RecipeEdit[] = [];
  for (let i = 0; i < before.fermentables.length; i++) {
    const a = before.fermentables[i];
    const b = after.fermentables[i];
    if (!b) continue;
    if (Math.abs(a.weightKg - b.weightKg) > WEIGHT_EPS_KG) {
      edits.push({
        kind: "adjust",
        ingredient: a.name,
        from: +a.weightKg.toFixed(3),
        to: +b.weightKg.toFixed(3),
        unit: "kg",
        reason,
      });
    }
  }
  const beforeHopIds = new Set(before.hops.map((h) => h.id));
  for (const h of after.hops) {
    const prev = before.hops.find((x) => x.id === h.id);
    if (!prev) {
      edits.push({ kind: "add", ingredient: h.name, amount: +h.grams.toFixed(0), unit: "g", reason });
    } else if (Math.abs(prev.grams - h.grams) > GRAMS_EPS) {
      edits.push({
        kind: "adjust",
        ingredient: h.name,
        from: +prev.grams.toFixed(0),
        to: +h.grams.toFixed(0),
        unit: "g",
        reason,
      });
    }
  }
  for (const h of before.hops) {
    if (!after.hops.some((x) => x.id === h.id)) {
      edits.push({ kind: "remove", ingredient: h.name, reason });
    }
  }
  return edits;
}

function assessReach(
  baseline: { malt: MaltFlavorProfile; hop: HopFlavorProfile },
  achieved: { malt: MaltFlavorProfile; hop: HopFlavorProfile },
  requested: { malt: MaltFlavorProfile; hop: HopFlavorProfile },
  pushedMalt: Set<string>,
  pushedHop: Set<string>,
): { ok: boolean; tooLarge: boolean; notes: string[] } {
  const notes: string[] = [];
  let worstNormGap = 0;

  for (const k of pushedMalt) {
    const key = k as keyof MaltFlavorProfile;
    const want = requested.malt[key] - baseline.malt[key];
    if (Math.abs(want) < 1e-6) continue;
    const got = achieved.malt[key] - baseline.malt[key];
    const frac = got / want;
    if (frac < MIN_REACH_FRACTION) {
      notes.push(`malt.${k}: reached ${(frac * 100).toFixed(0)}% of the requested delta`);
    }
    worstNormGap = Math.max(worstNormGap, Math.abs(want - got) / Math.max(Math.abs(want), 0.1));
  }
  for (const k of pushedHop) {
    const key = k as keyof HopFlavorProfile;
    const want = requested.hop[key] - baseline.hop[key];
    if (Math.abs(want) < 1e-6) continue;
    const got = achieved.hop[key] - baseline.hop[key];
    const frac = got / want;
    if (frac < MIN_REACH_FRACTION) {
      notes.push(`hop.${k}: reached ${(frac * 100).toFixed(0)}% of the requested delta`);
    }
    worstNormGap = Math.max(worstNormGap, Math.abs(want - got) / Math.max(Math.abs(want), 0.1));
  }

  for (const k of MALT_FLAVOR_KEYS) {
    if (pushedMalt.has(k)) continue;
    if (Math.abs(achieved.malt[k] - baseline.malt[k]) > NON_PUSHED_EPS) {
      notes.push(`malt.${k} drifted ${(achieved.malt[k] - baseline.malt[k]).toFixed(2)} without being pushed`);
    }
  }
  for (const k of HOP_FLAVOR_KEYS) {
    if (pushedHop.has(k)) continue;
    if (Math.abs(achieved.hop[k] - baseline.hop[k]) > NON_PUSHED_EPS) {
      notes.push(`hop.${k} drifted ${(achieved.hop[k] - baseline.hop[k]).toFixed(2)} without being pushed`);
    }
  }

  const tooLarge = worstNormGap > TOO_LARGE_NORM_GAP;
  if (tooLarge) notes.push("the ask is too large for a minimal edit — consider generating with steer() instead");
  return { ok: !tooLarge, tooLarge, notes };
}

/** Tier-1 restyle: own ingredients only, preserve absolute grain total + batch volume. */
export function restyleTier1(recipe: Recipe, tweak: RestyleTweak, opts: RestyleOpts = {}): RestyleTier1Result {
  const notes: string[] = [];
  const editBudget = opts.editBudget ?? DEFAULT_EDIT_BUDGET;
  if ((opts.sanctionTier ?? 1) > 1) {
    notes.push(`sanction tier ${opts.sanctionTier} is not implemented yet — using tier 1 (own bill only)`);
  }

  const baseline = featurize(recipe);
  notes.push(...baseline.notes);

  const { requestedMalt, requestedHop, maltTarget, hopTarget, pushedMalt, pushedHop } = buildDeltaTargets(
    { malt: baseline.malt, hop: baseline.hop },
    tweak,
  );

  if (pushedMalt.size === 0 && pushedHop.size === 0 && tweak.abv == null && tweak.ibu == null) {
    return {
      recipe,
      edits: [],
      baseline,
      requestedFlavor: { malt: requestedMalt, hop: requestedHop },
      achievedFlavor: { malt: baseline.malt, hop: baseline.hop },
      tooLargeForTweak: false,
      notes: [...notes, "no flavour deltas requested — recipe unchanged"],
    };
  }

  let working: Recipe = {
    ...recipe,
    fermentables: recipe.fermentables.map((f) => ({ ...f })),
    hops: (recipe.hops ?? []).map((h) => ({ ...h })),
  };
  const batchL = working.batchVolumeL > 0 ? working.batchVolumeL : 20;

  // ── malt correction (Tier 1: sanctioned = own archetypes) ───────────────
  if (pushedMalt.size > 0 && working.fermentables.length > 0) {
    const { items, groups, totalKg } = gristBillFromRecipe(working);
    if (items.length > 0) {
      const sanctioned = new Set(items.map((i) => i.archetype));
      const prevalence = maltPrevalenceFromGroups(groups, totalKg);
      const corrected = correctMaltGristToward(items, sanctioned, maltTarget, {
        allowReduce: true,
        prevalence,
        avoidCollateral: true,
      });
      const brew = enforceGristBrewability(corrected.items);
      working = {
        ...working,
        fermentables: applyGristToFermentables(working.fermentables, groups, brew.items, totalKg),
      };
      notes.push(...corrected.notes, ...brew.notes);
    }
  }

  // ── hop correction (Tier 1: sanctioned = own hop names) ─────────────────
  if (pushedHop.size > 0) {
    const templates = hopTemplatesFromRecipe(working);
    const sanctioned = new Set((working.hops ?? []).map((h) => normalizeHopName(h.name)));
    const prevalence = hopPrevalenceFromRecipe(working);
    const flavorMap = hopFlavorMapFor(working.hops ?? []);
    const evaluate = (tpls: HopTemplate[]) => {
      const hs = materializeHopSchedule(tpls, batchL).map((h) => ({ ...h, name: h.name.toLowerCase() }));
      return hopFlavorCalculationService.calculateCombinedFlavor(hs, flavorMap, batchL);
    };
    const corrected = correctHopScheduleToward(
      templates,
      sanctioned,
      (name) => flavorMap.get(name.toLowerCase()),
      hopTarget,
      evaluate,
      { allowReduce: true, prevalence, avoidCollateral: true },
    );
    working = { ...working, hops: applyHopTemplates(working.hops ?? [], corrected.templates, batchL) };
    notes.push(...corrected.notes);
  }

  const touched = countTouchedEdits(recipe, working);
  let tooLargeForTweak = false;
  if (touched > editBudget) {
    tooLargeForTweak = true;
    notes.push(`edit touched ${touched} ingredients (budget ${editBudget}) — ask may be too large for a tweak`);
  }

  const afterFeat = featurize(working);
  const assessment = assessReach(
    { malt: baseline.malt, hop: baseline.hop },
    { malt: afterFeat.malt, hop: afterFeat.hop },
    { malt: requestedMalt, hop: requestedHop },
    pushedMalt,
    pushedHop,
  );
  notes.push(...assessment.notes);
  if (assessment.tooLarge) tooLargeForTweak = true;

  const reason = "flavour tweak (tier 1 — own ingredients)";
  const edits = diffRecipe(recipe, working, reason);

  return {
    recipe: working,
    edits,
    baseline,
    requestedFlavor: { malt: requestedMalt, hop: requestedHop },
    achievedFlavor: { malt: afterFeat.malt, hop: afterFeat.hop },
    tooLargeForTweak,
    notes,
  };
}
