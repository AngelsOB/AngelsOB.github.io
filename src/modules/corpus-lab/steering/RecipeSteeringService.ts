/**
 * Phase 2 — the steering engine.
 *
 * query -> k-NN over the cloud -> average the neighbourhood's TARGETS (not raw
 * recipes) -> synthesize one clean recipe -> run it through the app's real
 * calculators (ABV is user-set; solved via the reverse target-ABV grain
 * solver; IBU solved the same way via a hop-grams bisection) -> return the
 * recipe + a style-fit/out-of-bounds signal.
 *
 * Pure and test-first: constructed with an already-loaded `CloudRecord[]`
 * (see loadCloud.ts for the one fs-touching piece) and app services it reuses
 * one-way (lab -> app), never duplicating their math.
 */
import type { Recipe, RecipeCalculations, Fermentable, Hop, Yeast } from "../../recipe/models/Recipe";
import type { HopFlavorProfile } from "../../recipe/models/Presets";
import type { MaltFlavorProfile } from "../maltFlavor";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import { MALT_FLAVOR_KEYS, aggregateMaltFlavor } from "../maltFlavor";
import { recipeCalculationService } from "../../recipe/services/RecipeCalculationService";
import { volumeCalculationService } from "../../recipe/services/VolumeCalculationService";
import { fermentableCalculationService } from "../../recipe/services/FermentableCalculationService";
import { hopFlavorCalculationService } from "../../recipe/services/HopFlavorCalculationService";
import { matchBjcpStyle } from "../../../utils/bjcpMatching";
import { getBjcpStyleSpec } from "../../../utils/bjcpSpecs";
import { ABV_FACTOR } from "@/calculators/abv";
import { HOP_FLAVOR_BY_LOWER } from "../offline/buildCloud";
import { family, type StyleFamily } from "../offline/styleFamily";
import {
  continuousRow,
  componentwiseMean,
  computeStats,
  zScore,
  buildYeastVocab,
  yeastBlockFromClass,
  blendYeastBlocks,
  yeastNorm2,
  weightedDistance2,
  kNearestByDistance,
  kernelWeights,
  type CloudRecord,
  type Stats,
  type YeastVocab,
  type YeastBlock,
} from "./featureSpace";
import {
  pickGristBill,
  buildFermentablesFromGristBill,
  reconstructHopSchedule,
  materializeHopSchedule,
  scaleHops,
  pickModalYeastName,
  buildYeastFromPresetName,
  yeastTypeOf,
} from "./reconstruction";

export type StyleGateMode = "family" | "strict" | "none";

/** A single flavour/stat target point. Unset axes default to the style's own median. */
export type SteeringTarget = {
  hop?: Partial<HopFlavorProfile>;
  malt?: Partial<MaltFlavorProfile>;
  /** Desired ABV% — materialised exactly via the reverse grain-weight solver. */
  abv?: number;
  /** Desired IBU — materialised via a hop-grams scale solve. */
  ibu?: number;
  srm?: number;
  /** Same units as the cloud's `mb` (grist body signal) — informational/query-only in Phase 2. */
  body?: number;
};

export type SteeringQuery = {
  /** Free-text or BJCP-coded style, e.g. "American IPA" or "21A". */
  style: string;
  target?: SteeringTarget;
  /** Neighbourhood size. Default 20 ("small k" per docs/corpus-lab-build.md §6). */
  k?: number;
  /** Default "family": soft-biases the starting point, searches the whole cloud. */
  styleGate?: StyleGateMode;
  /** Lock reconstruction (and, where the cloud has data for it, the k-NN query) to a specific YEAST_PRESETS name. */
  yeastName?: string;
  /**
   * How adventurous the ingredient identity picks are (0-1). 0 = always the
   * neighbourhood's most popular malt-per-role / hop-per-bucket (deterministic,
   * the original behaviour). Higher lets a seeded draw reach past the most
   * popular option — but only among candidates real neighbours actually used
   * (never invented) and only ones within reach of the top (never a no-hoper).
   * The %s/doses stay tight; only WHICH ingredient fills each slot varies.
   * Default 0.
   */
  exploration?: number;
  /**
   * Reroll seed. Same query + same `variation` -> identical recipe; bump it for
   * a different plausible take at the current `exploration` level. Default 0.
   */
  variation?: number;
  /**
   * Size of the wider neighbourhood the ingredient IDENTITIES are voted from —
   * the "menu" of plausible malts/hops — while the %s/doses stay on the tight
   * `k`. Defaults to a modest multiple of `k` that grows with `exploration`
   * (k when exploration is 0, so behaviour is unchanged there).
   */
  varietyK?: number;
};

export type SteeringResult = {
  recipe: Recipe;
  calculations: RecipeCalculations;
  requestedFlavor: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  achievedFlavor: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  /**
   * The matched style's (or, when too thin on data, its family/global
   * fallback's) own typical flavour range from the cloud — independent of
   * whatever this particular query pushed. The "box" a style normally plays
   * in, so a user steering away from it can see how far they've wandered.
   */
  styleNorms: {
    malt: { p25: MaltFlavorProfile; p75: MaltFlavorProfile };
    hop: { p25: HopFlavorProfile; p75: HopFlavorProfile };
    recordCount: number;
    level: "style" | "family" | "global";
  };
  /**
   * Per-axis realistic ceiling (~99th percentile across the whole cloud) — the
   * raw value that should map to a full-scale radar axis. Malt axes in
   * particular live in a tiny range (grainy tops out ~1.4, not 5), so a shared
   * 0-5 axis wastes most of the dial and squashes the norm band to a sliver.
   * Scaling each axis by its own ceiling makes the flavour space usable.
   */
  axisMax: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  style: { input: string; matchedCode?: string; matchedName?: string; family: StyleFamily };
  neighborhood: { k: number; recordIds: number[]; weights: number[] };
  styleFit: {
    meanNeighborDistance: number;
    baselineDistance: number;
    /** meanNeighborDistance ÷ baselineDistance. ~1 = the corpus is as dense here as
     * anywhere (a typical request); higher = you're steering toward flavour the
     * corpus has less and less of. A graded "how far out" signal for the UI. */
    ratio: number;
    band: "typical" | "stretch" | "experimental";
    /** Convenience for existing callers: band !== "experimental". */
    inBounds: boolean;
  };
  notes: string[];
};

