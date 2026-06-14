import { describe, it, expect } from 'vitest';
import { parseRecipeText } from '@/modules/recipe/services/recipeTextParser';
import { textRecipeImportService } from '@/modules/recipe/services/textRecipeImportService';
import { recipeCalculationService } from '@/modules/recipe/services/RecipeCalculationService';
import { getGrainPresets, HOP_PRESETS, YEAST_PRESETS } from '@/utils/presets';

const BOOK_RECIPE = `
West Coast Thumper
Style: American IPA
Batch size: 5 gal
Boil: 60 min

Fermentables
11 lb 2-row
1 lb Crystal 40
0.5 lb Munich

Hops
1 oz Magnum @60
1 oz Centennial @15
2 oz Citra dry hop 3 days

Yeast
Wyeast 1056 American Ale
`;

describe('textRecipeImportService.fromDraft — book recipe', () => {
  const { recipe, pendingMatches } = textRecipeImportService.fromDraft(
    parseRecipeText(BOOK_RECIPE),
  );

  it('builds a complete, calculable recipe', () => {
    expect(recipe.name).toBe('West Coast Thumper');
    expect(recipe.batchVolumeL).toBeCloseTo(18.9, 1);
    expect(recipe.equipment.boilTimeMin).toBe(60);
    expect(recipe.fermentables).toHaveLength(3);
    expect(recipe.hops).toHaveLength(3);
    expect(recipe.yeasts).toHaveLength(1);

    const calc = recipeCalculationService.calculate(recipe);
    expect(calc.og).toBeGreaterThan(1.04);
    expect(calc.og).toBeLessThan(1.09);
    expect(calc.ibu).toBeGreaterThan(0);
  });

  it('sources fermentable numerics from matched presets', () => {
    for (const f of recipe.fermentables) {
      expect(f.ppg).toBeGreaterThan(0);
      expect(f.colorLovibond).toBeGreaterThan(0);
      expect(f.weightKg).toBeGreaterThan(0);
      expect(f.fermentability).toBeGreaterThan(0);
    }
  });

  it('keeps hop schedule semantics', () => {
    const [magnum, centennial, citra] = recipe.hops;
    expect(magnum.type).toBe('boil');
    expect(magnum.timeMinutes).toBe(60);
    expect(magnum.alphaAcid).toBeGreaterThan(0); // from preset
    expect(centennial.timeMinutes).toBe(15);
    expect(citra.type).toBe('dry hop');
    expect(citra.dryHopDays).toBe(3);
    expect(citra.dryHopStartDay).toBe(7);
  });

  it('resolves the yeast against the lab code', () => {
    const yeast = recipe.yeasts[0];
    expect(yeast.attenuation).toBeGreaterThan(0.5);
    expect(yeast.attenuation).toBeLessThanOrEqual(1);
    expect(yeast.laboratory).toBe('Wyeast');
  });

  it('only surfaces low-confidence matches for review', () => {
    // Every pending match must reference an ingredient in the recipe.
    for (const pm of pendingMatches) {
      if (pm.kind === 'style') continue;
      const pool =
        pm.kind === 'grain'
          ? recipe.fermentables
          : pm.kind === 'hop'
            ? recipe.hops
            : recipe.yeasts;
      expect(pool.some((i) => i.id === pm.ingredientId)).toBe(true);
    }
  });
});

describe('color-first crystal names + mash/ferment prose (book regression)', () => {
  const { recipe, pendingMatches } = textRecipeImportService.fromDraft(
    parseRecipeText(`
Ingredients:
MALTS
10 lb. pale ale malt
6 oz. 45°L crystal malt
4 oz. 160°L crystal malt
2 oz. 80°L crystal malt
2 oz. 550°L roasted barley
HOPS
0.75 oz. (21 g) Willamette, 6% a.a. @ 60 min
1 oz. (28 g) East Kent Goldings, 4.7% a.a. @ 10 min
YEAST
1 sachet Lallemand Nottingham Yeast
Specifications:
Yield: 5 US gal. (18.9 L)
Original Gravity: 1.054 (13.3°P)
Directions:
Mash at 152°F (67°C) for 60 minutes. Boil 60 minutes. Ferment at 64°F (18°C).
`),
  );

  it('auto-matches the crystals to real presets with correct colors', () => {
    const [, c45, c160, c80] = recipe.fermentables;
    // 45°L → bare "Crystal 45L" preset exists → exact auto-accept.
    expect(c45.name).toBe('Crystal 45L');
    expect(c45.colorLovibond).toBe(45);
    // 80°L → no bare preset; generic US series fallback auto-accepts.
    expect(c80.name).toBe('Caramel / Crystal 80L');
    expect(c80.colorLovibond).toBe(80);
    // 160°L → no exact preset; numerics still come from the best candidate
    // (±10°L gate keeps only ~160L crystals in play).
    expect(c160.colorLovibond).toBeGreaterThanOrEqual(150);
    expect(c160.colorLovibond).toBeLessThanOrEqual(170);
  });

  it('auto-matches roasted barley despite the 550°L prefix', () => {
    expect(recipe.fermentables[4].name).toBe('Roasted Barley');
    expect(recipe.fermentables[4].colorLovibond).toBeGreaterThan(250);
  });

  it('no specialty grain falls back to the generic 2°L default', () => {
    // Pale ale malt legitimately sits at ~2°L — assert it matched the preset
    // by name; the four specialty grains must all carry real colors.
    expect(recipe.fermentables[0].name).toBe('Pale Ale Malt');
    for (const f of recipe.fermentables.slice(1)) {
      expect(f.colorLovibond, f.name).toBeGreaterThan(2);
    }
  });

  it('fills the mash schedule and fermentation temperature', () => {
    expect(recipe.mashSteps).toHaveLength(1);
    expect(recipe.mashSteps[0]).toMatchObject({
      name: 'Saccharification',
      temperatureC: 67,
      durationMinutes: 60,
    });
    expect(recipe.fermentationSteps[0].temperatureC).toBe(18);
  });

  it('yeast row is the only yeast and points at Nottingham', () => {
    expect(recipe.yeasts).toHaveLength(1);
    const pendingYeast = pendingMatches.find((m) => m.kind === 'yeast');
    const effectiveName = pendingYeast?.best?.presetName ?? recipe.yeasts[0].name;
    expect(effectiveName).toMatch(/nottingham/i);
    expect(recipe.yeasts[0].laboratory).toBe('Lallemand');
  });
});

