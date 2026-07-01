/**
 * Malt Flavour Lexicon + aggregation
 *
 * Hops carry a flavour vector per *product*; malt character is better modelled
 * per *archetype* (Pilsner, Munich, Crystal-60, Chocolate, Roasted Barley …),
 * because two products at the same colour can taste nothing alike, and there are
 * only ~30-40 archetypes worth distinguishing.
 *
 * Each archetype has two parts:
 *   - `flavor`     — the DIRECTION/quality (9 axes, 0-5), authored from maltster
 *                    descriptors (compiled facts, like the curated hop vectors).
 *   - `intensity`  — flavour PUNCH per unit of grist (base malt ≈ 0.4, roasted
 *                    barley ≈ 11). This is what makes 6% roasted barley define a
 *                    stout while 6% more base malt does almost nothing.
 *
 * `aggregateMaltFlavor` mirrors HopFlavorCalculationService exactly: a
 * potency-weighted amount per component, axis proportions from the blend, and a
 * single saturating magnitude (so 5% → 10% roast does NOT double perceived
 * roast). The goal is a useful COORDINATE SYSTEM where similar beers land near
 * each other (stouts cluster away from pales) — not a validated sensory model.
 *
 * Intensities/vectors are a hand-tuned first pass; they can later be data-fit
 * (pick coefficients that best separate styles). Known gaps documented per-entry
 * (rye spice, smoke/rauch, and acidulated/dextrine have no faithful axis here).
 */

// Malt flavour axes (radar order). Defined locally so this lab module stays
// fully self-contained — promoted into the app's data layer only at integration.
export const MALT_FLAVOR_KEYS = [
  "grainy", // grainy / bready
  "biscuit", // biscuit / toast
  "caramel", // caramel / toffee (toffee folds in — no clean standalone anchor)
  "darkFruit", // dark fruit / raisin
  "chocolate", // cocoa / dark chocolate
  "coffee", // coffee / espresso / cocoa-mocha — anchored by roasted barley
  "roast", // roast / burnt / acrid char — anchored by black/patent malt
  "nutty",
  "honey", // honey / malty-sweet
] as const;

export type MaltFlavorProfile = {
  grainy: number;
  biscuit: number;
  caramel: number;
  darkFruit: number;
  chocolate: number;
  coffee: number;
  roast: number;
  nutty: number;
  honey: number;
};

// Maps total potency-weight W to an overall magnitude in [0,5] via
// M = 5*(1 - exp(-LAMBDA * W)). Bumped above the natural ~1.0 to spread base-heavy
// grists across more of the 0–5 range so styles differentiate on the radar. The
// flavour-radar UI is the real optimisation target — this is a first-pass dial.
// Mirrors OVERALL_INTENSITY_LAMBDA in HopFlavorCalculationService.
export const MALT_INTENSITY_LAMBDA = 1.6;

function clamp(value: number, min = 0, max = 5): number {
  return Math.max(min, Math.min(max, value));
}

/** A flat 0 malt flavour vector, with overrides applied. */
function mf(overrides: Partial<MaltFlavorProfile> = {}): MaltFlavorProfile {
  return {
    grainy: 0,
    biscuit: 0,
    caramel: 0,
    darkFruit: 0,
    chocolate: 0,
    coffee: 0,
    roast: 0,
    nutty: 0,
    honey: 0,
    ...overrides,
  };
}

export type MaltArchetype = {
  slug: string; // stable key — the name-matcher maps raw ingredient strings to this
  label: string;
  intensity: number; // flavour punch per unit grist fraction (base ≈0.4 … roast ≈11)
  flavor: MaltFlavorProfile; // direction/quality, 0-5 per axis
  typicalColorLovibond?: number; // reference / matching aid (not used by the math)
  note?: string; // documents a known modelling gap for this archetype
};

// ── The lexicon ────────────────────────────────────────────────────────────────
// Grouped to mirror categorizeFermentable()'s families. Base malts are kept LOW
// intensity on purpose: their grainy/bready note is a mild background that
// specialty malts override, so the blend DIRECTION is driven by the punchy
// minority — exactly the stout-roasted-barley behaviour we want.

