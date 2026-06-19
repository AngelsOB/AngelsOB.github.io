import type { Recipe, Hop, Yeast, Fermentable } from '../models/Recipe';
import { recipeCalculationService } from './RecipeCalculationService';
import {
  HOP_PRESETS,
  YEAST_PRESETS,
  getGrainPresets,
  type GrainPreset,
  type HopPreset,
  type YeastPreset,
  type YeastStrainType,
} from '@/utils/presets';
import { findBjcpStyleByCode } from '@/utils/bjcp';
import { getBjcpStyleSpec, srmToEbc } from '@/utils/bjcpSpecs';
import { inferType as inferFermentableType } from '@/modules/recipe/data/fermentablePresets';

// ============================================================
// XML primitives
// ============================================================

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Render a number with sensible precision (drops trailing zeros). */
const num = (n: number | undefined | null, decimals = 2): string | undefined => {
  if (n == null || !Number.isFinite(n)) return undefined;
  return String(+n.toFixed(decimals));
};

const tag = (
  name: string,
  value: string | number | undefined | null,
  indent = '      '
): string => {
  if (value == null) return '';
  const v = typeof value === 'number' ? String(value) : escapeXml(value);
  return `${indent}<${name}>${v}</${name}>`;
};

// ============================================================
// Domain ↔ BeerXML enum maps
// ============================================================

const hopUseMap: Record<Hop['type'], string> = {
  boil: 'Boil',
  'dry hop': 'Dry Hop',
  'first wort': 'First Wort',
  whirlpool: 'Aroma',
  mash: 'Mash',
};

// BeerXML 1.0 YEAST/TYPE enum is narrow: Ale, Lager, Wheat, Wine, Champagne.
const yeastBeerXmlType = (t: YeastStrainType | undefined): string => {
  switch (t) {
    case 'lager':
      return 'Lager';
    case 'wheat':
      return 'Wheat';
    case 'wine':
      return 'Wine';
    case 'ale':
    case 'kveik':
    case 'brett':
    case 'wild':
    case 'bacteria':
    case 'blend':
    case 'other':
    default:
      return 'Ale';
  }
};

const yeastBeerXmlForm = (form: 'liquid' | 'dry' | undefined): string =>
  form === 'dry' ? 'Dry' : 'Liquid';

const ppgToYield = (ppg: number): number => +((ppg / 46) * 100).toFixed(2);

// BeerXML 1.0 FERMENTABLE/TYPE enum: Grain | Sugar | Extract | Dry Extract | Adjunct.
// We don't store this on the recipe model — infer from the name via the same
// helper the editor uses, then map to the BeerXML enum.
function fermentableBeerXmlType(name: string): string {
  const inferred = inferFermentableType(name);
  switch (inferred) {
    case 'sugar':
      return 'Sugar';
    case 'extract':
      // Distinguish dry malt extract from liquid: spec has both.
      return /\b(dme|dry\s+malt|dry\s+extract)\b/i.test(name) ? 'Dry Extract' : 'Extract';
    case 'adjunct_mashable':
      return 'Adjunct';
    case 'grain':
    default:
      return 'Grain';
  }
}

// ============================================================
// Preset lookups (by case-insensitive name)
// ============================================================

const hopByName = new Map<string, HopPreset>(
  HOP_PRESETS.map((p) => [p.name.toLowerCase(), p])
);
const yeastByName = new Map<string, YeastPreset>(
  YEAST_PRESETS.map((p) => [p.name.toLowerCase(), p])
);
// Grains include user-custom — re-resolve each export so adds are picked up.
function grainsByName(): Map<string, GrainPreset> {
  return new Map(getGrainPresets().map((p) => [p.name.toLowerCase(), p]));
}

// ============================================================
// Style helpers — convert "21A. American IPA" → full BeerXML <STYLE> block
// ============================================================

