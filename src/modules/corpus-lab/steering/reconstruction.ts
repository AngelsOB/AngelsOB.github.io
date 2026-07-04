/**
 * Phase 2 — neighbourhood-average -> clean recipe reconstruction.
 *
 * Three independent synthesis steps, each pure and unit-tested on their own:
 *   - grist:  role-first two-phase reconstruction (roll blended archetype% up
 *             to 6 functional roles, then pick each role's most-used
 *             archetype) -> a short, clean Fermentable[] bill
 *   - hops:   per-addition [name, gpl, type, timeMin] rows -> a bucketed,
 *             modal-variety Hop[] schedule
 *   - yeast:  a weighted vote on the neighbourhood's `yn` (preset name) -> a
 *             real Yeast object
 *
 * Reuses the app's own ingredient databases (FERMENTABLE_PRESETS, HOP_PRESETS,
 * YEAST_PRESETS) so the synthesized ingredients carry real ppg/color/alpha/
 * attenuation — never invented numbers.
 */
import type { Fermentable, Hop, Yeast } from "../../recipe/models/Recipe";
import type { HopFlavorProfile } from "../../recipe/models/Presets";
import { FERMENTABLE_PRESETS } from "../../recipe/data/fermentablePresets";
import { HOP_PRESETS } from "../../recipe/data/hopPresets";
import { YEAST_PRESETS } from "../../recipe/data/yeastPresets";
import { MALT_ARCHETYPE_SLUGS, MALT_ARCHETYPES_BY_SLUG, aggregateMaltFlavor, type MaltFlavorProfile } from "../maltFlavor";
import type { CloudRecord } from "./featureSpace";
import { selectExplored, mulberry32, hashSeed } from "./prng";

// Flavour steering happens entirely through the k-NN QUERY POINT (which
// neighbourhood we search), not by re-scoring individual ingredients against
// the target: a real multi-axis flavour (citrus + herbal, say) is achieved by
// BLENDING spiky single-note hops the way real recipes in that neighbourhood
// already do — not by hunting for one do-everything hop that scores "close" on
// every axis at once (which is what the old per-ingredient flavour-match did,
// and why it quietly avoided characterful hops). So reconstruction just
// faithfully rebuilds what the neighbourhood uses, ranked by popularity.

// ── Grist reconstruction ─────────────────────────────────────────────────────

const FERMENTABLE_BY_NAME = new Map(FERMENTABLE_PRESETS.map((p) => [p.name, p]));

/** One representative, real preset per malt-lexicon archetype (+ the 3 non-malt sugar buckets). */
export const ARCHETYPE_TO_PRESET_NAME: Record<string, string> = {
  "base-pale": "Briess - Brewers Malt 2-Row",
  pilsner: "Pilsner Malt",
  "maris-otter": "Maris Otter Pale",
  vienna: "Vienna Malt",
  "munich-light": "Munich Malt",
  "munich-dark": "Munich Dark 20L",
  "wheat-malt": "Wheat Malt",
  "rye-malt": "Briess - Rye Malt",
  acidulated: "Acidulated Malt",
  "biscuit-malt": "Biscuit Malt",
  "victory-amber": "Victory",
  "amber-malt": "Amber",
  aromatic: "Aromatic Malt",
  melanoidin: "Melanoidin",
  "brown-malt": "Brown Malt",
  "honey-malt": "Honey Malt",
  dextrine: "Carapils (Dextrine Malt)",
  "crystal-light": "Caramel / Crystal 20L",
  "crystal-medium": "Crystal 60L",
  "crystal-dark": "Crystal 90L",
  "special-b": "Special B",
  "pale-chocolate": "Pale Chocolate",
  "chocolate-malt": "Chocolate Malt",
  "carafa-dehusked": "Weyermann - Carafa Special Type II",
  "black-malt": "Black Patent",
  "roasted-barley": "Roasted Barley",
  "flaked-oats": "Flaked Oats",
  "flaked-wheat": "Flaked Wheat",
  "flaked-barley": "Flaked Barley",
  "flaked-corn": "Flaked Corn",
  "flaked-rice": "Flaked Rice",
  "torrified-wheat": "Torrified Wheat",
  "dark-candi-syrup": "Candi Syrup - Belgian Candi Syrup - D-180",
  "smoked-malt": "Smoked Malt",
  // non-malt-lexicon but reconstructable grist categories (see gristCategory)
  sugar: "Corn Sugar - Dextrose",
  "honey-sugar": "Honey",
  lactose: "Lactose (Milk Sugar)",
};

/** Every malt archetype the lexicon knows about must resolve to a real preset. */
export function unmappedArchetypes(): string[] {
  return [...MALT_ARCHETYPE_SLUGS, "sugar", "honey-sugar", "lactose"].filter(
    (a) => !FERMENTABLE_BY_NAME.has(ARCHETYPE_TO_PRESET_NAME[a] ?? ""),
  );
}

export function presetForArchetype(archetype: string) {
  const name = ARCHETYPE_TO_PRESET_NAME[archetype];
  return name ? FERMENTABLE_BY_NAME.get(name) : undefined;
}

const PRESET_NAME_TO_ARCHETYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ARCHETYPE_TO_PRESET_NAME).map(([archetype, presetName]) => [presetName, archetype]),
);

/** Reverse of ARCHETYPE_TO_PRESET_NAME — recover a malt archetype from a fermentable's
 *  preset name, so a locked grain bill can still report its malt flavour. */
export function archetypeForPresetName(name: string): string | undefined {
  return PRESET_NAME_TO_ARCHETYPE[name];
}

/**
 * Functional role of each archetype, for the two-phase grist reconstruction
 * below. This is deliberately its own taxonomy, not a reuse of maltFlavor.ts's
 * "Base / pale" authoring-comment groups — those group munich-dark/rye-malt/
 * acidulated with the base malts because they're LEXICON neighbours (similar
 * flavour-authoring notes), but none of the three is realistically a majority
 * ingredient, so grouping them as "base" here would defeat the point.
 */
type GristRole = "base" | "toasted" | "crystal" | "roasted" | "flaked" | "sugar";
const GRIST_ROLES: GristRole[] = ["base", "toasted", "crystal", "roasted", "flaked", "sugar"];
const ROLE_OF: Record<string, GristRole> = {
  "base-pale": "base", pilsner: "base", "maris-otter": "base", vienna: "base", "munich-light": "base", "wheat-malt": "base",
  "biscuit-malt": "toasted", "victory-amber": "toasted", "amber-malt": "toasted", aromatic: "toasted", melanoidin: "toasted",
  "brown-malt": "toasted", "honey-malt": "toasted", "munich-dark": "toasted", "smoked-malt": "toasted",
  dextrine: "crystal", "crystal-light": "crystal", "crystal-medium": "crystal", "crystal-dark": "crystal", "special-b": "crystal",
  "pale-chocolate": "roasted", "chocolate-malt": "roasted", "carafa-dehusked": "roasted", "black-malt": "roasted", "roasted-barley": "roasted",
  "flaked-oats": "flaked", "flaked-wheat": "flaked", "flaked-barley": "flaked", "flaked-corn": "flaked", "flaked-rice": "flaked",
  "torrified-wheat": "flaked", "rye-malt": "flaked", acidulated: "flaked",
  sugar: "sugar", "honey-sugar": "sugar", lactose: "sugar", "dark-candi-syrup": "sugar",
};

/** An archetype must be at least this much of a neighbour's role to count as genuinely co-used (not a trace). */
const MIN_CO_USE_SHARE = 0.2;
/** At most this many representatives per functional role — a real blend (pils+wheat, chocolate+roast), never a kitchen sink. */
const MAX_REPS_PER_ROLE = 2;

export type RoleRep = { archetype: string; share: number };

