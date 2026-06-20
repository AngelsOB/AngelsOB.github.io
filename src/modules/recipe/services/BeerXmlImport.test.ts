// @vitest-environment happy-dom
//
// BeerXML import/export tests. The importer parses XML via the browser DOMParser,
// so this file runs under happy-dom (the rest of the suite is `node`). Covers:
//  • our export → our import round-trips losslessly (equipment, batch, OG, IBU)
//  • foreign (Brewfather-style) imports parse <EQUIPMENT> and convert BATCH_SIZE
//  • edge cases (no equipment block, missing/garbage fields, flameout, hop form)
//  • source-vitals parsing (the input to the post-import reconciliation guard)

import { describe, test, expect } from 'vitest';
import { beerXmlImportService } from './BeerXmlImportService';
import { beerXmlExportService } from './BeerXmlExportService';
import { recipeCalculationService } from './RecipeCalculationService';
import { volumeCalculationService } from './VolumeCalculationService';
import type { Recipe } from '../models/Recipe';

// Deliberately NON-default equipment so a passing round-trip proves the BT_*
// custom tags actually carried each value (vs the importer's hardcoded defaults
// of kettle 1 / chiller 0 / fermenter 0.5 / deadspace 2 / boil-off 4, etc.).
function createTestRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'test-recipe',
    name: 'Round Trip Ale',
    batchVolumeL: 22.5,
    equipment: {
      boilTimeMin: 90,
      boilOffRateLPerHour: 3.2,
      brewhouseEfficiencyPercent: 68,
      mashThicknessLPerKg: 3.1,
      grainAbsorptionLPerKg: 0.85,
      mashTunDeadspaceLiters: 3.5,
      mashTunLossLiters: 0.4,
      kettleLossLiters: 1.8,
      hopsAbsorptionLPerKg: 0.6,
      chillerLossLiters: 0.9,
      fermenterLossLiters: 1.2,
      coolingShrinkagePercent: 4,
    },
    fermentables: [
      { id: 'f1', name: 'Pale Malt', weightKg: 5.5, colorLovibond: 4, ppg: 37 },
    ],
    hops: [
      { id: 'h1', name: 'Cascade', grams: 28, alphaAcid: 6, type: 'boil', timeMinutes: 60 },
    ],
    yeasts: [{ id: 'y1', name: 'SafAle US-05', attenuation: 0.78 }],
    mashSteps: [{ id: 'm1', name: 'Sacc', temperatureC: 66, durationMinutes: 60 }],
    fermentationSteps: [
      { id: 's1', name: 'Primary', type: 'primary', durationDays: 14, temperatureC: 19 },
    ],
    otherIngredients: [],
    waterChemistry: undefined,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  } as Recipe;
}