function parseStyleCode(style: string | undefined): string | null {
  if (!style) return null;
  const head = style.split('.')[0]?.trim();
  if (!head) return null;
  // Accept "21A", "X5", "27-Kellerbier"
  if (/^(\d{1,2}[A-Z]|X\d+|\d{1,2}-[A-Za-z])/.test(head)) return head;
  return null;
}

// BeerXML 1.0 STYLE/TYPE is a strict enum. Map BJCP category to one of these.
type BeerXmlStyleType = 'Lager' | 'Ale' | 'Mead' | 'Wheat' | 'Mixed' | 'Cider';

function bjcpCategoryToType(_categoryName: string, code: string): BeerXmlStyleType {
  const c = code.replace(/[^\d]/g, '');
  const n = parseInt(c, 10);
  if (!Number.isFinite(n)) return 'Ale';
  // Wheat beers
  if (n === 10) return 'Wheat';
  // Standard lager categories (American/International/Czech/European lagers)
  if ([2, 3, 4, 5, 6, 7, 8, 9].includes(n)) return 'Lager';
  // 1: Standard American — mostly lagers, with Cream Ale (1C) the lone Ale.
  if (n === 1) return code === '1C' ? 'Ale' : 'Lager';
  // Specialty / historical / sour buckets — best-fit "Mixed"
  if ([23, 27, 28, 29, 30, 31, 32, 33, 34].includes(n)) return 'Mixed';
  // Provisional (X*) — treat as Ale by default
  if (Number.isNaN(n)) return 'Ale';
  return 'Ale';
}

function pushStyleBlock(lines: string[], style: string): void {
  const code = parseStyleCode(style);
  // Title-only fallback when no recognizable code
  if (!code) {
    lines.push('      <STYLE>');
    lines.push(tag('NAME', style, '        '));
    lines.push(tag('VERSION', 1, '        '));
    lines.push('      </STYLE>');
    return;
  }

  const entry = findBjcpStyleByCode(code);
  const spec = getBjcpStyleSpec(code);
  const displayName = entry ? `${code}. ${entry.name}` : style;

  // Split code into CATEGORY_NUMBER + STYLE_LETTER. Most codes are "21A".
  // Provisional ("X5") has no letter; historical ("27-Kellerbier") has no letter.
  const m = code.match(/^(\d{1,3})([A-Z])?$/);
  const categoryNumber = m?.[1] ?? code.replace(/[^\d]/g, '');
  const styleLetter = m?.[2] ?? '';

  lines.push('      <STYLE>');
  lines.push(tag('NAME', displayName, '        '));
  lines.push(tag('VERSION', 1, '        '));
  if (entry?.categoryName) lines.push(tag('CATEGORY', entry.categoryName, '        '));
  if (categoryNumber) lines.push(tag('CATEGORY_NUMBER', categoryNumber, '        '));
  if (styleLetter) lines.push(tag('STYLE_LETTER', styleLetter, '        '));
  lines.push(tag('STYLE_GUIDE', 'BJCP 2021', '        '));
  lines.push(
    tag('TYPE', bjcpCategoryToType(entry?.categoryName ?? '', code), '        ')
  );
  if (spec?.og) {
    lines.push(tag('OG_MIN', num(spec.og[0], 4), '        '));
    lines.push(tag('OG_MAX', num(spec.og[1], 4), '        '));
  }
  if (spec?.fg) {
    lines.push(tag('FG_MIN', num(spec.fg[0], 4), '        '));
    lines.push(tag('FG_MAX', num(spec.fg[1], 4), '        '));
  }
  if (spec?.ibu) {
    lines.push(tag('IBU_MIN', num(spec.ibu[0], 1), '        '));
    lines.push(tag('IBU_MAX', num(spec.ibu[1], 1), '        '));
  }
  if (spec?.srm) {
    lines.push(tag('COLOR_MIN', num(spec.srm[0], 1), '        '));
    lines.push(tag('COLOR_MAX', num(spec.srm[1], 1), '        '));
  }
  if (spec?.abv) {
    lines.push(tag('ABV_MIN', num(spec.abv[0], 1), '        '));
    lines.push(tag('ABV_MAX', num(spec.abv[1], 1), '        '));
  }
  if (spec?.co2) {
    lines.push(tag('CARB_MIN', num(spec.co2[0], 1), '        '));
    lines.push(tag('CARB_MAX', num(spec.co2[1], 1), '        '));
  }
  lines.push('      </STYLE>');
}