/**
 * Which specific archetype(s) represent each role, and in what proportion.
 *
 * A neighbour's vote in a role is split across the archetypes it genuinely
 * co-uses there (each ≥ `MIN_CO_USE_SHARE` of that neighbour's role), by their
 * within-role share — so the vote is bounded to the neighbour's kernel weight
 * regardless of absolute pour size (one recipe's huge pour of an odd choice
 * still can't outweigh what the neighbourhood reaches for), while a *consistent*
 * secondary malt no longer disappears the way a single-max-vote drops it.
 *
 * How MANY representatives a role gets is the neighbourhood's own average count
 * of co-used archetypes in that role (rounded, capped at `MAX_REPS_PER_ROLE`):
 * a role where every neighbour uses one base malt collapses to one (naming
 * variance across neighbours must NOT split a role — that's the original
 * vote-splitting bug), but a role where neighbours genuinely blend two (a
 * hefeweizen's pils+wheat, a stout's chocolate+roasted-barley) keeps both,
 * split by their vote share.
 *
 * Winners are ranked by popularity share alone (the flavour steering already
 * happened when the neighbourhood was chosen — see the note at the top of this
 * file). `exploration` can seed-sample past the top pick for variety.
 */
function pickRoleRepresentatives(
  neighbors: Array<{ rec: CloudRecord; weight: number }>,
  opts: { exploration?: number; seed?: number } = {},
): Partial<Record<GristRole, RoleRep[]>> {
  const exploration = opts.exploration ?? 0;
  const seed = opts.seed ?? 0;
  const votes: Record<GristRole, Map<string, number>> = { base: new Map(), toasted: new Map(), crystal: new Map(), roasted: new Map(), flaked: new Map(), sugar: new Map() };
  const roleWeight: Record<GristRole, number> = { base: 0, toasted: 0, crystal: 0, roasted: 0, flaked: 0, sugar: 0 };
  const coUseWeighted: Record<GristRole, number> = { base: 0, toasted: 0, crystal: 0, roasted: 0, flaked: 0, sugar: 0 };

  for (const { rec, weight } of neighbors) {
    const byRole: Partial<Record<GristRole, Array<{ archetype: string; pct: number }>>> = {};
    for (const [archetype, pct] of Object.entries(rec.g)) {
      const role = ROLE_OF[archetype];
      if (!role || pct <= 0) continue;
      (byRole[role] ??= []).push({ archetype, pct });
    }
    for (const role of GRIST_ROLES) {
      const members = byRole[role];
      if (!members) continue;
      const roleTotal = members.reduce((s, m) => s + m.pct, 0) || 1;
      const coUsed = members.filter((m) => m.pct / roleTotal >= MIN_CO_USE_SHARE);
      if (coUsed.length === 0) continue;
      const coTotal = coUsed.reduce((s, m) => s + m.pct, 0) || 1;
      roleWeight[role] += weight;
      coUseWeighted[role] += weight * coUsed.length;
      for (const m of coUsed) {
        votes[role].set(m.archetype, (votes[role].get(m.archetype) ?? 0) + weight * (m.pct / coTotal));
      }
    }
  }

  const representatives: Partial<Record<GristRole, RoleRep[]>> = {};
  for (const role of GRIST_ROLES) {
    const roleVotes = votes[role];
    const totalVote = [...roleVotes.values()].reduce((s, w) => s + w, 0);
    if (totalVote <= 0) continue;
    const repCount = Math.min(MAX_REPS_PER_ROLE, Math.max(1, Math.round(coUseWeighted[role] / (roleWeight[role] || 1))));
    const scored = [...roleVotes.entries()].map(([archetype, w]) => ({ archetype, w, score: w / totalVote }));
    // exploration=0 => the top `repCount` by score (deterministic, unchanged);
    // higher => a seeded sample that can reach past the most-popular malt. Seeded
    // per role so each role draws independently and the whole recipe stays
    // reproducible for a given `variation`.
    const ranked = selectExplored(scored, repCount, exploration, mulberry32(hashSeed(seed, "grist", role)));
    const keptVote = ranked.reduce((s, r) => s + r.w, 0) || 1;
    representatives[role] = ranked.map((r) => ({ archetype: r.archetype, share: r.w / keptVote }));
  }
  return representatives;
}

export type GristBillItem = { archetype: string; pct: number; preset: NonNullable<ReturnType<typeof presetForArchetype>> };

export type GristBillResult = { items: GristBillItem[]; notes: string[] };

/**
 * A k-NN neighbourhood's grist -> a short, clean grist bill.
 *
 * Two-phase, not a flat "blend every archetype, keep the top-N" (see the
 * commit that replaced the old approach): exact-archetype blending lets a
 * role's vote split across near-equivalent choices (base-pale vs pilsner vs
 * maris-otter vs wheat-malt) and vanish from the top-N entirely, even though
 * "some base malt" was present in nearly every neighbour — exactly how a real
 * query once came back with zero base malt and a majority-adjunct bill.
 *
 * So: (1) roll the blended archetype% up to 6 functional roles (base/
 * toasted/crystal/roasted/flaked/sugar) — this total can't vanish to
 * naming variance, since it's summed before any specific choice is picked;
 * (2) within each present role, pick the one archetype the neighbourhood
 * most commonly reaches for (`pickRoleRepresentatives`); (3) apply the same
 * maxItems/minPct pruning + renormalisation as before, now over at most 6
 * role-collapsed candidates instead of 34 raw archetypes.
 */
export function pickGristBill(
  neighbors: Array<{ rec: CloudRecord; weight: number }>,
  opts: {
    maxItems?: number;
    minPct?: number;
    /** Wider neighbourhood the ROLE REPRESENTATIVES are voted from — the "menu"
     * of plausible malts — while the role %s stay on the tight `neighbors`.
     * Defaults to `neighbors` (no split). */
    identityNeighbors?: Array<{ rec: CloudRecord; weight: number }>;
    /** 0 = always the most popular malt per role; higher reaches past it (seeded). */
    exploration?: number;
    /** Reroll seed — same seed reproduces the same picks. */
    seed?: number;
  } = {},
): GristBillResult {
  const maxItems = opts.maxItems ?? 6;
  const minPct = opts.minPct ?? 1.5;
  const notes: string[] = [];

  // Quantities (role %s) come from the tight neighbourhood; the identity vote
  // (which malt fills each role) can come from a wider menu.
  const blended = blendGristPct(neighbors);
  const roleTotals: Partial<Record<GristRole, number>> = {};
  for (const [archetype, pct] of Object.entries(blended)) {
    const role = ROLE_OF[archetype];
    if (!role || pct <= 0) continue;
    roleTotals[role] = (roleTotals[role] ?? 0) + pct;
  }
  const representatives = pickRoleRepresentatives(opts.identityNeighbors ?? neighbors, {
    exploration: opts.exploration,
    seed: opts.seed,
  });

  const totalBlended = Object.values(blended).reduce((s, p) => s + Math.max(0, p), 0);
  let droppedPct = totalBlended - Object.values(roleTotals).reduce((s, p) => s + (p ?? 0), 0);

  const candidates: Array<{ archetype: string; pct: number }> = [];
  for (const role of GRIST_ROLES) {
    const pct = roleTotals[role];
    const reps = representatives[role];
    if (!pct || pct <= 0 || !reps?.length) continue;
    // Split the role's blended total across its representative(s) by vote share
    // — one malt for most roles, two for a genuine blend (see pickRoleRepresentatives).
    for (const { archetype, share } of reps) {
      const rolePct = pct * share;
      if (!presetForArchetype(archetype)) { droppedPct += rolePct; continue; } // defensive; unmappedArchetypes() should keep this empty
      candidates.push({ archetype, pct: rolePct });
    }
  }
  candidates.sort((a, b) => b.pct - a.pct);

  // Truncate the long tail to maxItems, then drop anything still under minPct
  // — but never truncate all the way down to zero items.
  const truncated = candidates.slice(0, maxItems);
  droppedPct += candidates.slice(maxItems).reduce((s, c) => s + c.pct, 0);

  let kept = truncated;
  if (truncated.length > 1) {
    const small = truncated.filter((c) => c.pct < minPct);
    if (small.length && small.length < truncated.length) {
      droppedPct += small.reduce((s, c) => s + c.pct, 0);
      kept = truncated.filter((c) => c.pct >= minPct);
    }
  }

  if (droppedPct > 0.05) {
    notes.push(`dropped ${droppedPct.toFixed(1)}% unreconstructable/minor grist, renormalised the rest to 100%`);
  }

  const keptTotal = kept.reduce((s, c) => s + c.pct, 0) || 1;
  const rawItems: GristBillItem[] = kept.map(({ archetype, pct }) => ({
    archetype,
    pct: (pct / keptTotal) * 100,
    preset: presetForArchetype(archetype)!,
  }));
  // Final safety net: no matter how the neighbourhood averaged out (a hard body
  // push can pull it to a mostly-adjunct grist), hand back something that will
  // actually mash. See enforceGristBrewability.
  const brew = enforceGristBrewability(rawItems);
  notes.push(...brew.notes);
  return { items: brew.items, notes };
}