describe('percentage grain bills', () => {
  it('derives weights from a stated OG and keeps proportions', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText(`
Batch size: 5 gal
OG: 1.050
80% 2-Row
12% Munich
8% Crystal 60
`),
    );
    const total = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
    expect(total).toBeGreaterThan(0);
    expect(recipe.fermentables[0].weightKg / total).toBeCloseTo(0.8, 2);
    expect(recipe.fermentables[1].weightKg / total).toBeCloseTo(0.12, 2);

    const calc = recipeCalculationService.calculate(recipe);
    expect(Math.abs(calc.og - 1.05)).toBeLessThan(0.003);
  });

  it('falls back to a volume-scaled grist without an OG', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText(`20 L batch\n90% Pilsner\n10% Wheat Malt`),
    );
    const total = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
    expect(total).toBeCloseTo(0.25 * 20, 1);
  });

  it('anchors mixed weight+pct bills on the stated weights', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText(`4 kg Pilsner\n20% Munich`),
    );
    // 4 kg is 80% of the grist → total 5 kg → Munich 1 kg.
    expect(recipe.fermentables[1].weightKg).toBeCloseTo(1, 2);
  });
});

describe('applySheetEdits — title, amounts, removals from the review sheet', () => {
  const { recipe } = textRecipeImportService.fromDraft(
    parseRecipeText(`3 kg Pilsner\n0.5 kg Munich\n30 g Saaz @ 60\n10 g Saaz dry hop 3 days\nUS-05 yeast`),
  );

  it('renames, edits amounts, and removes denied rows', () => {
    const next = textRecipeImportService.applySheetEdits(recipe, {
      name: 'House Pils',
      amounts: {
        [recipe.fermentables[0].id]: { weightKg: 4.2 },
        [recipe.hops[0].id]: { grams: 25, timeMinutes: 45 },
        [recipe.hops[1].id]: { grams: 15, dryHopDays: 5 },
      },
      removedIngredientIds: [recipe.fermentables[1].id],
    });
    expect(next.name).toBe('House Pils');
    expect(next.fermentables).toHaveLength(1);
    expect(next.fermentables[0].weightKg).toBe(4.2);
    expect(next.hops[0]).toMatchObject({ grams: 25, timeMinutes: 45 });
    expect(next.hops[1]).toMatchObject({ grams: 15, dryHopDays: 5 });
    expect(next.yeasts).toHaveLength(1);
  });

  it('keeps the original name when the title is blanked', () => {
    const next = textRecipeImportService.applySheetEdits(recipe, {
      name: '   ',
      amounts: {},
      removedIngredientIds: [],
    });
    expect(next.name).toBe(recipe.name);
  });

  it('routes timeMinutes to whirlpool stand time for whirlpool hops', () => {
    const { recipe: wp } = textRecipeImportService.fromDraft(
      parseRecipeText('1 oz Cascade whirlpool 20 min'),
    );
    const next = textRecipeImportService.applySheetEdits(wp, {
      name: '',
      amounts: { [wp.hops[0].id]: { timeMinutes: 30 } },
      removedIngredientIds: [],
    });
    expect(next.hops[0].whirlpoolTimeMinutes).toBe(30);
    expect(next.hops[0].timeMinutes).toBeUndefined();
  });
});