// ============================================================
// Equipment block
// ============================================================

function pushEquipmentBlock(
  lines: string[],
  recipe: Recipe,
  preBoilL: number,
  fermenterBatchL: number
): void {
  const eq = recipe.equipment;
  lines.push('      <EQUIPMENT>');
  // NAME holds the user's equipment profile — do NOT repurpose it as an origin
  // marker. Our round-trip detection rides on the BT_* custom tags below.
  lines.push(tag('NAME', recipe.equipmentProfileName ?? 'Custom', '        '));
  lines.push(tag('VERSION', 1, '        '));
  lines.push(tag('BATCH_SIZE', num(fermenterBatchL, 2), '        '));
  lines.push(tag('BOIL_SIZE', num(preBoilL, 2), '        '));
  lines.push(tag('BOIL_TIME', num(eq.boilTimeMin, 0), '        '));
  lines.push(tag('CALC_BOIL_VOLUME', 'TRUE', '        '));
  // BeerXML 1.0 EVAP_RATE is the PERCENTAGE of boil volume boiled off per
  // hour, NOT L/hr (we store L/hr; convert here against the actual boil
  // volume). e.g. 3 L/hr off a 25.92 L boil = 11.57 %/hr — matches Brewfather.
  const evapPct = preBoilL > 0 ? (eq.boilOffRateLPerHour / preBoilL) * 100 : 0;
  lines.push(tag('EVAP_RATE', num(evapPct, 3), '        '));
  // Trub/chiller loss = what stays in the kettle after transfer (post-boil).
  const trubLoss = (eq.kettleLossLiters ?? 0) + (eq.chillerLossLiters ?? 0);
  lines.push(tag('TRUB_CHILLER_LOSS', num(trubLoss, 2), '        '));
  // LAUTER_DEADSPACE is spec-defined as the amount LOST to the lauter tun, so we
  // write our genuine (unrecovered) mash-tun loss here — NOT the recovered
  // deadspace (which has no standard field and rides on BT_MASH_TUN_DEADSPACE).
  lines.push(tag('LAUTER_DEADSPACE', num(eq.mashTunLossLiters ?? 0, 2), '        '));

  // --- Non-standard round-trip tags (BeerXML readers ignore unknown tags) ---
  // These carry the equipment fields the standard can't express, so importing
  // our own export reconstructs the profile exactly. Their presence also marks
  // the file as ours. FERMENTER_LOSS is the key one: it lets the importer invert
  // BATCH_SIZE (into-fermenter) back to our finished volume without guessing.
  const bt = (name: string, value: number | undefined, decimals = 3) =>
    tag(`BT_${name}`, num(value, decimals), '        ');
  lines.push(bt('FERMENTER_LOSS', eq.fermenterLossLiters));
  lines.push(bt('KETTLE_LOSS', eq.kettleLossLiters));
  lines.push(bt('CHILLER_LOSS', eq.chillerLossLiters));
  lines.push(bt('MASH_TUN_DEADSPACE', eq.mashTunDeadspaceLiters));
  lines.push(bt('MASH_TUN_LOSS', eq.mashTunLossLiters));
  lines.push(bt('HOP_ABSORPTION', eq.hopsAbsorptionLPerKg));
  lines.push(bt('GRAIN_ABSORPTION', eq.grainAbsorptionLPerKg));
  lines.push(bt('MASH_THICKNESS', eq.mashThicknessLPerKg));
  lines.push(bt('COOLING_SHRINKAGE', eq.coolingShrinkagePercent));
  lines.push(bt('BOIL_OFF_RATE', eq.boilOffRateLPerHour));
  lines.push('      </EQUIPMENT>');
}