describe('BeerXML round-trip (our export → our import)', () => {
  test('preserves the full equipment profile via custom BT_ tags', () => {
    const original = createTestRecipe();
    const xml = beerXmlExportService.generate(original);
    const { recipe } = beerXmlImportService.parse(xml);
    const e = recipe.equipment;
    const o = original.equipment;

    expect(e.boilTimeMin).toBe(o.boilTimeMin);
    expect(e.brewhouseEfficiencyPercent).toBeCloseTo(o.brewhouseEfficiencyPercent, 1);
    expect(e.boilOffRateLPerHour).toBeCloseTo(o.boilOffRateLPerHour, 2);
    expect(e.kettleLossLiters).toBeCloseTo(o.kettleLossLiters, 2);
    expect(e.chillerLossLiters).toBeCloseTo(o.chillerLossLiters, 2);
    expect(e.fermenterLossLiters).toBeCloseTo(o.fermenterLossLiters, 2);
    expect(e.mashTunDeadspaceLiters).toBeCloseTo(o.mashTunDeadspaceLiters, 2);
    expect(e.mashTunLossLiters).toBeCloseTo(o.mashTunLossLiters, 2);
    expect(e.hopsAbsorptionLPerKg).toBeCloseTo(o.hopsAbsorptionLPerKg, 2);
    expect(e.grainAbsorptionLPerKg).toBeCloseTo(o.grainAbsorptionLPerKg, 2);
    expect(e.mashThicknessLPerKg).toBeCloseTo(o.mashThicknessLPerKg, 2);
    expect(e.coolingShrinkagePercent).toBeCloseTo(o.coolingShrinkagePercent, 2);
  });

  test('preserves batchVolumeL — no fermenter-loss inflation per round-trip', () => {
    const original = createTestRecipe();
    const once = beerXmlImportService.parse(beerXmlExportService.generate(original)).recipe;
    const twice = beerXmlImportService.parse(beerXmlExportService.generate(once)).recipe;

    expect(once.batchVolumeL).toBeCloseTo(original.batchVolumeL, 1);
    // Stable across a SECOND cycle — the old bug grew it by fermenterLoss each time.
    expect(twice.batchVolumeL).toBeCloseTo(original.batchVolumeL, 1);
  });

  test('preserves OG and IBU within tolerance', () => {
    const original = createTestRecipe();
    const recipe = beerXmlImportService.parse(beerXmlExportService.generate(original)).recipe;

    const a = recipeCalculationService.calculate(original);
    const b = recipeCalculationService.calculate(recipe);
    expect(Math.abs(b.og - a.og)).toBeLessThan(0.002);
    expect(Math.abs(b.ibu - a.ibu)).toBeLessThan(1.0);
  });

  test('round-trips dry-hop duration and whole-leaf form', () => {
    const original = createTestRecipe({
      hops: [
        { id: 'h1', name: 'Cascade', grams: 28, alphaAcid: 6, type: 'boil', timeMinutes: 60, form: 'leaf' },
        { id: 'h2', name: 'Citra', grams: 50, alphaAcid: 12, type: 'dry hop', dryHopDays: 5, dryHopStartDay: 7 },
      ],
    });
    const recipe = beerXmlImportService.parse(beerXmlExportService.generate(original)).recipe;

    const boilHop = recipe.hops.find((h) => h.type === 'boil');
    const dryHop = recipe.hops.find((h) => h.type === 'dry hop');
    expect(boilHop?.form).toBe('leaf');
    expect(dryHop?.dryHopDays).toBe(5);
  });

  test('round-trips the subtitle/tagline via a custom RECIPE tag', () => {
    const original = createTestRecipe({ subtitle: 'Adapted from Brewing Classic Styles' });
    const recipe = beerXmlImportService.parse(beerXmlExportService.generate(original)).recipe;
    expect(recipe.subtitle).toBe('Adapted from Brewing Classic Styles');
  });
});

// A trimmed Brewfather-style export: BATCH_SIZE = into-fermenter, EVAP_RATE in
// %/hr, EFFICIENCY = brewhouse, EQUIPMENT block with TRUB_CHILLER_LOSS +
// LAUTER_DEADSPACE, and NO BT_* tags (so the importer uses standard fields).
const BREWFATHER_LIKE = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>Irish Red</NAME><VERSION>1</VERSION><TYPE>All Grain</TYPE>
  <BATCH_SIZE>20</BATCH_SIZE><BOIL_SIZE>26</BOIL_SIZE><BOIL_TIME>60</BOIL_TIME>
  <EFFICIENCY>72</EFFICIENCY>
  <OG>1.048</OG><FG>1.012</FG><IBU>22</IBU><EST_ABV>4.7 %</EST_ABV>
  <FERMENTABLES><FERMENTABLE>
    <NAME>Pale Malt</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
    <AMOUNT>4.5</AMOUNT><YIELD>80</YIELD><COLOR>3</COLOR>
  </FERMENTABLE></FERMENTABLES>
  <HOPS><HOP>
    <NAME>East Kent Goldings</NAME><VERSION>1</VERSION><ALPHA>5</ALPHA>
    <AMOUNT>0.03</AMOUNT><USE>Boil</USE><TIME>60</TIME><FORM>Pellet</FORM>
  </HOP></HOPS>
  <YEASTS><YEAST><NAME>Irish Ale</NAME><VERSION>1</VERSION><TYPE>Ale</TYPE>
    <FORM>Liquid</FORM><ATTENUATION>75</ATTENUATION></YEAST></YEASTS>
  <EQUIPMENT>
    <NAME>My 3V</NAME><VERSION>1</VERSION>
    <BATCH_SIZE>20</BATCH_SIZE><BOIL_SIZE>26</BOIL_SIZE><BOIL_TIME>60</BOIL_TIME>
    <CALC_BOIL_VOLUME>true</CALC_BOIL_VOLUME><EVAP_RATE>9.5</EVAP_RATE>
    <TRUB_CHILLER_LOSS>1</TRUB_CHILLER_LOSS><LAUTER_DEADSPACE>1.5</LAUTER_DEADSPACE>
    <HOP_UTILIZATION>100</HOP_UTILIZATION>
  </EQUIPMENT>
