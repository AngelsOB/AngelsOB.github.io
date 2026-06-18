import { hsTokens } from "@/modules/builder/tokens";
import type { GlyphKind } from "@/modules/builder/components/Glyph";

// ─────────────────────────────────────────────────────────────────────────
// Calculator metadata — the single source of truth for the /calculators
// section. PURE DATA: no React components, so this module is safe to import
// anywhere (the client sidebar, the sitemap, the learn cross-link resolver).
//
// The component wiring (the live calculator + the article body) lives in the
// sibling `calculatorsConfig.tsx`, which merges these entries with components.
// ─────────────────────────────────────────────────────────────────────────

export interface CalculatorFaq {
  q: string;
  a: string;
}

export interface CalculatorQuickAnswer {
  /** Plain-language answer, front-loaded and liftable by answer engines. */
  answer: string;
  /** Plain-text formula (not LaTeX) — kept extractable. */
  formula?: string;
  /** One-line worked example. */
  example?: string;
}

export interface CalculatorHowTo {
  name: string;
  steps: string[];
}

export interface CalculatorMeta {
  slug: string;
  // Sidebar + hub catalog
  eyebrow: string;
  /** Short label used in the card header + sidebar (was CALC_META.title). */
  label: string;
  category: string;
  accent: string;
  glyph: GlyphKind;
  blurb: string;
  // Page hero
  h1: string;
  tagline: string;
  // <head> metadata
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  // SEO/AEO body content
  quickAnswer: CalculatorQuickAnswer;
  howTo: CalculatorHowTo;
  faq: CalculatorFaq[];
  // SoftwareApplication schema
  appName: string;
  appDescription: string;
  // Cross-links (hrefs to sibling calcs and concept articles)
  related: string[];
}