// ── Brewability floor ────────────────────────────────────────────────────────

/**
 * Malt archetypes with the diastatic power to convert a mash — the ones that
 * can carry a grain bill. Everything else (crystal, roasted, flaked adjuncts,
 * dextrine, sugars) rides along but can't self-convert, so a bill has to be
 * mostly these or it never becomes wort. Smoked malt is here because Rauchmalt
 * is just kilned base malt (a 100% smoked grist is a real beer).
 */
const DIASTATIC_ARCHETYPES = new Set<string>([
  "base-pale", "pilsner", "maris-otter", "vienna", "munich-light", "munich-dark", "wheat-malt", "rye-malt", "smoked-malt",
]);
/** Unmalted flaked/torrified adjuncts — need base-malt enzymes to convert; capped as a group. */
const FLAKED_ADJUNCTS = new Set<string>([
  "flaked-oats", "flaked-wheat", "flaked-barley", "flaked-corn", "flaked-rice", "torrified-wheat",
]);
const DEXTRINE_MAX_SHARE = 0.1; // Carapils is all unfermentable dextrin — cloying and pointless past ~10%.
const FLAKED_MAX_SHARE = 0.4; // even an oat-heavy hazy tops out around here before it won't lauter/convert.
const MIN_DIASTATIC_SHARE = 0.55; // a mash needs at least this much enzyme-carrying base malt to convert.
const BREWABILITY_BASE_ARCHETYPE = "base-pale"; // the clean base injected only when a bill has none at all.

/**
 * Turn a reconstructed grist into a *brewable* one. The steering engine's job is
 * to hand back a base template someone can actually mash, so this is a hard
 * guarantee, not a nudge: cap the non-diastatic grains that can't carry a bill
 * (dextrine, flaked adjuncts), then guarantee a diastatic-base floor so the mash
 * converts — topping up the neighbourhood's own base malt, or injecting a clean
 * one only if it somehow chose none. A normal 80%-base bill passes through
 * untouched; a body-pushed 3%-base / 95%-adjunct grist gets repaired.
 */
export function enforceGristBrewability(items: GristBillItem[]): { items: GristBillItem[]; notes: string[] } {
  const notes: string[] = [];
  if (items.length === 0) return { items, notes };

  const total = items.reduce((s, i) => s + i.pct, 0) || 1;
  const parts = items.map((i) => ({ archetype: i.archetype, share: i.pct / total, preset: i.preset }));
  const originalDiastatic = parts.filter((p) => DIASTATIC_ARCHETYPES.has(p.archetype)).reduce((s, p) => s + p.share, 0);

  // 1. Cap the grains that can't carry a bill on their own.
  let capped = false;
  for (const p of parts) {
    if (p.archetype === "dextrine" && p.share > DEXTRINE_MAX_SHARE) { p.share = DEXTRINE_MAX_SHARE; capped = true; }
  }
  const flaked = parts.filter((p) => FLAKED_ADJUNCTS.has(p.archetype));
  const flakedTotal = flaked.reduce((s, p) => s + p.share, 0);
  if (flakedTotal > FLAKED_MAX_SHARE) {
    const f = FLAKED_MAX_SHARE / flakedTotal;
    for (const p of flaked) p.share *= f;
    capped = true;
  }

  // 2. Enforce the diastatic-base floor. Non-diastatic keeps its internal
  // proportions but is scaled to at most (1 - floor); base fills the rest.
  const dParts = parts.filter((p) => DIASTATIC_ARCHETYPES.has(p.archetype));
  const ndParts = parts.filter((p) => !DIASTATIC_ARCHETYPES.has(p.archetype));
  const dRaw = dParts.reduce((s, p) => s + p.share, 0);
  const ndRaw = ndParts.reduce((s, p) => s + p.share, 0);
  const totalRaw = dRaw + ndRaw;
  const ndFinal = totalRaw > 0 ? Math.min(ndRaw / totalRaw, 1 - MIN_DIASTATIC_SHARE) : 0;
  const baseFinal = 1 - ndFinal;

  if (ndRaw > 0) for (const p of ndParts) p.share = (p.share / ndRaw) * ndFinal;
  if (dRaw > 0) {
    for (const p of dParts) p.share = (p.share / dRaw) * baseFinal;
  } else {
    const preset = presetForArchetype(BREWABILITY_BASE_ARCHETYPE);
    if (preset) parts.push({ archetype: BREWABILITY_BASE_ARCHETYPE, share: baseFinal, preset });
  }

  if (capped || originalDiastatic < MIN_DIASTATIC_SHARE - 1e-9) {
    notes.push("raised the base malt and trimmed the adjuncts so the mash will actually convert — the requested body was past what a real grist can hold");
  }

  const outTotal = parts.reduce((s, p) => s + p.share, 0) || 1;
  const outItems: GristBillItem[] = parts
    .map((p) => ({ archetype: p.archetype, pct: (p.share / outTotal) * 100, preset: p.preset }))
    .filter((i) => i.pct > 0)
    .sort((a, b) => b.pct - a.pct);
  return { items: outItems, notes };
}

// ── Residual correction (#3) ─────────────────────────────────────────────────

/** Never let a single corrective donor exceed this share of the grist — a
 * caramel-forward beer is real, a 45%-crystal one is cloying and fake. */
const CORRECTION_MAX_DONOR_SHARE = 0.3;
/** Grist share added per corrective pass (diminishing returns via saturation stop it early). */
const CORRECTION_STEP_SHARE = 0.05;
/** At most this many passes — a hard backstop. Higher than it looks because the
 * gentlest-first escalation climbs one grain a step at a time before moving on. */
const CORRECTION_MAX_PASSES = 40;
/** Only correct a pushed axis whose shortfall is at least this much (skip trivial gaps). */
const CORRECTION_MIN_DEFICIT = 0.15;
/**
 * Weight on collateral flavour when `avoidCollateral` is on: a donor's score for
 * the axis being raised is docked `penalty ×` its contribution to every OTHER
 * pushed axis already at/over target. 1 = collateral counts as much as the gain,
 * so a donor is only chosen if it helps the deficit more than it overshoots the
 * axes the user pulled down. Shared by the malt and hop corrections.
 */
const CORRECTION_COLLATERAL_PENALTY = 1.0;
/** With avoidCollateral on, a grain is dropped from the ladder if its (penalty-
 * weighted) contribution to the pulled-down axes exceeds this fraction of its gain
 * on the axis being raised — so a purer donor is used and the protected axis stays
 * put (e.g. crystal-medium over crystal-dark when dark fruit was pulled down). */