// ============================================================
// Main service
// ============================================================

class BeerXmlExportService {
  generate(recipe: Recipe): string {
    const calcs = recipeCalculationService.calculate(recipe);
    const grainLookup = grainsByName();
    const lines: string[] = [];

    // BeerXML BATCH_SIZE = into-fermenter volume; our batchVolumeL = final packaged volume.
    const fermenterBatchL = recipe.batchVolumeL + (recipe.equipment.fermenterLossLiters ?? 0);

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<RECIPES>');
    lines.push('  <RECIPE>');

    // ---- Recipe metadata ----
    lines.push(tag('NAME', recipe.name));
    lines.push(tag('VERSION', 1));
    lines.push(tag('TYPE', 'All Grain'));
    lines.push(tag('BATCH_SIZE', num(fermenterBatchL, 2)));
    lines.push(tag('BOIL_SIZE', num(calcs.preBoilVolumeL, 2)));
    lines.push(tag('BOIL_TIME', num(recipe.equipment.boilTimeMin, 0)));
    lines.push(tag('EFFICIENCY', num(recipe.equipment.brewhouseEfficiencyPercent, 1)));
    if (recipe.notes) lines.push(tag('NOTES', recipe.notes));

    // ---- Calculated vitals ----
    // Per BeerXML 1.0: OG/FG/IBU/ABV are plain floats; EST_* fields are
    // display STRINGS with units ("1.057 SG", "16 SRM", "6.04 %").
    lines.push(tag('OG', num(calcs.og, 4)));
    lines.push(tag('FG', num(calcs.fg, 4)));
    lines.push(tag('EST_OG', `${num(calcs.og, 4)} SG`));
    lines.push(tag('EST_FG', `${num(calcs.fg, 4)} SG`));
    lines.push(tag('EST_ABV', `${num(calcs.abv, 2)} %`));
    lines.push(tag('ABV', `${num(calcs.abv, 2)} %`));
    lines.push(tag('IBU', num(calcs.ibu, 1)));
    lines.push(tag('EST_COLOR', `${num(calcs.srm, 1)} SRM`));

    // Target carbonation (CARBONATION is in volumes of CO2)
    if (recipe.packaging?.targetCo2Volumes != null) {
      lines.push(tag('CARBONATION', num(recipe.packaging.targetCo2Volumes, 2)));
    }

    // ---- Style block ----
    if (recipe.style) pushStyleBlock(lines, recipe.style);

    // ---- Equipment block ----
    pushEquipmentBlock(lines, recipe, calcs.preBoilVolumeL, fermenterBatchL);

    // ---- Fermentables ----
    lines.push('      <FERMENTABLES>');
    for (const f of recipe.fermentables) {
      const preset = grainLookup.get(f.name.toLowerCase());
      lines.push('        <FERMENTABLE>');
      lines.push(tag('NAME', f.name, '          '));
      lines.push(tag('VERSION', 1, '          '));
      lines.push(tag('TYPE', fermentableBeerXmlType(f.name), '          '));
      lines.push(tag('AMOUNT', num(f.weightKg, 4), '          '));
      lines.push(tag('COLOR', num(f.colorLovibond, 1), '          '));
      lines.push(tag('YIELD', num(ppgToYield(f.ppg), 2), '          '));
      if (f.originCode) lines.push(tag('ORIGIN', f.originCode, '          '));
      if (preset?.producer) lines.push(tag('SUPPLIER', preset.producer, '          '));
      lines.push(tag('ADD_AFTER_BOIL', 'FALSE', '          '));
      lines.push('        </FERMENTABLE>');
    }
    lines.push('      </FERMENTABLES>');

    // ---- Hops ----
    lines.push('      <HOPS>');
    for (const h of recipe.hops) {
      const preset = hopByName.get(h.name.toLowerCase());
      const use = hopUseMap[h.type];
      const time =
        h.type === 'boil' || h.type === 'first wort'
          ? h.timeMinutes ?? 0
          : h.type === 'whirlpool'
          ? h.whirlpoolTimeMinutes ?? 0
          : h.type === 'dry hop'
          ? (h.dryHopDays ?? 0) * 24 * 60 // BeerXML spec: time in minutes; many tools treat dry-hop time as days, we emit minutes for spec compliance
          : 0;

      lines.push('        <HOP>');
      lines.push(tag('NAME', h.name, '          '));
      lines.push(tag('VERSION', 1, '          '));
      lines.push(tag('ALPHA', num(h.alphaAcid, 1), '          '));
      lines.push(tag('AMOUNT', num(h.grams / 1000, 4), '          '));
      lines.push(tag('USE', use, '          '));
      lines.push(tag('TIME', num(time, 0), '          '));
      // FORM is required by BeerXML; default to Pellet (most common) when unset.
      const hopForm = h.form === 'leaf' ? 'Leaf' : h.form === 'plug' ? 'Plug' : 'Pellet';
      lines.push(tag('FORM', hopForm, '          '));
      if (h.type === 'whirlpool' && h.temperatureC != null) {
        lines.push(tag('TEMPERATURE', num(h.temperatureC, 1), '          '));
      }
      if (preset?.originCode) lines.push(tag('ORIGIN', preset.originCode, '          '));
      lines.push('        </HOP>');
    }
    lines.push('      </HOPS>');

    // ---- Yeast ----
    lines.push('      <YEASTS>');
    for (const y of recipe.yeasts ?? []) {
      const preset = yeastByName.get(y.name.toLowerCase());
      pushYeast(lines, y, preset);
    }
    lines.push('      </YEASTS>');

    // ---- Misc + water salts ----
    // Emit water salts (from waterChemistry) AND other misc ingredients
    // (finings, spices, acids) so the recipe round-trips through other
    // brewing software without losing chemistry.
    const miscLines: string[] = [];
    pushSaltMiscs(miscLines, recipe.waterChemistry?.saltAdditions);
    pushOtherMiscs(miscLines, recipe.otherIngredients);
    if (miscLines.length > 0) {
      lines.push('      <MISCS>');
      lines.push(...miscLines);
      lines.push('      </MISCS>');
    }

    // ---- Source water profile ----
    if (recipe.waterChemistry?.sourceProfile) {
      pushWaterBlock(
        lines,
        recipe.waterChemistry.sourceProfile,
        recipe.waterChemistry.sourceProfileName,
        calcs.totalWaterL
      );
    }

    // ---- Mash ----
    lines.push('      <MASH>');
    lines.push(tag('NAME', 'Mash', '        '));
    lines.push(tag('VERSION', 1, '        '));
    lines.push(tag('GRAIN_TEMP', 22, '        '));
    lines.push('        <MASH_STEPS>');
    recipe.mashSteps.forEach((s, idx) => {
      lines.push('          <MASH_STEP>');
      lines.push(tag('NAME', s.name, '            '));
      lines.push(tag('VERSION', 1, '            '));
      lines.push(tag('TYPE', 'Temperature', '            '));
      lines.push(tag('STEP_TEMP', num(s.temperatureC, 1), '            '));
      lines.push(tag('STEP_TIME', num(s.durationMinutes, 0), '            '));
      // Put the total mash water on the first step as INFUSE_AMOUNT — a rough
      // approximation when we don't model per-step infusion volumes.
      if (idx === 0 && Number.isFinite(calcs.mashWaterL)) {
        lines.push(tag('INFUSE_AMOUNT', num(calcs.mashWaterL, 2), '            '));
      }
      lines.push('          </MASH_STEP>');
    });
    lines.push('        </MASH_STEPS>');
    lines.push('      </MASH>');

    // ---- Fermentation steps ----
    for (const step of recipe.fermentationSteps) {
      if (step.type === 'primary') {
        lines.push(tag('PRIMARY_AGE', num(step.durationDays, 1)));
        lines.push(tag('PRIMARY_TEMP', num(step.temperatureC, 1)));
      } else if (step.type === 'secondary') {
        lines.push(tag('SECONDARY_AGE', num(step.durationDays, 1)));
        lines.push(tag('SECONDARY_TEMP', num(step.temperatureC, 1)));
      } else if (step.type === 'conditioning') {
        lines.push(tag('AGE', num(step.durationDays, 1)));
        lines.push(tag('AGE_TEMP', num(step.temperatureC, 1)));
      }
    }
    // Hint to downstream tools how many stages were exported
    const stageCount = recipe.fermentationSteps.filter(
      (s) => s.type === 'primary' || s.type === 'secondary' || s.type === 'conditioning'
    ).length;
    if (stageCount > 0) lines.push(tag('FERMENTATION_STAGES', stageCount));

    lines.push('  </RECIPE>');
    lines.push('</RECIPES>');

    return lines.filter((l) => l !== '').join('\n');
  }
}

