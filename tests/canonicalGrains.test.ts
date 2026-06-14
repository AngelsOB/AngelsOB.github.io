import { describe, it, expect } from 'vitest';
import { resolveCanonicalGrain } from '@/modules/recipe/data/canonicalGrains';
import { normalizeGrainName } from '@/modules/compare/compareUtils';
import { FERMENTABLE_PRESETS } from '@/modules/recipe/data/fermentablePresets';

/**
 * LEGACY IMPLEMENTATION — vendored verbatim from compareUtils.normalizeGrainName
 * as of the commit before the canonical-grain-table refactor. Do not edit.
 *
 * computeMeanRecipe merges grains across recipes by this function's output;
 * any drift silently changes aggregation. The table-driven resolver must stay
 * output-identical for every input below.
 */
function legacyNormalizeGrainName(name: string): string {
  // Strip maltster prefix (e.g., "Briess - ", "Crisp Malting - ", "Weyermann - ")
  let normalized = name.replace(/^[A-Za-z\s&'.]+\s*[-–—]\s*/, '');

  // Remove qualifiers like "Finest", "Premium", "Best", "Extra"
  normalized = normalized.replace(/\b(Finest|Premium|Best|Extra|Superior)\s+/gi, '');

  // Normalize Maris Otter variants — anything containing "maris otter" is "Maris Otter"
  if (/maris\s*otter/i.test(normalized)) return 'Maris Otter';

  // Normalize "Pale Ale Malt" variants
  if (/^pale\s+ale\s+malt/i.test(normalized)) return 'Pale Ale Malt';

  // Normalize 2-Row / Two-Row variants
  if (/\b(2-row|two[- ]row)\b/i.test(normalized) && !/pilsner|vienna|munich/i.test(normalized)) {
    return '2-Row Pale Malt';
  }

  // Normalize Pilsner variants
  if (/^pilsner/i.test(normalized) || /^pils\b/i.test(normalized)) return 'Pilsner Malt';

  // Normalize Munich variants
  if (/^munich/i.test(normalized)) {
    const colorMatch = normalized.match(/(\d+)\s*°?L/i);
    return colorMatch ? `Munich Malt ${colorMatch[1]}L` : 'Munich Malt';
  }

  // Normalize Vienna
  if (/^vienna/i.test(normalized)) return 'Vienna Malt';

  // Normalize Crystal/Caramel with color
  const crystalMatch = normalized.match(/^(?:crystal|caramel)\s*(?:malt\s*)?(\d+)\s*°?L?/i);
  if (crystalMatch) return `Crystal ${crystalMatch[1]}L`;

  // Normalize Roasted Barley variants
  if (/roasted\s*barley/i.test(normalized)) return 'Roasted Barley';

  // Normalize Chocolate Malt variants
  if (/^(?:pale\s+)?chocolate(?:\s+malt)?$/i.test(normalized)) return 'Chocolate Malt';

  // Normalize Black Malt / Black Barley / Black Patent
  if (/^black\s*(malt|patent)/i.test(normalized)) return 'Black Malt';
  if (/^black\s*barley/i.test(normalized)) return 'Black Barley';

  // Normalize Flaked variants
  const flakedMatch = normalized.match(/^flaked\s+(\w+)/i);
  if (flakedMatch) return `Flaked ${flakedMatch[1].charAt(0).toUpperCase() + flakedMatch[1].slice(1).toLowerCase()}`;

  // Normalize Victory Malt
  if (/^victory/i.test(normalized)) return 'Victory Malt';

  // Normalize Biscuit Malt
  if (/^biscuit/i.test(normalized)) return 'Biscuit Malt';

  // Normalize Melanoidin Malt
  if (/^melanoidin/i.test(normalized)) return 'Melanoidin Malt';

  // Normalize Aromatic Malt
  if (/^aromatic/i.test(normalized)) return 'Aromatic Malt';

  // Normalize Wheat Malt
  if (/^wheat\s*(malt)?$/i.test(normalized)) return 'Wheat Malt';

  // Normalize Carapils / Dextrine
  if (/^cara\s*pils/i.test(normalized) || /^dextrin/i.test(normalized)) return 'CaraPils / Dextrine';

  return normalized.trim();
}

/** Real-world variants seen in BeerXML exports, books, and forum posts. */
const CURATED_VARIANTS = [
  'Crisp Malting - Finest Maris Otter',
  'Thomas Fawcett - Maris Otter Pale Ale Malt',
  'Weyermann - Roasted Barley',
  'Briess - Pale Ale Malt 2-Row',
  '2-Row',
  '2-row brewers malt',
  'Two Row Pale',
  'Two-Row',
  '2-Row Pilsner',
  'Pilsner',
  'Pils',
  'Pilsner Malt (Bohemian)',
  'Munich',
  'Munich 10L',
  'Munich Malt 20°L',
  'Munich Malt - 10L',
  'Vienna',
  'Vienna Malt',
  'Crystal 60',
  'Crystal 60L',
  'crystal 15°L',
  'Caramel 40',
  'Caramel Malt 40 L',
  'Caramel/Crystal Malt - 60L',
  'Caramel 120',
  'Roasted Barley',
  'roasted barley (300L)',
  'Chocolate',
  'Chocolate Malt',
  'Pale Chocolate',
  'Black Patent Malt',
  'Black Malt',
  'black patent',
  'Black Barley',
  'Flaked Oats',
  'flaked WHEAT',
  'Flaked maize',
  'Flaked Barley',
  'Victory Malt',
  'victory',
  'Biscuit',
  'Biscuit Malt',
  'Melanoidin Malt',
  'melanoidin',
  'Aromatic',
  'Aromatic Malt',
  'Wheat',
  'Wheat Malt',
  'wheat malt',
  'CaraPils',
  'Cara Pils',
  'Carapils (Dextrine Malt)',
  'Dextrine Malt',
  'Dextrin',
  'Premium English Caramalt',
  'Simpsons - Golden Promise',
  'Golden Promise',
  'Rye Malt',
  'Honey Malt',
  'Special B',
  'Acidulated Malt',
  'Smoked Malt',
  'Rice Hulls',
  'Lactose',
  'Corn Sugar (Dextrose)',
  'Briess - Brewers Malt 2-Row',
  'Weyermann - Bohemian Pilsner',
  'Gladfield - American Ale Malt',
  '',
  '   ',
];

describe('canonical grain table parity', () => {
  const corpus = [...FERMENTABLE_PRESETS.map((p) => p.name), ...CURATED_VARIANTS];

  it('resolveCanonicalGrain matches the legacy normalizeGrainName for every preset + variant', () => {
    for (const name of corpus) {
      expect(resolveCanonicalGrain(name).canonical, `input: "${name}"`).toBe(
        legacyNormalizeGrainName(name),
      );
    }
  });

  it('compareUtils.normalizeGrainName stays byte-identical through the refactor', () => {
    for (const name of corpus) {
      expect(normalizeGrainName(name), `input: "${name}"`).toBe(legacyNormalizeGrainName(name));
    }
  });
});

describe('color-first crystal wording (new rule — beyond legacy parity)', () => {
  // These inputs fell through to a verbatim trim in the legacy function;
  // canonicalizing them is a deliberate extension for the paste importer.
  it.each([
    ['45°L crystal malt', 'Crystal 45L'],
    ['160°L crystal malt', 'Crystal 160L'],
    ['80 L caramel malt', 'Crystal 80L'],
    ['120L Crystal', 'Crystal 120L'],
  ])('%s → %s', (input, expected) => {
    expect(resolveCanonicalGrain(input)).toEqual({
      canonical: expected,
      category: 'Crystal/Caramel',
    });
  });

  it('does not fire on names that merely start with digits', () => {
    // Digit-leading maltster names never matched the prefix-strip in legacy
    // either — the color-first rule must not change that (locked by parity).
    expect(resolveCanonicalGrain('1886 Malt House - Caramel 40').canonical).toBe(
      '1886 Malt House - Caramel 40',
    );
    // Roasted barley keeps its own rule even with a color prefix:
    expect(resolveCanonicalGrain('550°L roasted barley').canonical).toBe('Roasted Barley');
  });
});

describe('resolveCanonicalGrain categories', () => {
  it.each([
    ['Crystal 60', 'Crystal/Caramel'],
    ['Caramel Malt 40 L', 'Crystal/Caramel'],
    ['CaraPils', 'Crystal/Caramel'],
    ['Maris Otter', 'Base malts'],
    ['Pilsner', 'Base malts'],
    ['Flaked Oats', 'Adjuncts (mashable/flaked)'],
    ['Roasted Barley', 'Roasted'],
    ['Chocolate Malt', 'Roasted'],
    ['Victory Malt', 'Toasted & specialty'],
    ['Wheat Malt', 'Base malts'],
  ])('%s → %s', (name, category) => {
    expect(resolveCanonicalGrain(name).category).toBe(category);
  });
});