type WeightedNeighbor = { rec: CloudRecord; weight: number };

const GRAVITY_IDX = 18;
const IBU_IDX = 19;
const SRM_IDX = 20;
const BUGU_IDX = 21;
const MALTBODY_IDX = 22;

/** Style-fit bands on `meanNeighborDistance ÷ baselineDistance`: at/under ~1.25×
 * the corpus is as dense here as normal (typical); up to 2× is a stretch toward
 * the style's edges; beyond 2× the corpus barely contains what was asked for. */
const STYLE_FIT_TYPICAL_MAX = 1.25;
const STYLE_FIT_STRETCH_MAX = 2.0;
/** Assumed apparent attenuation used ONLY to translate a target ABV into an approximate
 * gravity for neighbour-finding — the actual ABV is hit exactly by the reverse solver later. */
const ASSUMED_ATTENUATION_FOR_QUERY = 0.75;
const FALLBACK_YEAST_PRESET = "SafAle US-05"; // clean, neutral — used only if reconstruction finds nothing

/**
 * The yeast strain types (see YeastStrainType) that belong in each coarse style
 * family — the guardrail that stops the modal-yeast vote from picking a
 * category-wrong strain when the corpus is polluted (homebrewers ferment
 * "lagers" with ale yeast; a noisy neighbourhood votes in a trendy kveik for a
 * plain IPA). Non-lager/wheat/sour families default to "ale" alone, so the
 * MEDIAN yeast is a clean, representative strain — a user who actually wants
 * kveik just locks it via `yeastName`. Deliberately permissive for Sour/Wild
 * (souring is a style-layer concern, not a yeast dial) and unrestricted for
 * "Other". If nothing on-style is found, steer() falls back to the most common
 * on-style yeast in the whole cloud before the generic default.
 */
const ON_STYLE_YEAST_TYPES: Record<StyleFamily, string[]> = {
  IPA: ["ale"],
  "Pale/Blonde": ["ale"],
  "Amber/Brown": ["ale"],
  "Stout/Porter": ["ale"],
  Strong: ["ale", "lager"], // barleywine=ale, but imperial lager / eisbock exist
  Belgian: ["ale"],
  Wheat: ["wheat", "ale"], // hefeweizen=wheat; American wheat / witbier=ale
  Lager: ["lager"],
  "Sour/Wild": ["wild", "brett", "bacteria", "blend", "ale", "lager", "wheat"],
  Other: ["ale", "lager", "kveik", "wheat", "brett", "wild", "bacteria", "blend", "wine", "other"],
};

/** A predicate accepting only yeast preset names whose strain type is on-style for `fam`. */
function allowYeastTypeFor(fam: StyleFamily): (name: string) => boolean {
  const allowed = new Set(ON_STYLE_YEAST_TYPES[fam] ?? ON_STYLE_YEAST_TYPES.Other);
  return (name: string) => {
    const t = yeastTypeOf(name);
    return t != null && allowed.has(t);
  };
}
/**
 * The steering engine's job is composition (grain %, hop g/L dose, yeast) and
 * concentration (ABV, IBU, SRM) — all volume-independent. A specific batch
 * size is a brew-day/equipment choice that belongs to the builder, not a
 * steering input: a 20L and a 200L batch of the same query are the identical
 * recipe, just scaled. This constant exists only because `Recipe.Fermentable`/
 * `Hop` require absolute weights (so the result is a real, BeerXML-ready
 * object) — any fixed value works identically; nothing about the output's
 * character depends on it.
 */
const NOMINAL_BATCH_VOLUME_L = 20;

/** Mirrors RecipeCalculationService's own "brewer's window" (MASH_WINDOW) — the
 * practical single-infusion range the mash-temp solver searches within. */
const MASH_TEMP_RANGE = { lo: 62.5, hi: 72.5 };
/** If the solved boundary still misses the target by more than this, it's worth a note. */
const MASH_SOLVE_NOTE_THRESHOLD = 0.03;

/** Boil additions at/after this minute are "bittering" — the IBU solver moves these, not the aroma/dry hops.
 * Matches reconstruction.ts's bittering bucket (≥40 min → snaps to 45/60), so a reconstructed bittering
 * charge is always caught while flavour (10-39 min), whirlpool, and dry-hop additions stay fixed. */
const BITTERING_MIN_MINUTES = 40;

function weightedMean(neighbors: WeightedNeighbor[], pick: (r: CloudRecord) => number): number {
  return neighbors.reduce((s, n) => s + n.weight * pick(n.rec), 0);
}

/** Apparent attenuation = (OG-FG)/(OG-1), clamped defensively against garbage self-reported data. */
function apparentAttenuation(og: number, fg: number): number {
  if (!(og > 1)) return 0.75;
  return Math.max(0, Math.min(1, (og - fg) / (og - 1)));
}

function rowToMalt(row: number[]): MaltFlavorProfile {
  const out = {} as MaltFlavorProfile;
  MALT_FLAVOR_KEYS.forEach((key, i) => { out[key] = row[i]; });
  return out;
}

function rowToHop(row: number[]): HopFlavorProfile {
  const out = {} as HopFlavorProfile;
  HOP_FLAVOR_KEYS.forEach((key, i) => { out[key] = row[9 + i]; });
  return out;
}

