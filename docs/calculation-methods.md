# Calculation Methods & Scientific Sources

An audit of every brewing calculation in this app — where each formula comes from, how it compares to other calculators, and where the science may need improvement.

Each section includes a **Validation** verdict:
- **Correct** — matches published science and industry standard
- **Acceptable** — reasonable approximation, minor deviations from ideal
- **Needs Review** — scientifically questionable or inconsistent with other implementations

---

## Table of Contents

1. [Original Gravity (OG)](#1-original-gravity-og)
2. [Final Gravity (FG) & Attenuation](#2-final-gravity-fg--attenuation)
3. [Alcohol by Volume (ABV)](#3-alcohol-by-volume-abv)
4. [Bitterness (IBU) — Tinseth Model](#4-bitterness-ibu--tinseth-model)
5. [Color (SRM) — Morey Equation](#5-color-srm--morey-equation)
6. [Calories & Carbohydrates — Balling Formula](#6-calories--carbohydrates--balling-formula)
7. [Mash pH — Proton Deficit Model](#7-mash-ph--proton-deficit-model)
8. [Water Chemistry — Stoichiometric Ion Calculations](#8-water-chemistry--stoichiometric-ion-calculations)
9. [Yeast Starter — White & Braukaiser Models](#9-yeast-starter--white--braukaiser-models)
10. [Water Volumes & Strike Temperature](#10-water-volumes--strike-temperature)
11. [Mash Schedule — Heat Balance Equations](#11-mash-schedule--heat-balance-equations)
12. [Hop Flavor Profile](#12-hop-flavor-profile)
13. [Brew Session Metrics](#13-brew-session-metrics)
14. [Standalone Calculators](#14-standalone-calculators)
15. [Known Issues & Discrepancies](#15-known-issues--discrepancies)

---

## 1. Original Gravity (OG)

**Method:** Points-Per-Gallon (PPG) gravity model
**Source:** Standard homebrew gravity calculation. Used identically by BeerSmith, Brewfather, Brewer's Friend, and described in John Palmer's *How to Brew* (Brewers Publications, 4th ed. 2017).
**Validation: Correct**

**Formula:**

```
OG = 1 + Σ(PPG × weight_lbs × efficiency) / (batch_volume_gal × 1000)
```

Each fermentable has a PPG value — the number of gravity points one pound of that ingredient contributes to one gallon of water. For example, 2-Row malt has a PPG of ~37, meaning 1 lb in 1 gallon yields a gravity of 1.037.

Mash efficiency is applied uniformly to all fermentables, accounting for how effectively sugars are extracted during the mash and transferred to the kettle.

**Comparison:** This is the universal approach. BeerSmith, Brewfather, and Brewer's Friend all use this identical formula. No calculator uses a different gravity model.

---

## 2. Final Gravity (FG) & Attenuation

**Method:** Two-layer attenuation model (custom)
**Source:** Layer 1 (per-ingredient fermentability) is standard practice in all major calculators. Layer 2 (effective attenuation adjustments) is a custom model with factors drawn from multiple sources of varying rigor.
**Validation: Needs Review** — several adjustment factors are scientifically questionable

### Layer 1 — Per-Ingredient Fermentability

**Validation: Correct**

Each fermentable has a fermentability value (0–1) representing how much of its sugar is fermentable by yeast:

- Standard base malt: ~0.95 (95% fermentable)
- Lactose: 0 (completely unfermentable)
- Honey: ~1.0 (fully fermentable)

The gravity contribution from each ingredient is split into fermentable and non-fermentable portions. Only the fermentable portion is reduced by yeast attenuation.

This approach matches BeerSmith and Brewfather, which both track per-ingredient fermentability.

### Layer 2 — Effective Attenuation

Starting from the yeast's stated base attenuation (typically 0.75 for a standard ale yeast), adjustments are applied for process conditions:

| Factor | Adjustment | Source | Validation |
|--------|-----------|--------|------------|
| **Mash temperature** | ~1% attenuation per °C from 66°C reference | Braukaiser mash temp studies | **Acceptable** — Braukaiser measured ~1.1%/°C; BeerSmith uses a similar model |
| **Decoction mash** | +0.5% per minute of decoction step | No published source | **Needs Review** — see issues below |
| **Mash duration** | ±0.5% per 15 min from 60 min reference (capped ±3%) | General brewing science | **Acceptable** — direction is correct, enzyme activity is time-dependent |
| **Fermentation temperature** | +0.4% per °C above 20°C | No published source | **Needs Review** — see issues below |
| **Fermentation duration** | +0.2% per day above 10-day reference | No published source | **Incorrect** — see issues below |

**Final formula:**

```
FG = 1 + (nonFermentablePts + fermentablePts × (1 − effectiveAttenuation)) / 1000
```

Effective attenuation is clamped to [60%, 95%].

### Issues Identified

**Fermentation duration (+0.2%/day):** This is physically wrong. Fermentation has a terminal gravity — the point at which all fermentable sugars have been consumed. Once the yeast has eaten everything it can, no amount of additional time will lower the gravity further. A 30-day fermentation does not produce a lower FG than a 14-day fermentation if the yeast reached terminal gravity on day 7. The linear, unbounded adjustment implies that fermenting for 60 days would add +10% attenuation over 10 days, which is not how fermentation works. This factor should either be removed entirely or replaced with a diminishing-returns curve that asymptotically approaches zero additional attenuation (e.g., logarithmic). Neither BeerSmith nor Brewfather apply a fermentation duration adjustment — they use the yeast's stated attenuation directly.

**Decoction bonus (+0.5%/min):** This is far too large. A 15-minute decoction step would add +7.5% attenuation, which is enormous. Brulosophy exBEERiments have found no statistically significant difference in attenuation between decoction and infusion mashes. The traditional claim is that decoction produces more fermentable wort by gelatinizing starches and denaturing proteins, but modern fully-modified malts don't benefit from this. If kept at all, the bonus should be much smaller (perhaps +1-2% total, not per minute) or applied only when using undermodified malts. Neither BeerSmith nor Brewfather model a decoction attenuation bonus.

**Fermentation temperature (+0.4%/°C):** The direction is correct — higher fermentation temperatures do increase yeast metabolism and can produce slightly lower terminal gravities. However, +0.4% per degree is uncapped beyond the [60%, 95%] clamp. At 30°C (an aggressive Belgian ale temp), this adds +4% attenuation over the 20°C baseline, which is plausible. But at very high temps the yeast would produce excessive off-flavors and potentially die, not attenuate further. The effect should probably cap around 25°C for most strains. Neither BeerSmith nor Brewfather model fermentation temperature effects on attenuation.

**Mash temperature (1%/°C):** The direction and magnitude are reasonable. Braukaiser's research shows that mashing at 64°C vs 70°C can produce a ~6% difference in apparent attenuation, which aligns with ~1%/°C. The reference point of 66°C is good (standard saccharification rest). This is the strongest factor in the model. BeerSmith applies a similar mash-temperature adjustment using a slightly different curve.

**Sources:**
- Kai Troester, "The Effect of Mash Parameters on Fermentability" — braukaiser.com
- White & Zainasheff, *Yeast* (Brewers Publications, 2010) — fermentation kinetics
- Brulosophy, "Decoction vs. Infusion exBEERiment" — brulosophy.com
- BeerSmith, "Understanding Attenuation" — beersmith.com/blog

---

## 3. Alcohol by Volume (ABV)

**Method:** Standard linear approximation
**Source:** Derived from the Balling equation. The constant 131.25 appears in numerous homebrew references and is used by BeerSmith, Brewfather, Brewer's Friend, and most homebrew calculators.
**Validation: Correct** for beers under ~1.080 OG

**Formula:**

```
ABV = (OG − FG) × 131.25
```

This linear approximation works well for normal-strength beers. For very high-gravity beers (OG > 1.080), more accurate alternatives exist:

- **Cutaia alternative:** `ABV = (76.08 × (OG − FG) / (1.775 − OG)) × (FG / 0.794)` — accounts for the non-linear relationship between gravity drop and alcohol production at high gravities
- **Balling-based:** Uses the Real Extract calculation (see Nutrition section) for higher accuracy

Most homebrew calculators use the simple 131.25 formula. BeerSmith offers both the simple and alternative formulas. Brewfather uses the simple formula.

**Source:** The 131.25 constant is a simplification of `100 × (OG − FG) / (1.775 − OG) × (FG / 0.794)` evaluated near OG ≈ 1.050. See Hall, "Brew By The Numbers," *Zymurgy* (1995).

---

## 4. Bitterness (IBU) — Tinseth Model

**Method:** Tinseth isomerization model with extensions for whirlpool, dry hop, mash, and first wort additions
**Source:** Glenn Tinseth, hop utilization research (1995–1999), originally published at realbeer.com/hops/research.html
**Validation: Correct** (core formula) / **Needs Review** (some extensions)

### Core Tinseth Formula (Boil Additions)

**Validation: Correct**

```
IBU = (AAU × utilization × 74.89) / batch_volume_gal

Where:
  AAU = weight_oz × alpha_acid_%
  utilization = gravityFactor × timeFactor
  gravityFactor = 1.65 × 0.000125^(wortGravity − 1)
  timeFactor = (1 − e^(−0.04 × minutes)) / 4.15
```

The four constants (1.65, 0.000125, -0.04, 4.15) are confirmed from Tinseth's original publication. Tinseth notes that 4.15 is the most system-dependent constant and may be adjusted to match individual brewing systems.

Our code uses 75 instead of the precise 74.89 — this is a common rounding. The difference is ~0.15%, well within the model's overall uncertainty. The precise derivation: 1 oz = 28.3495g, 1 gal = 3.78541L, so 28.3495/3.78541 × 10 = 74.89.

**Comparison:** BeerSmith, Brewfather, and Brewer's Friend all offer Tinseth as the default IBU model with identical constants.

### First Wort Hops (FWH)

**Validation: Needs Review** — inconsistent between our two implementations

The main recipe service (`RecipeCalculationService.ts`) uses:
```
utilization = tinseth(boilTime + 20 minutes)
```

The standalone calculator (`ibu.ts`) uses:
```
utilization = tinseth(boilTime) × 1.10
```

The foundational study is Preis, Mitter & Steiner, "The Re-Discovery of First Wort Hopping" (*Brauwelt International*, 1995). They found FWH beers had ~10% more IBUs than conventionally hopped beers, with a smoother perceived bitterness.

**BeerSmith** uses a flat ×1.10 multiplier. **Brewfather** treats FWH as equal to the full boil time with no additional boost.

The `+20 minutes` approach produces inconsistent results: for a 60-minute boil it adds ~10-12% IBU, but for a 90-minute boil only ~5%, and for a 30-minute boil ~18%. The ×1.10 multiplier is more faithful to the empirical research.

**Source:** Preis, Mitter & Steiner, *Brauwelt International* (1995); BeerSmith documentation

### Whirlpool / Hop Stand

**Validation: Acceptable** — decent approximation of the Arrhenius model

```
tempFactor = ((clampedTemp − 60) / 40)^1.8    [for temps 60–100°C]
utilization = tinsethUtilization × tempFactor
```

The scientifically grounded approach is the **Arrhenius equation** used in the Alchemy Overlord mIBU model:
```
Urel(T) = 2.39 × 10¹¹ × exp(−9773 / T_kelvin)
```

Comparing the two models at key temperatures:

| Temp | Our Power Curve | Arrhenius (mIBU) | Difference |
|------|----------------|------------------|------------|
| 100°C | 1.00 | 1.00 | — |
| 90°C | 0.57 | 0.50 | +14% |
| 80°C | 0.25 | 0.24 | +4% |
| 70°C | 0.057 | 0.10 | -43% |
| 60°C | 0.00 | 0.04 | -100% |

Our model is reasonably close in the 80-100°C range where most whirlpools happen. It diverges below 70°C, but utilization is negligible there anyway. The 60°C cutoff is conservative — the Arrhenius model shows some residual isomerization down to ~50°C, but it would take ~200 hours at that temperature for meaningful conversion.

**BeerSmith** uses the same Arrhenius equation with an 85°C practical cutoff. **Brewfather** uses a user-configured whirlpool utilization factor.

**Source:** Alchemy Overlord mIBU model (jphosom.github.io); BeerSmith whirlpool documentation

### Mash Hops

**Validation: Acceptable** — matches BeerSmith, but may be generous

```
utilization = tinseth(boilTime) × 0.20
```

At typical mash temperatures (65-70°C), the Arrhenius isomerization rate is ~8-10% of the boiling rate. Additionally, most alpha acids are removed with the grain during lautering. The 20% figure matches **BeerSmith's** default (applies an 80% penalty). **Brewfather** does not have a specific mash hop model. Brew Your Own magazine and the homebrew community consensus suggest ~10% is more accurate.

Our standalone calculator (`ibu.ts`) uses 15%, which differs from the main service's 20%.

**Source:** BeerSmith documentation; Alchemy Overlord Arrhenius model; BYO "Mash Hopping" article

### Dry Hops — Humulinone Dissolution Model

**Validation: Correct** — scientifically grounded and ahead of commercial tools

The main recipe service uses a novel two-compound model:

**1. Humulinones (oxidized alpha acids):**
```
humulinonePpm = (grams × 0.004 × 1000 × extractionRate) / batchVolumeL
humulinoneIBU = humulinonePpm × 0.54
```

**2. Non-isomerized alpha acids:**
```
dissolvedAaPpm = (grams × alphaAcid% × 0.01 × 1000) / batchVolumeL
alphaAcidIBU = dissolvedAaPpm × 0.62
```

Validation against published research:

| Constant | Our Value | Literature | Source |
|----------|----------|------------|--------|
| Humulinone content | 0.4% of hop weight | 0.2–0.5% w/w | Maye et al. (2016), MBAA TQ 53(1) |
| Humulinone extraction | 75% base, decreasing at high rates | 87-98% at moderate rates | Maye et al. (2016) |
| Humulinone IBU response | 0.54 per mg/L | 0.54 confirmed (spectrophotometric) | Maye et al. (2016) |
| Alpha acid dissolution | 1% at fermentation temps | Less documented; rough estimate | Calibrated against Maye 2016 data |
| Alpha acid IBU response | 0.62 per mg/L | 0.62 confirmed (spectrophotometric) | Algazzali & Shellhammer (2016) |

Note: The 0.54 and 0.62 are **spectrophotometric** IBU response factors (how much these compounds register on the standard IBU assay), not sensory bitterness factors. Sensory bitterness of humulinones is ~66% of iso-alpha-acids (Algazzali & Shellhammer 2016), but the IBU assay reads them at ~54%.

**Neither BeerSmith nor Brewfather model dry hop IBU contribution** — both show 0 IBU for dry hop additions. Our humulinone model is more scientifically current.

The standalone calculator (`ibu.ts`) uses a simpler heuristic: 5% of Tinseth(60min) utilization. This has no direct scientific basis and should be replaced with the humulinone model for consistency.

**Sources:**
- Maye, Smith & Leker, "Humulinone Formation in Hops and Hop Pellets and Its Implications for Dry Hopped Beers" — MBAA Technical Quarterly 53(1), 2016
- Algazzali & Shellhammer, "Bitterness Intensity of Oxidized Hop Acids: Humulinones and Hulupones" — JASBC 74(1), 2016
- Lafontaine & Shellhammer, "Impact of Static Dry-Hopping Rate on the Sensory and Analytical Profiles of Beer" — JASBC, 2018
- Alchemy Overlord SMPH model — jphosom.github.io

---

## 5. Color (SRM) — Morey Equation

**Method:** Morey equation
**Source:** Daniel Morey, "Approximating SRM Beer Color of Homebrew Based on Recipe Formulation," published on probrewer.com and adopted throughout the homebrew community. Originally posted to the Homebrew Digest (1990s).
**Validation: Correct**

**Formula:**

```
MCU = Σ(colorLovibond × weight_lbs) / batch_volume_gal
SRM = 1.4922 × MCU^0.6859
```

MCU (Malt Color Units) is the weighted sum of each grain's color contribution. The Morey equation applies a power-law correction because the relationship between grain color and beer color is non-linear — at higher MCU values, additional dark grain contributes proportionally less visible color due to Beer's Law (absorbance vs. concentration).

The Morey equation is accurate for beers in the 1-50 SRM range. For very dark beers (SRM > 50), all models converge toward opaque black and precision matters less.

**Comparison:** BeerSmith, Brewfather, and Brewer's Friend all use the Morey equation as their default SRM model. The alternative Daniels model (`MCU × 0.2 + 8.4` for MCU > 10) is older and less accurate.

### SRM-to-RGB Display

For visual color display, we use a 19-point lookup table based on the Morey SRM color chart, with linear interpolation between reference points. SRM values are clamped to the 1–40 range. This is cosmetic only and does not affect calculations.

**Source:** Daniel Morey, probrewer.com; ASBC Methods of Analysis (spectrophotometric SRM definition)

---

## 6. Calories & Carbohydrates — Balling Formula

**Method:** Balling-derived nutrition calculation
**Source:** Carl Joseph Napoleon Balling's 19th-century fermentation stoichiometry, as adapted by Michael Hall in "Brew By The Numbers," *Zymurgy* Special Issue (1995). The ASBC polynomial for SG-to-Plato conversion is from the American Society of Brewing Chemists *Methods of Analysis*.
**Validation: Correct**

### Step-by-Step Calculation

**1. SG to Plato conversion (ASBC polynomial):**
```
°Plato = −616.868 + 1111.14×SG − 630.272×SG² + 135.997×SG³
```
This polynomial is accurate to ±0.02°P for the typical beer gravity range (1.000–1.120). It is the industry standard.

**2. Real Extract (Balling formula):**
```
RE = 0.1808 × OE + 0.8192 × AE
```
Where OE = Original Extract (°Plato from OG) and AE = Apparent Extract (°Plato from FG). The "apparent" extract measured by a hydrometer is lower than the "real" extract because alcohol is less dense than water. Balling's formula corrects for this.

**3. Alcohol by Weight:**
```
ABW = (OE − RE) / (2.0665 − 0.010665 × OE)
```

**4. Calories per liter:**
```
cal/L = (6.9 × ABW + 4.0 × (RE − 0.1)) × FG × 10
```
- 6.9 kcal/g is the caloric contribution of ethanol
- 4.0 kcal/g is the caloric contribution of residual carbohydrates
- The `(RE − 0.1)` term subtracts non-caloric residual compounds (ash, etc.)

**5. Carbohydrates per liter:**
```
carbs/L = (RE − 0.1) × FG × 10
```

Results are scaled to a 355 mL (12 oz) serving size.

**Comparison:** BeerSmith uses the same Balling-derived formula for calories. Brewfather displays similar values. This is the only widely-used method for estimating beer nutrition.

**Source:** Hall, "Brew By The Numbers," *Zymurgy* Special Issue, 1995; ASBC *Methods of Analysis*; Balling, *Die Bierbrauerei* (1865)

---

## 7. Mash pH — Proton Deficit Model

**Method:** Proton deficit equilibrium model solved via bisection
**Source:** AJ deLange, "Understanding and Adjusting Mash pH," Master Brewers Association of the Americas Technical Quarterly (MBAA TQ), 2013 and 2015. Implemented similarly to the Bru'n Water spreadsheet by Martin Brungard. Grain classification data from Kai Troester (braukaiser.com) and Bru'n Water grain database.
**Validation: Correct** — this is the current gold standard for mash pH prediction

### How It Works

The model finds the pH at which the total proton balance of the mash equals zero:

```
f(pH) = waterAlkalinity + Σ(maltDeficit_i) − acidMeq + baseMeq = 0
```

**Water Effective Alkalinity (mEq/L):**
```
Alk = HCO₃/61.016 − Ca/(40.078 × 3.5) − Mg/(24.305 × 7)
```
The divisors for calcium (3.5) and magnesium (7) are **Kolbach's factors** — they account for how Ca²⁺ and Mg²⁺ ions precipitate with malt phosphates during mashing, effectively consuming alkalinity. These factors were established by Paul Kolbach in the mid-20th century and are confirmed by deLange's measurements.

**Malt Proton Deficit:**
```
maltDeficit_i = grain_kg × (−40 mEq/kg/pH) × (pH − pHdi)
```
Each grain has a distilled-water pH (pHdi) and a universal buffering capacity of ~40 mEq/kg/pH unit. deLange measured this buffering capacity at 40-46 mEq/kg/pH across many malt types — we use 40 as a conservative value.

### Grain Classification & Distilled-Water pH Values

| Category | pHdi Range | Source |
|----------|-----------|--------|
| Base malt (2-Row, Pilsner) | 5.65–5.72 | deLange / Bru'n Water |
| Wheat | 5.95–6.05 | deLange — wheat is less acidic than barley |
| Munich/Vienna/Kilned (4–200°L) | 4.70–5.55 | Bru'n Water grain data, interpolated by color |
| Crystal/Caramel (10–120°L) | 4.50–5.20 | Bru'n Water grain data, interpolated by color |
| Roasted (300–500°L) | 4.45–4.60 | Bru'n Water data — tight range |
| Acidulated malt | 3.35–3.45 | Contains lactic acid (~2% by weight) |
| Adjuncts (flaked oats, rice, etc.) | 5.70–5.80 | deLange — minimal pH impact |

### pH Adjustment Calculations

```
mEq needed = grain_kg × 40 mEq/kg/pH × |ΔpH|
```

- **88% Lactic acid:** 11.81 mEq/mL (derivation: 0.88 × 1.209 g/mL × 1000 / 90.08 g/mol)
- **Baking soda (NaHCO₃):** 11.904 mEq/g (derivation: 1000 / 84.006 g/mol)

The bisection solver finds the equilibrium pH in the bracket [3.0, 8.0] to a tolerance of ±0.001 pH units.

**Comparison:** Bru'n Water uses the same proton deficit framework with a larger grain database. BeerSmith uses a simpler residual-alkalinity based estimate. Brewfather uses a similar proton deficit model. Our implementation is comparable to Bru'n Water's accuracy.

**Sources:**
- AJ deLange, MBAA TQ (2013, 2015)
- Martin Brungard, Bru'n Water v4.0 documentation — brunwater.com
- Kai Troester, "Mash pH and Alkalinity" — braukaiser.com
- Paul Kolbach, "Die Wasseraufbereitung" — phosphate precipitation factors

---

## 8. Water Chemistry — Stoichiometric Ion Calculations

**Method:** Stoichiometric mass-fraction calculations from molar masses
**Source:** Basic inorganic chemistry. Every brewing water tool (Bru'n Water, BeerSmith, Brewfather, Brewer's Friend) uses identical stoichiometric calculations.
**Validation: Correct**

### Ion Contributions Per Gram of Salt Per Liter of Water

| Salt | Formula | Ion | ppm/(g/L) | Derivation |
|------|---------|-----|-----------|-----------|
| Gypsum | CaSO₄·2H₂O (MW 172.17) | Ca²⁺ | 232.8 | 40.078 / 172.169 × 1000 |
| | | SO₄²⁻ | 558.3 | 96.061 / 172.169 × 1000 |
| Calcium Chloride | CaCl₂·2H₂O (MW 147.01) | Ca²⁺ | 272.6 | 40.078 / 147.014 × 1000 |
| | | Cl⁻ | 482.0 | 70.906 / 147.014 × 1000 |
| Epsom Salt | MgSO₄·7H₂O (MW 246.47) | Mg²⁺ | 98.6 | 24.305 / 246.471 × 1000 |
| | | SO₄²⁻ | 389.6 | 96.061 / 246.471 × 1000 |
| Table Salt | NaCl (MW 58.44) | Na⁺ | 393.4 | 22.990 / 58.443 × 1000 |
| | | Cl⁻ | 606.6 | 35.453 / 58.443 × 1000 |
| Baking Soda | NaHCO₃ (MW 84.01) | Na⁺ | 273.7 | 22.990 / 84.006 × 1000 |
| | | HCO₃⁻ | 726.3 | 61.016 / 84.006 × 1000 |

Note: Calcium chloride assumes the **dihydrate** form (CaCl₂·2H₂O), which is standard for homebrew-grade calcium chloride. Anhydrous CaCl₂ (MW 110.98) would give different values — worth noting to users who may have anhydrous lab-grade salt.

### Chloride-to-Sulfate Ratio

```
Cl:SO₄ = Cl_ppm / SO₄_ppm
```

| Ratio | Character |
|-------|-----------|
| < 0.5 | Very hoppy — dry, crisp bitterness |
| 0.5–0.8 | Hoppy — balanced toward bitterness |
| 0.8–1.2 | Balanced |
| 1.2–2.0 | Malty — softer, rounder mouthfeel |
| > 2.0 | Very malty — full, sweet character |

**Sources:**
- Palmer, *How to Brew*, 4th ed. (Brewers Publications, 2017) — chapter on water chemistry
- Brungard, Bru'n Water documentation — brunwater.com
- CRC Handbook of Chemistry and Physics — molar mass values

---

## 9. Yeast Starter — White & Braukaiser Models

**Method:** Two selectable yeast growth models
**Source:** White & Zainasheff, *Yeast: The Practical Guide to Beer Fermentation* (Brewers Publications, 2010) for the White model; Kai Troester, braukaiser.com/wiki/index.php/Yeast_Starter for the Braukaiser model.
**Validation: Correct**

### Pitch Rate Calculation

**Validation: Correct** — industry standard formula

```
requiredCells (billions) = pitchRate × volumeL × °Plato(OG)
```

Typical pitch rates (million cells / mL / °Plato):
- Ale: 0.75
- Lager: 1.0–1.5
- High-gravity ale: 1.0

This formula and these rates are from White & Zainasheff and are used by virtually all starter calculators (Brewer's Friend, BrewUnited, Yeast Calculator).

### Yeast Viability

**Validation: Acceptable** — adequate for older packaging, may overestimate loss for modern PurePitch

```
viability = 1 − (0.007 × daysSinceManufacture)
```

White Labs estimated ~21% viability loss per month (~0.7%/day) for their original vial packaging. Modern PurePitch packaging (introduced ~2016) claims longer shelf life. Wyeast activator packs have similar decay rates. The linear model is a simplification — real viability decay follows more of a sigmoidal curve (slow initial loss, accelerating decline, then plateau near zero). However, for the typical 0-120 day range, the linear approximation is adequate.

### Package Cell Counts

| Type | Cells | Source |
|------|-------|--------|
| Dry yeast sachet (11g) | 66 billion (6B/g × 11g) | Fermentis (US-05 spec sheet) |
| Standard liquid (e.g., Wyeast) | 100 billion/pack | Wyeast / White Labs documentation |
| Large liquid (e.g., White Labs 200mL) | 200 billion/pack | White Labs PurePitch documentation |
| Slurry | User-specified | — |

### White Model (Polynomial Growth)

**Validation: Correct** — directly from the source material

```
growthFactor = 12.548 × inoculationRate^(−0.459) − 0.999
finalCells = currentCells × (1 + growthFactor)
```

- `inoculationRate` = current cells (billions) / starter volume (L)
- Aeration boost: +0.5 growth factor when shaking/stirring
- Growth factor clamped to [0, 6]
- Saturation cap: 200 billion cells/L

This polynomial was curve-fitted to White Labs yeast growth data. The inoculation rate dependency models real yeast biology: at lower cell densities, each cell has more nutrients available and reproduces more. The Brewer's Friend yeast calculator uses the same polynomial coefficients.

### Braukaiser Model (Linear Growth)

**Validation: Correct** — directly from the source material

```
growthBillion = DME_grams × 1.4
finalCells = currentCells + growthBillion
```

Each gram of DME produces ~1.4 billion new cells. This is independent of inoculation rate — a simpler model that works well for typical homebrew starter sizes (1-2L, 1.036 gravity). Troester's model is based on his own cell-counting experiments documented on braukaiser.com.

**Sources:**
- White & Zainasheff, *Yeast: The Practical Guide to Beer Fermentation* (Brewers Publications, 2010), Chapter 4
- Kai Troester, "Yeast Starter" — braukaiser.com/wiki/index.php/Yeast_Starter
- White Labs, "PurePitch Next Generation" technical documentation
- Fermentis, SafAle US-05 product data sheet

---

## 10. Water Volumes & Strike Temperature

**Method:** Conservation of mass (volumes) and heat balance (strike temperature)
**Source:** Standard brewing engineering, as described in Palmer's *How to Brew* and Narziss's *Abriss der Bierbrauerei*. Used identically by BeerSmith, Brewfather, and most homebrew calculators.
**Validation: Correct**

### Pre-Boil Volume

```
preBoilL = (batchVolume + totalLosses) × shrinkageFactor + boilOff
```

Where:
- `boilOff = boilOffRate × boilTime / 60`
- `totalLosses = kettleLoss + hopAbsorption + chillerLoss + fermenterLoss`
- `hopAbsorption = kettleHops_kg × absorptionRate_L/kg`
- `shrinkageFactor = 1 + coolingShrinkage% / 100` (wort contracts ~4% as it cools from boiling to pitching temp)

### Mash Water (Strike Water)

```
mashWater = totalGrain_kg × mashThickness_L/kg + deadspace_L
```

### Sparge Water

```
spargeWater = preBoilVolume − mashRunoff
mashRunoff = mashWater − grainAbsorption − mashTunLoss
```

Deadspace (water below the false bottom) is recovered during draining, so it affects the strike/sparge split but not total water needed.

### Strike Temperature

```
strikeTemp = targetTemp + (grainMass × 0.38 × (targetTemp − grainTemp)) / (waterMass × 1.0)
```

- Grain specific heat capacity: **0.38 cal/g/°C** (dimensionless ratio to water)
- Water specific heat capacity: **1.0 cal/g/°C** (reference)
- Default grain temperature: 20°C

This is a straightforward heat balance equation. The grain heat capacity of 0.38 is a well-established value from brewing science literature.

**Note:** The `MashScheduleService` uses 0.41 for grain heat capacity in step-mash infusion calculations (see section 11). See Known Issues for discussion.

**Sources:**
- Palmer, *How to Brew*, 4th ed. (Brewers Publications, 2017), Chapter 17
- Narziss, *Abriss der Bierbrauerei*, 8th ed. (Wiley-VCH, 2017)
- BeerSmith equipment profile documentation

---

## 11. Mash Schedule — Heat Balance Equations

**Method:** Heat balance / conservation of energy
**Source:** Standard thermodynamics applied to brewing. Palmer's *How to Brew*; Narziss's *Abriss der Bierbrauerei*.
**Validation: Acceptable** — minor inconsistency in grain heat capacity

### Strike Temperature

Same as section 10, using grain heat capacity of 0.38 (or 0.41, see note below).

### Infusion Temperature (Step Mash)

When adding hot water to raise the mash temperature to the next rest:

```
infusionTemp = (tempRise × mashHeatCapacity) / infusionVolume + targetTemp
```

Where:
- `mashHeatCapacity = grain_kg × 0.41 + currentMashVolume_L`
- `tempRise = targetTemp − currentTemp`

### Grain Heat Capacity Note

The code uses **0.38** for strike temperature calculation and **0.41** for step-mash infusion calculations. Both values appear in brewing literature:
- 0.38 cal/g/°C — dry grain (Palmer, *How to Brew*)
- 0.41 cal/g/°C — hydrated grain during mashing (accounts for absorbed water increasing effective heat capacity)

The distinction is physically meaningful: dry grain absorbs heat differently than grain that has been soaking in hot water. BeerSmith uses 0.41 for all mash calculations. Using 0.38 for strike water and 0.41 for subsequent infusions is arguably more correct, but the difference is small (~3°C variation in extreme cases).

**Sources:**
- Palmer, *How to Brew*, 4th ed. (2017), Chapter 17
- Narziss, *Abriss der Bierbrauerei* (2017)

---

## 12. Hop Flavor Profile

**Method:** Custom weighted-average model with aroma retention factors
**Source:** Original model developed for this app. Retention factors are informed by general brewing science principles and hop oil volatility research rather than a single published model.
**Validation: Acceptable** — no published standard exists for this type of calculation

### Aroma Retention Factors

| Addition Type | Retention | Rationale |
|--------------|-----------|-----------|
| Dry hop | 0.80 | Volatile compounds preserved — no heat exposure |
| Whirlpool | 0.50–1.0 | Temperature and time dependent (see below) |
| Boil | e^(−0.05×min) | Exponential decay — hop oil volatiles driven off by boiling |
| First wort | 0.08 | Extended boil destroys most volatile aroma compounds |
| Mash | 0.05 | Very little aroma survives the full boil |

**Whirlpool aroma model:**
```
tempFactor = 0.6 + 0.4 × clamp((95 − temp) / 20)
timeFactor = 1 − e^(−0.06 × time)
aromaRetention = min(1, 0.5 + 0.5 × tempFactor × timeFactor)
```

### Combined Flavor Calculation

```
weight_i = (grams_i / batchL) × aromaFactor_i
overallMagnitude = 5 × (1 − e^(−0.7 × totalWeight))
finalAxis = clamp(magnitude × (axisSum / totalWeight), 0, 5)
```

The sigmoidal intensity curve prevents unrealistic linear growth — there's a practical ceiling to perceivable hop flavor intensity.

**Comparison:** No other homebrew calculator offers a comparable feature. BeerSmith and Brewfather do not model hop flavor profiles.

**Sources:**
- Peacock, *The Chemistry of Beer Aging* — hop oil volatility data
- Lafontaine & Shellhammer, research on hop aroma extraction — Oregon State University
- General hop science: linalool, geraniol, myrcene volatility points

---

## 13. Brew Session Metrics

**Method:** Standard brewing efficiency calculations
**Source:** Standard homebrew and professional brewing practice, as described in Palmer's *How to Brew* and Fix's *Principles of Brewing Science*. Used identically by BeerSmith, Brewfather, and Brewer's Friend.
**Validation: Correct**

### Apparent Attenuation
```
AA% = ((OG − FG) / (OG − 1.0)) × 100
```

### Mash Efficiency
```
mashEfficiency% = (actualPoints / potentialPoints) × 100
actualPoints = (preBoilSG − 1) × 1000 × preBoilVolume_gal
potentialPoints = Σ(PPG × weight_lbs)
```

### Brewhouse Efficiency
```
brewhouseEfficiency% = (actualPoints / potentialPoints) × 100
actualPoints = (OG − 1) × 1000 × finalVolume_gal
```

**Sources:**
- Palmer, *How to Brew*, 4th ed. (2017), Chapter 19
- Fix, *Principles of Brewing Science*, 2nd ed. (Brewers Publications, 1999)

---

## 14. Standalone Calculators

These are simplified tools for brew-day use:

### Dilution Calculator
**Validation: Correct** — conservation of gravity points

```
totalVolume = (currentVolume × currentPoints) / targetPoints
waterToAdd = totalVolume − currentVolume
```

### Boil-Off Calculator
**Validation: Correct** — same conservation principle in reverse

```
postBoilVolume = (preBoilVolume × preBoilPoints) / targetPoints
```

### Standalone IBU Calculator
**Validation: Needs Review** — see discrepancies noted in section 15

Uses Tinseth with different FWH, dry hop, and mash hop factors than the main recipe service.

---

## 15. Known Issues & Discrepancies

### Issue 1: Duplicate IBU Implementations That Disagree

There are two IBU implementations with different constants:

| Hop Type | Main Service (`RecipeCalculationService.ts`) | Standalone (`ibu.ts`) |
|----------|----------------------------------------------|----------------------|
| First Wort | `tinseth(time + 20min)` | `tinseth(time) × 1.10` |
| Dry Hop | Humulinone dissolution model | `tinseth(60min) × 0.05` |
| Mash | `tinseth(time) × 0.20` | `tinseth(60min) × 0.15` |

These should be unified. The main service's humulinone model for dry hops is more scientifically grounded. The standalone's ×1.10 for FWH is more consistent with published research than the main service's +20min approach.

### Issue 2: Fermentation Duration Adjustment Is Physically Wrong

The `+0.2% attenuation per day above 10 days` factor has no terminal point. Fermentation has a terminal gravity determined by the wort's sugar composition and yeast capabilities. Once fermentable sugars are consumed, additional time does not lower the gravity. This factor should be removed or replaced with a diminishing-returns model.

### Issue 3: Decoction Attenuation Bonus Is Too Large

The `+0.5% per minute` bonus means a 15-minute decoction adds +7.5% attenuation. Controlled experiments (Brulosophy) have found no significant attenuation difference between decoction and infusion mashes with modern fully-modified malts.

### Issue 4: Grain Heat Capacity Inconsistency

`VolumeCalculationService` uses 0.38 for strike temperature. `MashScheduleService` uses 0.41 for infusion calculations. Both values appear in literature, but the inconsistency could produce confusing results if a user cross-checks the numbers.

---

## Summary of Named Methods

| Calculation | Named Method | Primary Source | Validation |
|-------------|-------------|----------------|------------|
| Gravity (OG) | **PPG model** | Standard (Palmer, BeerSmith) | Correct |
| Final Gravity | **Two-layer attenuation** | Custom (Braukaiser + empirical) | Needs Review |
| ABV | **Standard approximation** | Hall, *Zymurgy* (1995) | Correct |
| IBU (boil) | **Tinseth** | Glenn Tinseth (1995) | Correct |
| IBU (FWH) | **Modified Tinseth** | Preis, Mitter & Steiner (1995) | Needs Review |
| IBU (whirlpool) | **Tinseth + temp scaling** | Approximation of Arrhenius/mIBU model | Acceptable |
| IBU (dry hop) | **Humulinone dissolution** | Maye et al. (2016), Algazzali & Shellhammer (2016) | Correct |
| IBU (mash) | **Tinseth × 0.20** | BeerSmith default | Acceptable |
| Color (SRM) | **Morey equation** | Daniel Morey (1990s) | Correct |
| Nutrition | **Balling formula** | Balling (1865), Hall (1995) | Correct |
| SG ↔ Plato | **ASBC polynomial** | ASBC *Methods of Analysis* | Correct |
| Mash pH | **Proton deficit model** | AJ deLange, MBAA TQ (2013/2015) | Correct |
| Mash pH grain data | **Bru'n Water / Braukaiser** | Brungard, Troester | Correct |
| Water ions | **Stoichiometry** | Basic chemistry | Correct |
| Residual alkalinity | **Kolbach factors** | Paul Kolbach (mid-20th c.) | Correct |
| Yeast growth (opt. 1) | **White model** | White & Zainasheff, *Yeast* (2010) | Correct |
| Yeast growth (opt. 2) | **Braukaiser model** | Kai Troester, braukaiser.com | Correct |
| Yeast viability | **White Labs linear decay** | White Labs (~0.7%/day) | Acceptable |
| Strike temperature | **Heat balance** | Palmer, *How to Brew* (2017) | Correct |
| Volumes | **Conservation of mass** | Standard brewing engineering | Correct |
| Hop flavor | **Custom model** | Original (no published standard) | Acceptable |
| Brew session metrics | **Standard efficiency** | Palmer (2017), Fix (1999) | Correct |

---

## Full Bibliography

- Algazzali, V. & Shellhammer, T. "Bitterness Intensity of Oxidized Hop Acids: Humulinones and Hulupones." *Journal of the American Society of Brewing Chemists* 74(1), 2016.
- ASBC. *Methods of Analysis*, 14th ed. American Society of Brewing Chemists.
- Balling, C.J.N. *Die Bierbrauerei*, 1865.
- deLange, A.J. "Understanding and Adjusting Mash pH." *MBAA Technical Quarterly*, 2013 and 2015.
- Fermentis. SafAle US-05 Product Data Sheet.
- Fix, G. *Principles of Brewing Science*, 2nd ed. Brewers Publications, 1999.
- Hall, M. "Brew By The Numbers." *Zymurgy* Special Issue, 1995.
- Lafontaine, S. & Shellhammer, T. "Impact of Static Dry-Hopping Rate on the Sensory and Analytical Profiles of Beer." *JASBC*, 2018.
- Maye, J.P., Smith, R. & Leker, J. "Humulinone Formation in Hops and Hop Pellets and Its Implications for Dry Hopped Beers." *MBAA Technical Quarterly* 53(1), 2016.
- Morey, D. "Approximating SRM Beer Color of Homebrew Based on Recipe Formulation." probrewer.com.
- Narziss, L. *Abriss der Bierbrauerei*, 8th ed. Wiley-VCH, 2017.
- Palmer, J. *How to Brew*, 4th ed. Brewers Publications, 2017.
- Preis, F., Mitter, W. & Steiner, K. "The Re-Discovery of First Wort Hopping." *Brauwelt International*, 1995.
- Tinseth, G. "Glenn's Hop Utilization Numbers." realbeer.com/hops/research.html, 1995.
- Troester, K. Various articles on mash chemistry, yeast starters, and fermentability. braukaiser.com.
- White, C. & Zainasheff, J. *Yeast: The Practical Guide to Beer Fermentation*. Brewers Publications, 2010.

---

*Last updated: March 2026*