const CORRECTION_COLLATERAL_MAX_RATIO = 0.5;
/**
 * Floor on the in-style weight (see the corrections' `prevalence`). A donor's
 * score is scaled by `FLOOR + (1-FLOOR)·prevalenceNorm`, so even a zero-prevalence
 * grain keeps `FLOOR` of its raw pull. This makes prevalence a TIE-BREAKER that
 * nudges close calls toward the in-style choice, without letting a weak-but-common
 * donor beat a strong one and cripple the reach on a genuine push (which a hard
 * prevalence multiply did — biscuit reachability fell to ~0.45).
 */
const CORRECTION_IN_STYLE_FLOOR = 0.6;

/**
 * Close the reachable part of a malt flavour shortfall by using MORE of the
 * grain that drives the deficit axis — the "extrapolate what they're using to
 * get there, then use extra of it" step (#3). This is the dimension the k-NN
 * rerank structurally can't touch: a reroll varies WHICH malt fills a role, but
 * the role's fraction is fixed by the neighbourhood, and malt flavour is
 * fraction-driven.
 *
 * Greedy and bounded: each pass finds the largest still-open pushed-axis deficit,
 * picks the donor archetype that most drives that axis (intensity × its flavour
 * on the axis) FROM the set the neighbourhood actually used (`sanctioned` — never
 * invents a grain), and shifts a small share of the grist onto it. Stops as soon
 * as a pass stops helping (the malt aggregator saturates, so more crystal
 * eventually adds nothing) or the donor hits its share cap. The result is run
 * through `enforceGristBrewability`, so the diastatic-base floor still holds.
 *
 * `target` carries only the pushed axes and their (raw) requested values. Pure —
 * no cloud, no weights — so it's unit-tested directly.
 */
export function correctMaltGristToward(
  items: GristBillItem[],
  sanctioned: Set<string>,
  target: Partial<MaltFlavorProfile>,
  opts: {
    step?: number;
    maxPasses?: number;
    maxDonorShare?: number;
    minDeficit?: number;
    avoidCollateral?: boolean;
    collateralPenalty?: number;
    prevalence?: Record<string, number>;
    /** When true, also reduce grains driving an axis when achieved > target.
     *  Default false — `steer()` never produces negative deltas. */
    allowReduce?: boolean;
  } = {},
): { items: GristBillItem[]; notes: string[] } {
  const step = opts.step ?? CORRECTION_STEP_SHARE;
  const maxPasses = opts.maxPasses ?? CORRECTION_MAX_PASSES;
  const maxDonorShare = opts.maxDonorShare ?? CORRECTION_MAX_DONOR_SHARE;
  const minDeficit = opts.minDeficit ?? CORRECTION_MIN_DEFICIT;
  const avoidCollateral = opts.avoidCollateral ?? false;
  const collateralPenalty = opts.collateralPenalty ?? CORRECTION_COLLATERAL_PENALTY;
  const allowReduce = opts.allowReduce ?? false;
  // In-style weighting: when the neighbourhood's grain PREVALENCE is supplied, a
  // donor's score is scaled by how much the neighbourhood actually leans on it, so
  // the correction reaches for the common in-style grain (more munich/vienna in a
  // hazy) instead of the potent-but-out-of-style specialty (honey malt) just
  // because it moves the axis hardest. No prevalence → uniform (old behaviour).
  const prevalence = opts.prevalence;
  const maxPrev = prevalence ? Math.max(1e-9, ...Object.values(prevalence)) : 1;
  const styleWeightOf = (slug: string) => (prevalence ? CORRECTION_IN_STYLE_FLOOR + (1 - CORRECTION_IN_STYLE_FLOOR) * ((prevalence[slug] ?? 0) / maxPrev) : 1);
  const notes: string[] = [];
  const pushedAxes = (Object.keys(target) as Array<keyof MaltFlavorProfile>).filter((k) => target[k] != null);
  if (pushedAxes.length === 0 || items.length === 0) return { items, notes };

  type Part = { archetype: string; share: number; preset: GristBillItem["preset"] };
  const total = items.reduce((s, i) => s + i.pct, 0) || 1;
  let work: Part[] = items.map((i) => ({ archetype: i.archetype, share: i.pct / total, preset: i.preset }));
  const achievedOf = (parts: Part[]): MaltFlavorProfile =>
    aggregateMaltFlavor(parts.map((p) => ({ archetype: p.archetype, amount: p.share })));

  let changed = false;
  // Axes we're finished with — either hit, or taken as far as the ladder can.
  const settled = new Set<keyof MaltFlavorProfile>();
  // Per-axis grains we've climbed PAST (maxed or saturated) — never returned to, so
  // the escalation is monotonic despite the whole bill rescaling each step.
  const exhausted = new Map<keyof MaltFlavorProfile, Set<string>>();
  for (let pass = 0; pass < maxPasses; pass++) {
    const achieved = achievedOf(work);
    // Largest still-open gap on a pushed axis — either a shortfall (raise) or,
    // when allowReduce, a surplus (lower). Restyle uses both; steer() only raises.
    let axis: keyof MaltFlavorProfile | null = null;
    let worstGap = minDeficit;
    let direction: "up" | "down" = "up";
    for (const a of pushedAxes) {
      if (settled.has(a)) continue;
      const deficit = (target[a] ?? 0) - achieved[a];
      if (deficit > worstGap) { worstGap = deficit; axis = a; direction = "up"; }
      if (allowReduce) {
        const surplus = achieved[a] - (target[a] ?? 0);
        if (surplus > worstGap) { worstGap = surplus; axis = a; direction = "down"; }
      }
    }
    if (!axis) break;
    const ax = axis;

    // ── reduce: shift share off grains that drive this axis ────────────────
    if (direction === "down") {
      const reduceLadder = work
        .map((w) => ({ w, arch: MALT_ARCHETYPES_BY_SLUG.get(w.archetype) }))
        .filter((x): x is { w: Part; arch: NonNullable<typeof x.arch> } => !!x.arch && (x.arch.flavor[ax] || 0) > 0)
        .sort((a, b) => b.arch.intensity * (b.arch.flavor[ax] || 0) - a.arch.intensity * (a.arch.flavor[ax] || 0));

      let stepped = false;
      for (const { w: donorPart, arch: donorArch } of reduceLadder) {
        if (donorPart.share <= 1e-6) continue;
        const dec = Math.min(step, donorPart.share);
        // Recipient: the grain in the bill weakest on this axis (usually base malt).
        const recipients = work
          .filter((p) => p.archetype !== donorPart.archetype)
          .map((p) => ({ p, arch: MALT_ARCHETYPES_BY_SLUG.get(p.archetype) }))
          .filter((x): x is { p: Part; arch: NonNullable<typeof x.arch> } => !!x.arch)
          .sort((a, b) => (a.arch.intensity * (a.arch.flavor[ax] || 0)) - (b.arch.intensity * (b.arch.flavor[ax] || 0)));
        if (recipients.length === 0) continue;

        const trial: Part[] = work.map((p) => ({ ...p }));
        const donor = trial.find((p) => p.archetype === donorPart.archetype)!;
        donor.share -= dec;
        recipients[0].p.share += dec;
        const after = achievedOf(trial.filter((p) => p.share > 1e-9))[ax];
        if (!(after < achieved[ax] - 1e-4)) continue;
        stepped = true;
        const tgt = target[ax] ?? 0;
        if (after < tgt) {
          if (Math.abs(after - tgt) < Math.abs(tgt - achieved[ax])) { work = trial.filter((p) => p.share > 1e-9); changed = true; }
          settled.add(ax);
        } else {
          work = trial.filter((p) => p.share > 1e-9);
          changed = true;
        }
        break;
      }
      if (!stepped) settled.add(ax);
      continue;
    }

    // Axes to protect: other pushed axes already at/over target — a donor that also
    // drives these overshoots them, so with avoidCollateral on we drop such donors.
    const avoidAxes = avoidCollateral
      ? pushedAxes.filter((a) => a !== ax && achieved[a] >= (target[a] ?? 0))
      : [];

    // Escalate gentlest-first: reach for the least-assertive in-style grain that
    // still moves this axis, and only climb to a bigger-flavour one when the gentle
    // ones are maxed or saturated — base → munich → crystal → roast, the way a
    // brewer adds depth. Candidates are the sanctioned grains that drive the axis,
    // ordered by intensity ascending (ties broken toward the more in-style one).
    const exSet = exhausted.get(ax) ?? new Set<string>();
    exhausted.set(ax, exSet);
    const ladder = [...sanctioned]
      .map((slug) => MALT_ARCHETYPES_BY_SLUG.get(slug))
      .filter((a): a is NonNullable<typeof a> => !!a && !exSet.has(a.slug) && !!presetForArchetype(a.slug) && (a.flavor[ax] || 0) > 0)
      .filter((a) => {
        // with avoidCollateral, drop a grain whose collateral on the pulled-down
        // axes is more than a fraction of its gain on the axis being raised.
        if (avoidAxes.length === 0) return true;
        const gain = a.intensity * (a.flavor[ax] || 0);
        let collateral = 0;
        for (const av of avoidAxes) collateral += a.intensity * (a.flavor[av] || 0);
        return collateralPenalty * collateral <= CORRECTION_COLLATERAL_MAX_RATIO * gain;
      })
      .sort((a, b) => a.intensity - b.intensity || styleWeightOf(b.slug) - styleWeightOf(a.slug));

    const tgt = target[ax] ?? 0;
    let stepped = false;
    for (const arch of ladder) {
      const shareNow = work.find((w) => w.archetype === arch.slug)?.share ?? 0;
      if (shareNow >= maxDonorShare) { exSet.add(arch.slug); continue; } // maxed — exhaust + escalate
      const inc = Math.min(step, maxDonorShare - shareNow);
      // Trial: scale the bill down by (1-inc) to make room, add `inc` of this grain.
      const trial: Part[] = work.map((w) => ({ ...w, share: w.share * (1 - inc) }));
      const te = trial.find((w) => w.archetype === arch.slug);
      if (te) te.share += inc; else trial.push({ archetype: arch.slug, share: inc, preset: presetForArchetype(arch.slug)! });
      const after = achievedOf(trial)[ax];
      if (!(after > achieved[ax] + 1e-4)) { exSet.add(arch.slug); continue; } // saturated — exhaust + escalate
      stepped = true;
      // Overshoot guard: if the step vaults past the target, keep it only when it
      // lands closer than not stepping; either way the axis is now as close as it gets.
      if (after > tgt) {
        if (Math.abs(after - tgt) < Math.abs(tgt - achieved[ax])) { work = trial; changed = true; }
        settled.add(ax);
      } else {
        work = trial;
        changed = true;
        // hit the per-grain cap on this step → exhaust it so we climb next pass.
        if ((trial.find((w) => w.archetype === arch.slug)?.share ?? 0) >= maxDonorShare - 1e-9) exSet.add(arch.slug);
      }
      break; // one grain-step per pass
    }
    if (!stepped) settled.add(ax); // nothing left on the ladder could move it — done
  }

  if (!changed) return { items, notes };
  notes.push(allowReduce
    ? "rebalanced the grist toward the requested malt character using grains already in the bill"
    : "nudged the grist toward the requested malt character with more of a malt the neighbourhood already uses");
  const asItems: GristBillItem[] = work.map((w) => ({ archetype: w.archetype, pct: w.share * 100, preset: w.preset }));
  const brew = enforceGristBrewability(asItems);
  notes.push(...brew.notes);
  return { items: brew.items, notes };
}

