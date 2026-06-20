import type {
  Recipe,
  Fermentable,
  Hop,
  MashStep,
  FermentationStep,
  Yeast,
  OtherIngredient,
  OtherIngredientCategory,
} from '../models/Recipe';
import { uid } from '@/utils/uid';
import { round } from '@/utils/round';
import { hopEnrichmentService } from './HopEnrichmentService';
import {
  matchHop,
  matchGrain,
  matchYeast,
  type MatchCandidate,
} from '@/utils/ingredientMatching';
import { matchBjcpStyle, bjcpCodeFromParts, type BjcpStyleHit } from '@/utils/bjcpMatching';
import type { HopPreset, GrainPreset, YeastPreset } from '@/utils/presets';

const text = (parent: Element | null, tag: string): string | undefined => {
  const el = parent?.getElementsByTagName(tag)?.[0];
  if (!el || !el.textContent) return undefined;
  return el.textContent.trim();
};

const toNumber = (value: string | undefined): number | undefined => {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

// Strip precision artifacts from BeerXML floats (some exporters round-trip
// through SRM↔Lovibond / alpha-as-fraction conversions and emit values like
// 4.5685179°L). We keep one decimal of meaningful precision.
const roundTo = (n: number | undefined, decimals: number): number | undefined =>
  n == null || !Number.isFinite(n) ? undefined : round(n, decimals);

const alphaToPercent = (alphaRaw: number | undefined): number | undefined => {
  if (alphaRaw == null) return undefined;
  return alphaRaw <= 1 ? alphaRaw * 100 : alphaRaw;
};

const potentialToPpg = (potential: number | undefined): number | undefined => {
  if (potential == null) return undefined;
  return Math.round((potential - 1) * 1000);
};

const yieldToPpg = (yieldPercent: number | undefined): number | undefined => {
  if (yieldPercent == null) return undefined;
  return Math.round((yieldPercent / 100) * 46);
};

// Parse a BeerXML float that may carry a unit suffix ("1.052 SG", "6.0 %", "45 IBU").
const parseLeadingNumber = (value: string | undefined): number | undefined => {
  if (value == null) return undefined;
  const m = value.match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
};

// A non-negative finite number, else undefined — so a negative/garbage loss in
// the source file falls back to our default rather than corrupting the calc.
const nonNegOrUndefined = (n: number | undefined): number | undefined =>
  n != null && Number.isFinite(n) && n >= 0 ? n : undefined;

// ---------- Equipment (<EQUIPMENT>) parsing ----------

/** Vitals the source file claims, surfaced for the post-import reconciliation. */
export type SourceVitals = { og?: number; fg?: number; ibu?: number; abv?: number };

// Hardcoded fallbacks — used per-field whenever the EQUIPMENT block (or a field)
// is absent, so an equipment-less BeerXML still imports cleanly. These mirror the
// values the importer used to stamp unconditionally.
const EQUIPMENT_DEFAULTS = {
  boilOffRateLPerHour: 4,
  mashThicknessLPerKg: 2.7,
  grainAbsorptionLPerKg: 0.8,
  mashTunDeadspaceLiters: 2,
  mashTunLossLiters: 0,
  kettleLossLiters: 1,
  hopsAbsorptionLPerKg: 0.7,
  chillerLossLiters: 0,
  fermenterLossLiters: 0.5,
  coolingShrinkagePercent: 4,
} as const;

// Namespace for the non-standard child tags our own export stamps inside
// <EQUIPMENT>. BeerXML mandates that readers ignore unknown tags, so these are a
// spec-sanctioned side-channel for the equipment fields the standard can't carry
// (fermenter loss, recovered deadspace, absorption rates, etc.). Their presence
// also marks a file as one of ours, making round-trips exactly lossless without
// the fragile NAME-marker approach (NAME already holds the user's profile name).
const BT = 'BT_';

type ParsedEquipmentFields = Omit<
  Recipe['equipment'],
  'boilTimeMin' | 'brewhouseEfficiencyPercent' | 'fermenterLossLiters'
>;

function parseEquipment(recipeEl: Element): {
  equipment: ParsedEquipmentFields;
  fermenterLossLiters: number;
} {
  const d = EQUIPMENT_DEFAULTS;
  const eqEl = recipeEl.getElementsByTagName('EQUIPMENT')?.[0] ?? null;
  if (!eqEl) {
    return { equipment: { ...d }, fermenterLossLiters: d.fermenterLossLiters };
  }

  // BT_* custom children are authoritative (our own export); they let the full
  // equipment profile round-trip losslessly. Foreign files have none and fall
  // through to the standard fields, then to defaults.
  const bt = (tag: string) => nonNegOrUndefined(toNumber(text(eqEl, BT + tag)));

  const trubChillerLoss = nonNegOrUndefined(toNumber(text(eqEl, 'TRUB_CHILLER_LOSS')));
  const lauterDeadspace = nonNegOrUndefined(toNumber(text(eqEl, 'LAUTER_DEADSPACE')));
  const boilSize = nonNegOrUndefined(toNumber(text(eqEl, 'BOIL_SIZE')));
  const evapRate = toNumber(text(eqEl, 'EVAP_RATE')); // %/hr of boil volume, per spec

  // EVAP_RATE is a PERCENTAGE of the boil volume per hour (NOT L/hr) — convert
  // against BOIL_SIZE. Both must be present and sane; otherwise keep the default
  // rate (we recompute pre-boil from our own model anyway, so boil-off only
  // affects pre-boil water and the boil-average gravity feeding IBU).
  const boilOffFromEvap =
    evapRate != null && Number.isFinite(evapRate) && evapRate > 0 && boilSize != null
      ? (evapRate / 100) * boilSize
      : undefined;

  const equipment: ParsedEquipmentFields = {
    boilOffRateLPerHour: bt('BOIL_OFF_RATE') ?? boilOffFromEvap ?? d.boilOffRateLPerHour,
    mashThicknessLPerKg: bt('MASH_THICKNESS') ?? d.mashThicknessLPerKg,
    grainAbsorptionLPerKg: bt('GRAIN_ABSORPTION') ?? d.grainAbsorptionLPerKg,
    // Recovered deadspace has no standard BeerXML field — only our custom tag.
    mashTunDeadspaceLiters: bt('MASH_TUN_DEADSPACE') ?? d.mashTunDeadspaceLiters,
    // LAUTER_DEADSPACE is "amount LOST to the lauter tun" → a genuine
    // (unrecovered) loss, which maps to our mashTunLoss, NOT the recovered
    // deadspace above.
    mashTunLossLiters: bt('MASH_TUN_LOSS') ?? lauterDeadspace ?? d.mashTunLossLiters,
    // BeerXML lumps kettle trub + chiller/transfer into TRUB_CHILLER_LOSS. Both
    // are post-boil losses and the calc only uses their sum, so put it all on
    // kettle and leave chiller 0 (the split is cosmetic).
    kettleLossLiters: bt('KETTLE_LOSS') ?? trubChillerLoss ?? d.kettleLossLiters,
    hopsAbsorptionLPerKg: bt('HOP_ABSORPTION') ?? d.hopsAbsorptionLPerKg,
    chillerLossLiters: bt('CHILLER_LOSS') ?? d.chillerLossLiters,
    coolingShrinkagePercent: bt('COOLING_SHRINKAGE') ?? d.coolingShrinkagePercent,
  };

  return { equipment, fermenterLossLiters: bt('FERMENTER_LOSS') ?? d.fermenterLossLiters };
}

function parseSourceVitals(recipeEl: Element): SourceVitals | undefined {
  const og = parseLeadingNumber(text(recipeEl, 'OG') ?? text(recipeEl, 'EST_OG'));
  const fg = parseLeadingNumber(text(recipeEl, 'FG') ?? text(recipeEl, 'EST_FG'));
  const ibu = parseLeadingNumber(text(recipeEl, 'IBU'));
  const abv = parseLeadingNumber(text(recipeEl, 'ABV') ?? text(recipeEl, 'EST_ABV'));
  const v: SourceVitals = {};
  // Guard junk values some exporters emit (OG 1.000 / 0, etc.).
  if (og != null && og > 1.0) v.og = og;
  if (fg != null && fg > 0.9) v.fg = fg;
  if (ibu != null && ibu >= 0) v.ibu = ibu;
  if (abv != null && abv >= 0) v.abv = abv;
  return Object.keys(v).length > 0 ? v : undefined;
}

// ---------- Water salt routing (BeerXML MISC → waterChemistry.saltAdditions) ----------

type SaltKey = 'gypsum_g' | 'cacl2_g' | 'epsom_g' | 'nacl_g' | 'nahco3_g';

// Salts our ion calculator models. Names cover the common spellings/synonyms
// that exporters emit (Brewfather/BeerSmith/BeerJSON tools all differ).
const SALT_ALIASES: Array<{ key: SaltKey; match: RegExp }> = [
  { key: 'gypsum_g', match: /\b(gypsum|caso4|calcium\s+sulf[a|p]?h?ate)\b/i },
  // Order matters: match calcium-chloride BEFORE generic "chloride" so it
  // doesn't get swallowed by anything else later.
  { key: 'cacl2_g', match: /\b(cacl2?|calcium\s+chloride)\b/i },
  { key: 'epsom_g', match: /\b(epsom(\s+salt)?|mgso4|magnesium\s+sulf[a|p]?h?ate)\b/i },
  { key: 'nahco3_g', match: /\b(baking\s+soda|sodium\s+bicarbonate|nahco3|bicarbonate)\b/i },
  // NaCl is last so "epsom salt" / "canning salt" can't match it incorrectly.
  { key: 'nacl_g', match: /\b(table\s+salt|canning\s+salt|sodium\s+chloride|nacl|^salt$|^salt\b)/i },
];

function matchWaterSalt(name: string | undefined): SaltKey | null {
  if (!name) return null;
  const n = name.trim();
  if (!n) return null;
  for (const { key, match } of SALT_ALIASES) {
    if (match.test(n)) return key;
  }
  return null;
}

// ---------- Match result types surfaced to the UI ----------

export type PendingHopMatch = {
  kind: 'hop';
  ingredientId: string;
  imported: string;
  best: MatchCandidate<HopPreset> | null;
  candidates: MatchCandidate<HopPreset>[];
  reason?: string;
};
export type PendingGrainMatch = {
  kind: 'grain';
  ingredientId: string;
  imported: string;
  best: MatchCandidate<GrainPreset> | null;
  candidates: MatchCandidate<GrainPreset>[];
  reason?: string;
};
export type PendingYeastMatch = {
  kind: 'yeast';
  ingredientId: string;
  imported: string;
  best: MatchCandidate<YeastPreset> | null;
  candidates: MatchCandidate<YeastPreset>[];
  reason?: string;
};
export type PendingStyleMatch = {
  kind: 'style';
  imported: string;
  best: MatchCandidate<BjcpStyleHit> | null;
  candidates: MatchCandidate<BjcpStyleHit>[];
  reason?: string;
};

export type PendingMatch =
  | PendingHopMatch
  | PendingGrainMatch
  | PendingYeastMatch
  | PendingStyleMatch;

export type BeerXmlImportResult = {
  recipe: Recipe;
  pendingMatches: PendingMatch[];
  /** Vitals the source file stated (if any), for post-import reconciliation. */
  sourceVitals?: SourceVitals;
};

/** Resolutions returned by the review UI back to the import committer. */
export type MatchResolution =
  | { kind: 'hop'; ingredientId: string; presetName?: string }
  | { kind: 'grain'; ingredientId: string; presetName?: string }
  | { kind: 'yeast'; ingredientId: string; presetName?: string }
  | { kind: 'style'; canonical?: string };

class BeerXmlImportService {
  parse(xml: string): BeerXmlImportResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const recipeEl = doc.getElementsByTagName('RECIPE')?.[0];
    if (!recipeEl) {
      throw new Error('BeerXML missing RECIPE');
    }

    const now = new Date().toISOString();
    const name = text(recipeEl, 'NAME') || 'Imported BeerXML';

    // Style: prefer category-number + style-letter when present (most reliable).
    const styleEl = recipeEl.getElementsByTagName('STYLE')?.[0] ?? null;
    const styleName = styleEl ? text(styleEl, 'NAME') : undefined;
    const styleCategoryNumber = styleEl ? text(styleEl, 'CATEGORY_NUMBER') : undefined;
    const styleLetter = styleEl ? text(styleEl, 'STYLE_LETTER') : undefined;
    const codeHint = bjcpCodeFromParts(styleCategoryNumber, styleLetter) ?? undefined;

    const pendingMatches: PendingMatch[] = [];
    let resolvedStyle: string | undefined = styleName;
    if (styleName || codeHint) {
      const styleMatch = matchBjcpStyle(styleName ?? '', codeHint);
      if (styleMatch.autoAccept && styleMatch.canonical) {
        resolvedStyle = styleMatch.canonical;
      } else if (styleMatch.best) {
        pendingMatches.push({
          kind: 'style',
          imported: styleName ?? codeHint ?? '',
          best: styleMatch.best,
          candidates: styleMatch.candidates,
          reason: styleMatch.reason,
        });
      }
    }

    // Equipment first — we need the fermenter loss to convert BATCH_SIZE.
    const { equipment: parsedEquipment, fermenterLossLiters } = parseEquipment(recipeEl);

    // BeerXML BATCH_SIZE is the INTO-FERMENTER volume; our batchVolumeL is the
    // finished/packaged volume (fermenter loss is added back on top — see the
    // export). Subtract the fermenter loss so OG and round-trips reconcile (this
    // is the exact inverse of BeerXmlExportService's fermenterBatchL). Clamp so a
    // tiny/garbage BATCH_SIZE can't drive the volume to zero/negative.
    const rawBatchSize = toNumber(text(recipeEl, 'BATCH_SIZE')) ?? 20;
    const batchVolumeL =
      Math.max(1, roundTo(rawBatchSize - fermenterLossLiters, 3) ?? rawBatchSize);
    const boilTimeMin = toNumber(text(recipeEl, 'BOIL_TIME')) ?? 60;
    const efficiency = toNumber(text(recipeEl, 'EFFICIENCY')) ?? 75;

    // Fermentables
    const fermentables: Fermentable[] = [];
    const fermParent = recipeEl.getElementsByTagName('FERMENTABLES')?.[0];
    if (fermParent) {
      const fermEls = Array.from(fermParent.getElementsByTagName('FERMENTABLE'));
      fermEls.forEach((f) => {
        const amtKg = roundTo(toNumber(text(f, 'AMOUNT')), 4) ?? 0;
        const colorLov = roundTo(toNumber(text(f, 'COLOR')), 1) ?? 2;
        const potential = potentialToPpg(toNumber(text(f, 'POTENTIAL')));
        const yieldPct = yieldToPpg(toNumber(text(f, 'YIELD')));
        const ppg = potential ?? yieldPct ?? 36;
        const importedName = text(f, 'NAME') || 'Fermentable';
        const id = uid();

        const grainMatch = matchGrain(importedName);
        const resolvedName =
          grainMatch.autoAccept && grainMatch.best ? grainMatch.best.presetName : importedName;
        if (!grainMatch.autoAccept && grainMatch.best) {
          pendingMatches.push({
            kind: 'grain',
            ingredientId: id,
            imported: importedName,
            best: grainMatch.best,
            candidates: grainMatch.candidates,
            reason: grainMatch.reason,
          });
        }

        fermentables.push({
          id,
          name: resolvedName,
          weightKg: amtKg,
          colorLovibond: colorLov,
          ppg,
          efficiencyPercent: efficiency,
          originCode: text(f, 'ORIGIN'),
        });
      });
    }

    // Hops
    const hops: Hop[] = [];
    const hopsParent = recipeEl.getElementsByTagName('HOPS')?.[0];
    if (hopsParent) {
      const hopEls = Array.from(hopsParent.getElementsByTagName('HOP'));
      hopEls.forEach((h) => {
        const amountKg = toNumber(text(h, 'AMOUNT')) ?? 0;
        const amountG = roundTo(amountKg * 1000, 1) ?? 0;
        const alpha = roundTo(alphaToPercent(toNumber(text(h, 'ALPHA'))), 1) ?? 0;
        const use = (text(h, 'USE') || '').toLowerCase();
        const timeMin = toNumber(text(h, 'TIME'));

        const formStr = (text(h, 'FORM') || '').toLowerCase();
        const form: Hop['form'] | undefined = formStr.includes('leaf') || formStr.includes('whole')
          ? 'leaf'
          : formStr.includes('plug')
          ? 'plug'
          : formStr.includes('pellet')
          ? 'pellet'
          : undefined;

        let type: Hop['type'] = 'boil';
        const useFlameout = use.includes('flameout');
        if (use.includes('dry')) type = 'dry hop';
        else if (use.includes('mash')) type = 'mash';
        else if (use.includes('first')) type = 'first wort';
        else if (use.includes('aroma') || use.includes('whirlpool') || useFlameout)
          type = 'whirlpool';

        // Narrow flameout case: a USE=Boil addition with TIME=0 isn't a 0-minute
        // boil (which isomerizes ~nothing) — it's a flameout/steep. Route it to
        // whirlpool with hot-stand defaults so it earns realistic late bitterness.
        // (USE=Aroma already maps to whirlpool above and is left untouched.)
        const isBoilFlameout = type === 'boil' && timeMin === 0;
        if (isBoilFlameout) type = 'whirlpool';
        const isFlameout = useFlameout || isBoilFlameout;

        const importedName = text(h, 'NAME') || 'Hop';
        const id = uid();

        const hopMatchResult = matchHop(importedName);
        const resolvedName =
          hopMatchResult.autoAccept && hopMatchResult.best
            ? hopMatchResult.best.presetName
            : importedName;
        if (!hopMatchResult.autoAccept && hopMatchResult.best) {
          pendingMatches.push({
            kind: 'hop',
            ingredientId: id,
            imported: importedName,
            best: hopMatchResult.best,
            candidates: hopMatchResult.candidates,
            reason: hopMatchResult.reason,
          });
        }

        // enrichHop pulls flavor profile from presets keyed off the (now canonical) name.
        const enriched = hopEnrichmentService.enrichHop({
          id,
          name: resolvedName,
          alphaAcid: alpha,
          grams: amountG,
          type,
          form,
          timeMinutes: type === 'boil' || type === 'first wort' ? timeMin : undefined,
          // Stand time: respect an explicit positive TIME, else default so a
          // 0-min flameout still isomerizes (flameout ~10 min, whirlpool ~15).
          whirlpoolTimeMinutes:
            type === 'whirlpool'
              ? (timeMin && timeMin > 0 ? timeMin : isFlameout ? 10 : 15)
              : undefined,
          // Temperature: use XML TEMPERATURE if present, else hot for flameout
          // (~99 °C) and a cooler default for whirlpool/aroma (~85 °C).
          temperatureC:
            type === 'whirlpool'
              ? (toNumber(text(h, 'TEMPERATURE')) ?? (isFlameout ? 99 : 85))
              : undefined,
          dryHopStartDay: type === 'dry hop' ? 7 : undefined,
          // Round-trip the dry-hop duration: BeerXML carries it in TIME minutes
          // (our export writes days×1440). Fall back to 3 days when absent/zero.
          dryHopDays:
            type === 'dry hop'
              ? (timeMin && timeMin > 0 ? Math.max(1, Math.round(timeMin / 1440)) : 3)
              : undefined,
        });
        // enrichHop may rebuild the object from presets — make sure FORM survives.
        if (form) enriched.form = form;
        hops.push(enriched);
      });
    }

    // Yeast
    const yeasts: Yeast[] = [];
    const yeastsParent = recipeEl.getElementsByTagName('YEASTS')?.[0];
    if (yeastsParent) {
      const yeastEls = Array.from(yeastsParent.getElementsByTagName('YEAST'));
      yeastEls.forEach((yeastEl) => {
        const attenuationPct = toNumber(text(yeastEl, 'ATTENUATION'));
        const attDecimal = roundTo(
          attenuationPct != null
            ? attenuationPct > 1
              ? attenuationPct / 100
              : attenuationPct
            : undefined,
          3
        );
        const importedName = text(yeastEl, 'NAME') || 'Yeast';
        const laboratory = text(yeastEl, 'LABORATORY');
        const id = uid();

        const yeastMatch = matchYeast(importedName, laboratory);
        const resolvedName =
          yeastMatch.autoAccept && yeastMatch.best ? yeastMatch.best.presetName : importedName;
        if (!yeastMatch.autoAccept && yeastMatch.best) {
          pendingMatches.push({
            kind: 'yeast',
            ingredientId: id,
            imported: importedName,
            best: yeastMatch.best,
            candidates: yeastMatch.candidates,
            reason: yeastMatch.reason,
          });
        }

        yeasts.push({
          id,
          name: resolvedName,
          attenuation: attDecimal ?? 0.75,
          laboratory,
        });
      });
    }

    // Mash steps
    const mashSteps: MashStep[] = [];
    const mashParent = recipeEl.getElementsByTagName('MASH_STEPS')?.[0];
    if (mashParent) {
      const stepEls = Array.from(mashParent.getElementsByTagName('MASH_STEP'));
      stepEls.forEach((s, idx) => {
        mashSteps.push({
          id: uid(),
          name: text(s, 'NAME') || `Step ${idx + 1}`,
          temperatureC: toNumber(text(s, 'STEP_TEMP')) ?? 66,
          durationMinutes: toNumber(text(s, 'STEP_TIME')) ?? 60,
        });
      });
    }

    // Fermentation steps (basic mapping from primary/secondary)
    const fermentationSteps: FermentationStep[] = [];
    const primaryDays = toNumber(text(recipeEl, 'PRIMARY_AGE')) ?? 10;
    const primaryTempC = toNumber(text(recipeEl, 'PRIMARY_TEMP')) ?? 20;
    fermentationSteps.push({
      id: uid(),
      name: 'Primary',
      type: 'primary',
      durationDays: primaryDays,
      temperatureC: primaryTempC,
    });

    const secondaryDays = toNumber(text(recipeEl, 'SECONDARY_AGE'));
    const secondaryTempC = toNumber(text(recipeEl, 'SECONDARY_TEMP')) ?? primaryTempC;
    if (secondaryDays && secondaryDays > 0) {
      fermentationSteps.push({
        id: uid(),
        name: 'Secondary',
        type: 'secondary',
        durationDays: secondaryDays,
        temperatureC: secondaryTempC,
      });
    }

    const tertiaryDays = toNumber(text(recipeEl, 'TERTIARY_AGE'));
    const tertiaryTempC =
      toNumber(text(recipeEl, 'TERTIARY_TEMP')) ?? secondaryTempC ?? primaryTempC;
    if (tertiaryDays && tertiaryDays > 0) {
      fermentationSteps.push({
        id: uid(),
        name: 'Tertiary',
        type: 'conditioning',
        durationDays: tertiaryDays,
        temperatureC: tertiaryTempC,
      });
    }

    const conditioningDays = toNumber(text(recipeEl, 'AGE'));
    const conditioningTempC =
      toNumber(text(recipeEl, 'AGE_TEMP')) ?? tertiaryTempC ?? secondaryTempC ?? primaryTempC;
    if (conditioningDays && conditioningDays > 0) {
      fermentationSteps.push({
        id: uid(),
        name: 'Conditioning',
        type: 'conditioning',
        durationDays: conditioningDays,
        temperatureC: conditioningTempC,
      });
    }

    // Misc items + water salts
    // BeerXML lumps water salts under MISCS with TYPE=Water Agent. If we drop
    // them straight into otherIngredients they show up as "Additional items"
    // and don't feed the ion calculator. Route the 5 salts our chemistry
    // model knows about into saltAdditions instead, and only fall through to
    // otherIngredients for things we don't model (acids, finings, spices…).
    const otherIngredients: OtherIngredient[] = [];
    const saltAdditions: Partial<Record<SaltKey, number>> = {};
    const miscParent = recipeEl.getElementsByTagName('MISCS')?.[0];
    if (miscParent) {
      const miscEls = Array.from(miscParent.getElementsByTagName('MISC'));
      miscEls.forEach((m) => {
        const rawName = text(m, 'NAME');
        const amountKg = toNumber(text(m, 'AMOUNT')) ?? 0;
        const grams = roundTo(amountKg * 1000, 2) ?? 0;
        const useStr = (text(m, 'USE') || 'boil').toLowerCase();
        const typeStr = (text(m, 'TYPE') || 'other').toLowerCase();
        const isWater = typeStr.includes('water');

        // Salt routing: water-agent MISC whose name matches a modeled salt.
        if (isWater) {
          const salt = matchWaterSalt(rawName);
          if (salt) {
            // Accumulate — a recipe may split the same salt across mash/sparge.
            saltAdditions[salt] = roundTo((saltAdditions[salt] ?? 0) + grams, 2) ?? 0;
            return;
          }
        }

        let timing: OtherIngredient['timing'] = 'boil';
        if (useStr.includes('mash')) timing = 'mash';
        else if (useStr.includes('primary') || useStr.includes('secondary')) timing = 'secondary';
        else if (useStr.includes('bottling')) timing = 'bottling';

        let category: OtherIngredientCategory = 'other';
        if (isWater) category = 'water-agent';
        else if (typeStr.includes('fining')) category = 'fining';
        else if (typeStr.includes('spice')) category = 'spice';
        else if (typeStr.includes('flavor')) category = 'flavor';
        else if (typeStr.includes('herb')) category = 'herb';

        otherIngredients.push({
          id: uid(),
          name: rawName || 'Misc',
          category,
          amount: grams,
          unit: 'g',
          timing,
          notes: text(m, 'NOTES'),
        });
      });
    }

    // Optional source water profile from <WATERS><WATER>…</WATER></WATERS>.
    // Not every exporter includes one; defaults to all-zeros (RO/distilled)
    // when absent, so a recipe with only salt additions still gets a valid
    // waterChemistry block.
    let sourceProfile: { Ca: number; Mg: number; Na: number; Cl: number; SO4: number; HCO3: number } | null = null;
    let sourceProfileName: string | undefined;
    const watersParent = recipeEl.getElementsByTagName('WATERS')?.[0];
    if (watersParent) {
      const waterEl = watersParent.getElementsByTagName('WATER')?.[0];
      if (waterEl) {
        sourceProfileName = text(waterEl, 'NAME');
        sourceProfile = {
          Ca: roundTo(toNumber(text(waterEl, 'CALCIUM')) ?? 0, 1) ?? 0,
          Mg: roundTo(toNumber(text(waterEl, 'MAGNESIUM')) ?? 0, 1) ?? 0,
          Na: roundTo(toNumber(text(waterEl, 'SODIUM')) ?? 0, 1) ?? 0,
          Cl: roundTo(toNumber(text(waterEl, 'CHLORIDE')) ?? 0, 1) ?? 0,
          SO4: roundTo(toNumber(text(waterEl, 'SULFATE')) ?? 0, 1) ?? 0,
          HCO3: roundTo(toNumber(text(waterEl, 'BICARBONATE')) ?? 0, 1) ?? 0,
        };
      }
    }

    const hasSalts = Object.keys(saltAdditions).length > 0;
    const waterChemistry =
      hasSalts || sourceProfile
        ? {
            sourceProfile: sourceProfile ?? { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 },
            saltAdditions,
            sourceProfileName,
          }
        : undefined;

    const recipe: Recipe = {
      id: uid(),
      name,
      style: resolvedStyle,
      subtitle: text(recipeEl, 'BT_SUBTITLE'),
      notes: text(recipeEl, 'NOTES'),
      tags: [],
      currentVersion: 1,
      batchVolumeL,
      equipment: {
        boilTimeMin,
        brewhouseEfficiencyPercent: efficiency,
        ...parsedEquipment,
        // Fermenter loss is parsed alongside the rest but lives on batchVolumeL's
        // conversion; restore it here so it round-trips and feeds SRM/volumes.
        fermenterLossLiters,
      },
      fermentables,
      hops,
      yeasts,
      otherIngredients,
      mashSteps,
      waterChemistry,
      fermentationSteps,
      createdAt: now,
      updatedAt: now,
    };

    return { recipe, pendingMatches, sourceVitals: parseSourceVitals(recipeEl) };
  }

  /**
   * Apply user-confirmed resolutions from the review modal back onto the parsed recipe.
   * Each resolution may carry `presetName` (apply) or undefined (keep imported name).
   * For hops, also re-runs enrichment in case the canonical name unlocks a flavor profile.
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
        if (hop) {
          hop.name = r.presetName;
          const enriched = hopEnrichmentService.enrichHop(hop);
          Object.assign(hop, enriched);
        }
      } else if (r.kind === 'grain') {
        const grain = next.fermentables.find((g) => g.id === r.ingredientId);
        if (grain) grain.name = r.presetName;
      } else if (r.kind === 'yeast') {
        const yeast = next.yeasts.find((y) => y.id === r.ingredientId);
        if (yeast) yeast.name = r.presetName;
      }
    }
    return next;
  }
}

export const beerXmlImportService = new BeerXmlImportService();