describe('prose yeast noise filtering', () => {
  it('drops matchless caption rows when a real yeast resolved', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText(`
Yeast and Fermentation
This beer came to life with the help of San Diego Super Yeast by White Labs.
pitching yeast
`),
    );
    expect(recipe.yeasts).toHaveLength(1);
    expect(recipe.yeasts[0].laboratory).toBe('White Labs');
  });

  it('keeps an unmatched yeast when it is the only one', () => {
    const { recipe } = textRecipeImportService.fromDraft({
      fermentables: [],
      hops: [],
      yeasts: [{ rawName: 'Zzqx wild blend nine' }],
      unparsedLines: [],
    });
    expect(recipe.yeasts).toHaveLength(1);
  });
});

describe('efficiency, derived attenuation, and vitals application', () => {
  it('stated efficiency flows into equipment and per-grain values', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText('Efficiency: 72%\n4 kg Pilsner\n0.5 kg Corn Sugar'),
    );
    expect(recipe.equipment.mashEfficiencyPercent).toBe(72);
    expect(recipe.fermentables[0].efficiencyPercent).toBe(72);
    // Sugars stay at 100 regardless of mash efficiency.
    expect(recipe.fermentables[1].efficiencyPercent).toBe(100);
  });

  it('derives attenuation from OG/FG when the yeast has no preset', () => {
    const { recipe } = textRecipeImportService.fromDraft({
      targetOg: 1.06,
      targetFg: 1.012,
      fermentables: [],
      hops: [],
      yeasts: [{ rawName: 'Zzqx wild blend nine' }],
      unparsedLines: [],
    });
    expect(recipe.yeasts[0].attenuation).toBeCloseTo(0.8, 3);
  });

  it('applyVitals overwrites process values after review edits', () => {
    const { recipe } = textRecipeImportService.fromDraft(
      parseRecipeText('3 kg Pilsner\n30 g Saaz @ 60'),
    );
    const vitals = textRecipeImportService.vitalsFromRecipe(recipe);
    const next = textRecipeImportService.applyVitals(recipe, {
      ...vitals,
      batchVolumeL: 25,
      boilTimeMin: 90,
      efficiencyPercent: 68,
      mashSteps: [{ temperatureC: 64, durationMinutes: 45 }],
      fermentTempC: 12,
      fermentDays: 21,
    });
    expect(next.batchVolumeL).toBe(25);
    expect(next.equipment.boilTimeMin).toBe(90);
    expect(next.equipment.mashEfficiencyPercent).toBe(68);
    expect(next.fermentables[0].efficiencyPercent).toBe(68);
    expect(next.mashSteps).toHaveLength(1);
    expect(next.mashSteps[0]).toMatchObject({
      name: 'Saccharification',
      temperatureC: 64,
      durationMinutes: 45,
    });
    const primary = next.fermentationSteps.find((s) => s.type === 'primary');
    expect(primary).toMatchObject({ temperatureC: 12, durationDays: 21 });
  });
});

describe('applyResolutions — re-sources numerics from the chosen preset', () => {
  const { recipe } = textRecipeImportService.fromDraft(
    parseRecipeText(`1 kg Crystal 40\n30 g Saaz @60\nUS-05 yeast`),
  );

  it('grain override patches color/ppg/fermentability', () => {
    const target = getGrainPresets().find((p) => /maris otter/i.test(p.name));
    expect(target).toBeDefined();
    const resolved = textRecipeImportService.applyResolutions(recipe, [
      { kind: 'grain', ingredientId: recipe.fermentables[0].id, presetName: target!.name },
    ]);
    expect(resolved.fermentables[0].name).toBe(target!.name);
    expect(resolved.fermentables[0].colorLovibond).toBe(target!.colorLovibond);
    expect(resolved.fermentables[0].ppg).toBe(target!.potentialGu);
  });

  it('hop override patches alpha and re-enriches flavor', () => {
    const target = HOP_PRESETS.find((p) => p.name === 'Citra') ?? HOP_PRESETS[0];
    const resolved = textRecipeImportService.applyResolutions(recipe, [
      { kind: 'hop', ingredientId: recipe.hops[0].id, presetName: target.name },
    ]);
    expect(resolved.hops[0].name).toBe(target.name);
    expect(resolved.hops[0].alphaAcid).toBe(target.alphaAcidPercent);
    if (target.flavor) expect(resolved.hops[0].flavor).toBeDefined();
  });

  it('yeast override patches attenuation and laboratory', () => {
    const target = YEAST_PRESETS.find((p) => p.attenuationPercent != null);
    expect(target).toBeDefined();
    const resolved = textRecipeImportService.applyResolutions(recipe, [
      { kind: 'yeast', ingredientId: recipe.yeasts[0].id, presetName: target!.name },
    ]);
    expect(resolved.yeasts[0].attenuation).toBe(target!.attenuationPercent);
    expect(resolved.yeasts[0].laboratory).toBe(target!.category);
  });

  it('keep-imported (no presetName) leaves the ingredient untouched', () => {
    const resolved = textRecipeImportService.applyResolutions(recipe, [
      { kind: 'grain', ingredientId: recipe.fermentables[0].id },
    ]);
    expect(resolved.fermentables[0]).toEqual(recipe.fermentables[0]);
  });
});