/** Weighted-average a k-NN neighbourhood's `g` (archetype -> % of grist) maps. */
export function blendGristPct(neighbors: Array<{ rec: CloudRecord; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { rec, weight } of neighbors) {
    for (const [archetype, pct] of Object.entries(rec.g)) {
      out[archetype] = (out[archetype] ?? 0) + weight * pct;
    }
  }
  return out;
}

/** Grist bill -> Fermentable[] (placeholder weights) + the percentById map the ABV solver needs. */
export function buildFermentablesFromGristBill(
  items: GristBillItem[],
): { fermentables: Fermentable[]; percentById: Record<string, number> } {
  const fermentables: Fermentable[] = [];
  const percentById: Record<string, number> = {};
  items.forEach((item, i) => {
    const id = `grist-${i}`;
    fermentables.push({
      id,
      name: item.preset.name,
      weightKg: 0,
      colorLovibond: item.preset.colorLovibond,
      ppg: item.preset.potentialGu,
      // Vestigial on Fermentable — the calc engine derives efficiency from
      // type + system brewhouse efficiency (fermentableExtractEfficiency), not
      // this field. Set for type-completeness, mirroring seed-recipes.ts.
      efficiencyPercent: item.preset.type === "sugar" || item.preset.type === "extract" ? 100 : 75,
      originCode: item.preset.originCode,
    });
    percentById[id] = item.pct;
  });
  return { fermentables, percentById };
}

// ── Hop reconstruction ───────────────────────────────────────────────────────

export type HopBucket = "bittering" | "flavor" | "aroma" | "first-wort" | "whirlpool" | "dry-hop" | "mash";
const HOP_BUCKETS: HopBucket[] = ["bittering", "flavor", "aroma", "first-wort", "whirlpool", "dry-hop", "mash"];

export function bucketForAddition(type: string, timeMin: number): HopBucket | null {
  switch (type) {
    case "boil":
      if (timeMin >= 40) return "bittering";
      if (timeMin >= 10) return "flavor";
      return "aroma";
    case "first wort":
      return "first-wort";
    case "whirlpool":
      return "whirlpool";
    case "dry hop":
      return "dry-hop";
    case "mash":
      return "mash";
    default:
      return null;
  }
}

const HOP_PRESET_BY_LOWER = new Map(HOP_PRESETS.map((h) => [h.name.toLowerCase(), h]));
const DEFAULT_ALPHA_ACID = 10; // fallback for a corpus hop name absent from HOP_PRESETS

/** Alpha acid % for a (normalised, already lower-cased) hop name, or the generic fallback. */
function alphaFor(name: string): number {
  return HOP_PRESET_BY_LOWER.get(name.toLowerCase())?.alphaAcidPercent ?? DEFAULT_ALPHA_ACID;
}

/**
 * Corpus hop names are free text and carry noise real preset names don't —
 * inline AA%/form annotations ("Cascade (7% AA)", "Citra (T-90)"). Left
 * unstripped, two spellings of the same hop fragment into separate
 * "varieties" during bucketing/voting, and the annotated one then misses the
 * real HOP_PRESETS lookup and falls back to a generic 10% AA instead of the
 * hop's actual alpha acid. Applied once at ingestion so grouping, voting, and
 * the final preset lookup all see the same clean key.
 */
export function normalizeHopName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // "(7 aa)", "(pellet)", "(t-90)", etc.
    .replace(/\b\d+(\.\d+)?\s*%?\s*a\.?a\.?\b/gi, " ") // stray "7% aa" / "7aa" without parens
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type HopTemplate = { name: string; type: Hop["type"]; gpl: number; timeMinutes: number };

/**
 * Real recipes land additions on round checkpoints, not a bucket's raw
 * weighted-average time (which can land on "3min" or "57min" — an honest
 * average, but not how anyone actually schedules a hop addition).
 */