export const MALT_ARCHETYPES: MaltArchetype[] = [
  // Base / pale
  { slug: "base-pale", label: "Pale / 2-row (generic)", intensity: 0.4, typicalColorLovibond: 2, flavor: mf({ grainy: 2, biscuit: 0.5 }) },
  { slug: "pilsner", label: "Pilsner malt", intensity: 0.4, typicalColorLovibond: 2, flavor: mf({ grainy: 3, honey: 0.5 }), note: "Pilsner's 'green / fresh-wort / DMS' note (Mallett; Murray glossary) has no faithful axis here — grainy is a loose stand-in" },
  { slug: "maris-otter", label: "Maris Otter / British pale", intensity: 0.6, typicalColorLovibond: 3, flavor: mf({ grainy: 2, biscuit: 3, nutty: 2, honey: 1 }) },
  { slug: "vienna", label: "Vienna malt", intensity: 0.9, typicalColorLovibond: 4, flavor: mf({ grainy: 1.5, biscuit: 2.5, honey: 1.5, nutty: 1, caramel: 0.5 }) },
  { slug: "munich-light", label: "Munich (light)", intensity: 1.2, typicalColorLovibond: 9, flavor: mf({ grainy: 1, biscuit: 2.5, honey: 2, caramel: 1, nutty: 1 }) },
  { slug: "munich-dark", label: "Munich (dark)", intensity: 1.8, typicalColorLovibond: 20, flavor: mf({ biscuit: 3, caramel: 1.5, honey: 2, darkFruit: 0.5, nutty: 1 }) },
  { slug: "wheat-malt", label: "Wheat malt", intensity: 0.45, typicalColorLovibond: 2, flavor: mf({ grainy: 2.5, honey: 0.5 }) },
  { slug: "rye-malt", label: "Rye malt", intensity: 0.9, typicalColorLovibond: 4, flavor: mf({ grainy: 2.5, biscuit: 1, nutty: 1 }), note: "rye spice/earthiness is not captured by these 8 axes" },
  { slug: "acidulated", label: "Acidulated malt", intensity: 0.1, typicalColorLovibond: 3, flavor: mf({}), note: "pH/sour malt — negligible flavour on these axes" },

  // Toasted & specialty (non-crystal)
  { slug: "biscuit-malt", label: "Biscuit malt", intensity: 2.5, typicalColorLovibond: 25, flavor: mf({ biscuit: 4, nutty: 2, grainy: 1 }) },
  { slug: "victory-amber", label: "Victory / Amber (toasted)", intensity: 2.5, typicalColorLovibond: 28, flavor: mf({ biscuit: 3.5, nutty: 3, caramel: 1, grainy: 1 }) },
  { slug: "amber-malt", label: "Amber malt", intensity: 3, typicalColorLovibond: 35, flavor: mf({ biscuit: 3, nutty: 2, caramel: 1.5, roast: 0.5 }) },
  { slug: "aromatic", label: "Aromatic malt", intensity: 2.0, typicalColorLovibond: 20, flavor: mf({ biscuit: 2, honey: 2, caramel: 1.5 }) },
  { slug: "melanoidin", label: "Melanoidin malt", intensity: 2.2, typicalColorLovibond: 30, flavor: mf({ honey: 3, caramel: 1.5, biscuit: 2, darkFruit: 0.5 }), note: "Mallett equates melanoidin = Honey malt / Brumalt ('Super-Munich') — honey-forward" },
  { slug: "brown-malt", label: "Brown malt", intensity: 4, typicalColorLovibond: 65, flavor: mf({ biscuit: 2, chocolate: 2, nutty: 2, roast: 1.5, caramel: 1 }) },
  { slug: "honey-malt", label: "Honey malt / Brumalt", intensity: 2.5, typicalColorLovibond: 25, flavor: mf({ honey: 4, caramel: 1.5 }) },

  // Crystal / caramel (split by colour — flavour shifts caramel → raisin with depth)
  { slug: "dextrine", label: "Carapils / dextrine", intensity: 0.4, typicalColorLovibond: 2, flavor: mf({ grainy: 0.5 }), note: "body/head retention — minimal flavour" },
  { slug: "crystal-light", label: "Crystal (light, ~10-30°L)", intensity: 2.0, typicalColorLovibond: 20, flavor: mf({ caramel: 2.5, honey: 1.5, biscuit: 0.5 }) },
  { slug: "crystal-medium", label: "Crystal (medium, ~40-70°L)", intensity: 3.5, typicalColorLovibond: 55, flavor: mf({ caramel: 4, honey: 1.5, darkFruit: 0.5, biscuit: 0.5 }) },
  { slug: "crystal-dark", label: "Crystal (dark, ~80-120°L)", intensity: 4.5, typicalColorLovibond: 100, flavor: mf({ caramel: 4, darkFruit: 2.5, honey: 1, roast: 0.3 }) },
  { slug: "special-b", label: "Special B (~120-180°L)", intensity: 5.5, typicalColorLovibond: 150, flavor: mf({ darkFruit: 5, caramel: 2.5, chocolate: 1 }) },

  // Roasted / dark
  { slug: "pale-chocolate", label: "Pale chocolate malt", intensity: 6, typicalColorLovibond: 200, flavor: mf({ chocolate: 3, coffee: 1.5, roast: 1, nutty: 1 }) },
  { slug: "chocolate-malt", label: "Chocolate malt", intensity: 8, typicalColorLovibond: 350, flavor: mf({ chocolate: 4, coffee: 2.5, roast: 2, darkFruit: 0.5, nutty: 0.5 }) },
  { slug: "carafa-dehusked", label: "Carafa / dehusked dark", intensity: 7, typicalColorLovibond: 350, flavor: mf({ chocolate: 3, coffee: 2, roast: 2 }), note: "dehusked — smoother, lower acridity than black malt" },
  { slug: "black-malt", label: "Black / patent malt", intensity: 10, typicalColorLovibond: 500, flavor: mf({ roast: 5, coffee: 1, chocolate: 1 }), note: "the acrid/burnt 'roast' anchor — low coffee, distinct from roasted barley" },
  { slug: "roasted-barley", label: "Roasted barley", intensity: 11, typicalColorLovibond: 450, flavor: mf({ coffee: 4, roast: 3, chocolate: 1.5, darkFruit: 0.5 }), note: "Brynildson's 'cocoa-mocha' — the coffee anchor, distinct from acrid black malt" },

  // Adjuncts (mashable / flaked) — mostly texture/body, low flavour
  { slug: "flaked-oats", label: "Flaked oats", intensity: 0.6, typicalColorLovibond: 1, flavor: mf({ grainy: 1.5, honey: 0.5 }), note: "creamy body more than flavour" },
  { slug: "flaked-wheat", label: "Flaked wheat", intensity: 0.5, typicalColorLovibond: 1, flavor: mf({ grainy: 1.5 }) },
  { slug: "flaked-barley", label: "Flaked barley", intensity: 0.6, typicalColorLovibond: 1.5, flavor: mf({ grainy: 1.5, nutty: 0.5 }) },
  { slug: "flaked-corn", label: "Flaked maize / corn", intensity: 0.4, typicalColorLovibond: 1, flavor: mf({ grainy: 1, honey: 0.5 }) },
  { slug: "flaked-rice", label: "Flaked rice", intensity: 0.2, typicalColorLovibond: 1, flavor: mf({ grainy: 0.3 }), note: "lightens body — minimal flavour" },
  { slug: "torrified-wheat", label: "Torrified wheat", intensity: 0.5, typicalColorLovibond: 2, flavor: mf({ grainy: 1.5 }) },

  // Flavour-significant specialty (non-grain) — included because they move the vector
  { slug: "dark-candi-syrup", label: "Belgian dark candi syrup", intensity: 4, typicalColorLovibond: 180, flavor: mf({ darkFruit: 3, caramel: 2, chocolate: 1 }), note: "type: sugar; strong dark-fruit/caramel character. Compiled from general brewing consensus — not Mallett-validated" },
  { slug: "smoked-malt", label: "Smoked / Rauch malt", intensity: 1.0, typicalColorLovibond: 3, flavor: mf({ grainy: 1.5, biscuit: 1 }), note: "smoke/rauch character is NOT captured by these axes — flag downstream" },
];