export const CALCULATORS_META: CalculatorMeta[] = [
  {
    slug: "abv",
    eyebrow: "ABV",
    label: "Alcohol by volume",
    category: "Gravity & ABV",
    accent: hsTokens.malt,
    glyph: "drop",
    blurb: "From original and final gravity.",
    h1: "ABV Calculator",
    tagline: "How strong is your beer?",
    metaTitle: "ABV Calculator: Alcohol by Volume",
    metaDescription:
      "Free ABV calculator. Enter original and final gravity to estimate alcohol by volume, with the formula and a worked example.",
    keywords: [
      "ABV calculator",
      "alcohol by volume",
      "OG FG calculator",
      "homebrew ABV",
      "gravity to ABV",
      "beer alcohol calculator",
    ],
    quickAnswer: {
      answer:
        "Take the gravity drop and multiply by 131.25.",
      formula: "ABV % = (OG − FG) × 131.25",
      example: "OG 1.052, FG 1.012 → (0.040 × 131.25) = 5.25% ABV",
    },
    howTo: {
      name: "How to calculate ABV from gravity",
      steps: [
        "Measure original gravity (OG) before pitching yeast.",
        "Measure final gravity (FG) once fermentation finishes.",
        "Subtract FG from OG to get the gravity drop.",
        "Multiply the gravity drop by 131.25 for approximate ABV %.",
      ],
    },
    faq: [
      {
        q: "How do you calculate ABV from OG and FG?",
        a: "ABV ≈ (OG − FG) × 131.25. A beer that drops from 1.052 to 1.012 is about 5.25% ABV. The constant 131.25 converts the specific-gravity drop into percent alcohol by volume.",
      },
      {
        q: "Why is the constant 131.25?",
        a: "It comes from the relationship between the sugar fermented and the ethanol produced. 131.25 is the standard multiplier that turns a gravity drop into ABV for normal-strength beer; you'll also see 131 or 132 used.",
      },
      {
        q: "Is the simple ABV formula accurate?",
        a: "For beers under about 1.080 OG it's accurate to within roughly 0.1% ABV. Above that the gravity-to-alcohol relationship curves, so big beers like imperial stouts and barleywines read slightly low; formulas such as Cutaia's are more accurate there.",
      },
      {
        q: "What's the difference between ABV and ABW?",
        a: "ABV is alcohol by volume; ABW is alcohol by weight. Because ethanol is less dense than water, ABW ≈ ABV × 0.79. Homebrew and commercial labels use ABV.",
      },
      {
        q: "Do I need to temperature-correct my gravity first?",
        a: "Yes, if your sample isn't at the hydrometer's calibration temperature. Correct the reading first with the hydrometer correction calculator, then use the corrected OG and FG here.",
      },
    ],
    appName: "ABV Calculator",
    appDescription:
      "Free ABV calculator for homebrewers. Enter original and final gravity to estimate alcohol by volume.",
    related: ["/calculators/hydrometer", "/learn/gravity"],
  },
  {
    slug: "ibu",
    eyebrow: "IBU",
    label: "Bitterness, Tinseth style",
    category: "Hops & bitterness",
    accent: hsTokens.hops,
    glyph: "hop",
    blurb: "Sum of hop additions with isomerization.",
    h1: "IBU Calculator",
    tagline: "How bitter will it taste?",
    metaTitle: "IBU Calculator (Tinseth): Hop Bitterness",
    metaDescription:
      "Free IBU calculator using the Tinseth model. Estimate bitterness from boil, whirlpool, first-wort, mash, and dry-hop additions.",
    keywords: [
      "IBU calculator",
      "tinseth calculator",
      "hop bitterness calculator",
      "whirlpool IBU",
      "dry hop IBU",
      "homebrew IBU",
    ],
    quickAnswer: {
      answer:
        "Each hop's bitterness, summed by the Tinseth model. More alpha acid and boil time raise it; higher gravity lowers it.",
      formula: "IBU = Σ (weight × alpha-acid% × utilization × 75) ÷ volume",
      example:
        "1 oz Cascade (7% AA), 60 min, 5 gal of 1.050 wort → about 24 IBU",
    },
    howTo: {
      name: "How to estimate IBU",
      steps: [
        "Enter your batch volume and boil gravity (OG).",
        "Add each hop: variety, alpha-acid %, weight, time, and type (boil, whirlpool, first wort, mash, or dry hop).",
        "The calculator applies the Tinseth utilization for each addition and sums them.",
        "Compare the total against your target style range.",
      ],
    },
    faq: [
      {
        q: "What is the Tinseth formula?",
        a: "Tinseth (1995) estimates hop utilization from wort gravity (higher gravity lowers extraction) and boil time (longer boils extract more, with diminishing returns past about 60 minutes). IBU = weight × alpha-acid% × utilization × 75 ÷ volume.",
      },
      {
        q: "Do whirlpool and hop-stand additions add IBU?",
        a: "Yes. Isomerization slows but doesn't stop below boiling. We scale the Tinseth utilization by a temperature factor — roughly 29% of the boil rate at 80°C, dropping to zero below about 60°C.",
      },
      {
        q: "Do dry hops add bitterness?",
        a: "A little. Humulinones formed during pellet processing dissolve without heat and add measurable bitterness — a heavy dry hop (about 8 g/L at 12% AA) adds roughly 12 IBU. We model the humulinone contribution plus a small amount of non-isomerized alpha acid.",
      },
      {
        q: "What IBU should my beer be?",
        a: "It depends on style: a light lager sits near 8–12 IBU, an American pale ale 30–45, a West Coast IPA 50–70+. Perceived bitterness is also balanced by malt sweetness, so the same IBU tastes different at different gravities.",
      },
      {
        q: "Why don't my IBUs match another calculator?",
        a: "Calculators use different utilization models (Tinseth vs Rager vs Garetz) and different assumptions for whirlpool and dry-hop bitterness. We use Tinseth for the boil and add explicit whirlpool, first-wort, mash, and dry-hop handling, so totals can differ by several IBU.",
      },
    ],
    appName: "IBU Calculator",
    appDescription:
      "Free IBU calculator using the Tinseth model, with whirlpool, first-wort, mash, and dry-hop bitterness.",
    related: ["/learn/ibu", "/learn/hop-flavor", "/calculators/abv"],
  },
  {
    slug: "boil-off",
    eyebrow: "Boil-off",
    label: "Boil-off / target OG",
    category: "Boil & volume",
    accent: hsTokens.roast,
    glyph: "flame",
    blurb: "Volume to boil down to the OG you want.",
    h1: "Boil-Off Calculator",
    tagline: "How much volume you'll lose, and when to stop boiling",
    metaTitle: "Boil-Off Calculator: Pre-Boil to Post-Boil Volume",
    metaDescription:
      "Calculate post-boil volume and the boil time to hit your target OG. Same gravity-point conservation as dilution, in reverse.",
    keywords: [
      "boil off calculator",
      "pre boil gravity",
      "post boil volume",
      "boil time calculator",
      "target OG calculator",
    ],
    quickAnswer: {
      answer:
        "Water boils off but sugar stays, so gravity climbs as volume drops.",
      formula: "V_post = V_pre × G_pre ÷ G_target",
      example: "27 L at 1.040, target 1.050 → about 21.6 L post-boil",
    },
    howTo: {
      name: "How to calculate boil-off and post-boil volume",
      steps: [
        "Measure your pre-boil volume and pre-boil gravity.",
        "Set your target OG.",
        "The calculator conserves gravity points to find the post-boil volume.",
        "Optionally enter your kettle's boil-off rate (L/hr) to get the boil time needed.",
      ],
    },
    faq: [
      {
        q: "How do I calculate post-boil gravity?",
        a: "Gravity points are conserved during the boil, so post-boil gravity rises as volume falls. Concentrating 27 L of 1.040 down to about 21.6 L gives roughly 1.050.",
      },
      {
        q: "What is a typical boil-off rate?",
        a: "Most homebrew kettles evaporate 3–5 L/hr (about 1–1.5 gal/hr) depending on burner power, kettle width, and how vigorous the boil is. Measure yours once and reuse it.",
      },
      {
        q: "How do I hit a target OG if I overshoot or undershoot?",
        a: "Boil longer or harder to raise gravity, or add water to lower it. This calculator gives the post-boil volume for your target; the dilution calculator handles adding water.",
      },
      {
        q: "Do hops and trub affect my volume?",
        a: "Slightly — break material and hops trap some wort. Account for that as kettle and hop losses when planning your pre-boil volume; this calculator works on the wort volume itself.",
      },
    ],
    appName: "Boil-Off Calculator",
    appDescription:
      "Calculate post-boil volume and boil time from pre-boil measurements and a target OG.",
    related: ["/calculators/dilution", "/learn/gravity"],
  },
  {
    slug: "dilution",
    eyebrow: "Dilution",
    label: "Wort dilution",
    category: "Boil & volume",
    accent: hsTokens.water,
    glyph: "water",
    blurb: "Water to add to drop into spec.",
    h1: "Dilution Calculator",
    tagline: "How much water to add when your gravity is too high",
    metaTitle: "Dilution Calculator: Hit Your Target Gravity",
    metaDescription:
      "Calculate how much water to add to hit your target gravity. Exact gravity-point conservation, no guesswork.",
    keywords: [
      "dilution calculator",
      "gravity dilution",
      "water addition brewing",
      "lower gravity calculator",
      "sparge calculator",
    ],
    quickAnswer: {
      answer:
        "Water spreads the same sugar over more volume. Add the gap between your current and target volume.",
      formula: "V_total = V_current × G_current ÷ G_target",
      example: "20 L at 1.060, target 1.050 → 24 L total, so add 4 L water",
    },
    howTo: {
      name: "How to calculate water for dilution",
      steps: [
        "Measure your current volume and gravity.",
        "Set the target gravity you want.",
        "The calculator conserves gravity points to find the total volume.",
        "Add the difference between total and current volume as water.",
      ],
    },
    faq: [
      {
        q: "How much water do I add to lower gravity?",
        a: "Water to add = current volume × (current points ÷ target points − 1). For 20 L at 1.060 aiming for 1.050: 20 × (60/50 − 1) = 4 L.",
      },
      {
        q: "Is dilution exact or an estimate?",
        a: "It's exact for gravity, because it's conservation of sugar (gravity points). The only real-world fudge is that volumes aren't perfectly additive, and that error is negligible at homebrew scale.",
      },
      {
        q: "Can I dilute after fermentation?",
        a: "You can, but diluting finished beer also waters down flavor, bitterness, and carbonation. It's usually better to correct gravity before or during the boil.",
      },
      {
        q: "What if my gravity is too low instead?",
        a: "You can't dilute up. Boil longer to evaporate water (see the boil-off calculator) or add dry or liquid malt extract to raise gravity.",
      },
    ],
    appName: "Dilution Calculator",
    appDescription:
      "Calculate how much water to add to hit your target gravity.",
    related: ["/calculators/boil-off", "/learn/gravity"],
  },
  {
    slug: "carbonation",
    eyebrow: "Carbonation",
    label: "Force carbonation",
    category: "Packaging",
    accent: hsTokens.water,
    glyph: "water",
    blurb: "Regulator PSI for a target CO₂ volume.",
    h1: "Carbonation Calculator",
    tagline: "The right pressure for the right fizz",
    metaTitle: "Carbonation Calculator: PSI for Your CO₂ Volumes",
    metaDescription:
      "Find the keg pressure for your target CO₂ volumes at serving temperature. Instant PSI and bar from the CO₂ solubility curve.",
    keywords: [
      "carbonation calculator",
      "CO2 volumes",
      "keg PSI calculator",
      "force carbonation",
      "beer carbonation chart",
    ],
    quickAnswer: {
      answer:
        "Cold beer holds CO₂ more easily, so colder beer needs less pressure for the same fizz. About 2.5 volumes at 4°C is ~12 PSI.",
      example: "2.5 volumes at 4°C (39°F) ≈ 12 PSI",
    },
    howTo: {
      name: "How to force carbonate a keg",
      steps: [
        "Choose your target CO₂ volumes for the style.",
        "Enter your keg/serving temperature.",
        "The calculator solves the CO₂ solubility curve for the equilibrium pressure.",
        "Set your regulator to that PSI and let the keg equilibrate for several days.",
      ],
    },
    faq: [
      {
        q: "What PSI should I set for kegging?",
        a: "It depends on temperature and target carbonation. At a typical 3–4°C keg, most ales at 2.4–2.5 volumes sit around 10–12 PSI. Colder beer needs less pressure for the same fizz.",
      },
      {
        q: "How many CO₂ volumes for my style?",
        a: "British and cask ales 1.5–2.0, most American ales and lagers 2.2–2.7, Belgian ales and saisons 2.7–3.5, German wheat beers 3.5–4.5.",
      },
      {
        q: "How long does force carbonation take?",
        a: "Set-and-forget at serving pressure takes about 1–2 weeks to equilibrate. Higher-pressure or shake methods are faster (a few days) but easier to over-carbonate.",
      },
      {
        q: "Does this work for bottle conditioning?",
        a: "No — this is for force carbonation with a CO₂ tank. Bottle priming uses a measured amount of sugar instead, which is a separate calculation.",
      },
    ],
    appName: "Carbonation Calculator",
    appDescription:
      "Find the right keg PSI for your desired CO₂ volumes at serving temperature.",
    related: ["/calculators/abv", "/learn/gravity"],
  },
  {
    slug: "hydrometer",
    eyebrow: "Hydrometer",
    label: "Hydrometer correction",
    category: "Gravity & ABV",
    accent: hsTokens.yeast,
    glyph: "drop",
    blurb: "Adjust a warm reading to calibrated temp.",
    h1: "Hydrometer Correction Calculator",
    tagline: "Because your sample is never the right temperature",
    metaTitle: "Hydrometer Temperature Correction Calculator",
    metaDescription:
      "Correct a gravity reading for sample temperature using the Kell (1975) water-density equation. Get the true OG or FG.",
    keywords: [
      "hydrometer correction calculator",
      "hydrometer temperature correction",
      "gravity reading correction",
      "hydrometer calibration",
      "wort temperature gravity",
    ],
    quickAnswer: {
      answer:
        "Hydrometers only read true at their calibration temperature. Warm samples read low, cold samples read high. This corrects for it.",
      formula: "SG_corrected = SG_measured × ρ(T_sample) ÷ ρ(T_calibration)",
      example: "1.050 read at 30°C (calibrated 20°C) → about 1.052",
    },
    howTo: {
      name: "How to correct a hydrometer reading for temperature",
      steps: [
        "Read your gravity and note the sample temperature.",
        "Set your hydrometer's calibration temperature (usually 20°C or 15.5°C).",
        "The calculator compares water density at both temperatures (Kell 1975).",
        "Use the corrected gravity for your OG, FG, and ABV math.",
      ],
    },
    faq: [
      {
        q: "Why does temperature change a hydrometer reading?",
        a: "Hydrometers measure density, and water expands as it warms. A sample hotter than the calibration temperature is less dense, so the hydrometer floats lower and reads low; a colder sample reads high.",
      },
      {
        q: "How much does temperature affect gravity?",
        a: "Near the calibration point the effect is small, but it grows with the gap: at 30°C a 1.050 reading is really about 1.052, and at 40°C it's off by roughly 4 points. Hot wort and very cold beer need correction.",
      },
      {
        q: "What calibration temperature should I use?",
        a: "Use whatever is printed on your hydrometer — commonly 20°C (68°F) or 15.5°C (60°F). Choosing the wrong calibration temperature introduces a constant offset.",
      },
      {
        q: "Do refractometers need the same correction?",
        a: "No. Refractometers have their own temperature behavior and need an alcohol/wort correction after fermentation. This calculator is for hydrometers.",
      },
    ],
    appName: "Hydrometer Correction Calculator",
    appDescription:
      "Correct gravity readings for sample temperature differences using the Kell (1975) density equation.",
    related: ["/calculators/abv", "/learn/gravity"],
  },
  {
    slug: "strike-temp",
    eyebrow: "Strike temp",
    label: "Strike water temperature",
    category: "Mash & water",
    accent: hsTokens.roast,
    glyph: "flame",
    blurb: "Hit your target mash temp first try.",
    h1: "Strike Water Temperature Calculator",
    tagline: "Hit your mash temp on the first pour",
    metaTitle: "Strike Water Temperature Calculator",
    metaDescription:
      "Calculate strike water temperature from target mash temp, grain temp, and mash thickness using Palmer's heat-balance equation.",
    keywords: [
      "strike water temperature calculator",
      "strike temp homebrewing",
      "mash infusion temperature",
      "how to calculate strike water",
      "Palmer strike temperature",
    ],
    quickAnswer: {
      answer:
        "Cold grain steals heat, so strike water starts hotter than your mash target. Thicker mash and colder grain need it hotter still.",
      formula: "T_strike = T_mash + (0.41 ÷ thickness) × (T_mash − T_grain)",
      example: "Target 67°C, grain 20°C, 3.0 L/kg → 73.4°C strike water",
    },
    howTo: {
      name: "How to calculate strike water temperature",
      steps: [
        "Set your target mash temperature.",
        "Measure or estimate your grain temperature.",
        "Enter your mash thickness in liters of water per kg of grain.",
        "The calculator applies Palmer's heat-balance equation to give the strike temperature.",
      ],
    },
    faq: [
      {
        q: "How do you calculate strike water temperature?",
        a: "Palmer's heat balance: T_strike = T_mash + (0.41 ÷ r) × (T_mash − T_grain), where r is mash thickness in L/kg. The 0.41 is grain's heat capacity relative to water.",
      },
      {
        q: "Why does strike water need to be hotter than the mash?",
        a: "Grain enters cold and absorbs heat from the water until everything equilibrates. The water has to start above target so the mixture settles at your mash temperature.",
      },
      {
        q: "What mash thickness should I use?",
        a: "2.0–2.5 L/kg is a thick, traditional mash; 2.5–3.5 L/kg is the standard single-infusion range; 3.5–4.5 L/kg is thin and typical for brew-in-a-bag. Thinner mashes are more temperature-stable.",
      },
      {
        q: "Does grain temperature really matter?",
        a: "Yes — grain at 5–10°C in a cold garage versus 22°C in a warm kitchen can shift the strike temperature by several degrees. Measure it in winter rather than assuming room temperature.",
      },
      {
        q: "How do I hit later mash steps?",
        a: "Step mashes raise temperature by infusing boiling water or applying direct heat, which is a different calculation. This covers the initial infusion; the recipe builder handles step infusions automatically.",
      },
    ],
    appName: "Strike Water Temperature Calculator",
    appDescription:
      "Free strike water temperature calculator using Palmer's heat-balance equation.",
    related: ["/learn/mash-temperature", "/learn/mash-ph", "/calculators/abv"],
  },
];