// ============================================================
// Misc / salts / water helpers
// ============================================================

type SaltAdditions = {
  gypsum_g?: number;
  cacl2_g?: number;
  epsom_g?: number;
  nacl_g?: number;
  nahco3_g?: number;
};

const SALT_DISPLAY: Record<keyof SaltAdditions, string> = {
  gypsum_g: 'Gypsum',
  cacl2_g: 'Calcium Chloride',
  epsom_g: 'Epsom Salt',
  nacl_g: 'Table Salt',
  nahco3_g: 'Baking Soda',
};

function pushSaltMiscs(lines: string[], salts: SaltAdditions | undefined): void {
  if (!salts) return;
  (Object.entries(salts) as Array<[keyof SaltAdditions, number | undefined]>).forEach(
    ([key, grams]) => {
      if (!grams || grams <= 0) return;
      lines.push('        <MISC>');
      lines.push(tag('NAME', SALT_DISPLAY[key], '          '));
      lines.push(tag('VERSION', 1, '          '));
      lines.push(tag('TYPE', 'Water Agent', '          '));
      lines.push(tag('USE', 'Mash', '          '));
      lines.push(tag('TIME', 0, '          '));
      lines.push(tag('AMOUNT', num(grams / 1000, 6), '          '));
      lines.push(tag('AMOUNT_IS_WEIGHT', 'TRUE', '          '));
      lines.push(tag('DISPLAY_AMOUNT', `${num(grams, 2)} g`, '          '));
      lines.push('        </MISC>');
    }
  );
}