export const MALT_ARCHETYPES_BY_SLUG: Map<string, MaltArchetype> = new Map(
  MALT_ARCHETYPES.map((a) => [a.slug, a])
);

export const MALT_ARCHETYPE_SLUGS: string[] = MALT_ARCHETYPES.map((a) => a.slug);

export function getMaltArchetype(slug: string): MaltArchetype | undefined {
  return MALT_ARCHETYPES_BY_SLUG.get(slug);
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Core math, on already-resolved components. Mirrors
 * HopFlavorCalculationService.calculateCombinedFlavor:
 *   - fraction_i = amount_i / Σamount            (normalise to % of grist)
 *   - w_i        = intensity_i * fraction_i      (potency-weighted amount)
 *   - axisSum[k] = Σ w_i * (flavor_i[k] / 5)
 *   - W          = Σ w_i
 *   - M          = 5 * (1 - exp(-LAMBDA * W))    (saturating magnitude)
 *   - result[k]  = clamp( M * axisSum[k] / W )
 *
 * Scale-invariant (depends on proportions, not absolute weights). Components with
 * amount <= 0 are ignored. Empty / all-zero input → all-zero profile.
 */
export function aggregateMaltFlavorFrom(
  items: Array<{ flavor: MaltFlavorProfile; intensity: number; amount: number }>
): MaltFlavorProfile {
  let total = 0;
  for (const it of items) if (it.amount > 0) total += it.amount;
  if (total <= 0) return mf();

  let overallWeight = 0;
  const axisSum: MaltFlavorProfile = mf();
  for (const it of items) {
    if (it.amount <= 0) continue;
    const fraction = it.amount / total;
    const weight = it.intensity * fraction;
    if (weight <= 0) continue;

    overallWeight += weight;
    for (const k of MALT_FLAVOR_KEYS) {
      axisSum[k] += weight * ((it.flavor[k] || 0) / 5);
    }
  }

  if (overallWeight <= 0) return mf();

  const magnitude = 5 * (1 - Math.exp(-MALT_INTENSITY_LAMBDA * overallWeight));
  const result: MaltFlavorProfile = mf();
  for (const k of MALT_FLAVOR_KEYS) {
    result[k] = clamp(magnitude * (axisSum[k] / overallWeight));
  }
  return result;
}

/**
 * Estimate the combined malt flavour for a grist expressed as archetype slugs +
 * amounts (any positive weight unit; normalised internally). Unknown slugs are
 * skipped (same defensive behaviour as the hop service skipping unknown hops).
 */
export function aggregateMaltFlavor(
  items: Array<{ archetype: string; amount: number }>
): MaltFlavorProfile {
  const resolved: Array<{ flavor: MaltFlavorProfile; intensity: number; amount: number }> = [];
  for (const it of items) {
    const arch = MALT_ARCHETYPES_BY_SLUG.get(it.archetype);
    if (!arch) continue;
    resolved.push({ flavor: arch.flavor, intensity: arch.intensity, amount: it.amount });
  }
  return aggregateMaltFlavorFrom(resolved);
}

// ── Body / mouthfeel ─────────────────────────────────────────────────────────
//
// Some grains carry little/no FLAVOUR but a real MOUTHFEEL role — this is where
// dextrine (Carapils), flaked oats/wheat/barley and rye earn their place, and
// where rice/corn/sugar register as body-THINNING. It is a separate scalar
// feature, NOT one of the 8 flavour axes.
//
// In the recipe pipeline the full "body" feature combines residual gravity (FG —
// which already captures dextrins / crystal / low attenuation) with THIS grist
// signal, which captures the protein/β-glucan viscosity that FG misses (oats,
// wheat, barley) and the dilution sugars/rice add.
//
// Relative, dimensionless, neutral baseline 0 (base & toasted malts). May be
// negative. Roughly LINEAR in grist fraction (unlike flavour — no saturation).
export const MALT_BODY_CONTRIBUTION: Record<string, number> = {
  // adds body
  dextrine: 1.0,
  "flaked-oats": 1.0,
  "flaked-barley": 0.8,
  "flaked-wheat": 0.7,
  "torrified-wheat": 0.6,
  "wheat-malt": 0.6,
  "rye-malt": 0.5,
  "crystal-light": 0.3,
  "crystal-medium": 0.3,
  "crystal-dark": 0.3,
  "special-b": 0.3,
  "chocolate-malt": 0.1,
  "pale-chocolate": 0.1,
  "carafa-dehusked": 0.1,
  "black-malt": 0.1,
  "roasted-barley": 0.1,
  // thins body
  "flaked-corn": -0.4,
  "dark-candi-syrup": -0.3,
  "flaked-rice": -0.6,
  // simple sugars: no malt flavour, thin the body (matcher tags "sugar" / "honey-sugar").
  sugar: -0.5,
  "honey-sugar": -0.4,
  // lactose: UNFERMENTABLE milk sugar — adds body & sweetness (matcher tag "lactose").
  lactose: 0.5,
};

/**
 * Grist-side body/mouthfeel signal: a fraction-weighted sum of per-archetype body
 * contributions (default 0 for base malts and unknown slugs). Linear in grist
 * fraction. Combine with FG at the recipe level for the full body feature.
 */
export function aggregateMaltBody(
  items: Array<{ archetype: string; amount: number }>
): number {
  let total = 0;
  for (const it of items) if (it.amount > 0) total += it.amount;
  if (total <= 0) return 0;

  let body = 0;
  for (const it of items) {
    if (it.amount <= 0) continue;
    const contribution = MALT_BODY_CONTRIBUTION[it.archetype] ?? 0;
    body += contribution * (it.amount / total);
  }
  return body;
}