/** Bare 9-axis array (not the combined 23-dim row) -> a flavour profile, for style-norm ranges. */
function malt9ToProfile(arr: number[]): MaltFlavorProfile {
  const out = {} as MaltFlavorProfile;
  MALT_FLAVOR_KEYS.forEach((key, i) => { out[key] = arr[i]; });
  return out;
}

function hop9ToProfile(arr: number[]): HopFlavorProfile {
  const out = {} as HopFlavorProfile;
  HOP_FLAVOR_KEYS.forEach((key, i) => { out[key] = arr[i]; });
  return out;
}

function percentileOf(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/**
 * Per-axis 25th/75th percentile across a set of cloud records — the "box"
 * most of a style's real recipes actually sit inside. Percentiles rather than
 * mean±std because flavour axes are zero-heavy/skewed (most styles score 0 on
 * most axes), where a symmetric std band can imply a nonsensical negative
 * lower bound.
 */
function axisRange(idxs: number[], cloud: CloudRecord[], pick: (r: CloudRecord) => number[], axisCount: number): { p25: number[]; p75: number[] } {
  const p25 = new Array(axisCount).fill(0);
  const p75 = new Array(axisCount).fill(0);
  for (let j = 0; j < axisCount; j++) {
    const values = idxs.map((i) => pick(cloud[i])[j]).sort((a, b) => a - b);
    p25[j] = percentileOf(values, 0.25);
    p75[j] = percentileOf(values, 0.75);
  }
  return { p25, p75 };
}

type FlavorRange = { maltP25: number[]; maltP75: number[]; hopP25: number[]; hopP75: number[] };
type Centroid = { row: number[]; yeastBlock: YeastBlock; count: number; idxs?: number[] } & FlavorRange;

/** Below this many cloud records, a specific-style centroid is too noisy to trust — fall back to the family. */
const MIN_STYLE_CENTROID_RECORDS = 30;

export class RecipeSteeringService {
  private readonly cloud: CloudRecord[];
  private readonly stats: Stats;
  private readonly vocab: YeastVocab;
  private readonly zRows: Float64Array[];
  private readonly yeastBlocks: YeastBlock[];
  private readonly yeastNorms: Float64Array;
  private readonly familyOf: StyleFamily[];
  /** Resolved BJCP code per record (undefined if its raw style string doesn't cleanly resolve to one) —
   * `family()` is a coarse 10-bucket classifier built for k-NN soft-gating (see styleFamily.ts); using it
   * as the "median brew" starting point conflates every style that shares a bucket (e.g. Munich Helles,
   * Czech Pale Lager, and American Lager are all "Lager" — same centroid, same output, whenever the user
   * doesn't push an explicit flavour override). This is the finer-grained level `steer()` tries first. */
  private readonly styleCodeOf: Array<string | undefined>;
  private readonly presetNameToClass = new Map<string, { yc: string | null; ys: string[] }>();
  /** Unique yeast preset names, most-used first — the data-driven fallback when a neighbourhood has no on-style yeast. */
  private readonly ynByGlobalFrequency: string[];
  private readonly baselineCache = new Map<string, number>();
  /** Whole-cloud flavour percentile range, computed once — the "none" gate's styleNorms and globalCentroid()'s fallback. */
  private readonly globalRange: FlavorRange;
  /** Per-axis ~p99 across the whole cloud — the realistic ceiling each flavour axis should scale to on a radar. */
  private readonly globalAxisMax: { malt: number[]; hop: number[] };

  constructor(cloud: CloudRecord[]) {
    if (cloud.length === 0) throw new Error("RecipeSteeringService: cloud is empty");
    this.cloud = cloud;

    const rows = cloud.map((r) => continuousRow({ m: r.m, h: r.h, og: r.og, ibu: r.ibu, srm: r.srm, mb: r.mb }));
    this.stats = computeStats(rows);
    this.zRows = rows.map((row) => zScore(row, this.stats));

    this.vocab = buildYeastVocab(cloud);
    this.yeastBlocks = cloud.map((r) => yeastBlockFromClass(r, this.vocab));
    this.yeastNorms = Float64Array.from(this.yeastBlocks.map(yeastNorm2));

    this.familyOf = cloud.map((r) => family(r.s));

    // Resolving per unique raw style string, not per record (~180 uniques
    // over ~149k records) — matchBjcpStyle's fuzzy fallback is too expensive
    // to run 149k times, but trivial a few hundred times.
    const codeByRawStyle = new Map<string, string | undefined>();
    for (const r of cloud) {
      if (codeByRawStyle.has(r.s)) continue;
      const m = matchBjcpStyle(r.s);
      codeByRawStyle.set(r.s, m.autoAccept ? m.canonical?.split(".")[0] : undefined);
    }
    this.styleCodeOf = cloud.map((r) => codeByRawStyle.get(r.s));

    const ynCount = new Map<string, number>();
    for (const r of cloud) {
      if (r.yn && !this.presetNameToClass.has(r.yn)) this.presetNameToClass.set(r.yn, { yc: r.yc, ys: r.ys });
      if (r.yn) ynCount.set(r.yn, (ynCount.get(r.yn) ?? 0) + 1);
    }
    this.ynByGlobalFrequency = [...ynCount.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

    // Paid once here rather than per query — see getBaselineDistance for the
    // same "expensive whole-cloud pass belongs in the constructor" pattern.
    const allIdxs = cloud.map((_, i) => i);
    const { p25: gMaltP25, p75: gMaltP75 } = axisRange(allIdxs, cloud, (r) => r.m, 9);
    const { p25: gHopP25, p75: gHopP75 } = axisRange(allIdxs, cloud, (r) => r.h, 9);
    this.globalRange = { maltP25: gMaltP25, maltP75: gMaltP75, hopP25: gHopP25, hopP75: gHopP75 };

    const axisP99 = (pick: (r: CloudRecord) => number[]) => {
      const out = new Array(9).fill(0);
      for (let j = 0; j < 9; j++) {
        const values = cloud.map((r) => pick(r)[j]).sort((a, b) => a - b);
        out[j] = percentileOf(values, 0.99);
      }
      return out;
    };
    this.globalAxisMax = { malt: axisP99((r) => r.m), hop: axisP99((r) => r.h) };
  }

  steer(query: SteeringQuery): SteeringResult {
    const notes: string[] = [];
    // Larger neighbourhood = steadier %s/doses (less per-recipe noise); the
    // adaptive kernel keeps the closest neighbours dominant. Tunable per query.
    const k = query.k ?? 40;
    const batchVolumeL = NOMINAL_BATCH_VOLUME_L;
    const gate = query.styleGate ?? "family";

    const match = matchBjcpStyle(query.style);
    const matchedCode = match.canonical?.split(".")[0];
    const matchedName = match.autoAccept ? match.best?.presetName : undefined;
    const fam = family(matchedName ?? query.style);
    if (!match.autoAccept) {
      notes.push(`style "${query.style}" didn't resolve to an exact BJCP entry — steering by flavour-family "${fam}" only`);
    }

    // Prefer the specific style's own centroid over the coarse family's —
    // family() buckets ~10 flavour groups for k-NN soft-gating, so leaning on
    // it as the starting point too would give every style sharing a bucket
    // (e.g. Munich Helles / Czech Pale Lager / American Lager, all "Lager")
    // the exact same median and thus the same output whenever the user
    // doesn't push an explicit flavour override.
    let centroid: Centroid;
    let strictCode: string | undefined;
    let centroidLevel: "style" | "family" | "global";
    if (gate === "none") {
      centroid = this.globalCentroid();
      centroidLevel = "global";
    } else {
      const styleLevel = this.styleCentroid(matchedCode);
      if (styleLevel) {
        centroid = styleLevel;
        strictCode = matchedCode;
        centroidLevel = "style";
      } else {
        if (matchedCode) {
          notes.push(`fewer than ${MIN_STYLE_CENTROID_RECORDS} cloud records specifically match "${matchedName}" — steering from the broader "${fam}" family median instead`);
        }
        centroid = this.familyCentroid(fam);
        centroidLevel = "family";
        if (centroid.count === 0) {
          notes.push(`no cloud records in the "${fam}" family either — falling back to the global median as the starting point`);
          centroidLevel = "global";
        }
      }
    }

    let queryYeast = centroid.yeastBlock;
    if (query.yeastName) {
      const locked = this.yeastVectorForPresetName(query.yeastName);
      if (locked) queryYeast = locked;
      else notes.push(`yeast "${query.yeastName}" has no cloud data to steer by — searching without a yeast lock`);
    }

    const queryTarget = this.clampBodyTarget(query.target, notes);
    const queryRow = this.buildQueryRow(centroid.row, queryTarget);

    // Two neighbourhoods from one k-NN pass: the tight `k` drives the quantities
    // (role %s, hop doses, timings, addition count, yeast, attenuation, ABV/IBU),
    // and a wider `varietyK` is the MENU the ingredient identities are voted (and,
    // with exploration>0, sampled) from. Kernel bandwidth is adaptive, so just
    // widening k would flatten the weighting and loosen the %s — hence the split.
    const exploration = Math.max(0, Math.min(1, query.exploration ?? 0));
    const variation = query.variation ?? 0;
    const varietyK = Math.min(
      this.cloud.length,
      Math.max(k, query.varietyK ?? Math.round(k * (1 + 2 * exploration))),
    );
    const wideRaw = this.queryNeighbors(queryRow, queryYeast, varietyK, gate, fam, strictCode);
    if (wideRaw.length === 0) throw new Error("no neighbours found in the cloud for this query");
    // The k nearest are the first k of the varietyK nearest (both sorted ascending).
    const neighbors = wideRaw.slice(0, Math.min(k, wideRaw.length));
    const weights = kernelWeights(neighbors.map((n) => n.distance));
    const weighted: WeightedNeighbor[] = neighbors.map((n, i) => ({ rec: this.cloud[n.index], weight: weights[i] }));
    const wideWeights = kernelWeights(wideRaw.map((n) => n.distance));
    const wideWeighted: WeightedNeighbor[] = wideRaw.map((n, i) => ({ rec: this.cloud[n.index], weight: wideWeights[i] }));

    // ---- average the neighbourhood's targets, synthesize one clean bill ----
    // Flavour steering already happened when the neighbourhood was chosen (the
    // target moved the query point); reconstruction just faithfully rebuilds
    // what the neighbourhood uses. `exploration` adds seeded variety.
    const { items: gristItems, notes: gristNotes } = pickGristBill(weighted, {
      identityNeighbors: wideWeighted,
      exploration,
      seed: variation,
    });
    notes.push(...gristNotes);
    const { fermentables, percentById } = buildFermentablesFromGristBill(gristItems);

    const { templates: hopTemplates, notes: hopNotes } = reconstructHopSchedule(weighted, {
      identityNeighbors: wideWeighted,
      exploration,
      seed: variation,
    });
    notes.push(...hopNotes);
    const hops = materializeHopSchedule(hopTemplates, batchVolumeL);

    let yeast: Yeast | null = query.yeastName ? buildYeastFromPresetName(query.yeastName) : null;
    if (query.yeastName && !yeast) notes.push(`yeast preset "${query.yeastName}" not found — falling back to the neighbourhood's modal yeast`);
    if (!yeast) {
      // Constrain the modal vote to strain types that belong in this style
      // family, so a corpus-polluted neighbourhood (ale-yeast "lagers", a stray
      // kveik in a clean IPA) can't hand back a category-wrong yeast. If the
      // neighbourhood has none on-style, fall back to the most common on-style
      // yeast in the whole cloud before the generic clean-ale default.
      const allow = allowYeastTypeFor(fam);
      let modalName = pickModalYeastName(weighted, { allow });
      if (!modalName) {
        modalName = this.ynByGlobalFrequency.find(allow) ?? null;
        if (modalName) notes.push(`no on-style yeast among the neighbours — defaulted to the corpus's most common "${fam}" yeast, ${modalName}`);
      }
      yeast = modalName ? buildYeastFromPresetName(modalName) : null;
    }
    if (!yeast) {
      notes.push("no reconstructable yeast in the neighbourhood — defaulting to a generic clean ale yeast");
      yeast = buildYeastFromPresetName(FALLBACK_YEAST_PRESET)!;
    }

    // ---- assemble + run through the app's real calculators ----
    const recipe = this.buildBaseRecipe(batchVolumeL, fermentables, hops, yeast, matchedName ?? query.style);

    // The corpus has no mash-schedule field at all (checked directly), but it
    // does have attenuation OUTCOMES (og/fg) — and the kinetic model is
    // already the forward map from mash temp -> attenuation, given yeast.
    // Inverting it recovers a real signal ("how hot/cold do flavour-similar
    // neighbours typically mash, to finish where they do") from data that
    // never recorded mash temperature directly. This only depends on yeast
    // attenuation + mash steps (never fermentables/OG), so it's fully
    // independent of the ABV/grain-weight solve below — no iteration needed.
    const neighborhoodAvgAttenuation = weightedMean(weighted, (r) => apparentAttenuation(r.og, r.fg));
    const mashSolve = this.solveMashTemp(recipe, neighborhoodAvgAttenuation);
    recipe.mashSteps = [{ id: "mash-1", name: "Saccharification", temperatureC: mashSolve.temperatureC, durationMinutes: 60 }];
    if (mashSolve.note) notes.push(mashSolve.note);

    // ABV is entirely determined by ingredients + process (grain %, weight,
    // efficiency) — it's not an independent fact worth "learning" from the
    // neighbourhood's raw self-reported numbers (noisy homebrew-submitted
    // data, and redundant with what the grain bill already encodes). Default
    // to the style's own BJCP guideline midpoint — a real, authoritative
    // number — and only fall back to the corpus average when the style
    // didn't resolve to a BJCP spec at all.
    const bjcpAbv = matchedCode ? getBjcpStyleSpec(matchedCode)?.abv : undefined;
    const targetABV = query.target?.abv ?? (bjcpAbv ? (bjcpAbv[0] + bjcpAbv[1]) / 2 : weightedMean(weighted, (r) => r.abv));
    const ogRefVolumeL = volumeCalculationService.calculateIntoFermenterVolume(recipe);
    const effectiveAttenuation = recipeCalculationService.getEffectiveAttenuation(recipe, "kinetic");
    recipe.fermentables = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
      fermentables, percentById, targetABV, ogRefVolumeL, recipe.equipment.brewhouseEfficiencyPercent, effectiveAttenuation,
    );

    // An explicit target is a dial — hit it precisely. With no explicit ask,
    // don't pinpoint-solve to the family centroid's derived IBU either: that
    // number is itself just an approximation, and always forcing exact
    // convergence onto it papers over the natural (and honest) variance a
    // real reconstructed hop bill has. Instead accept whatever IBU the
    // naturally-reconstructed schedule lands on, as long as it's within a
    // tolerance band of the neighbourhood's OWN average IBU — only nudge
    // toward the nearest edge of that band if it's genuinely outside it.
    if (query.target?.ibu != null) {
      recipe.hops = this.solveHopsForTargetIBU(recipe, Math.max(0, query.target.ibu));
    } else if (recipe.hops.length > 0) {
      const neighborhoodAvgIBU = weightedMean(weighted, (r) => r.ibu);
      const naturalIBU = recipeCalculationService.calculate(recipe).ibu;
      const band = Math.max(5, neighborhoodAvgIBU * 0.15);
      const lo = Math.max(0, neighborhoodAvgIBU - band);
      const hi = neighborhoodAvgIBU + band;
      if (naturalIBU < lo || naturalIBU > hi) {
        const nearestEdge = naturalIBU < lo ? lo : hi;
        recipe.hops = this.solveHopsForTargetIBU(recipe, nearestEdge);
        notes.push(`the reconstructed hop bill's natural IBU (${naturalIBU.toFixed(0)}) was outside the neighbourhood's typical ${lo.toFixed(0)}-${hi.toFixed(0)} range — nudged to ${nearestEdge.toFixed(0)}`);
      }
    }

    const calculations = recipeCalculationService.calculate(recipe);

    // ---- style-fit / density signal (graded, not a hard in/out flip) ----
    // Baseline is style-LOCAL: sampled from this style's own records, so "how far
    // have I wandered" means the same thing in a sparse style as in a dense one.
    const meanNeighborDistance = neighbors.reduce((s, n) => s + n.distance, 0) / neighbors.length;
    const baselineTag = centroidLevel === "style" ? `style:${strictCode}` : centroidLevel === "family" ? `family:${fam}` : "global";
    const baselineDistance = this.getBaselineDistance(neighbors.length, centroid.idxs, baselineTag);
    const ratio = baselineDistance > 0 ? meanNeighborDistance / baselineDistance : 0;
    const band: SteeringResult["styleFit"]["band"] =
      ratio <= STYLE_FIT_TYPICAL_MAX ? "typical" : ratio <= STYLE_FIT_STRETCH_MAX ? "stretch" : "experimental";
    const inBounds = band !== "experimental";
    if (band === "experimental") notes.push("this target sits well outside the cloud's dense region for this style — treat the result as experimental");

    const achievedMalt = aggregateMaltFlavor(gristItems.map((i) => ({ archetype: i.archetype, amount: i.pct })));
    // HOP_FLAVOR_BY_LOWER is keyed lower-case (corpus names vary in case) but
    // materializeHopSchedule prefers the properly-cased preset name for a
    // nicer recipe — lower-case just for this lookup, same as buildCloud.ts does.
    const lowerCasedHops = recipe.hops.map((h) => ({ ...h, name: h.name.toLowerCase() }));
    const achievedHop = hopFlavorCalculationService.calculateCombinedFlavor(lowerCasedHops, HOP_FLAVOR_BY_LOWER, batchVolumeL);

    const styleNorms: SteeringResult["styleNorms"] = {
      malt: { p25: malt9ToProfile(centroid.maltP25), p75: malt9ToProfile(centroid.maltP75) },
      hop: { p25: hop9ToProfile(centroid.hopP25), p75: hop9ToProfile(centroid.hopP75) },
      recordCount: centroid.count,
      level: centroidLevel,
    };

    return {
      recipe,
      calculations,
      requestedFlavor: { malt: rowToMalt(queryRow), hop: rowToHop(queryRow) },
      achievedFlavor: { malt: achievedMalt, hop: achievedHop },
      styleNorms,
      axisMax: { malt: malt9ToProfile(this.globalAxisMax.malt), hop: hop9ToProfile(this.globalAxisMax.hop) },
      style: { input: query.style, matchedCode, matchedName, family: fam },
      neighborhood: { k: neighbors.length, recordIds: neighbors.map((n) => this.cloud[n.index].id), weights },
      styleFit: { meanNeighborDistance, baselineDistance, ratio, band, inBounds },
      notes,
    };
  }

  // ── style centroid ─────────────────────────────────────────────────────────

  private globalCentroid(): Centroid {
    return { row: this.stats.mean, yeastBlock: new Map(), count: this.cloud.length, ...this.globalRange };
  }

  private centroidFromIndices(idxs: number[]): Centroid {
    const row = componentwiseMean(idxs.map((i) => continuousRow({
      m: this.cloud[i].m, h: this.cloud[i].h, og: this.cloud[i].og, ibu: this.cloud[i].ibu, srm: this.cloud[i].srm, mb: this.cloud[i].mb,
    })));
    const yeastBlock = blendYeastBlocks(idxs.map((i) => this.yeastBlocks[i]), idxs.map(() => 1));
    const { p25: maltP25, p75: maltP75 } = axisRange(idxs, this.cloud, (r) => r.m, 9);
    const { p25: hopP25, p75: hopP75 } = axisRange(idxs, this.cloud, (r) => r.h, 9);
    return { row, yeastBlock, count: idxs.length, idxs, maltP25, maltP75, hopP25, hopP75 };
  }

  private familyCentroid(fam: StyleFamily): Centroid {
    const idxs: number[] = [];
    for (let i = 0; i < this.cloud.length; i++) if (this.familyOf[i] === fam) idxs.push(i);
    if (idxs.length === 0) return this.globalCentroid();
    return this.centroidFromIndices(idxs);
  }

  /** The specific-style-level centroid, or null if the code is unresolved or too thin on data to trust. */
  private styleCentroid(code: string | undefined): Centroid | null {
    if (!code) return null;
    const idxs: number[] = [];
    for (let i = 0; i < this.cloud.length; i++) if (this.styleCodeOf[i] === code) idxs.push(i);
    if (idxs.length < MIN_STYLE_CENTROID_RECORDS) return null;
    return this.centroidFromIndices(idxs);
  }

  private yeastVectorForPresetName(name: string): YeastBlock | null {
    const cls = this.presetNameToClass.get(name);
    return cls ? yeastBlockFromClass(cls, this.vocab) : null;
  }

  // ── query construction ───────────────────────────────────────────────────────

  /**
   * Clamp the body target to the cloud's real maltBody range (±3σ). The feature
   * is tiny in magnitude (mean ~0.08, σ ~0.12), so a UI slider that runs to,
   * say, 2 would place the query ~16σ out — k-NN then ignores everything else
   * and grabs the few adjunct "body bombs", producing an un-mashable grist. This
   * keeps the push on the manifold; the grist brewability floor is the backstop.
   */
  private clampBodyTarget(target: SteeringTarget | undefined, notes: string[]): SteeringTarget | undefined {
    if (target?.body == null) return target;
    const mean = this.stats.mean[MALTBODY_IDX];
    const std = this.stats.std[MALTBODY_IDX];
    const lo = mean - 3 * std;
    const hi = mean + 3 * std;
    if (target.body >= lo && target.body <= hi) return target;
    const clamped = Math.max(lo, Math.min(hi, target.body));
    notes.push(`body target ${target.body.toFixed(2)} is beyond what real grists reach — clamped to ${clamped.toFixed(2)} to keep the recipe brewable`);
    return { ...target, body: clamped };
  }

  /** Overlay explicit target axes onto the style centroid; unset axes keep the centroid's value. */
  private buildQueryRow(centroidRow: number[], target?: SteeringTarget): number[] {
    const row = [...centroidRow];
    if (target?.malt) {
      for (const [key, value] of Object.entries(target.malt)) {
        if (value == null) continue;
        const idx = MALT_FLAVOR_KEYS.indexOf(key as (typeof MALT_FLAVOR_KEYS)[number]);
        if (idx >= 0) row[idx] = value;
      }
    }
    if (target?.hop) {
      for (const [key, value] of Object.entries(target.hop)) {
        if (value == null) continue;
        const idx = HOP_FLAVOR_KEYS.indexOf(key as (typeof HOP_FLAVOR_KEYS)[number]);
        if (idx >= 0) row[9 + idx] = value;
      }
    }
    if (target?.abv != null) {
      // GRAVITY_IDX holds gravity POINTS ((og-1)*1000, see gravityPoints()), not (og-1) —
      // the missing *1000 here previously produced a ~1000x-too-small value that also
      // corrupted the buGu dim below, blowing up k-NN distance for any ABV-targeted query.
      row[GRAVITY_IDX] = (1000 * target.abv) / (ABV_FACTOR * ASSUMED_ATTENUATION_FOR_QUERY);
    }
    if (target?.ibu != null) row[IBU_IDX] = target.ibu;
    if (target?.srm != null) row[SRM_IDX] = target.srm;
    // Only re-derive buGu when a target actually moved gravity or IBU. Otherwise
    // keep the centroid's own buGu (the neighbourhood mean of per-recipe ibu/grav),
    // so a no-target query point equals the centroid exactly instead of drifting
    // to a ratio-of-means on this one dim.
    if (target?.abv != null || target?.ibu != null) {
      row[BUGU_IDX] = row[GRAVITY_IDX] > 0 ? row[IBU_IDX] / row[GRAVITY_IDX] : 0;
    }
    if (target?.body != null) row[MALTBODY_IDX] = target.body;
    return row;
  }

  // ── k-NN ─────────────────────────────────────────────────────────────────────

  private queryNeighbors(
    queryRow: number[],
    queryYeast: YeastBlock,
    k: number,
    gate: StyleGateMode,
    fam: StyleFamily,
    strictCode?: string,
  ): Array<{ index: number; distance: number }> {
    const qz = zScore(queryRow, this.stats);
    const qn2 = yeastNorm2(queryYeast);

    // "strict" restricts to whichever level the centroid itself came from —
    // the specific style when we had enough data for one, else the family.
    const candidateIdx: number[] = [];
    for (let i = 0; i < this.cloud.length; i++) {
      if (gate === "strict") {
        if (strictCode ? this.styleCodeOf[i] !== strictCode : this.familyOf[i] !== fam) continue;
      }
      candidateIdx.push(i);
    }
    if (candidateIdx.length === 0) throw new Error(`no cloud records for a strict style gate on "${strictCode ?? fam}"`);

    const distances = new Float64Array(candidateIdx.length);
    for (let c = 0; c < candidateIdx.length; c++) {
      const i = candidateIdx[c];
      distances[c] = weightedDistance2(qz, queryYeast, qn2, this.zRows[i], this.yeastBlocks[i], this.yeastNorms[i]);
    }
    const nearest = kNearestByDistance(distances, Math.min(k, candidateIdx.length));
    return nearest.map((n) => ({ index: candidateIdx[n.index], distance: n.distance }));
  }

  // ── style-fit baseline ───────────────────────────────────────────────────────

  /**
   * Typical distance-to-k-th-neighbour for a TYPICAL RECIPE OF THIS STYLE — the
   * "how dense is the corpus normally, around here" yardstick the style-fit
   * ratio is measured against. The sample points come from the style's own
   * records (`sampleIdxs`) so a sparse style (few, spread-out recipes) gets a
   * larger baseline and its own median brew still reads as typical, while a
   * dense style (a packed thicket like American IPA) gets a smaller one and the
   * meter turns discriminating there. The candidate set stays a whole-cloud
   * subsample — that's what real queries actually search against. Global sample
   * (`sampleIdxs` undefined) reproduces the old whole-cloud baseline; cached
   * per (style tag, k).
   */
  private getBaselineDistance(k: number, sampleIdxs: number[] | undefined, tag: string): number {
    const cacheKey = `${tag}:${k}`;
    const cached = this.baselineCache.get(cacheKey);
    if (cached != null) return cached;

    const N = this.cloud.length;
    const candidateStride = Math.max(1, Math.floor(N / 8000));
    const candidateIdx: number[] = [];
    for (let i = 0; i < N; i += candidateStride) candidateIdx.push(i);

    const pool = sampleIdxs && sampleIdxs.length > 0 ? sampleIdxs : null;
    const poolSize = pool ? pool.length : N;
    const sampleStride = Math.max(1, Math.floor(poolSize / Math.min(200, poolSize)));
    const kthDistances: number[] = [];
    for (let p = 0; p < poolSize; p += sampleStride) {
      const s = pool ? pool[p] : p;
      const distances = new Float64Array(candidateIdx.length);
      for (let c = 0; c < candidateIdx.length; c++) {
        const ci = candidateIdx[c];
        distances[c] = ci === s
          ? Infinity
          : weightedDistance2(this.zRows[s], this.yeastBlocks[s], this.yeastNorms[s], this.zRows[ci], this.yeastBlocks[ci], this.yeastNorms[ci]);
      }
      const kthK = Math.min(k, candidateIdx.length - 1);
      if (kthK <= 0) continue;
      const nearest = kNearestByDistance(distances, kthK);
      if (nearest.length > 0) kthDistances.push(nearest[nearest.length - 1].distance);
    }
    kthDistances.sort((a, b) => a - b);
    const median = kthDistances[Math.floor(kthDistances.length / 2)] ?? 0;
    this.baselineCache.set(cacheKey, median);
    return median;
  }

  // ── mash-temp solver ─────────────────────────────────────────────────────────

  /**
   * Bisect a single-infusion, 60-minute mash temperature so the kinetic
   * attenuation model (given our reconstructed yeast) reproduces the
   * neighbourhood's own typical apparent attenuation. Cooler mash -> more
   * fermentable wort -> higher attenuation, monotonically over the practical
   * range, so plain bisection suffices (no growth phase needed, unlike the
   * IBU solver — the search bounds are already known-achievable endpoints).
   * Only depends on `recipe.yeasts`/`recipe.mashSteps`, never fermentables,
   * so it's safe to call before the grain bill has real weights.
   */
  private solveMashTemp(recipe: Recipe, targetAttenuation: number): { temperatureC: number; note?: string } {
    const attenuationAt = (t: number) => recipeCalculationService.getEffectiveAttenuation(
      { ...recipe, mashSteps: [{ id: "mash-1", name: "Saccharification", temperatureC: t, durationMinutes: 60 }] },
      "kinetic",
    );

    let lo = MASH_TEMP_RANGE.lo;
    let hi = MASH_TEMP_RANGE.hi;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (attenuationAt(mid) > targetAttenuation) lo = mid; else hi = mid;
    }
    const solved = Math.round(((lo + hi) / 2) * 2) / 2; // nearest 0.5°C — false precision otherwise
    const achieved = attenuationAt(solved);

    const note = Math.abs(achieved - targetAttenuation) > MASH_SOLVE_NOTE_THRESHOLD
      ? `the neighbourhood's typical ~${(targetAttenuation * 100).toFixed(0)}% attenuation is outside what a single-infusion mash can reach for this yeast within ${MASH_TEMP_RANGE.lo}-${MASH_TEMP_RANGE.hi}°C — settled on ${solved}°C (~${(achieved * 100).toFixed(0)}%)`
      : undefined;
    return { temperatureC: solved, note };
  }

  // ── IBU solver ───────────────────────────────────────────────────────────────

  /**
   * Adjust the hop bill to hit a target IBU, biasing the change onto the
   * BITTERING charge so late/aroma character survives the correction.
   *
   * The blunt version scaled every hop uniformly, which is wrong for the common
   * case: a reconstructed hop-forward bill lands its bitterness a bit off but
   * its whirlpool/dry-hop doses are exactly the flavour the query asked for —
   * scaling those to fix IBU throws away the aroma to fix the bitterness. So:
   * hold the flavour/aroma/whirlpool/dry-hop additions fixed and bisect only the
   * early-boil (≥ BITTERING_MIN_MINUTES) + first-wort charge. Fall back to
   * uniform scaling only when there's no bittering charge to move, or when the
   * fixed late hops already exceed the target on their own (can't preserve them
   * and still get that low). Bisection throughout because dry-hop IBU
   * (humulinone extraction) is sub-linear in grams — see @/calculators/ibu.
   */
  private solveHopsForTargetIBU(recipe: Recipe, targetIBU: number): Hop[] {
    const baseHops = recipe.hops;
    const isBittering = (h: Hop) => (h.type === "boil" && (h.timeMinutes ?? 0) >= BITTERING_MIN_MINUTES) || h.type === "first wort";
    const scaleBitteringBy = (scale: number): Hop[] => baseHops.map((h) => (isBittering(h) ? { ...h, grams: h.grams * scale } : h));

    const bisect = (ibuAt: (scale: number) => number, build: (scale: number) => Hop[]): Hop[] | null => {
      let lo = 0;
      let hi = 1;
      let hiIbu = ibuAt(hi);
      let guard = 0;
      while (hiIbu < targetIBU && guard++ < 24) { hi *= 2; hiIbu = ibuAt(hi); }
      if (hiIbu < targetIBU) return null; // even a huge scale can't reach it
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (ibuAt(mid) < targetIBU) lo = mid; else hi = mid;
      }
      return build((lo + hi) / 2);
    };

    // Preferred path: move only the bittering charge, if there is one and the
    // fixed rest doesn't already overshoot the target.
    if (baseHops.some(isBittering)) {
      const restIBU = recipeCalculationService.calculate({ ...recipe, hops: baseHops.filter((h) => !isBittering(h)) }).ibu;
      if (restIBU <= targetIBU) {
        const solved = bisect(
          (scale) => recipeCalculationService.calculate({ ...recipe, hops: scaleBitteringBy(scale) }).ibu,
          scaleBitteringBy,
        );
        if (solved) return solved;
      }
    }

    // Fallback: uniform scale of the whole bill.
    const solved = bisect(
      (scale) => recipeCalculationService.calculate({ ...recipe, hops: scaleHops(baseHops, scale) }).ibu,
      (scale) => scaleHops(baseHops, scale),
    );
    return solved ?? baseHops; // no bittering potential at all — nothing to solve
  }

  // ── recipe skeleton ──────────────────────────────────────────────────────────

  private buildBaseRecipe(
    batchVolumeL: number,
    fermentables: Fermentable[],
    hops: Hop[],
    yeast: Yeast,
    styleName: string,
  ): Recipe {
    const now = new Date().toISOString();
    return {
      id: "steered-recipe",
      name: `Steered ${styleName}`,
      style: styleName,
      currentVersion: 1,
      batchVolumeL,
      equipment: {
        boilTimeMin: 60,
        boilOffRateLPerHour: 4,
        brewhouseEfficiencyPercent: 75,
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
      yeasts: [yeast],
      otherIngredients: [],
      // Throwaway placeholder — steer() immediately overwrites this with
      // solveMashTemp()'s result. The raw corpus has no mash temperature/
      // duration field at all (checked directly — its only process-adjacent
      // field is "ph mash", a pH reading, usually -1/unset), so there's no
      // per-neighbourhood mash schedule to copy; instead we infer one from
      // attenuation outcomes (see solveMashTemp's docstring).
      mashSteps: [{ id: "mash-1", name: "Saccharification", temperatureC: 67, durationMinutes: 60 }],
      fermentationSteps: [],
      createdAt: now,
      updatedAt: now,
    };
  }
}