// Map our category → BeerXML MISC/TYPE enum (Spice, Fining, Water Agent, Herb, Flavor, Other).
const OTHER_TYPE_MAP: Record<string, string> = {
  'water-agent': 'Water Agent',
  fining: 'Fining',
  spice: 'Spice',
  flavor: 'Flavor',
  herb: 'Herb',
  other: 'Other',
};

// Map our timing → BeerXML MISC/USE enum (Boil, Mash, Primary, Secondary, Bottling).
const OTHER_USE_MAP: Record<string, string> = {
  mash: 'Mash',
  boil: 'Boil',
  whirlpool: 'Boil',
  secondary: 'Secondary',
  kegging: 'Bottling',
  bottling: 'Bottling',
};

function pushOtherMiscs(
  lines: string[],
  others: Array<{
    name: string;
    category: string;
    amount: number;
    unit: string;
    timing: string;
    notes?: string;
  }> | undefined
): void {
  if (!others?.length) return;
  for (const o of others) {
    // Convert to kg only when the unit is a known mass; otherwise pass through
    // raw amount and let the recipient interpret via DISPLAY_AMOUNT.
    const kgFromGrams = o.unit === 'g' ? o.amount / 1000 : o.amount / 1000;
    lines.push('        <MISC>');
    lines.push(tag('NAME', o.name, '          '));
    lines.push(tag('VERSION', 1, '          '));
    lines.push(tag('TYPE', OTHER_TYPE_MAP[o.category] ?? 'Other', '          '));
    lines.push(tag('USE', OTHER_USE_MAP[o.timing] ?? 'Boil', '          '));
    lines.push(tag('TIME', 0, '          '));
    lines.push(tag('AMOUNT', num(kgFromGrams, 6), '          '));
    lines.push(tag('AMOUNT_IS_WEIGHT', 'TRUE', '          '));
    lines.push(tag('DISPLAY_AMOUNT', `${num(o.amount, 2)} ${o.unit}`, '          '));
    if (o.notes) lines.push(tag('NOTES', o.notes, '          '));
    lines.push('        </MISC>');
  }
}