const BOIL_TIME_CHECKPOINTS = [0, 10, 15, 30, 45, 60];
const WHIRLPOOL_TIME_CHECKPOINTS = [0, 5, 10, 15, 20, 30];

function snapToNearest(value: number, checkpoints: number[]): number {
  let best = checkpoints[0];
  let bestDiff = Math.abs(value - best);
  for (const c of checkpoints) {
    const diff = Math.abs(value - c);
    if (diff < bestDiff) { best = c; bestDiff = diff; }
  }
  return best;
}

/** First-wort/dry-hop timing isn't snapped here: first-wort's timeMinutes is
 * discarded downstream (its IBU contribution anchors to the full boil time,
 * not this value) and dry-hop is already expressed in whole days. */
function snapTiming(type: Hop["type"], timeMinutes: number): number {
  if (type === "boil" || type === "mash") return snapToNearest(timeMinutes, BOIL_TIME_CHECKPOINTS);
  if (type === "whirlpool") return snapToNearest(timeMinutes, WHIRLPOOL_TIME_CHECKPOINTS);
  return timeMinutes;
}

/**
 * Bucket every weighted neighbour's hop additions by role/timing, keep a
 * bucket only if enough of the neighbourhood actually uses it, and split its
 * blended g/L across the (at most `maxVarietiesPerBucket`) most common
 * varieties in that bucket — but only when a variety earns real usage share;
 * a bucket collapses to its single dominant hop rather than padding out a
 * second line for a corpus outlier (see `minVarietyShare`). Finally, caps the
 * TOTAL number of additions to roughly what the neighbourhood itself
 * averages per recipe — clearing the presence threshold in 5-6 different
 * buckets doesn't mean a real brewer would stack a distinct addition in
 * every one of them.
 *
 * A bucket's g/L is normalised by its PRESENCE, so a partially-used bucket is
 * dosed the way its actual users dose it (not diluted by the neighbours who
 * skip it) — otherwise a dry hop in 40% of the neighbourhood came out at ~40%
 * of a real charge even after earning its line.
 *
 * Which variety wins a bucket's `maxVarietiesPerBucket` slots is ranked by
 * popularity share (the flavour steering already happened via the k-NN
 * neighbourhood — see the note at the top of this file), except BITTERING,
 * which ranks by the bitterness a hop actually delivers (g/L × alpha acid), so
 * the bill bitters with a real bittering hop instead of whatever aroma variety
 * happened to also appear in a few 60-min charges.
 */
export function reconstructHopSchedule(
  neighbors: Array<{ rec: CloudRecord; weight: number }>,
  opts: {
    presenceThreshold?: number;
    maxVarietiesPerBucket?: number;
    minVarietyShare?: number;
    maxTotalAdditions?: number;
    /** Wider neighbourhood the hop VARIETIES are voted from — the "menu" — while
     * bucket presence, dose, timing and addition count stay on the tight
     * `neighbors`. Defaults to `neighbors` (no split). */
    identityNeighbors?: Array<{ rec: CloudRecord; weight: number }>;
    /** 0 = always the most popular variety per bucket; higher reaches past it (seeded). */
    exploration?: number;
    /** Reroll seed — same seed reproduces the same picks. */
    seed?: number;
  } = {},
): { templates: HopTemplate[]; notes: string[] } {
  const presenceThreshold = opts.presenceThreshold ?? 0.25;
  const maxVarieties = opts.maxVarietiesPerBucket ?? 2;
  const minVarietyShare = opts.minVarietyShare ?? 0.3;
  const exploration = opts.exploration ?? 0;
  const seed = opts.seed ?? 0;
  const identityNeighbors = opts.identityNeighbors ?? neighbors;
  const notes: string[] = [];

  const presenceWeight: Record<HopBucket, number> = { bittering: 0, flavor: 0, aroma: 0, "first-wort": 0, whirlpool: 0, "dry-hop": 0, mash: 0 };
  const totalGplWeighted: Record<HopBucket, number> = { bittering: 0, flavor: 0, aroma: 0, "first-wort": 0, whirlpool: 0, "dry-hop": 0, mash: 0 };
  const nameGplWeighted: Record<HopBucket, Map<string, number>> = Object.fromEntries(HOP_BUCKETS.map((b) => [b, new Map<string, number>()])) as Record<HopBucket, Map<string, number>>;
  const timeWeighted: Record<HopBucket, { sum: number; weight: number }> = Object.fromEntries(HOP_BUCKETS.map((b) => [b, { sum: 0, weight: 0 }])) as Record<HopBucket, { sum: number; weight: number }>;

  // Bucket QUANTITIES — which buckets exist, their dose, their timing — from the
  // tight neighbourhood, so the volumes stay coherent.
  for (const { rec, weight } of neighbors) {
    const bucketsPresent = new Set<HopBucket>();
    for (const [, gpl, type, timeMin] of rec.hp) {
      const bucket = bucketForAddition(type, timeMin);
      if (!bucket || gpl <= 0) continue;
      bucketsPresent.add(bucket);
      totalGplWeighted[bucket] += weight * gpl;
      timeWeighted[bucket].sum += weight * gpl * timeMin;
      timeWeighted[bucket].weight += weight * gpl;
    }
    for (const bucket of bucketsPresent) presenceWeight[bucket] += weight;
  }
  // Variety IDENTITIES — which hops are on the menu for each bucket, and their
  // relative shares — from the (optionally wider) identity neighbourhood.
  for (const { rec, weight } of identityNeighbors) {
    for (const [name, gpl, type, timeMin] of rec.hp) {
      const bucket = bucketForAddition(type, timeMin);
      if (!bucket || gpl <= 0) continue;
      nameGplWeighted[bucket].set(normalizeHopName(name), (nameGplWeighted[bucket].get(normalizeHopName(name)) ?? 0) + weight * gpl);
    }
  }

  type Draft = HopTemplate & { presenceWeight: number; score: number };
  const drafts: Draft[] = [];
  for (const bucket of HOP_BUCKETS) {
    if (presenceWeight[bucket] < presenceThreshold) continue;
    // Dose this bucket as the neighbours who ACTUALLY USE IT dose it, not
    // diluted by the ones who don't: totalGplWeighted is summed over the whole
    // (weight-1) neighbourhood, so a bucket present in only part of it (a dry
    // hop in 40% of neighbours, say) would otherwise come out at ~40% of a real
    // dose even though it cleared the presence threshold and earned a line.
    // Divide by presenceWeight (≥ presenceThreshold > 0 here) to recover the
    // per-participant dose. Universal buckets (bittering ≈ presence 1) are
    // unchanged.
    const avgGpl = totalGplWeighted[bucket] / presenceWeight[bucket];
    if (avgGpl <= 0) continue;

    const entries = [...nameGplWeighted[bucket].entries()];
    const bucketTotal = entries.reduce((s, [, w]) => s + w, 0) || 1;
    // Ranking weight decides WHICH variety wins a slot; dose weight (raw
    // gpl-share `w`) decides how much of it is poured and gates minVarietyShare.
    // They diverge only for the bittering bucket: the right hop to bitter with
    // is the one that actually delivers the bitterness — a high-alpha hop at a
    // given g/L out-bitters a low-alpha aroma hop at the same g/L — so bittering
    // ranks by IBU potential (g/L × alpha acid), not raw dose. Otherwise a
    // popular low-alpha aroma variety that also shows up in a few 60-min charges
    // wins the bittering slot and the whole bill comes out badly under-bittered
    // (a Cascade-bittered "IPA" landing at ~20 IBU — see docs/corpus-lab-build.md).
    const rankWeightOf = (name: string, w: number) => (bucket === "bittering" ? w * alphaFor(name) : w);
    const rankTotal = entries.reduce((s, [name, w]) => s + rankWeightOf(name, w), 0) || 1;
    const scored = entries.map(([name, w]) => ({ name, w, score: rankWeightOf(name, w) / rankTotal }));
    // exploration=0 => the top `maxVarieties` by score (deterministic, unchanged);
    // higher => a seeded sample that can pick a less-common variety already on
    // this bucket's menu. Seeded per bucket for independent, reproducible draws.
    const topRanked = selectExplored(scored, maxVarieties, exploration, mulberry32(hashSeed(seed, "hop", bucket)));
    // Always keep the top-ranked variety; a 2nd (or 3rd) only earns its own
    // line if it represents a real share of the bucket, not a lone outlier —
    // gated on its actual popularity share regardless of flavour match, so
    // this can shift which hop is dominant but can't manufacture an addition
    // out of a hop nobody nearby uses.
    const ranked = topRanked.filter((c, i) => i === 0 || c.w / bucketTotal >= minVarietyShare);
    const rankedTotal = ranked.reduce((s, c) => s + c.w, 0) || 1;
    const rawTimeMinutes = timeWeighted[bucket].weight > 0 ? timeWeighted[bucket].sum / timeWeighted[bucket].weight : 0;
    const type: Hop["type"] = bucket === "first-wort" ? "first wort" : bucket === "dry-hop" ? "dry hop" : (bucket === "bittering" || bucket === "flavor" || bucket === "aroma") ? "boil" : (bucket as "whirlpool" | "mash");
    const timeMinutes = Math.round(snapTiming(type, rawTimeMinutes));

    for (const { name, w, score } of ranked) {
      drafts.push({ name, type, gpl: avgGpl * (w / rankedTotal), timeMinutes, presenceWeight: presenceWeight[bucket], score });
    }
  }

  // Cap total additions to what the neighbourhood itself typically has.
  // Keep the most TYPICAL additions first (highest bucket presence, i.e. how
  // many neighbours use this timing role at all); break ties by each draft's
  // own ranking score, not raw gpl — gpl is dominated by per-role dosing
  // convention (dry hops are just dosed heavier than bittering charges), which
  // would otherwise override the per-bucket variety ranking above.
  const avgHopCount = neighbors.reduce((s, { rec, weight }) => {
    const count = rec.hp.filter(([, gpl, type, timeMin]) => gpl > 0 && bucketForAddition(type, timeMin) != null).length;
    return s + weight * count;
  }, 0);
  const targetCount = opts.maxTotalAdditions ?? Math.max(1, Math.round(avgHopCount));
  let kept = drafts;
  if (drafts.length > targetCount) {
    kept = [...drafts].sort((a, b) => b.presenceWeight - a.presenceWeight || b.score - a.score).slice(0, targetCount);
    notes.push(`the neighbourhood averages ~${targetCount} hop addition${targetCount === 1 ? "" : "s"} per recipe — trimmed the schedule to match`);
  }

  const templates: HopTemplate[] = kept.map(({ name, type, gpl, timeMinutes }) => ({ name, type, gpl, timeMinutes }));
  if (templates.length === 0) notes.push("no hop bucket cleared the presence threshold — synthesized an unhopped bill");
  return { templates, notes };
}