</RECIPE></RECIPES>`;

describe('BeerXML foreign import (Brewfather-style)', () => {
  test('parses TRUB_CHILLER_LOSS, LAUTER_DEADSPACE and EVAP_RATE into equipment', () => {
    const { recipe } = beerXmlImportService.parse(BREWFATHER_LIKE);
    const e = recipe.equipment;
    expect(e.kettleLossLiters).toBeCloseTo(1, 2); // TRUB_CHILLER_LOSS → kettle
    expect(e.chillerLossLiters).toBe(0); // split is cosmetic; all on kettle
    expect(e.mashTunLossLiters).toBeCloseTo(1.5, 2); // LAUTER_DEADSPACE → loss, not recovered deadspace
    expect(e.boilOffRateLPerHour).toBeCloseTo((9.5 / 100) * 26, 3); // EVAP_RATE %/hr × BOIL_SIZE
    expect(e.brewhouseEfficiencyPercent).toBe(72);
  });

  test('converts BATCH_SIZE (into-fermenter) to finished batchVolumeL', () => {
    const { recipe } = beerXmlImportService.parse(BREWFATHER_LIKE);
    // No BT_FERMENTER_LOSS → default 0.5; batchVolumeL = 20 − 0.5
    expect(recipe.equipment.fermenterLossLiters).toBe(0.5);
    expect(recipe.batchVolumeL).toBeCloseTo(19.5, 2);
  });

  test('OG denominator reconciles to source BATCH_SIZE regardless of fermenter loss', () => {
    const { recipe } = beerXmlImportService.parse(BREWFATHER_LIKE);
    // into-fermenter = batchVolumeL + fermenterLoss = (20 − loss) + loss = 20 = source BATCH_SIZE.
    expect(volumeCalculationService.calculateIntoFermenterVolume(recipe)).toBeCloseTo(20, 2);
    const og = recipeCalculationService.calculateOG(recipe);
    expect(og).toBeGreaterThan(1.03);
    expect(og).toBeLessThan(1.06);
  });

  test('captures the source-stated vitals (incl. unit-suffixed EST_ABV)', () => {
    const { sourceVitals } = beerXmlImportService.parse(BREWFATHER_LIKE);
    expect(sourceVitals?.og).toBeCloseTo(1.048, 3);
    expect(sourceVitals?.fg).toBeCloseTo(1.012, 3);
    expect(sourceVitals?.ibu).toBeCloseTo(22, 1);
    expect(sourceVitals?.abv).toBeCloseTo(4.7, 1); // parsed from "4.7 %"
  });
});

function wrap(recipeInner: string): string {
  return `<?xml version="1.0"?><RECIPES><RECIPE>
    <NAME>Edge</NAME><BATCH_SIZE>20</BATCH_SIZE><EFFICIENCY>70</EFFICIENCY>
    <FERMENTABLES><FERMENTABLE><NAME>Pale Malt</NAME><AMOUNT>4</AMOUNT><YIELD>80</YIELD><COLOR>2</COLOR></FERMENTABLE></FERMENTABLES>
    ${recipeInner}
  </RECIPE></RECIPES>`;
}

describe('BeerXML import edge cases', () => {
  test('no EQUIPMENT block → defaults, batch minus default fermenter loss', () => {
    const { recipe } = beerXmlImportService.parse(wrap(''));
    expect(recipe.equipment.kettleLossLiters).toBe(1); // default
    expect(recipe.equipment.boilOffRateLPerHour).toBe(4); // default
    expect(recipe.batchVolumeL).toBeCloseTo(19.5, 2); // 20 − 0.5
  });

  test('EVAP_RATE absent → default boil-off rate', () => {
    const { recipe } = beerXmlImportService.parse(
      wrap('<EQUIPMENT><TRUB_CHILLER_LOSS>2</TRUB_CHILLER_LOSS></EQUIPMENT>')
    );
    expect(recipe.equipment.boilOffRateLPerHour).toBe(4);
    expect(recipe.equipment.kettleLossLiters).toBeCloseTo(2, 2);
  });

  test('EVAP_RATE present but BOIL_SIZE absent → cannot convert → default boil-off', () => {
    const { recipe } = beerXmlImportService.parse(
      wrap('<EQUIPMENT><EVAP_RATE>10</EVAP_RATE></EQUIPMENT>')
    );
    expect(recipe.equipment.boilOffRateLPerHour).toBe(4);
  });

  test('negative / garbage loss falls back to default', () => {
    const { recipe } = beerXmlImportService.parse(
      wrap('<EQUIPMENT><TRUB_CHILLER_LOSS>-3</TRUB_CHILLER_LOSS><LAUTER_DEADSPACE>nope</LAUTER_DEADSPACE></EQUIPMENT>')
    );
    expect(recipe.equipment.kettleLossLiters).toBe(1); // default, not -3
    expect(recipe.equipment.mashTunLossLiters).toBe(0); // default, not NaN
  });

  test('USE=Boil with TIME=0 is reclassified as a whirlpool flameout', () => {
    const { recipe } = beerXmlImportService.parse(
      wrap('<HOPS><HOP><NAME>Cascade</NAME><ALPHA>6</ALPHA><AMOUNT>0.02</AMOUNT><USE>Boil</USE><TIME>0</TIME></HOP></HOPS>')
    );
    expect(recipe.hops[0].type).toBe('whirlpool');
    expect(recipe.hops[0].timeMinutes).toBeUndefined();
  });

  test('whole-leaf FORM removes the +10% pellet IBU bonus', () => {
    const leafRecipe = beerXmlImportService.parse(
      wrap('<HOPS><HOP><NAME>Fuggle</NAME><ALPHA>5</ALPHA><AMOUNT>0.03</AMOUNT><USE>Boil</USE><TIME>60</TIME><FORM>Leaf</FORM></HOP></HOPS>')
    ).recipe;
    const pelletRecipe = beerXmlImportService.parse(
      wrap('<HOPS><HOP><NAME>Fuggle</NAME><ALPHA>5</ALPHA><AMOUNT>0.03</AMOUNT><USE>Boil</USE><TIME>60</TIME><FORM>Pellet</FORM></HOP></HOPS>')
    ).recipe;

    expect(leafRecipe.hops[0].form).toBe('leaf');
    const leafIbu = recipeCalculationService.calculate(leafRecipe).ibu;
    const pelletIbu = recipeCalculationService.calculate(pelletRecipe).ibu;
    expect(leafIbu).toBeLessThan(pelletIbu);
    expect(leafIbu).toBeCloseTo(pelletIbu / 1.1, 1); // exactly the missing 10% bonus
  });

  test('ignores junk source gravities (OG ≤ 1.0)', () => {
    const { sourceVitals } = beerXmlImportService.parse(
      wrap('<OG>1.000</OG><IBU>30</IBU>')
    );
    expect(sourceVitals?.og).toBeUndefined();
    expect(sourceVitals?.ibu).toBeCloseTo(30, 1);
  });
});
