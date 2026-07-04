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
  archetypeForPresetName,
  correctMaltGristToward,
  correctHopScheduleToward,
  normalizeHopName,
  blendGristPct,
  type GristBillItem,
  type HopTemplate,
} from "./reconstruction";
import { hashSeed, mulberry32 } from "./prng";
import { featurize, type FermentableClassification } from "./featurize";

export type StyleGateMode = "family" | "strict" | "none";
/** The adaptive gate's rungs, tightest → widest (see queryNeighbors). */
type RestrictLevel = "style" | "family" | "none";

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
   * The grain and hop bills reroll INDEPENDENTLY — set `gristVariation` /
   * `hopVariation` to reroll one while the other stays put (lock one, reroll the
   * other). Both fall back to `variation` when unset.
   */
  variation?: number;
  /** Reroll seed for the GRAIN bill only. Bump to reroll the grist while the hops stay fixed (lock hops). Defaults to `variation`. */
  gristVariation?: number;
  /** Reroll seed for the HOP bill only. Bump to reroll the hops while the grist stays fixed (lock grain). Defaults to `variation`. */
  hopVariation?: number;
  /**
   * Size of the wider neighbourhood the ingredient IDENTITIES are voted from —
   * the "menu" of plausible malts/hops — while the %s/doses stay on the tight
   * `k`. Defaults to a modest multiple of `k` that grows with `exploration`
   * (k when exploration is 0, so behaviour is unchanged there).
   */
  varietyK?: number;
  /**
   * Verbatim ingredient locks. When set, that bill is used EXACTLY as given —
   * its reconstruction AND its solver (grain: the reverse-ABV weight solve;
   * hops: the IBU solve) are skipped, so it survives a reroll or a re-steer
   * byte-for-byte. This is the hard "lock this bill, reroll the other" the
   * seed-only reroll couldn't guarantee (a rerolled grist shifts OG, and the
   * IBU solver would then rescale even "seed-locked" hops). Pass the previous
   * result's `recipe.fermentables` / `recipe.hops` back in.
   */
  lockedFermentables?: Fermentable[];
  lockedHops?: Hop[];
  /**
   * How many candidate reconstructions to generate off the (shared) k-NN
   * neighbourhood and rerank by how closely their ACHIEVED flavour matches the
   * request — the closed loop that turns "spikier selection" from random
   * variety into DIRECTED search. Every candidate is still built only from
   * ingredients real neighbours used, so realism is untouched; we just keep the
   * one that best hits the target. Candidate 0 is always the deterministic
   * single-shot pick (raw seeds, `exploration` as given), so reranking can only
   * match or beat today's output, never regress. 1 = today's behaviour exactly.
   */
  candidates?: number;
  /**
   * Style ↔ push balance for the rerank score, 0-1. 0 (default): the full
   * requested profile is scored, so a candidate is rewarded for staying on the
   * style's own centroid everywhere the user DIDN'T push — a good, on-style beer
   * that also leans the way they asked. 1 ("crazy mode"): only the pushed axes
   * count, so the rerank chases them hard and lets the rest drift wherever the
   * best-matching candidate lands. Pushed axes are always weighted heavily; this
   * only controls how much the UNpushed axes pull back toward the style.
   */
  wildness?: number;
  /**
   * After reranking, close the reachable part of a MALT flavour shortfall by
   * using more of the grain that drives the deficit axis (see
   * `correctMaltGristToward`) — the fraction-move the k-NN rerank structurally
   * can't make. Bounded and brewability-gated; only acts on pushed malt axes and
   * only with an unlocked grain bill. Default false (no behaviour change).
   */
  correctResidual?: boolean;
  /**
   * EXPERIMENTAL (only affects residual correction). When raising a pushed axis,
   * penalise a donor ingredient for the flavour it also adds to OTHER pushed axes
   * already at/over target — so pulling one axis down (e.g. stone fruit) while
   * keeping others up (berry, tropical) picks the "purest" donor instead of one
   * that drags the pulled-down axis back up. Can't fully decouple axes that real
   * ingredients bundle together, only stop the correction fighting the ask.
   * Default false.
   */
  avoidCollateral?: boolean;
  /**
   * EXPERIMENTAL. Search a SEPARATE neighbourhood for the grain bill and the hop
   * bill — the grain steered only by the malt-side dims (malt axes + gravity + SRM
   * + body), the hops only by the hop-side dims (hop axes + IBU + buGu), each
   * grounded at the style centroid on the other's dims. Avoids the sparse "weird
   * zone" a joint malt+hop push lands in (each profile common alone, the
   * combination rare), so both bills come from dense, real parts of the cloud.
   * Only diverges from the default when you actually push both sides. Default false
   * (one shared neighbourhood, byte-identical to the original behaviour).
   */
  splitNeighbourhoods?: boolean;
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
  /**
   * The raw value that maps to the TOP of a 0-5 flavour dial (dial-5), per axis.
   * `axisMax` is dial-4 (the edge of typical); this is `axisMax × AXIS_DIAL_HEADROOM`,
   * the aggressive-but-brewable extreme residual correction can reach. A UI should
   * scale its radar full-scale AND its target wheels to THIS, so the wheels fill
   * with realistic recipes over 0-4 and the 4-5 zone is a genuine "push it" reach.
   */
  axisDialMax: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  /** The cloud's robust maltBody range — lets a UI map a normalized "thin ↔ full" dial to a real `target.body`. */
  bodyRange: { min: number; mid: number; max: number };
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

/**
 * Phase 0 of PRD-009 — place an imported recipe on the flavour radars next to
 * its matched style's norm box. No edits; just featurize + style context.
 * Shares `styleNorms` / `axisMax` / `axisDialMax` display fields with
 * `SteeringResult` so the studio can render either interchangeably.
 */