/** Hop templates (g/L) -> real Hop[] at a batch volume, with alpha acid from HOP_PRESETS. */
export function materializeHopSchedule(templates: HopTemplate[], batchVolumeL: number): Hop[] {
  return templates.map((t, i) => {
    const preset = HOP_PRESET_BY_LOWER.get(t.name.toLowerCase());
    const hop: Hop = {
      id: `hop-${i}`,
      name: preset?.name ?? t.name,
      alphaAcid: preset?.alphaAcidPercent ?? DEFAULT_ALPHA_ACID,
      grams: t.gpl * batchVolumeL,
      type: t.type,
      timeMinutes: t.type === "boil" || t.type === "mash" ? t.timeMinutes : undefined,
    };
    if (t.type === "whirlpool") hop.whirlpoolTimeMinutes = t.timeMinutes;
    if (t.type === "dry hop") hop.dryHopDays = Math.max(1, Math.round(t.timeMinutes / 1440));
    return hop;
  });
}

/** Uniformly scale every hop's grams (used by the target-IBU bisection solver). */
export function scaleHops(hops: Hop[], factor: number): Hop[] {
  return hops.map((h) => ({ ...h, grams: h.grams * factor }));
}

// ── Hop-side residual correction (#3 for hops) ────────────────────────────────

/** g/L added to the corrective dry-hop per pass (saturation stops it early). */
const HOP_CORRECTION_STEP_GPL = 1.0;
/** A single corrective variety can't exceed this dry-hop dose — a big charge, not a firehose. */
const HOP_CORRECTION_DONOR_MAX_GPL = 6;
/** Total corrective dry-hop added across all passes is capped here (keeps the bill real). */
const HOP_CORRECTION_ADDED_MAX_GPL = 8;
const HOP_CORRECTION_MAX_PASSES = 12;
/** Only correct a pushed hop axis whose shortfall is at least this much. */
const HOP_CORRECTION_MIN_DEFICIT = 0.2;
/** Corrective charge is a 3-day dry hop (expressed in minutes for the template). */
const HOP_CORRECTION_DRYHOP_MINUTES = 3 * 24 * 60;

/**
 * The hop analogue of `correctMaltGristToward`: close the part of a HOP flavour
 * shortfall the k-NN rerank leaves by adding a bounded late/dry-hop charge of the
 * variety that most drives the deficit axis — drawn only from what the
 * neighbourhood actually used (`sanctioned` → never invents a hop).
 *
 * Hop flavour is dose-driven (a late charge's g/L), not fraction-driven like
 * malt, so this adds grams rather than shifting proportions: each pass finds the
 * largest open pushed-axis deficit, picks the strongest-on-axis sanctioned
 * variety, and grows its dry-hop dose a step — stopping when the flavour
 * aggregator saturates (more of the same hop stops helping) or a dose cap is hit.
 *
 * Pure: the whole-schedule flavour is evaluated through an injected `evaluate`
 * (the caller wires in the app's real hop-flavour calc), and each variety's own
 * vector through `flavorOf`, so this has no cloud/app dependency and is unit-tested
 * directly. Bittering is never touched (the IBU solver owns that downstream).
 */
