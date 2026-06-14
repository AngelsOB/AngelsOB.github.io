import { describe, it, expect } from 'vitest';
import {
  parseRecipeText,
  sanitizeDraft,
  lbToKg,
  ozToG,
  galToL,
} from '@/modules/recipe/services/recipeTextParser';

describe('unit converters', () => {
  it('converts imperial to metric', () => {
    expect(lbToKg(1)).toBeCloseTo(0.4536, 3);
    expect(ozToG(1)).toBeCloseTo(28.35, 1);
    expect(galToL(5)).toBeCloseTo(18.93, 1);
  });
});

describe('parseRecipeText — clean book recipe (line per ingredient)', () => {
  const text = `
West Coast Thumper
Style: American IPA
Batch size: 5 gal
Boil: 60 min
OG: 1.064

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

  const draft = parseRecipeText(text);

  it('extracts vitals', () => {
    expect(draft.name).toBe('West Coast Thumper');
    expect(draft.style).toBe('American IPA');
    expect(draft.batchVolumeL).toBeCloseTo(18.9, 1);
    expect(draft.boilTimeMin).toBe(60);
    expect(draft.targetOg).toBeCloseTo(1.064, 3);
  });

  it('extracts the grain bill with converted weights', () => {
    expect(draft.fermentables).toHaveLength(3);
    expect(draft.fermentables[0].rawName).toBe('2-row');
    expect(draft.fermentables[0].weightKg).toBeCloseTo(lbToKg(11), 3);
    expect(draft.fermentables[1].rawName).toBe('Crystal 40');
    expect(draft.fermentables[1].weightKg).toBeCloseTo(lbToKg(1), 3);
    expect(draft.fermentables[2].rawName).toBe('Munich');
    expect(draft.fermentables[2].weightKg).toBeCloseTo(lbToKg(0.5), 3);
  });

  it('extracts hops with timings and types', () => {
    expect(draft.hops).toHaveLength(3);
    expect(draft.hops[0]).toMatchObject({ rawName: 'Magnum', type: 'boil', timeMinutes: 60 });
    expect(draft.hops[0].grams).toBeCloseTo(ozToG(1), 1);
    expect(draft.hops[1]).toMatchObject({ rawName: 'Centennial', type: 'boil', timeMinutes: 15 });
    expect(draft.hops[2]).toMatchObject({ rawName: 'Citra', type: 'dry hop', dryHopDays: 3 });
    expect(draft.hops[2].grams).toBeCloseTo(ozToG(2), 1);
  });

  it('extracts yeast with laboratory', () => {
    expect(draft.yeasts).toHaveLength(1);
    expect(draft.yeasts[0].rawName).toMatch(/1056/);
    expect(draft.yeasts[0].laboratory).toBe('Wyeast');
  });

  it('leaves nothing unparsed', () => {
    expect(draft.unparsedLines).toEqual([]);
  });
});

describe('parseRecipeText — forum one-liner with slash separators', () => {
  it('splits compound lines on " / "', () => {
    const draft = parseRecipeText(
      '11 lb 2-row / 1 lb Crystal 40 / 0.5 lb Munich / 1 oz Magnum @60 / 1 oz Centennial @15 / 2 oz Citra dry hop 3 days / Wyeast 1056',
    );
    expect(draft.fermentables.map((f) => f.rawName)).toEqual(['2-row', 'Crystal 40', 'Munich']);
    expect(draft.hops.map((h) => h.rawName)).toEqual(['Magnum', 'Centennial', 'Citra']);
    expect(draft.yeasts).toHaveLength(1);
  });

  it('does not split names like "CaraPils / Dextrine"', () => {
    const draft = parseRecipeText('0.5 lb CaraPils / Dextrine');
    expect(draft.fermentables).toHaveLength(1);
    expect(draft.fermentables[0].rawName).toBe('CaraPils / Dextrine');
  });
});

describe('parseRecipeText — percentage grain bill', () => {
  it('keeps relativePct without weights', () => {
    const draft = parseRecipeText(`
Grain bill
80% 2-Row
12% Munich
8% Crystal 60
`);
    expect(draft.fermentables).toEqual([
      { rawName: '2-Row', weightKg: undefined, relativePct: 80 },
      { rawName: 'Munich', weightKg: undefined, relativePct: 12 },
      { rawName: 'Crystal 60', weightKg: undefined, relativePct: 8 },
    ]);
  });
});

describe('parseRecipeText — headerless inference', () => {
  it('classifies by line cues without section headers', () => {
    const draft = parseRecipeText(`
2.5 kg Pilsner
250 g Carapils
30 g Saaz @ 60 min
30 g Saaz @ 5 min
Safale US-05
`);
    expect(draft.fermentables).toHaveLength(2);
    expect(draft.fermentables[0].weightKg).toBeCloseTo(2.5, 3);
    expect(draft.fermentables[1].weightKg).toBeCloseTo(0.25, 3);
    expect(draft.hops).toHaveLength(2);
    expect(draft.hops[0]).toMatchObject({ rawName: 'Saaz', timeMinutes: 60 });
    expect(draft.hops[0].grams).toBeCloseTo(30, 1);
    expect(draft.yeasts[0].laboratory).toBe('Fermentis');
  });

  it('whirlpool, FWH and alpha cues', () => {
    const draft = parseRecipeText(`
1 oz Cascade whirlpool 20 min
0.5 oz Magnum 14% AA first wort
`);
    expect(draft.hops[0]).toMatchObject({ rawName: 'Cascade', type: 'whirlpool', timeMinutes: 20, temperatureC: 85 });
    expect(draft.hops[1]).toMatchObject({ rawName: 'Magnum', type: 'first wort', alphaAcid: 14 });
  });

  it('flameout is hot (~99°C), whirlpool defaults cooler (~85°C), explicit temp wins', () => {
    const draft = parseRecipeText(`
1 oz Citra flameout
1 oz Mosaic whirlpool
1 oz Simcoe hopstand 30 min at 80C
`);
    expect(draft.hops[0]).toMatchObject({ rawName: 'Citra', type: 'whirlpool', temperatureC: 99 });
    expect(draft.hops[1]).toMatchObject({ rawName: 'Mosaic', type: 'whirlpool', temperatureC: 85 });
    expect(draft.hops[2]).toMatchObject({ rawName: 'Simcoe', type: 'whirlpool', temperatureC: 80, timeMinutes: 30 });
  });
});

describe('parseRecipeText — messy input', () => {
  it('surfaces unclassifiable lines and skips stat/mash prose', () => {
    const draft = parseRecipeText(`
My Saison
ABV: 6.5%  IBU: 28
Mash at 152F for 60 minutes
something completely unparseable here
3 kg Pilsner
`);
    expect(draft.name).toBe('My Saison');
    expect(draft.fermentables).toHaveLength(1);
    expect(draft.unparsedLines).toEqual(['something completely unparseable here']);
  });

  it('handles compound imperial weights and fractions', () => {
    const draft = parseRecipeText(`
1 lb 8 oz Munich
½ oz Saaz @ 10
1 1/2 lb Wheat Malt
`);
    expect(draft.fermentables[0].weightKg).toBeCloseTo(lbToKg(1.5), 2);
    expect(draft.hops[0].grams).toBeCloseTo(ozToG(0.5), 1);
    expect(draft.fermentables[1].weightKg).toBeCloseTo(lbToKg(1.5), 2);
  });
});

describe('parseRecipeText — book recipe with Specifications/Directions blocks', () => {
  // Real-world regression: Ingredients/Specifications/Directions headers,
  // color-first crystal names, "(21 g)" dupes, "a.a.", "US gal", °F/°C prose.
  const text = `
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

Final Gravity: 1.012 (3.1°P)

ABV: 5.5%

IBU: 24

SRM: 17

Directions:
Mash at 152°F (67°C) for 60 minutes. Boil 60 minutes, adding hops as indicated. Ferment at 64°F (18°C) until specific gravity stabilizes at or near 1.012 (3.1°P). Package with 1.1 vol. (2.2 g/L) of CO2 and optionally serve on nitro.
`;

  const draft = parseRecipeText(text);

  it('extracts all five fermentables with clean names', () => {
    expect(draft.fermentables.map((f) => f.rawName)).toEqual([
      'pale ale malt',
      '45°L crystal malt',
      '160°L crystal malt',
      '80°L crystal malt',
      '550°L roasted barley',
    ]);
    expect(draft.fermentables[0].weightKg).toBeCloseTo(lbToKg(10), 2);
    expect(draft.fermentables[1].weightKg).toBeCloseTo(ozToG(6) / 1000, 3);
  });

  it('extracts hops with alpha, time, and clean names (no "(21 g)" or "a.a.")', () => {
    expect(draft.hops).toHaveLength(2);
    expect(draft.hops[0]).toMatchObject({
      rawName: 'Willamette',
      type: 'boil',
      timeMinutes: 60,
      alphaAcid: 6,
    });
    expect(draft.hops[0].grams).toBeCloseTo(ozToG(0.75), 1);
    expect(draft.hops[1]).toMatchObject({
      rawName: 'East Kent Goldings',
      type: 'boil',
      timeMinutes: 10,
      alphaAcid: 4.7,
    });
  });

  it('keeps the yeast clean — no stat-line trash, brand stripped', () => {
    expect(draft.yeasts).toHaveLength(1);
    expect(draft.yeasts[0].rawName).toBe('Nottingham');
    expect(draft.yeasts[0].laboratory).toBe('Lallemand');
  });

  it('reads vitals from the Specifications block ("5 US gal.")', () => {
    expect(draft.batchVolumeL).toBeCloseTo(18.9, 1);
    expect(draft.targetOg).toBeCloseTo(1.054, 3);
    expect(draft.targetFg).toBeCloseTo(1.012, 3);
    expect(draft.boilTimeMin).toBe(60);
  });

  it('reads mash and fermentation from the directions prose', () => {
    expect(draft.mashSteps).toEqual([{ temperatureC: 67, durationMinutes: 60 }]);
    expect(draft.fermentTempC).toBe(18);
  });

  it('does not use "Ingredients" as the recipe name and leaves nothing unparsed', () => {
    expect(draft.name).toBeUndefined();
    expect(draft.unparsedLines).toEqual([]);
  });

  it('converts °F when no °C is given', () => {
    const d = parseRecipeText('Mash at 152F for 75 min\nFerment at 64 °F');
    expect(d.mashSteps?.[0].temperatureC).toBeCloseTo(66.7, 1);
    expect(d.mashSteps?.[0].durationMinutes).toBe(75);
    expect(d.fermentTempC).toBeCloseTo(17.8, 1);
  });
});

describe('parseRecipeText — process extraction variations (entity + slot)', () => {
  it.each([
    ['Sacch rest: 148F 75 min', 64.4, 75],
    ['Mash: 65C/60m', 65, 60],
    ['67°C mash for an hour', 67, 60],
    ['Single infusion mash, 67°C, 60 min', 67, 60],
    ['Mash at 152 for 60 minutes', 66.7, 60], // bare number → only °F is plausible
    ['Dough in and mash at 66', 66, undefined], // bare number → only °C is plausible
  ])('%s → %d°C', (text, tempC, durationMin) => {
    const d = parseRecipeText(text);
    expect(d.mashSteps).toHaveLength(1);
    expect(d.mashSteps![0].temperatureC).toBeCloseTo(tempC as number, 1);
    expect(d.mashSteps![0].durationMinutes).toBe(durationMin);
    expect(d.unparsedLines).toEqual([]);
  });

  it('parses a step mash into multiple rests', () => {
    const d = parseRecipeText('Protein rest 122°F 20 min, sacch rest 150°F 40 min');
    expect(d.mashSteps).toEqual([
      { temperatureC: 50, durationMinutes: 20 },
      { temperatureC: 65.6, durationMinutes: 40 },
    ]);
  });

  it.each([
    ['Primary: 2 weeks @ 66°F', 18.9, 14],
    ['Ferment at 18 until done', 18, undefined], // bare → only °C plausible
    ['pitch at 64F and let it free rise', 17.8, undefined],
    ['Ferment for ten days at 19C', 19, 10],
  ])('%s → ferment %d°C', (text, tempC, days) => {
    const d = parseRecipeText(text);
    expect(d.fermentTempC).toBeCloseTo(tempC as number, 1);
    expect(d.fermentDays).toBe(days);
  });

  it.each([
    ['90-minute boil', 90],
    ['Boil for an hour', 60],
    ['Boil time: 75 minutes', 75],
  ])('%s → boil %d min', (text, min) => {
    expect(parseRecipeText(text).boilTimeMin).toBe(min);
  });

  it('reads batch volume from looser phrasings', () => {
    expect(parseRecipeText('Makes five gallons').batchVolumeL).toBeCloseTo(18.9, 1);
    expect(parseRecipeText('5.5 gallons into the fermenter').batchVolumeL).toBeCloseTo(20.8, 1);
  });

  it('captures stated efficiency', () => {
    expect(parseRecipeText('Efficiency: 72%').efficiencyPercent).toBe(72);
    expect(parseRecipeText('assumes 68% brewhouse efficiency').efficiencyPercent).toBe(68);
  });

  it('recognizes water volume/temp lines but does not import them', () => {
    const d = parseRecipeText(
      'Strike with 4.5 gal at 165°F\nSparge to collect 6.5 gal\nTotal water: 7.5 gal',
    );
    expect(d.batchVolumeL).toBeUndefined();
    expect(d.unparsedLines).toEqual([]);
  });

  it('never reads process values off ingredient rows', () => {
    const d = parseRecipeText('1 oz Magnum @ 60 min boil');
    expect(d.boilTimeMin).toBeUndefined();
    expect(d.hops).toHaveLength(1);
    expect(d.hops[0]).toMatchObject({ rawName: 'Magnum', type: 'boil', timeMinutes: 60 });
  });
});

describe('parseRecipeText — blog-style recipe with prose and photo captions', () => {
  // Real-world regression: leading-dot decimals (".6 oz"), two-unit
  // parentheticals "(3kg 861.2g)", "at 60 minutes" wording, prose yeast
  // ("San Diego Super Yeast by White Labs"), "Yeast and Fermentation"
  // header, caption noise, and a total-water line that must NOT become the
  // batch volume.
  const text = `
Water
We started with 7.64 gallons (28.9 liters) of Asheville, NC city water and made a few minor adjustments, which will be different for you depending on what kind of water you're using.
filling kettle with water
Grains
Here's the detailed grain bill for this recipe.
Pale Malt - 8lbs, 8.2oz. (3kg 861.2g)
Crystal 10 - 11.7 oz. (331.7g)
Vienna - 11.7 oz. (331.7g)
Victory - 8.5 oz. (241g)
Crystal 60 - 5.3 oz. (150.3g)
Mash
We did a single step mash at 152 degrees Fahrenheit (66.7C) for 60 minutes and did not sparge.
mashing in
pulling grains after a 60 minute mash
Hops
We used the following hop amounts at the times listed below during a 60-minute boil.
Magnum - .6 oz (17.01g) at 60 minutes
Perle - .5 oz (14.17g) at 25 minutes
Fuggle - .5 (14.17g) oz at 10 minutes
Fuggle .5 (14.17g) oz at 2 minutes
boiling wort
adding hops to hop basket
Yeast and Fermentation
This beer came to life with the help of San Diego Super Yeast by White Labs.
pitching yeast
We fermented at 66F (18.9C) for 4 days and then let the beer come up to room temp naturally and then sit for another 5 days.
putting beer into fermentation chamber
We cold crashed and added gelatin, then kegged.
`;

  const draft = parseRecipeText(text);

  it('extracts all five grains with combined lb+oz weights', () => {
    expect(draft.fermentables.map((f) => f.rawName)).toEqual([
      'Pale Malt',
      'Crystal 10',
      'Vienna',
      'Victory',
      'Crystal 60',
    ]);
    expect(draft.fermentables[0].weightKg).toBeCloseTo(lbToKg(8) + ozToG(8.2) / 1000, 2);
    expect(draft.fermentables[1].weightKg).toBeCloseTo(0.3317, 2);
  });

  it('reads leading-dot hop amounts correctly (not 10× off)', () => {
    expect(draft.hops).toHaveLength(4);
    expect(draft.hops[0]).toMatchObject({ rawName: 'Magnum', type: 'boil', timeMinutes: 60 });
    expect(draft.hops[0].grams).toBeCloseTo(ozToG(0.6), 0); // ~17 g, not 170
    expect(draft.hops[1]).toMatchObject({ rawName: 'Perle', timeMinutes: 25 });
    expect(draft.hops[1].grams).toBeCloseTo(ozToG(0.5), 0);
    // "Fuggle - .5 (14.17g) oz" — unit after the stripped parenthetical.
    expect(draft.hops[2]).toMatchObject({ rawName: 'Fuggle', timeMinutes: 10 });
    expect(draft.hops[2].grams).toBeCloseTo(ozToG(0.5), 0);
    expect(draft.hops[3].timeMinutes).toBe(2);
  });

  it('finds the yeast in prose and ignores caption noise', () => {
    const real = draft.yeasts.find((y) => /san diego super/i.test(y.rawName));
    expect(real).toBeDefined();
    expect(real!.laboratory).toBe('White Labs');
  });

  it('reads mash, boil, and fermentation from prose', () => {
    expect(draft.mashSteps).toEqual([{ temperatureC: 66.7, durationMinutes: 60 }]);
    expect(draft.boilTimeMin).toBe(60);
    expect(draft.fermentTempC).toBeCloseTo(18.9, 1);
    expect(draft.fermentDays).toBe(4);
  });

  it('does not mistake total water for batch volume', () => {
    expect(draft.batchVolumeL).toBeUndefined();
  });
});

describe('parseRecipeText — book recipe with orphan amounts and inline yeast options', () => {
  // Regression: amount digits on their own line, "(89%)" grist shares on
  // weighted rows, "Malt Bill" header, mash header with temps on the next
  // line, no Hops header (boil line must end the grain section), yeast
  // options inline with fermentation prose, and Plato-first gravities.
  const text = `
Mild Ale
John Boyce
Mighty Oak
Malt Bill


6
 pounds Maris Otter pale malt (89%)

0.4
 pound UK 60L crystal malt (6%)

0.3
 pound UK black malt (5%)


 Single-Infusion Mash

153°F (67°C) for 75 minutes

90-Minute Boil

1 ounce East Kent Goldings, 90 minutes (5.0% AA, contribution of 19 IBU)
1 ounce East Kent Goldings, 5 minutes (5.0% AA, contribution of 4 IBU)

Fermentation and Conditioning
Ferment with Wyeast 1469 (West Yorkshire Ale), White Labs WLP022 (Essex Ale), or your choice of British strain. Lower temperatures (65 to 68°F [18–20°C]) will suppress esters, while warmer ones (72 to 76°F [22–24°C]) will encourage them, so proceed as befits your preference.
Package
Cask- or bottle-condition. If kegging, limit to 2.0 volumes and serve at 55°F (13°C).

Expected OG: 9.3° P/1.037
Expected TG: 2.5° P/1.010
Expected ABV: 3.5%
Expected bitterness: 18–22 IBU
`;

  const draft = parseRecipeText(text);

  it('rejoins orphan amount lines — real weights, not percentages', () => {
    expect(draft.name).toBe('Mild Ale');
    expect(draft.fermentables.map((f) => f.rawName)).toEqual([
      'Maris Otter pale malt',
      'UK 60L crystal malt',
      'UK black malt',
    ]);
    expect(draft.fermentables[0].weightKg).toBeCloseTo(lbToKg(6), 2);
    expect(draft.fermentables[1].weightKg).toBeCloseTo(lbToKg(0.4), 3);
    expect(draft.fermentables[2].weightKg).toBeCloseTo(lbToKg(0.3), 3);
    // Grist shares captured alongside, names kept clean of "(89%)".
    expect(draft.fermentables[0].relativePct).toBe(89);
  });

  it('hops are hops, not grains, despite no Hops header', () => {
    expect(draft.hops).toHaveLength(2);
    expect(draft.hops[0]).toMatchObject({
      rawName: 'East Kent Goldings',
      type: 'boil',
      timeMinutes: 90,
      alphaAcid: 5,
    });
    expect(draft.hops[0].grams).toBeCloseTo(ozToG(1), 1);
    expect(draft.hops[1].timeMinutes).toBe(5);
  });

  it('catches both inline yeast options with strain names', () => {
    expect(draft.yeasts).toHaveLength(2);
    expect(draft.yeasts[0]).toEqual({ rawName: '1469 West Yorkshire Ale', laboratory: 'Wyeast' });
    expect(draft.yeasts[1]).toEqual({ rawName: 'WLP022 Essex Ale', laboratory: 'White Labs' });
  });

  it('reads mash from the header-then-values layout and the 90-minute boil', () => {
    expect(draft.mashSteps).toEqual([{ temperatureC: 67, durationMinutes: 75 }]);
    expect(draft.boilTimeMin).toBe(90);
  });

  it('reads Plato-first gravities', () => {
    expect(draft.targetOg).toBeCloseTo(1.037, 3);
    expect(draft.targetFg).toBeCloseTo(1.01, 3);
  });
});

describe('sanitizeDraft', () => {
  it('coerces an AI-shaped response with nulls', () => {
    const draft = sanitizeDraft({
      name: null,
      style: 'Saison',
      batchVolumeL: 20,
      boilTimeMin: null,
      targetOg: 1.05,
      fermentables: [
        { rawName: 'Pilsner', weightKg: 4, relativePct: null },
        { rawName: '', weightKg: 1 }, // dropped — no name
        null,
      ],
      hops: [{ rawName: 'Saaz', grams: 30, type: 'nonsense', timeMinutes: 60 }],
      yeasts: [{ rawName: 'Belle Saison', laboratory: null }],
      unparsedLines: ['x', 42],
    });
    expect(draft.name).toBeUndefined();
    expect(draft.style).toBe('Saison');
    expect(draft.fermentables).toEqual([{ rawName: 'Pilsner', weightKg: 4, relativePct: undefined }]);
    expect(draft.hops[0].type).toBe('boil'); // invalid type falls back
    expect(draft.yeasts[0]).toEqual({ rawName: 'Belle Saison', laboratory: undefined });
    expect(draft.unparsedLines).toEqual(['x']);
  });

  it('rejects junk gravities and negative numbers', () => {
    const draft = sanitizeDraft({ targetOg: 64, fermentables: [{ rawName: 'X', weightKg: -2 }], hops: [], yeasts: [] });
    expect(draft.targetOg).toBeUndefined();
    expect(draft.fermentables[0].weightKg).toBeUndefined();
  });

  it('tolerates complete garbage', () => {
    expect(sanitizeDraft(null)).toMatchObject({ fermentables: [], hops: [], yeasts: [], unparsedLines: [] });
    expect(sanitizeDraft('hi')).toMatchObject({ fermentables: [] });
  });
});
