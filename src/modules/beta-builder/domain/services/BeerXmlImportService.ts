import type { Recipe, Fermentable, Hop, MashStep, FermentationStep, Yeast, OtherIngredient, OtherIngredientCategory } from '../models/Recipe';
import { hopEnrichmentService } from './HopEnrichmentService';

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

class BeerXmlImportService {
  parse(xml: string): Recipe {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const recipeEl = doc.getElementsByTagName('RECIPE')?.[0];
    if (!recipeEl) {
      throw new Error('BeerXML missing RECIPE');
    }

    const now = new Date().toISOString();
    const name = text(recipeEl, 'NAME') || 'Imported BeerXML';
    const styleName = text(recipeEl, 'STYLE') ? text(recipeEl.getElementsByTagName('STYLE')[0], 'NAME') : undefined;

    const batchVolumeL = toNumber(text(recipeEl, 'BATCH_SIZE')) ?? 20;
    const boilTimeMin = toNumber(text(recipeEl, 'BOIL_TIME')) ?? 60;
    const efficiency = toNumber(text(recipeEl, 'EFFICIENCY')) ?? 75;

    // Fermentables
    const fermentables: Fermentable[] = [];
    const fermParent = recipeEl.getElementsByTagName('FERMENTABLES')?.[0];
    if (fermParent) {
      const fermEls = Array.from(fermParent.getElementsByTagName('FERMENTABLE'));
      fermEls.forEach((f) => {
        const amtKg = toNumber(text(f, 'AMOUNT')) ?? 0;
        const colorLov = toNumber(text(f, 'COLOR')) ?? 2;
        const potential = potentialToPpg(toNumber(text(f, 'POTENTIAL')));
        const yieldPct = yieldToPpg(toNumber(text(f, 'YIELD')));
        const ppg = potential ?? yieldPct ?? 36;
        fermentables.push({
          id: crypto.randomUUID(),
          name: text(f, 'NAME') || 'Fermentable',
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
        const amountG = amountKg * 1000;
        const alpha = alphaToPercent(toNumber(text(h, 'ALPHA'))) ?? 0;
        const use = (text(h, 'USE') || '').toLowerCase();
        const timeMin = toNumber(text(h, 'TIME'));

        let type: Hop['type'] = 'boil';
        if (use.includes('dry')) type = 'dry hop';
        else if (use.includes('mash')) type = 'mash';
        else if (use.includes('first')) type = 'first wort';
        else if (use.includes('aroma') || use.includes('whirlpool') || use.includes('flameout')) type = 'whirlpool';

        const hopName = text(h, 'NAME') || 'Hop';

        hops.push(hopEnrichmentService.enrichHop({
          id: crypto.randomUUID(),
          name: hopName,
          alphaAcid: alpha,
          grams: amountG,
          type,
          timeMinutes: type === 'boil' || type === 'first wort' ? timeMin : undefined,
          whirlpoolTimeMinutes: type === 'whirlpool' ? timeMin : undefined,
          temperatureC: type === 'whirlpool' ? toNumber(text(h, 'TEMPERATURE')) : undefined,
          dryHopStartDay: type === 'dry hop' ? 7 : undefined,
          dryHopDays: type === 'dry hop' ? 3 : undefined,
        }));
      });
    }

    // Yeast
    const yeasts: Yeast[] = [];
    const yeastsParent = recipeEl.getElementsByTagName('YEASTS')?.[0];
    if (yeastsParent) {
      const yeastEls = Array.from(yeastsParent.getElementsByTagName('YEAST'));
      yeastEls.forEach((yeastEl) => {
        const attenuationPct = toNumber(text(yeastEl, 'ATTENUATION'));
        const attDecimal =
          attenuationPct != null ? (attenuationPct > 1 ? attenuationPct / 100 : attenuationPct) : undefined;
        yeasts.push({
          id: crypto.randomUUID(),
          name: text(yeastEl, 'NAME') || 'Yeast',
          attenuation: attDecimal ?? 0.75,
          laboratory: text(yeastEl, 'LABORATORY'),
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
          id: crypto.randomUUID(),
          name: text(s, 'NAME') || `Step ${idx + 1}`,
          type: (text(s, 'TYPE')?.toLowerCase() === 'decoction'
            ? 'decoction'
            : text(s, 'TYPE')?.toLowerCase() === 'temperature'
            ? 'temperature'
            : 'infusion') as MashStep['type'],
          temperatureC: toNumber(text(s, 'STEP_TEMP')) ?? 66,
          durationMinutes: toNumber(text(s, 'STEP_TIME')) ?? 60,
          infusionVolumeLiters: toNumber(text(s, 'INFUSE_AMOUNT')),
        });
      });
    }

    // Fermentation steps (basic mapping from primary/secondary)
    const fermentationSteps: FermentationStep[] = [];
    const primaryDays = toNumber(text(recipeEl, 'PRIMARY_AGE')) ?? 10;
    const primaryTempC = toNumber(text(recipeEl, 'PRIMARY_TEMP')) ?? 20;
    fermentationSteps.push({
      id: crypto.randomUUID(),
      name: 'Primary',
      type: 'primary',
      durationDays: primaryDays,
      temperatureC: primaryTempC,
    });

    const secondaryDays = toNumber(text(recipeEl, 'SECONDARY_AGE'));
    const secondaryTempC = toNumber(text(recipeEl, 'SECONDARY_TEMP')) ?? primaryTempC;
    if (secondaryDays && secondaryDays > 0) {
      fermentationSteps.push({
        id: crypto.randomUUID(),
        name: 'Secondary',
        type: 'secondary',
        durationDays: secondaryDays,
        temperatureC: secondaryTempC,
      });
    }

    const tertiaryDays = toNumber(text(recipeEl, 'TERTIARY_AGE'));
    const tertiaryTempC = toNumber(text(recipeEl, 'TERTIARY_TEMP')) ?? secondaryTempC ?? primaryTempC;
    if (tertiaryDays && tertiaryDays > 0) {
      fermentationSteps.push({
        id: crypto.randomUUID(),
        name: 'Tertiary',
        type: 'conditioning',
        durationDays: tertiaryDays,
        temperatureC: tertiaryTempC,
      });
    }

    const conditioningDays = toNumber(text(recipeEl, 'AGE'));
    const conditioningTempC = toNumber(text(recipeEl, 'AGE_TEMP')) ?? tertiaryTempC ?? secondaryTempC ?? primaryTempC;
    if (conditioningDays && conditioningDays > 0) {
      fermentationSteps.push({
        id: crypto.randomUUID(),
        name: 'Conditioning',
        type: 'conditioning',
        durationDays: conditioningDays,
        temperatureC: conditioningTempC,
      });
    }

    // Misc items (other ingredients)
    const otherIngredients: OtherIngredient[] = [];
    const miscParent = recipeEl.getElementsByTagName('MISCS')?.[0];
    if (miscParent) {
      const miscEls = Array.from(miscParent.getElementsByTagName('MISC'));
      miscEls.forEach((m) => {
        const amountKg = toNumber(text(m, 'AMOUNT')) ?? 0;
        const useStr = (text(m, 'USE') || 'boil').toLowerCase();
        const typeStr = (text(m, 'TYPE') || 'other').toLowerCase();

        let timing: OtherIngredient['timing'] = 'boil';
        if (useStr.includes('mash')) timing = 'mash';
        else if (useStr.includes('primary') || useStr.includes('secondary')) timing = 'secondary';
        else if (useStr.includes('bottling')) timing = 'bottling';

        let category: OtherIngredientCategory = 'other';
        if (typeStr.includes('water')) category = 'water-agent';
        else if (typeStr.includes('fining')) category = 'fining';
        else if (typeStr.includes('spice')) category = 'spice';
        else if (typeStr.includes('flavor')) category = 'flavor';
        else if (typeStr.includes('herb')) category = 'herb';

        otherIngredients.push({
          id: crypto.randomUUID(),
          name: text(m, 'NAME') || 'Misc',
          category,
          amount: amountKg * 1000, // BeerXML stores in kg, convert to g
          unit: 'g',
          timing,
          notes: text(m, 'NOTES'),
        });
      });
    }

    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name,
      style: styleName,
      notes: text(recipeEl, 'NOTES'),
      tags: [],
      currentVersion: 1,
      batchVolumeL,
      equipment: {
        boilTimeMin,
        boilOffRateLPerHour: 4,
        mashEfficiencyPercent: efficiency,
        mashThicknessLPerKg: 2.7,
        grainAbsorptionLPerKg: 0.8,
        mashTunDeadspaceLiters: 2,
        mashTunLossLiters: 0,
        kettleLossLiters: 1,
        hopsAbsorptionLPerKg: 0.7,
        chillerLossLiters: 0,
        fermenterLossLiters: 0.5,
        coolingShrinkagePercent: 4,
      },
      fermentables,
      hops,
      yeasts,
      otherIngredients,
      mashSteps,
      waterChemistry: undefined,
      fermentationSteps,
      createdAt: now,
      updatedAt: now,
    };

    return recipe;
  }
}

export const beerXmlImportService = new BeerXmlImportService();