export function correctHopScheduleToward(
  templates: HopTemplate[],
  sanctioned: Iterable<string>,
  flavorOf: (name: string) => HopFlavorProfile | undefined,
  target: Partial<HopFlavorProfile>,
  evaluate: (templates: HopTemplate[]) => HopFlavorProfile,
  opts: {
    step?: number;
    donorMaxGpl?: number;
    addedMaxGpl?: number;
    maxPasses?: number;
    minDeficit?: number;
    avoidCollateral?: boolean;
    collateralPenalty?: number;
    prevalence?: Record<string, number>;
    /** When true, trim dry-hop doses driving an axis when achieved > target. Default false. */
    allowReduce?: boolean;
  } = {},
): { templates: HopTemplate[]; notes: string[] } {
  const step = opts.step ?? HOP_CORRECTION_STEP_GPL;
  const donorMaxGpl = opts.donorMaxGpl ?? HOP_CORRECTION_DONOR_MAX_GPL;
  const addedMaxGpl = opts.addedMaxGpl ?? HOP_CORRECTION_ADDED_MAX_GPL;
  const maxPasses = opts.maxPasses ?? HOP_CORRECTION_MAX_PASSES;
  const minDeficit = opts.minDeficit ?? HOP_CORRECTION_MIN_DEFICIT;
  const avoidCollateral = opts.avoidCollateral ?? false;
  const collateralPenalty = opts.collateralPenalty ?? CORRECTION_COLLATERAL_PENALTY;
  const allowReduce = opts.allowReduce ?? false;
  // In-style weighting (see correctMaltGristToward): scale a donor by how much the
  // neighbourhood leans on that hop, so a common in-style variety wins over a rare
  // one that merely scores high on the axis. No prevalence → uniform (old behaviour).
  const prevalence = opts.prevalence;
  const maxPrev = prevalence ? Math.max(1e-9, ...Object.values(prevalence)) : 1;
  const styleWeightOf = (name: string) => (prevalence ? CORRECTION_IN_STYLE_FLOOR + (1 - CORRECTION_IN_STYLE_FLOOR) * ((prevalence[name] ?? 0) / maxPrev) : 1);
  const notes: string[] = [];
  const pushedAxes = (Object.keys(target) as Array<keyof HopFlavorProfile>).filter((k) => target[k] != null);
  if (pushedAxes.length === 0) return { templates, notes };

  const sanctionedNames = [...sanctioned];
  let work: HopTemplate[] = templates.map((t) => ({ ...t }));
  let addedTotal = 0;
  let changed = false;
  const settled = new Set<keyof HopFlavorProfile>();

  for (let pass = 0; pass < maxPasses; pass++) {
    const achieved = evaluate(work);
    let axis: keyof HopFlavorProfile | null = null;
    let worstGap = minDeficit;
    let direction: "up" | "down" = "up";
    for (const ax of pushedAxes) {
      if (settled.has(ax)) continue;
      const deficit = (target[ax] ?? 0) - achieved[ax];
      if (deficit > worstGap) { worstGap = deficit; axis = ax; direction = "up"; }
      if (allowReduce) {
        const surplus = achieved[ax] - (target[ax] ?? 0);
        if (surplus > worstGap) { worstGap = surplus; axis = ax; direction = "down"; }
      }
    }
    if (!axis) break;

    // ── reduce: trim dry-hop (or whirlpool) doses driving this axis ─────────
    if (direction === "down") {
      const reducible = work
        .filter((t) => (t.type === "dry hop" || t.type === "whirlpool") && (flavorOf(t.name)?.[axis] ?? 0) > 0)
        .sort((a, b) => (flavorOf(b.name)?.[axis] ?? 0) - (flavorOf(a.name)?.[axis] ?? 0));
      let stepped = false;
      for (const donor of reducible) {
        if (donor.gpl <= 1e-6) continue;
        const dec = Math.min(step, donor.gpl);
        const trial = work.map((t) => (t === donor ? { ...t, gpl: t.gpl - dec } : { ...t })).filter((t) => t.gpl > 1e-6);
        const after = evaluate(trial)[axis];
        if (!(after < achieved[axis] - 1e-4)) continue;
        stepped = true;
        const tgt = target[axis] ?? 0;
        if (after < tgt) {
          if (Math.abs(after - tgt) < Math.abs(tgt - achieved[axis])) { work = trial; changed = true; }
          settled.add(axis);
        } else {
          work = trial;
          changed = true;
        }
        break;
      }
      if (!stepped) settled.add(axis);
      continue;
    }

    if (addedTotal >= addedMaxGpl) break;

    // Axes to protect: pushed axes (other than the one being raised) already at
    // or over target — a donor strong in these overshoots them. With
    // avoidCollateral on, dock its score by their contribution so the purest
    // donor for the deficit axis wins (e.g. a berry hop that isn't also stone
    // fruit, when stone fruit was pulled down).
    const avoidAxes = avoidCollateral
      ? pushedAxes.filter((ax) => ax !== axis && achieved[ax] >= (target[ax] ?? 0))
      : [];

    // The neighbourhood-sanctioned variety strongest on that axis — net of
    // collateral, and weighted toward the varieties the neighbourhood actually uses.
    let donor: string | null = null;
    let donorScore = 0;
    for (const name of sanctionedNames) {
      const vec = flavorOf(name);
      const contrib = vec?.[axis] ?? 0;
      if (contrib <= 0) continue; // must actually help the deficit axis
      let gain = contrib;
      for (const av of avoidAxes) gain -= collateralPenalty * (vec?.[av] ?? 0);
      if (gain <= 0) continue;
      const score = gain * styleWeightOf(name);
      if (score > donorScore) { donorScore = score; donor = name; }
    }
    if (!donor || donorScore <= 0) { settled.add(axis); continue; }

    // Grow the donor's dry-hop dose (boost an existing one, else add a new charge).
    const existing = work.find((t) => t.type === "dry hop" && t.name === donor);
    const donorGplNow = existing ? existing.gpl : 0;
    if (donorGplNow >= donorMaxGpl) { settled.add(axis); continue; }
    const inc = Math.min(step, donorMaxGpl - donorGplNow, addedMaxGpl - addedTotal);
    if (inc <= 0) { settled.add(axis); continue; }

    const trial: HopTemplate[] = work.map((t) => ({ ...t }));
    const trialExisting = trial.find((t) => t.type === "dry hop" && t.name === donor);
    if (trialExisting) trialExisting.gpl += inc;
    else trial.push({ name: donor, type: "dry hop", gpl: inc, timeMinutes: HOP_CORRECTION_DRYHOP_MINUTES });

    const tgt = target[axis] ?? 0;
    const after = evaluate(trial)[axis];
    if (!(after > achieved[axis] + 1e-4)) { settled.add(axis); continue; }
    if (after > tgt) {
      // overshoot: keep the step only if it lands closer than not adding it, then stop.
      if (Math.abs(after - tgt) < Math.abs(tgt - achieved[axis])) { work = trial; addedTotal += inc; changed = true; }
      settled.add(axis);
    } else {
      work = trial;
      addedTotal += inc;
      changed = true;
    }
  }

  if (!changed) return { templates, notes };
  notes.push(allowReduce
    ? "adjusted hop doses already in the bill toward the requested hop character"
    : "added a dry-hop charge of a variety the neighbourhood already uses to reach the requested hop character");
  return { templates: work, notes };
}

// ── Yeast reconstruction ─────────────────────────────────────────────────────

const YEAST_PRESET_BY_NAME = new Map(YEAST_PRESETS.map((y) => [y.name, y]));

/** The strain type ("ale"/"lager"/"kveik"/…) of a yeast preset name, or undefined if unknown. */
export function yeastTypeOf(name: string): string | undefined {
  return YEAST_PRESET_BY_NAME.get(name)?.type;
}

/**
 * Weighted vote on the neighbourhood's reconstruction-ready yeast preset name.
 *
 * An optional `allow` predicate filters the vote to on-style candidates BEFORE
 * tallying, so a disallowed yeast can't win at all (returns null if nothing
 * survives the filter — the caller then applies its own fallback). This is how
 * a lager style stops picking up the ale yeast that homebrewers routinely
 * (mis)use in "lagers", and how a clean-ale style stops defaulting to a trendy
 * kveik a noisy neighbourhood happened to vote in.
 */
export function pickModalYeastName(
  neighbors: Array<{ rec: CloudRecord; weight: number }>,
  opts: { allow?: (name: string) => boolean } = {},
): string | null {
  const { allow } = opts;
  const tally = new Map<string, number>();
  for (const { rec, weight } of neighbors) {
    if (!rec.yn) continue;
    if (allow && !allow(rec.yn)) continue;
    tally.set(rec.yn, (tally.get(rec.yn) ?? 0) + weight);
  }
  let best: string | null = null;
  let bestWeight = 0;
  for (const [name, w] of tally) {
    if (w > bestWeight) { best = name; bestWeight = w; }
  }
  return best;
}

export function buildYeastFromPresetName(name: string): Yeast | null {
  const preset = YEAST_PRESET_BY_NAME.get(name);
  if (!preset) return null;
  return {
    id: "yeast-0",
    name: preset.name,
    attenuation: preset.attenuationPercent ?? 0.75,
    laboratory: preset.category,
  };
}