// ─── Derived helpers ───────────────────────────────────────────────────────

export const calculatorSlugs = CALCULATORS_META.map((c) => c.slug);

export function getCalculatorMeta(slug: string): CalculatorMeta | null {
  return CALCULATORS_META.find((c) => c.slug === slug) ?? null;
}

/** Ordered categories for the shared sidebar (mirrors the old CATEGORIES). */
export const CALCULATOR_CATEGORIES: {
  label: string;
  slugs: string[];
  accent: string;
}[] = [
  { label: "Gravity & ABV", slugs: ["abv", "hydrometer"], accent: hsTokens.malt },
  { label: "Hops & bitterness", slugs: ["ibu"], accent: hsTokens.hops },
  { label: "Boil & volume", slugs: ["boil-off", "dilution"], accent: hsTokens.water },
  { label: "Mash & water", slugs: ["strike-temp"], accent: hsTokens.roast },
  { label: "Packaging", slugs: ["carbonation"], accent: hsTokens.yeast },
];

/**
 * Calculator pages exposed as {href, label, description} so the learn-article
 * related-links resolver can cross-link to them (they live outside docsConfig).
 */
export const calculatorLearnLinks = CALCULATORS_META.map((c) => ({
  href: `/calculators/${c.slug}`,
  label: c.h1,
  description: c.blurb,
}));

export function resolveCalculatorLink(href: string) {
  return calculatorLearnLinks.find((l) => l.href === href) ?? null;
}