function pushWaterBlock(
  lines: string[],
  profile: { Ca: number; Mg: number; Na: number; Cl: number; SO4: number; HCO3: number },
  name: string | undefined,
  amountL: number
): void {
  lines.push('      <WATERS>');
  lines.push('        <WATER>');
  lines.push(tag('NAME', name ?? 'Source Water', '          '));
  lines.push(tag('VERSION', 1, '          '));
  // AMOUNT (liters) is REQUIRED per BeerXML 1.0 WATER spec.
  lines.push(tag('AMOUNT', num(amountL, 2), '          '));
  lines.push(tag('CALCIUM', num(profile.Ca, 1), '          '));
  lines.push(tag('MAGNESIUM', num(profile.Mg, 1), '          '));
  lines.push(tag('SODIUM', num(profile.Na, 1), '          '));
  lines.push(tag('CHLORIDE', num(profile.Cl, 1), '          '));
  lines.push(tag('SULFATE', num(profile.SO4, 1), '          '));
  lines.push(tag('BICARBONATE', num(profile.HCO3, 1), '          '));
  lines.push('        </WATER>');
  lines.push('      </WATERS>');
}

function pushYeast(lines: string[], y: Yeast, preset: YeastPreset | undefined): void {
  lines.push('        <YEAST>');
  lines.push(tag('NAME', y.name, '          '));
  lines.push(tag('VERSION', 1, '          '));
  // Spec-required enums — fall back to sensible defaults when we don't know.
  lines.push(tag('TYPE', yeastBeerXmlType(preset?.type), '          '));
  lines.push(tag('FORM', yeastBeerXmlForm(preset?.form), '          '));
  // AMOUNT in BeerXML is liters for liquid, kg for dry. We don't track per-recipe
  // pitch quantity yet, so omit rather than guess.
  lines.push(tag('ATTENUATION', num(y.attenuation * 100, 1), '          '));
  if (y.laboratory) lines.push(tag('LABORATORY', y.laboratory, '          '));
  else if (preset?.category) lines.push(tag('LABORATORY', preset.category, '          '));
  if (preset?.labProductId) lines.push(tag('PRODUCT_ID', preset.labProductId, '          '));
  if (preset?.tempMinC != null) {
    lines.push(tag('MIN_TEMPERATURE', num(preset.tempMinC, 1), '          '));
  }
  if (preset?.tempMaxC != null) {
    lines.push(tag('MAX_TEMPERATURE', num(preset.tempMaxC, 1), '          '));
  }
  if (preset?.flocculation) {
    // BeerXML 1.0 FLOCCULATION enum is exactly: Low, Medium, High, Very High.
    // We collapse the finer-grained slugs into the four allowed values.
    const flocMap: Record<string, 'Low' | 'Medium' | 'High' | 'Very High'> = {
      'very-low': 'Low',
      low: 'Low',
      'medium-low': 'Medium',
      medium: 'Medium',
      'medium-high': 'Medium',
      high: 'High',
      'very-high': 'Very High',
    };
    const beerXmlFloc = flocMap[preset.flocculation] ?? 'Medium';
    lines.push(tag('FLOCCULATION', beerXmlFloc, '          '));
  }
  lines.push('        </YEAST>');
}

export const beerXmlExportService = new BeerXmlExportService();
// `srmToEbc` import kept for parity; consumers calling EBC conversions can import directly.
void srmToEbc;
// `Fermentable` type preserved for future per-fermentable extensions.
export type { Fermentable };
