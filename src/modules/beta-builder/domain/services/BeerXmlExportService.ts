import type { Recipe, Hop } from '../models/Recipe';

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const tag = (name: string, value: string | number | undefined): string => {
  if (value == null) return '';
  const v = typeof value === 'number' ? String(value) : escapeXml(value);
  return `      <${name}>${v}</${name}>`;
};

const ppgToYield = (ppg: number): number =>
  Math.round((ppg / 46) * 10000) / 100; // two decimal places

const hopUseMap: Record<Hop['type'], string> = {
  boil: 'Boil',
  'dry hop': 'Dry Hop',
  'first wort': 'First Wort',
  whirlpool: 'Aroma',
  mash: 'Mash',
};

class BeerXmlExportService {
  generate(recipe: Recipe): string {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<RECIPES>');
    lines.push('  <RECIPE>');

    // Recipe metadata
    lines.push(tag('NAME', recipe.name));
    lines.push(tag('VERSION', 1));
    lines.push(tag('TYPE', 'All Grain'));
    lines.push(tag('BATCH_SIZE', recipe.batchVolumeL));
    lines.push(tag('BOIL_TIME', recipe.equipment.boilTimeMin));
    lines.push(tag('EFFICIENCY', recipe.equipment.mashEfficiencyPercent));
    if (recipe.notes) lines.push(tag('NOTES', recipe.notes));

    // Style
    if (recipe.style) {
      lines.push('      <STYLE>');
      lines.push(`        <NAME>${escapeXml(recipe.style)}</NAME>`);
      lines.push('        <VERSION>1</VERSION>');
      lines.push('      </STYLE>');
    }

    // Fermentables
    lines.push('      <FERMENTABLES>');
    for (const f of recipe.fermentables) {
      lines.push('        <FERMENTABLE>');
      lines.push(`          <NAME>${escapeXml(f.name)}</NAME>`);
      lines.push(`          <VERSION>1</VERSION>`);
      lines.push(`          <AMOUNT>${f.weightKg}</AMOUNT>`);
      lines.push(`          <COLOR>${f.colorLovibond}</COLOR>`);
      lines.push(`          <YIELD>${ppgToYield(f.ppg)}</YIELD>`);
      lines.push(`          <TYPE>Grain</TYPE>`);
      if (f.originCode) lines.push(`          <ORIGIN>${escapeXml(f.originCode)}</ORIGIN>`);
      lines.push('        </FERMENTABLE>');
    }
    lines.push('      </FERMENTABLES>');

    // Hops
    lines.push('      <HOPS>');
    for (const h of recipe.hops) {
      const use = hopUseMap[h.type];
      const time =
        h.type === 'boil' || h.type === 'first wort'
          ? h.timeMinutes ?? 0
          : h.type === 'whirlpool'
          ? h.whirlpoolTimeMinutes ?? 0
          : 0;

      lines.push('        <HOP>');
      lines.push(`          <NAME>${escapeXml(h.name)}</NAME>`);
      lines.push(`          <VERSION>1</VERSION>`);
      lines.push(`          <AMOUNT>${h.grams / 1000}</AMOUNT>`);
      lines.push(`          <ALPHA>${h.alphaAcid}</ALPHA>`);
      lines.push(`          <USE>${use}</USE>`);
      lines.push(`          <TIME>${time}</TIME>`);
      if (h.type === 'whirlpool' && h.temperatureC != null) {
        lines.push(`          <TEMPERATURE>${h.temperatureC}</TEMPERATURE>`);
      }
      lines.push('        </HOP>');
    }
    lines.push('      </HOPS>');

    // Yeast
    lines.push('      <YEASTS>');
    for (const y of (recipe.yeasts ?? [])) {
      lines.push('        <YEAST>');
      lines.push(`          <NAME>${escapeXml(y.name)}</NAME>`);
      lines.push(`          <VERSION>1</VERSION>`);
      lines.push(`          <ATTENUATION>${y.attenuation * 100}</ATTENUATION>`);
      if (y.laboratory) lines.push(`          <LABORATORY>${escapeXml(y.laboratory)}</LABORATORY>`);
      lines.push('        </YEAST>');
    }
    lines.push('      </YEASTS>');

    // Mash
    lines.push('      <MASH>');
    lines.push('        <NAME>Mash</NAME>');
    lines.push('        <VERSION>1</VERSION>');
    lines.push('        <GRAIN_TEMP>22</GRAIN_TEMP>');
    lines.push('        <MASH_STEPS>');
    for (const s of recipe.mashSteps) {
      lines.push('          <MASH_STEP>');
      lines.push(`            <NAME>${escapeXml(s.name)}</NAME>`);
      lines.push(`            <VERSION>1</VERSION>`);
      lines.push(`            <TYPE>Temperature</TYPE>`);
      lines.push(`            <STEP_TEMP>${s.temperatureC}</STEP_TEMP>`);
      lines.push(`            <STEP_TIME>${s.durationMinutes}</STEP_TIME>`);
      lines.push('          </MASH_STEP>');
    }
    lines.push('        </MASH_STEPS>');
    lines.push('      </MASH>');

    // Fermentation steps → BeerXML primary/secondary/tertiary/conditioning fields
    for (const step of recipe.fermentationSteps) {
      if (step.type === 'primary') {
        lines.push(tag('PRIMARY_AGE', step.durationDays));
        lines.push(tag('PRIMARY_TEMP', step.temperatureC));
      } else if (step.type === 'secondary') {
        lines.push(tag('SECONDARY_AGE', step.durationDays));
        lines.push(tag('SECONDARY_TEMP', step.temperatureC));
      } else if (step.type === 'conditioning') {
        lines.push(tag('AGE', step.durationDays));
        lines.push(tag('AGE_TEMP', step.temperatureC));
      }
    }

    lines.push('  </RECIPE>');
    lines.push('</RECIPES>');

    return lines.filter((l) => l !== '').join('\n');
  }
}

export const beerXmlExportService = new BeerXmlExportService();