export type ReflectResult = {
  recipe: Recipe;
  calculations: RecipeCalculations;
  achievedFlavor: { malt: MaltFlavorProfile; hop: HopFlavorProfile };
  /** 23-dim continuous row — the recipe's point in the cloud's feature space. */
  row: number[];
  maltBody: number;
  styleNorms: SteeringResult["styleNorms"];
  axisMax: SteeringResult["axisMax"];
  axisDialMax: SteeringResult["axisDialMax"];
  bodyRange: SteeringResult["bodyRange"];
  style: SteeringResult["style"];
  classifications: FermentableClassification[];
  unmatchedRate: number;
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
 * Weight of the yeast multi-hot block in the k-NN DISTANCE. Zero on purpose:
 * yeast is now selected for the style separately (modalYeastOverIdxs), so
 * letting it also shape the flavour neighbourhood just dilutes how much a
 * flavour push moves the result. It was 3 — ~27% of the distance — tuned for
 * style purity, a classification goal we no longer optimise for. Dial back up
 * if flavour neighbourhoods start drifting off-style despite the explicit gate.
 */
const KNN_YEAST_WEIGHT = 0;

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

/** Reranking a single candidate is just today's single-shot path — no spread to choose from. */
const DEFAULT_CANDIDATES = 1;
/** Sanity cap on candidate count (each is a full reconstruction + solve pass). */
const MAX_CANDIDATES = 32;
/**
 * Exploration forced onto the ALTERNATIVE candidates (index ≥ 1) when reranking,
 * if the caller didn't ask for more. Candidate 0 keeps the caller's own
 * `exploration`, so the deterministic baseline is always in the pool; the
 * alternatives need some spread or they'd all collapse to that same pick and
 * there'd be nothing to rerank. Only engaged when `candidates > 1`.
 */
const RERANK_ALT_EXPLORATION = 0.6;
/** How much more a user-pushed axis counts than an unpushed one in the rerank score. */
const RERANK_PUSHED_AXIS_WEIGHT = 3;
/**
 * How many of the best-aligned candidates form the "another take" pool. The
 * rerank still returns the single best on a fresh query (variation seed 0), but a
 * reroll (any non-zero grist/hop seed) surfaces a DIFFERENT, still-well-aligned
 * candidate seeded by that reroll — instead of always re-finding the one global
 * best and looking near-identical. Only these top-N by alignment are eligible, so
 * a take is always one of the closest matches, never a poorly-aligned outlier.
 * (Could later be exposed as a "how different" knob.)
 */
const RERANK_ROTATE_POOL = 5;
/**
 * Adaptive-gate miss threshold: normalised RMS error (achieved vs requested, on the
 * pushed axes, scaled by each axis's ceiling) above which the style is judged
 * unable to hit the push in-style, so the gate widens a rung. ~0.3 ≈ "still off by
 * a third of the axis after correction" — a genuine miss (roast on a hazy), not the
 * small residual a reachable target leaves.
 */
const GATE_MISS_THRESHOLD = 0.3;
/** Floor for an axis's ceiling when normalising rerank error (guards divide-by-zero on a dead axis). */
const RERANK_AXIS_MAX_FLOOR = 0.1;
/**
 * Dial headroom above the typical ceiling. `axisMax` is the corpus's ~p99 — the
 * edge of what NORMAL recipes reach — which we map to dial-4, not dial-5, so
 * realistic recipes fill the lower 0-4 of a flavour wheel and the top 4-5 is
 * reserved for a deliberate push past typical. `axisDialMax = axisMax × this` is
 * that dial-5 point: aggressive but still brewable, and — validated on the real
 * cloud (RecipeSteeringService.rerank.test.ts) — almost exactly what residual
 * correction (#3) can actually reach on every malt axis (mean ratio ~1.00). So
 * the top of the dial is a real, reachable target, not a lie. (Hops currently
 * reach ~0.81 of it via rerank alone until a hop-side correction lands.)
 */
const AXIS_DIAL_HEADROOM = 1.25;

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
/**
 * BJCP data-quality filter. Homebrew corpus style labels are noisy — a third of
 * recipes tagged "American Light Lager" run past 8 SRM (amber, crystal-laden),
 * dragging the style AVERAGE dark and poisoning both the centroid and the k-NN.
 * When the matched style has an SRM guideline, keep only records within
 * [lo × LO, hi × HI] of it, so a beer that violates its own style's colour spec
 * can't define that style. HI is the load-bearing bound (junk is darker than
 * spec); LO stays generous. No SRM spec → no filter (unresolved/exotic styles).
 */
const STYLE_SRM_TOLERANCE_HI = 1.3;
const STYLE_SRM_TOLERANCE_LO = 0.5;

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

  /**
   * PRD-009 Phase 0 — featurize an arbitrary recipe and return it against its
   * matched style's norm box. Purely reflective: no edits, no k-NN, no solve.
   * Style is auto-resolved from `recipe.style` (overridable via `opts.style`).
   */
  reflect(recipe: Recipe, opts?: { style?: string }): ReflectResult {
    const notes: string[] = [];
    const feat = featurize(recipe);
    notes.push(...feat.notes);

    const styleInput = (opts?.style ?? recipe.style ?? "").trim() || "American IPA";
    const match = matchBjcpStyle(styleInput);
    const matchedCode = match.canonical?.split(".")[0];
    const matchedName = match.autoAccept ? match.best?.presetName : undefined;
    const fam = family(matchedName ?? styleInput);
    if (!match.autoAccept) {
      notes.push(`style "${styleInput}" didn't resolve to an exact BJCP entry — norms from flavour-family "${fam}"`);
    }

    let centroid: Centroid;
    let centroidLevel: "style" | "family" | "global";
    const styleLevel = this.styleCentroid(matchedCode);
    if (styleLevel) {
      centroid = styleLevel;
      centroidLevel = "style";
    } else {
      centroid = this.familyCentroid(fam);
      centroidLevel = centroid.count === this.cloud.length ? "global" : "family";
      if (match.autoAccept) {
        notes.push(
          `fewer than ${MIN_STYLE_CENTROID_RECORDS} cloud records specifically match "${matchedName ?? styleInput}" — norms from the broader "${fam}" family`,
        );
      }
    }

    return {
      recipe,
      calculations: feat.calculations,
      achievedFlavor: { malt: feat.malt, hop: feat.hop },
      row: feat.row,
      maltBody: feat.maltBody,
      styleNorms: {
        malt: { p25: malt9ToProfile(centroid.maltP25), p75: malt9ToProfile(centroid.maltP75) },
        hop: { p25: hop9ToProfile(centroid.hopP25), p75: hop9ToProfile(centroid.hopP75) },
        recordCount: centroid.count,
        level: centroidLevel,
      },
      axisMax: { malt: malt9ToProfile(this.globalAxisMax.malt), hop: hop9ToProfile(this.globalAxisMax.hop) },
      axisDialMax: {
        malt: malt9ToProfile(this.globalAxisMax.malt.map((v) => v * AXIS_DIAL_HEADROOM)),
        hop: hop9ToProfile(this.globalAxisMax.hop.map((v) => v * AXIS_DIAL_HEADROOM)),
      },
      bodyRange: { min: this.stats.lo[MALTBODY_IDX], mid: this.stats.mean[MALTBODY_IDX], max: this.stats.hi[MALTBODY_IDX] },
      style: { input: styleInput, matchedCode, matchedName, family: fam },
      classifications: feat.classifications,
      unmatchedRate: feat.unmatchedRate,
      notes,
    };
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

    // Each neighbourhood yields two nested sets: the tight `k` drives the
    // quantities (role %s, hop doses, timings, addition count, attenuation, IBU),
    // and a wider `varietyK` is the MENU the ingredient identities are voted (and,
    // with exploration>0, sampled) from. Kernel bandwidth is adaptive, so just
    // widening k would flatten the weighting and loosen the %s — hence the split.
    const exploration = Math.max(0, Math.min(1, query.exploration ?? 0));
    const variation = query.variation ?? 0;
    // Independent reroll seeds so the grain and hop bills can be rerolled
    // separately — lock one (keep its seed) and reroll the other.
    const gristSeed = query.gristVariation ?? variation;
    const hopSeed = query.hopVariation ?? variation;
    const varietyK = Math.min(
      this.cloud.length,
      Math.max(k, query.varietyK ?? Math.round(k * (1 + 2 * exploration))),
    );

    // Split neighbourhoods: steer the grain bill and the hop bill in their OWN
    // subspaces, each grounded at the style centroid on the other's dims. Pushing
    // both malt AND hop hard would otherwise drive one joint query point into a
    // sparse corner the cloud barely occupies (roasty AND tropical: each common
    // alone, the combination almost unseen), so reconstruction ends up averaging
    // weird outliers. Split → the grain comes from real recipes with this MALT
    // profile and the hops from real recipes with this HOP profile, both dense; the
    // malt↔hop correlation is only "broken" exactly when the user deliberately asks
    // for a combination real brewers don't make. Default off = one shared query row
    // for both, byte-identical to the original single-neighbourhood behaviour.
    const split = query.splitNeighbourhoods ?? false;
    const grainRow = this.buildQueryRow(centroid.row, query.target, split ? "grain" : "both");
    const hopRow = split ? this.buildQueryRow(centroid.row, query.target, "hop") : grainRow;

    const deriveHood = (wideRaw: Array<{ index: number; distance: number }>) => {
      // The k nearest are the first k of the varietyK nearest (both sorted ascending).
      const neighbors = wideRaw.slice(0, Math.min(k, wideRaw.length));
      const weights = kernelWeights(neighbors.map((n) => n.distance));
      const weighted: WeightedNeighbor[] = neighbors.map((n, i) => ({ rec: this.cloud[n.index], weight: weights[i] }));
      const wideWeights = kernelWeights(wideRaw.map((n) => n.distance));
      const wideWeighted: WeightedNeighbor[] = wideRaw.map((n, i) => ({ rec: this.cloud[n.index], weight: wideWeights[i] }));
      return { neighbors, weights, weighted, wideWeighted };
    };
    type Hood = ReturnType<typeof deriveHood>;

    // A locked bill is used verbatim — no reconstruction, and no gate probing on that side.
    const grainLocked = !!query.lockedFermentables?.length;
    const hopsLocked = !!query.lockedHops?.length;

    // Requested flavour (target overlaid on the style centroid) + which axes were
    // pushed. Up here because the adaptive gate below PROBES whether a rung can hit them.
    const reqMalt = rowToMalt(grainRow);
    const reqHop = rowToHop(hopRow);
    const pushedMalt = new Set(Object.entries(query.target?.malt ?? {}).filter(([, v]) => v != null).map(([key]) => key));
    const pushedHop = new Set(Object.entries(query.target?.hop ?? {}).filter(([, v]) => v != null).map(([key]) => key));

    // Ingredient sanctions + prevalence from a hood's identity neighbourhood — the
    // corrections reach only for what real neighbours used, weighted toward the common.
    const hoodSanctions = (hood: Hood) => {
      const maltPrevalence = blendGristPct(hood.wideWeighted);
      const hopPrevalence: Record<string, number> = {};
      for (const { rec, weight } of hood.wideWeighted) for (const [name, gpl] of rec.hp) if (gpl > 0) hopPrevalence[normalizeHopName(name)] = (hopPrevalence[normalizeHopName(name)] ?? 0) + weight * gpl;
      return {
        maltPrevalence,
        maltSanctioned: new Set<string>(Object.keys(maltPrevalence).filter((a) => maltPrevalence[a] > 0)),
        hopPrevalence,
        hopSanctioned: new Set<string>(Object.keys(hopPrevalence)),
      };
    };

    // Shared bill builders (reconstruct + residual-correct from a hood) — used both
    // to PROBE a gate rung (seed 0) and to synthesize the final candidates.
    const buildGrist = (hood: Hood, seed: number, expl: number): { items: GristBillItem[]; notes: string[] } => {
      const s = hoodSanctions(hood);
      const grist = pickGristBill(hood.weighted, { identityNeighbors: hood.wideWeighted, exploration: expl, seed });
      let items = grist.items;
      const gnotes = [...grist.notes];
      if (query.correctResidual && pushedMalt.size > 0) {
        const maltTarget: Partial<MaltFlavorProfile> = {};
        for (const key of pushedMalt) maltTarget[key as keyof MaltFlavorProfile] = reqMalt[key as keyof MaltFlavorProfile];
        const c = correctMaltGristToward(items, s.maltSanctioned, maltTarget, { avoidCollateral: query.avoidCollateral, prevalence: s.maltPrevalence });
        items = c.items;
        gnotes.push(...c.notes);
      }
      return { items, notes: gnotes };
    };
    const buildHopTemplates = (hood: Hood, seed: number, expl: number): { templates: HopTemplate[]; notes: string[] } => {
      const s = hoodSanctions(hood);
      const hopRes = reconstructHopSchedule(hood.weighted, { identityNeighbors: hood.wideWeighted, exploration: expl, seed });
      let templates = hopRes.templates;
      const hnotes = [...hopRes.notes];
      if (query.correctResidual && pushedHop.size > 0) {
        const hopTarget: Partial<HopFlavorProfile> = {};
        for (const key of pushedHop) hopTarget[key as keyof HopFlavorProfile] = reqHop[key as keyof HopFlavorProfile];
        const evaluate = (tpls: HopTemplate[]): HopFlavorProfile => {
          const hs = materializeHopSchedule(tpls, batchVolumeL).map((h) => ({ ...h, name: h.name.toLowerCase() }));
          return hopFlavorCalculationService.calculateCombinedFlavor(hs, HOP_FLAVOR_BY_LOWER, batchVolumeL);
        };
        const c = correctHopScheduleToward(templates, s.hopSanctioned, (name) => HOP_FLAVOR_BY_LOWER.get(name), hopTarget, evaluate, { avoidCollateral: query.avoidCollateral, prevalence: s.hopPrevalence });
        templates = c.templates;
        hnotes.push(...c.notes);
      }
      return { templates, notes: hnotes };
    };
    // Normalised RMS error of an achieved bill vs the request, on the pushed axes only.
    const maltProbeErr = (items: GristBillItem[]): number => {
      const a = aggregateMaltFlavor(items.map((i) => ({ archetype: i.archetype, amount: i.pct })));
      let sum = 0; let n = 0;
      MALT_FLAVOR_KEYS.forEach((key, i) => {
        if (!pushedMalt.has(key)) return;
        const max = Math.max(this.globalAxisMax.malt[i], RERANK_AXIS_MAX_FLOOR);
        const d = (a[key] - reqMalt[key]) / max; sum += d * d; n++;
      });
      return n ? Math.sqrt(sum / n) : 0;
    };
    const hopProbeErr = (templates: HopTemplate[]): number => {
      const hs = materializeHopSchedule(templates, batchVolumeL).map((h) => ({ ...h, name: h.name.toLowerCase() }));
      const a = hopFlavorCalculationService.calculateCombinedFlavor(hs, HOP_FLAVOR_BY_LOWER, batchVolumeL);
      let sum = 0; let n = 0;
      HOP_FLAVOR_KEYS.forEach((key, i) => {
        if (!pushedHop.has(key)) return;
        const max = Math.max(this.globalAxisMax.hop[i], RERANK_AXIS_MAX_FLOOR);
        const d = (a[key] - reqHop[key]) / max; sum += d * d; n++;
      });
      return n ? Math.sqrt(sum / n) : 0;
    };

    // ---- adaptive style gate: stay tight to the style, widen ONLY when a push
    // genuinely can't be hit in-style. Rungs: this exact style → its family → the
    // whole cloud. At rest (nothing pushed) it never widens, so a hazy is built only
    // from hazies — no other style's grains bleeding in (that was the crystal leak).
    // An explicit `styleGate` pins a fixed rung. ----
    const gateToRestrict: Record<StyleGateMode, RestrictLevel> = { strict: "style", family: "family", none: "none" };
    const fullLadder = (["style", "family", "none"] as RestrictLevel[]).filter((r) => r !== "style" || !!strictCode);
    const ladder: RestrictLevel[] = query.styleGate ? [gateToRestrict[query.styleGate]] : fullLadder;
    // Restrict the tightest ("style") rung to exactly the records the style centroid
    // used — the BJCP-SRM-conformant ones — so the neighbourhood is built from the
    // same de-junked set, not the mislabelled dark recipes that share the label.
    const styleIdxSet = centroidLevel === "style" && centroid.idxs ? new Set(centroid.idxs) : undefined;
    const styleConform = styleIdxSet ? (i: number) => styleIdxSet.has(i) : undefined;
    let restrict: RestrictLevel = ladder[0];
    let grainHood!: Hood;
    let hopHood!: Hood;
    let built = false;
    for (const r of ladder) {
      const grainRaw = this.queryNeighbors(grainRow, queryYeast, varietyK, r, fam, strictCode, styleConform);
      if (grainRaw.length === 0) continue; // no records at this rung — widen to the next
      restrict = r;
      grainHood = deriveHood(grainRaw);
      hopHood = split ? deriveHood(this.queryNeighbors(hopRow, queryYeast, varietyK, r, fam, strictCode, styleConform)) : grainHood;
      built = true;
      const canProbeMalt = pushedMalt.size > 0 && !grainLocked;
      const canProbeHop = pushedHop.size > 0 && !hopsLocked;
      if (!canProbeMalt && !canProbeHop) break; // nothing pushed → stay tightest
      const mErr = canProbeMalt ? maltProbeErr(buildGrist(grainHood, 0, exploration).items) : 0;
      const hErr = canProbeHop ? hopProbeErr(buildHopTemplates(hopHood, 0, exploration).templates) : 0;
      if (Math.max(mErr, hErr) <= GATE_MISS_THRESHOLD) break; // reachable in-style → stop widening
    }
    if (!built) throw new Error("no neighbours found in the cloud for this query");
    if (!query.styleGate && restrict !== ladder[0]) {
      notes.push(`couldn't reach the target within the style — widened the search to ${restrict === "none" ? "the whole cloud" : "the " + restrict}`);
    }

    // ---- yeast: chosen for the STYLE, not pulled from the (flavour-steered)
    // neighbourhood — the most common strain among this style's OWN records,
    // restricted to strain types that belong in the family (lager→lager,
    // wheat→wheat/ale…). Seed-independent (a reroll varies the grain/hops, never
    // the strain), so it's resolved ONCE and shared across every candidate.
    // This is also why yeast no longer needs to weigh on the k-NN distance at
    // all (see KNN_YEAST_WEIGHT).
    let yeast: Yeast | null = query.yeastName ? buildYeastFromPresetName(query.yeastName) : null;
    if (query.yeastName && !yeast) notes.push(`yeast preset "${query.yeastName}" not found — falling back to the style's typical yeast`);
    if (!yeast) {
      const allow = allowYeastTypeFor(fam);
      let modalName = centroid.idxs ? this.modalYeastOverIdxs(centroid.idxs, allow) : null;
      if (!modalName) modalName = pickModalYeastName(grainHood.weighted, { allow }); // gate "none" / no style records
      if (!modalName) {
        modalName = this.ynByGlobalFrequency.find(allow) ?? null;
        if (modalName) notes.push(`no on-style yeast for "${fam}" — defaulted to the corpus's most common one, ${modalName}`);
      }
      yeast = modalName ? buildYeastFromPresetName(modalName) : null;
    }
    if (!yeast) {
      notes.push("no reconstructable yeast for this style — defaulting to a generic clean ale yeast");
      yeast = buildYeastFromPresetName(FALLBACK_YEAST_PRESET)!;
    }

    // ---- mash temp: the corpus has no mash-schedule field at all (checked
    // directly), but it does have attenuation OUTCOMES (og/fg), and the kinetic
    // model is already the forward map from mash temp -> attenuation given
    // yeast. Inverting it recovers "how hot/cold do flavour-similar neighbours
    // mash, to finish where they do." It depends only on yeast attenuation + the
    // neighbourhood's own attenuation — both shared — so it's solved ONCE here
    // (on a fermentable/hop-less probe recipe) and reused by every candidate. ----
    const neighborhoodAvgAttenuation = weightedMean(grainHood.weighted, (r) => apparentAttenuation(r.og, r.fg));
    const probeRecipe = this.buildBaseRecipe(batchVolumeL, [], [], yeast, matchedName ?? query.style);
    const mashSolve = this.solveMashTemp(probeRecipe, neighborhoodAvgAttenuation);
    const mashStep = { id: "mash-1", name: "Saccharification", temperatureC: mashSolve.temperatureC, durationMinutes: 60 };
    if (mashSolve.note) notes.push(mashSolve.note);

    // ABV target (shared): entirely determined by ingredients + process, so not
    // worth "learning" from the neighbourhood's noisy self-reported numbers.
    // Default to the style's own BJCP guideline midpoint (authoritative), falling
    // back to the corpus average only when the style didn't resolve to a spec.
    const neighborhoodAvgIBU = weightedMean(hopHood.weighted, (r) => r.ibu);
    const bjcpAbv = matchedCode ? getBjcpStyleSpec(matchedCode)?.abv : undefined;
    const targetABV = query.target?.abv ?? (bjcpAbv ? (bjcpAbv[0] + bjcpAbv[1]) / 2 : weightedMean(grainHood.weighted, (r) => r.abv));

    // ---- one candidate: reconstruct grist + hops off the shared neighbourhood
    // (seeded), assemble, and run the app's real calculators. The grain/hop bills
    // are the only thing a reroll seed moves; everything above is shared. ----
    type Candidate = {
      recipe: Recipe;
      calculations: RecipeCalculations;
      gristItems: GristBillItem[];
      achievedMalt: MaltFlavorProfile;
      achievedHop: HopFlavorProfile;
      notes: string[];
    };
    const synthesize = (cIndex: number): Candidate => {
      const cNotes: string[] = [];
      // Candidate 0 is the deterministic baseline: the caller's own exploration
      // and raw seeds — i.e. today's single-shot output, always in the pool so a
      // rerank can only match or beat it. Alternatives get a forced exploration
      // floor and independent seeds; without spread they'd all collapse onto
      // candidate 0 and there'd be nothing to rerank.
      const expl = cIndex === 0 ? exploration : Math.max(exploration, RERANK_ALT_EXPLORATION);
      const gSeed = cIndex === 0 ? gristSeed : hashSeed(gristSeed, "cand", cIndex);
      const hSeed = cIndex === 0 ? hopSeed : hashSeed(hopSeed, "cand", cIndex);

      let gristItems: GristBillItem[] = [];
      let fermentables: Fermentable[];
      let percentById: Record<string, number> = {};
      if (grainLocked) {
        fermentables = query.lockedFermentables!.map((f) => ({ ...f }));
      } else {
        const grist = buildGrist(grainHood, gSeed, expl); // reconstruct + #3 malt correction
        gristItems = grist.items;
        cNotes.push(...grist.notes);
        ({ fermentables, percentById } = buildFermentablesFromGristBill(gristItems));
      }

      let hops: Hop[];
      if (hopsLocked) {
        hops = query.lockedHops!.map((h) => ({ ...h }));
      } else {
        const hopRes = buildHopTemplates(hopHood, hSeed, expl); // reconstruct + #3 hop correction
        cNotes.push(...hopRes.notes);
        hops = materializeHopSchedule(hopRes.templates, batchVolumeL);
      }

      const recipe = this.buildBaseRecipe(batchVolumeL, fermentables, hops, yeast!, matchedName ?? query.style);
      recipe.mashSteps = [{ ...mashStep }];

      // Skip the weight solve when the grain is locked — keep its exact weights.
      if (!grainLocked) {
        const ogRefVolumeL = volumeCalculationService.calculateIntoFermenterVolume(recipe);
        const effectiveAttenuation = recipeCalculationService.getEffectiveAttenuation(recipe, "kinetic");
        recipe.fermentables = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
          fermentables, percentById, targetABV, ogRefVolumeL, recipe.equipment.brewhouseEfficiencyPercent, effectiveAttenuation,
        );
      }

      // An explicit target IBU is a dial — hit it precisely. With no explicit
      // ask, accept whatever the reconstructed schedule lands on, as long as it's
      // within a tolerance band of the neighbourhood's own average IBU; only
      // nudge to the nearest edge if it's genuinely outside. Skip when locked.
      if (hopsLocked) {
        // no-op: locked hops are used exactly as given
      } else if (query.target?.ibu != null) {
        recipe.hops = this.solveHopsForTargetIBU(recipe, Math.max(0, query.target.ibu));
      } else if (recipe.hops.length > 0) {
        const naturalIBU = recipeCalculationService.calculate(recipe).ibu;
        const ibuBand = Math.max(5, neighborhoodAvgIBU * 0.15);
        const lo = Math.max(0, neighborhoodAvgIBU - ibuBand);
        const hi = neighborhoodAvgIBU + ibuBand;
        if (naturalIBU < lo || naturalIBU > hi) {
          const nearestEdge = naturalIBU < lo ? lo : hi;
          recipe.hops = this.solveHopsForTargetIBU(recipe, nearestEdge);
          cNotes.push(`the reconstructed hop bill's natural IBU (${naturalIBU.toFixed(0)}) was outside the neighbourhood's typical ${lo.toFixed(0)}-${hi.toFixed(0)} range — nudged to ${nearestEdge.toFixed(0)}`);
        }
      }

      const calculations = recipeCalculationService.calculate(recipe);

      // Locked grain has no gristItems (reconstruction was skipped) — recover the
      // malt flavour from the fermentables' preset names instead.
      const achievedMalt = grainLocked
        ? aggregateMaltFlavor(recipe.fermentables.map((f) => ({ archetype: archetypeForPresetName(f.name) ?? "unknown", amount: f.weightKg })))
        : aggregateMaltFlavor(gristItems.map((i) => ({ archetype: i.archetype, amount: i.pct })));
      // HOP_FLAVOR_BY_LOWER is keyed lower-case (corpus names vary in case) but
      // materializeHopSchedule prefers the properly-cased preset name for a nicer
      // recipe — lower-case just for this lookup, same as buildCloud.ts does.
      const lowerCasedHops = recipe.hops.map((h) => ({ ...h, name: h.name.toLowerCase() }));
      const achievedHop = hopFlavorCalculationService.calculateCombinedFlavor(lowerCasedHops, HOP_FLAVOR_BY_LOWER, batchVolumeL);

      return { recipe, calculations, gristItems, achievedMalt, achievedHop, notes: cNotes };
    };

    // ---- rerank: generate N candidates and keep the one whose ACHIEVED flavour
    // is closest to the request. This is the closed loop — the target no longer
    // only picks the neighbourhood, it now selects among realistic candidates.
    // Candidate 0 == today's single-shot output, so it can only match or beat the
    // baseline on the alignment score, never regress. ----
    const candidateCount = Math.max(1, Math.min(MAX_CANDIDATES, Math.round(query.candidates ?? DEFAULT_CANDIDATES)));
    const wildness = Math.max(0, Math.min(1, query.wildness ?? 0));
    // Normalised squared flavour error vs the request. Pushed axes weigh heavily;
    // unpushed axes weigh (1 - wildness), so at wildness 0 a candidate is also
    // rewarded for staying on the style centroid everywhere it wasn't pushed, and
    // at wildness 1 only the pushed axes matter (the rest may drift).
    const alignmentError = (c: Candidate): number => {
      let s = 0;
      MALT_FLAVOR_KEYS.forEach((key, i) => {
        const max = Math.max(this.globalAxisMax.malt[i], RERANK_AXIS_MAX_FLOOR);
        const d = (c.achievedMalt[key] - reqMalt[key]) / max;
        const w = pushedMalt.has(key) ? RERANK_PUSHED_AXIS_WEIGHT : 1 - wildness;
        s += w * d * d;
      });
      HOP_FLAVOR_KEYS.forEach((key, i) => {
        const max = Math.max(this.globalAxisMax.hop[i], RERANK_AXIS_MAX_FLOOR);
        const d = (c.achievedHop[key] - reqHop[key]) / max;
        const w = pushedHop.has(key) ? RERANK_PUSHED_AXIS_WEIGHT : 1 - wildness;
        s += w * d * d;
      });
      return s;
    };

    // Build every candidate, rank by alignment (ties broken by seed index so the
    // order is deterministic). The top RERANK_ROTATE_POOL form the "another take"
    // pool: a fresh query (variation seed 0) returns the single best, but a reroll
    // (non-zero grist/hop seed) picks a DIFFERENT, still-well-aligned candidate
    // from that pool — seeded by the reroll — so "Another take" surfaces the other
    // near-best recipes we build anyway instead of re-finding the same winner.
    const scored = Array.from({ length: candidateCount }, (_, c) => synthesize(c))
      .map((cand, i) => ({ cand, err: alignmentError(cand), i }))
      .sort((a, b) => a.err - b.err || a.i - b.i);
    const poolSize = Math.min(RERANK_ROTATE_POOL, scored.length);
    // gristSeed + hopSeed is 0 only on an un-rerolled query; any reroll bumps it.
    const takeSeed = gristSeed + hopSeed;
    const poolIndex = takeSeed === 0 ? 0 : Math.floor(mulberry32(hashSeed(gristSeed, hopSeed, "rerank-take"))() * poolSize);
    const chosen = scored[Math.min(poolIndex, poolSize - 1)];
    const best = chosen.cand;
    if (candidateCount > 1) {
      const rank = scored.indexOf(chosen);
      notes.push(rank === 0
        ? `reranked ${candidateCount} candidates by flavour match (wildness ${wildness.toFixed(2)})`
        : `reranked ${candidateCount} candidates — this "take" is #${rank + 1} of the ${poolSize} closest matches (wildness ${wildness.toFixed(2)})`);
    }
    notes.push(...best.notes);

    const { recipe, calculations } = best;

    // ---- style-fit / density signal (graded, not a hard in/out flip) ----
    // Baseline is style-LOCAL: sampled from this style's own records, so "how far
    // have I wandered" means the same thing in a sparse style as in a dense one.
    // With split neighbourhoods the grain and hop bills sit at different distances
    // from the style; report the MORE experimental side so a wild hop push flags
    // even when the grain is classic (and vice versa). Un-split, both are equal.
    const grainMeanDist = grainHood.neighbors.reduce((s, n) => s + n.distance, 0) / grainHood.neighbors.length;
    const hopMeanDist = hopHood.neighbors.reduce((s, n) => s + n.distance, 0) / hopHood.neighbors.length;
    const meanNeighborDistance = Math.max(grainMeanDist, hopMeanDist);
    const baselineTag = centroidLevel === "style" ? `style:${strictCode}` : centroidLevel === "family" ? `family:${fam}` : "global";
    const baselineDistance = this.getBaselineDistance(grainHood.neighbors.length, centroid.idxs, baselineTag);
    const ratio = baselineDistance > 0 ? meanNeighborDistance / baselineDistance : 0;
    const band: SteeringResult["styleFit"]["band"] =
      ratio <= STYLE_FIT_TYPICAL_MAX ? "typical" : ratio <= STYLE_FIT_STRETCH_MAX ? "stretch" : "experimental";
    const inBounds = band !== "experimental";
    if (band === "experimental") notes.push("this target sits well outside the cloud's dense region for this style — treat the result as experimental");

    const styleNorms: SteeringResult["styleNorms"] = {
      malt: { p25: malt9ToProfile(centroid.maltP25), p75: malt9ToProfile(centroid.maltP75) },
      hop: { p25: hop9ToProfile(centroid.hopP25), p75: hop9ToProfile(centroid.hopP75) },
      recordCount: centroid.count,
      level: centroidLevel,
    };

    return {
      recipe,
      calculations,
      requestedFlavor: { malt: reqMalt, hop: reqHop },
      achievedFlavor: { malt: best.achievedMalt, hop: best.achievedHop },
      styleNorms,
      axisMax: { malt: malt9ToProfile(this.globalAxisMax.malt), hop: hop9ToProfile(this.globalAxisMax.hop) },
      axisDialMax: {
        malt: malt9ToProfile(this.globalAxisMax.malt.map((v) => v * AXIS_DIAL_HEADROOM)),
        hop: hop9ToProfile(this.globalAxisMax.hop.map((v) => v * AXIS_DIAL_HEADROOM)),
      },
      bodyRange: { min: this.stats.lo[MALTBODY_IDX], mid: this.stats.mean[MALTBODY_IDX], max: this.stats.hi[MALTBODY_IDX] },
      style: { input: query.style, matchedCode, matchedName, family: fam },
      // Reports the grain neighbourhood; when split, the hop side has its own (see styleFit).
      neighborhood: { k: grainHood.neighbors.length, recordIds: grainHood.neighbors.map((n) => this.cloud[n.index].id), weights: grainHood.weights },
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

  /**
   * A predicate keeping only records within a tolerance of the style's BJCP SRM
   * guideline — the data-quality filter that drops mislabelled junk (see
   * STYLE_SRM_TOLERANCE_*). Always-true when the style has no SRM spec.
   */
  bjcpConformFilter(code: string | undefined): (i: number) => boolean {
    const srm = code ? getBjcpStyleSpec(code)?.srm : undefined;
    if (!srm) return () => true;
    const lo = srm[0] * STYLE_SRM_TOLERANCE_LO;
    const hi = srm[1] * STYLE_SRM_TOLERANCE_HI;
    return (i: number) => { const s = this.cloud[i].srm; return s >= lo && s <= hi; };
  }

  /** The specific-style-level centroid, or null if the code is unresolved or too thin on data to trust. */
  private styleCentroid(code: string | undefined): Centroid | null {
    if (!code) return null;
    const conform = this.bjcpConformFilter(code);
    const idxs: number[] = [];
    const raw: number[] = [];
    for (let i = 0; i < this.cloud.length; i++) {
      if (this.styleCodeOf[i] !== code) continue;
      raw.push(i);
      if (conform(i)) idxs.push(i);
    }
    // Prefer the spec-conformant records; only fall back to the noisy full set if
    // the filter left too few to trust (a noisy centroid still beats none).
    const use = idxs.length >= MIN_STYLE_CENTROID_RECORDS ? idxs : raw;
    if (use.length < MIN_STYLE_CENTROID_RECORDS) return null;
    return this.centroidFromIndices(use);
  }

  private yeastVectorForPresetName(name: string): YeastBlock | null {
    const cls = this.presetNameToClass.get(name);
    return cls ? yeastBlockFromClass(cls, this.vocab) : null;
  }

  /** The most common on-style yeast among a set of records (the matched style's own members). */
  private modalYeastOverIdxs(idxs: number[], allow: (name: string) => boolean): string | null {
    const tally = new Map<string, number>();
    for (const i of idxs) {
      const yn = this.cloud[i].yn;
      if (yn && allow(yn)) tally.set(yn, (tally.get(yn) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [name, n] of tally) if (n > bestN) { best = name; bestN = n; }
    return best;
  }

  // ── query construction ───────────────────────────────────────────────────────

  /**
   * Overlay explicit target axes onto the style centroid; unset axes keep the
   * centroid's value. `side` restricts WHICH dims a target may move, so the grain
   * and hop bills can each be steered in their own subspace while staying grounded
   * at the style on the other's dims (see `splitNeighbourhoods`):
   *   - grain-side dims = malt axes + gravity(abv) + SRM + maltBody
   *   - hop-side dims   = hop axes + IBU + buGu
   * "both" (the default) applies everything and is byte-identical to the original
   * single-query behaviour.
   */
  private buildQueryRow(centroidRow: number[], target?: SteeringTarget, side: "grain" | "hop" | "both" = "both"): number[] {
    const row = [...centroidRow];
    const doGrain = side !== "hop";
    const doHop = side !== "grain";
    if (doGrain && target?.malt) {
      for (const [key, value] of Object.entries(target.malt)) {
        if (value == null) continue;
        const idx = MALT_FLAVOR_KEYS.indexOf(key as (typeof MALT_FLAVOR_KEYS)[number]);
        if (idx >= 0) row[idx] = value;
      }
    }
    if (doHop && target?.hop) {
      for (const [key, value] of Object.entries(target.hop)) {
        if (value == null) continue;
        const idx = HOP_FLAVOR_KEYS.indexOf(key as (typeof HOP_FLAVOR_KEYS)[number]);
        if (idx >= 0) row[9 + idx] = value;
      }
    }
    if (doGrain && target?.abv != null) {
      // GRAVITY_IDX holds gravity POINTS ((og-1)*1000, see gravityPoints()), not (og-1) —
      // the missing *1000 here previously produced a ~1000x-too-small value that also
      // corrupted the buGu dim below, blowing up k-NN distance for any ABV-targeted query.
      row[GRAVITY_IDX] = (1000 * target.abv) / (ABV_FACTOR * ASSUMED_ATTENUATION_FOR_QUERY);
    }
    if (doHop && target?.ibu != null) row[IBU_IDX] = target.ibu;
    if (doGrain && target?.srm != null) row[SRM_IDX] = target.srm;
    // Only re-derive buGu (a hop-side dim) when a target actually moved IBU (or, in
    // "both", gravity via abv). Otherwise keep the centroid's own buGu so a no-target
    // query point equals the centroid exactly instead of drifting to a ratio-of-means.
    if (doHop && (target?.ibu != null || (side === "both" && target?.abv != null))) {
      row[BUGU_IDX] = row[GRAVITY_IDX] > 0 ? row[IBU_IDX] / row[GRAVITY_IDX] : 0;
    }
    if (doGrain && target?.body != null) row[MALTBODY_IDX] = target.body;
    return row;
  }

  // ── k-NN ─────────────────────────────────────────────────────────────────────

  private queryNeighbors(
    queryRow: number[],
    queryYeast: YeastBlock,
    k: number,
    restrict: RestrictLevel,
    fam: StyleFamily,
    strictCode?: string,
    styleConform?: (i: number) => boolean,
  ): Array<{ index: number; distance: number }> {
    const qz = zScore(queryRow, this.stats);
    const qn2 = yeastNorm2(queryYeast);

    // The adaptive gate's three rungs: "style" = only this exact BJCP style (the
    // purest, no other styles bleeding in); "family" = the whole flavour family
    // (all IPAs, all lagers…); "none" = the whole cloud. Widen only when a push
    // can't be hit in-style. "style" with no resolved code falls back to family.
    const candidateIdx: number[] = [];
    for (let i = 0; i < this.cloud.length; i++) {
      if (restrict === "style") {
        if (strictCode ? this.styleCodeOf[i] !== strictCode : this.familyOf[i] !== fam) continue;
        if (styleConform && !styleConform(i)) continue; // BJCP data-quality filter, only at the tightest rung
      } else if (restrict === "family") {
        if (this.familyOf[i] !== fam) continue;
      }
      candidateIdx.push(i);
    }
    if (candidateIdx.length === 0) return []; // this rung has no records — the adaptive gate widens past it

    const distances = new Float64Array(candidateIdx.length);
    for (let c = 0; c < candidateIdx.length; c++) {
      const i = candidateIdx[c];
      distances[c] = weightedDistance2(qz, queryYeast, qn2, this.zRows[i], this.yeastBlocks[i], this.yeastNorms[i], KNN_YEAST_WEIGHT);
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
          : weightedDistance2(this.zRows[s], this.yeastBlocks[s], this.yeastNorms[s], this.zRows[ci], this.yeastBlocks[ci], this.yeastNorms[ci], KNN_YEAST_WEIGHT);
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
