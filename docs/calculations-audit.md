# Calculations audit

A scientific inventory of every brewing calculation in the app: what it computes,
where it lives, the formula and constants it uses, the source those come from, and
a verdict on how well-founded it is.

**Verdicts**

- **Solid** — standard, widely-cited formula; constants match the literature. Trust it.
- **Shaky** — a defensible model, but with hand-fit constants or an approximation that
  isn't first-principles. Works, but document the assumption and revisit if it's ever
  challenged by real data.
- **Inconsistent** — duplicated or partially-wired logic that could drift between call
  sites. Not wrong today, but a maintenance hazard.

Last reviewed 2026-06-12. Items marked **(fixed this round)** were changed in the
FWH/OG/FG-model pass; see git history for the diff.

---

## Gravity

### Original Gravity (OG) — **Solid** (fixed this round)
- `RecipeCalculationService.calculateOG` → shared `gravityPointsSplit`.
- `OG = 1 + Σ(ppg · lbs · efficiency) / (postBoilVolumeGal · 1000)`.
- Denominator is the **cold post-boil volume** (`VolumeCalculationService.calculatePostBoilVolume`
  = `batchVolume + losses`), not the packaged volume. Trub/chiller/fermenter losses remove
  wort at constant concentration, so OG is measured where all the extract is dissolved.
  This matches Brewfather. Previously divided by packaged volume, which overstated OG
  ~10–20% on recipes with real losses.
- Efficiency: 100% for sugar/extract, mash efficiency for grains (`getEfficiency`).
- Constants: kg→lb 2.20462, L→gal 0.264172.

### Final Gravity (FG) — **Solid** (model selectable; overhauled)
- `RecipeCalculationService.calculateFG`, shares `gravityPointsSplit` with OG so the two
  cannot drift on the denominator. The fermentable share attenuates at `effAtt`; lactose /
  maltodextrin / part of crystal is held back via `inferFermentability`.
- The whole FG basis was rebuilt around one principle (Escarpment, Braukaiser): **a wort's
  attenuation limit is set by the mash, not the yeast.** The published yeast attenuation only
  holds at the 67.5 °C neutral point; a lower saccharification rest ferments further. Two
  selectable models via the account preference (`AttenuationModel`):
  - **kinetic** *(default)*: a Brandam-style mash simulation. Steps through the rest schedule
    tracking four sugar pools (starch → β-convertible dextrin / branched limit dextrin →
    fermentable) with three enzymes:
    - **β-amylase** (maltose, ~63 °C) and **α-amylase** (dextrins, ~70 °C);
    - **limit dextrinase** (debranching, ~61 °C) — free LD is the *single strongest* predictor of
      wort fermentability (r=0.84 vs β 0.37, α 0.58; Stenholm & Home 1999), so it's modelled
      explicitly; it cleaves the α-1,6 branch points β can't, the reason a low maltose rest
      attenuates so far.
    - in-mash thermal denaturation anchored to **Muller (1991)** measured decay (β k₆₅ = 0.0434 min⁻¹),
      *not* the buffer Arrhenius rates (which denature β far too fast).
    The wort attenuation-limit `AL` maps to apparent attenuation against the 67.5 °C reference through an
    **asymmetric, smooth "reach"** — real attenuation is always ≤ the chemical limit, and the gap is set by
    the sugar spectrum that mash temp controls. A cool/maltose-rich wort (ratio > 1) is fermented nearly to
    the limit, so its gain is compressed (×0.45); a hot/maltotriose-heavy wort (ratio < 1) falls short of it
    (gain ×1.60), because maltotriose is taken up last and incompletely (AGT1, strain-dependent; "maltotriose-
    negative" is a known trait — Stewart) and dextrins not at all. The two blend with a logistic in
    `AL/refAL − 1` (continuous, **no kink** at the anchor). **The direction is mechanistic** — the flat/
    proportional hot side wrongly assumes constant reach; **the magnitude (1.60) is calibrated**, like every
    rate constant here. **Gray-box: validated, not first-principles.** Calibrated to ~59 real measured-FG beers
    (all real ale/lager data kept in — no convenience exclusions); **clean-data MAE ~4.3 %, hot-region bias ~0**
    (all-data MAE ~4.8 incl. the Belgian outlier), the best of any model on the set. The cool gain 0.45 is a
    touch above the MAE-optimal 0.40 — lifts the cool plateau ~1 point, within the genuine uncertainty of which
    mash temp the yeast spec is measured at (67.5 °C anchor is convention, not measured). **Earlier we shipped a
    simple proportional hot side and documented its +6–10 pt over-read at ≥71 °C as a known limitation; the
    asymmetric reach replaced it once we confirmed the over-read was systematic on clean lagers (not the
    aggregate-MAE-with-Belgian framing that masked it).** Remaining least-certain region: the ≥71 °C end rests
    on ~3 single-infusion batches — now unbiased, not high.
  - **linear**: the Grainfather published formula — `effAtt = nominal − 0.0225 × (T_lowest − 67.5)`,
    brewer's window 62.5–72.5 °C, lowest in-window rest. Provided for **parity with other apps**
    (reproduces Grainfather — the only competitor mash-temp formula that's actually published;
    Brewfather and Brewer's Friend both move FG with mash temp but don't disclose how, so we match
    the open formula rather than guess at the closed ones). Less accurate on real data (MAE ~5.6 %) — a straight line
    over-predicts at low mash temps and over-credits a single low rest. (Keeps a >72.5 °C clamp fix so
    a hot mash reads dextrinous instead of nominal.)
- **Validation & honesty.** Head-to-head MAE on the dataset (% AA, lower=better):
  **kinetic 4.8** < Grainfather-avg 5.1 < our-linear 5.6 < flat-no-mash-temp 5.8 < Grainfather-lowest
  5.9 < Braukaiser-4%/°C 8.7 → ~±2 FG points on a 1.050 beer (scales ×(OG−1)×10). The "flat" row is
  the conceptual "ignore mash temperature" predictor, not a stand-in for any named competitor. See
  `AttenuationModelValidation.test.ts`, which holds the ~59-beer dataset + benchmark and **guards
  against re-overfitting** (held-out MAE/bias bounds + a hot-region bias bound). The first kinetic
  calibration overfit one Märzen (nailed it, over-predicted other step mashes ~9 %); fitting the
  population fixed it. **On exclusions:** all real ale/lager data is kept in the *fit* — including the
  high-OG Belgian pair, which the model now misses by ~21 points at 73 °C (the B45 strain over-attenuates
  a dextriny wort — a yeast effect no mash-temp model can capture, and the only in-fit point that wanted
  the hot side held high). We do NOT cherry it out of the fit, but it IS dropped from the held-out
  *yardstick* (a diastaticus-like outlier isn't a fair generalization target). Genuinely out-of-scope
  points stay flagged: the diastaticus Saison (a different organism, 97–98 % AA), decoction (unmodeled
  boil), an OG-approx batch, and fruit/wheat worts (sugar the model can't see) — scope, not fit
  convenience. Leave-one-out CV (refit per fold) ≈ in-sample, so the model generalizes rather than
  memorizing the 33 points.
  *Why step mashing barely moves FG (controlled lit):* Laus et al. 2022 — a step mash hits ~89 %
  attenuation limit, *equal to the best single infusion, not higher*; Brulosophy single-vs-step pairs
  agree. Big swings come only from long β-band dwells (rising/overnight, +7–9 %) or under-modified
  malt (decoction, +14 %). **Honest limits:** (1) on step mashes alone, a naive "use the yeast spec"
  baseline (2.1) beats every mash model — the kinetic edge is on single infusions; (2) the very high
  (≥71 °C) end is now unbiased but rests on ~3 batches, so it's the least-certain region; (3) no gravity
  term, so high-OG beers run a touch dry; (4) noise floor from grist/adjunct effects (fruit sugar, wheat)
  the model can't see.
- Retired for the clean two-model lineup: the `simple`/old-`linear` flat & 1%/°C models, the
  log-space damping, the tuned smooth `mash_adjusted` curve, and the one-beer gravity knob. Stored
  prefs migrate: old kinetic ids → `kinetic`; formula/flat ids → `linear`.

### Pre-boil gravity — **Solid**
- In `calculate()`: `preBoilGravity = 1 + (OG−1)·postBoilCold / preBoilVolume`.
- Sugar-conservation dilution of OG back to the pre-boil volume. Became internally
  self-consistent once OG moved to the post-boil denominator (covered by
  `PreBoilGravity.test.ts`).

### ABV — **Solid**
- `RecipeCalculationService.calculateABV` now delegates to the single shared helper
  `abvFromOGFG` in `src/calculators/abv.ts` — one implementation, no drift.
- The `×131.25` estimate is standard and fine to ~8% ABV; it mildly under-reads at high
  gravity vs the alternate `(76.08·(OG−FG)/(1.775−OG))·(FG/0.794)`.

---

## Bitterness (IBU)

All kettle additions use the Tinseth model. `tinsethUtilization(minutes, gravity)` with
`gravityFactor = 1.65 · 0.000125^(gravity−1)`, `timeFactor = (1−e^(−0.04·min))/4.15`, and
`IBU = AAU · util · 75 / batchVolumeGal`.

### Tinseth boil — **Solid** (fixed this round)
- Now receives the **average boil gravity** `(preBoilGravity + OG)/2`, not the post-boil OG —
  Tinseth's bigness factor expects the mean wort gravity over the boil. Threaded through
  `calculateIBU` → `calculateSingleHopIBU`, and through the hop-table / export per-hop
  readouts so they match the brew-sheet total.

### First wort hops (FWH) — **Solid** (fixed this round)
- `tinsethUtilization(boilTimeMin + 20, boilGravity)`.
- Previously read the (deliberately unset) per-hop `timeMinutes` as 0 and computed
  `tinseth(20)` — roughly half-strength. Now anchored to the full boil. The `+20` min
  bonus is a **calibration choice** (carried over from the prior code), not a sourced
  constant — flagged for future tuning.

### Whirlpool / flameout — **Shaky** (import temps fixed this round)
- `whirlpoolUtilization`: `tinseth(min, OG) · ((clamp(T,60,100)−60)/40)^1.8`, zero below 60 °C.
- The temperature factor exponent **1.8 is a hand-fit with no citation**. Direction is
  right (more isomerization when hotter), magnitude is a guess. Real behaviour follows an
  Arrhenius rate. **Recommend** sourcing/validating against measured whirlpool IBU data.
- Import temps *(fixed this round)*: flameout now defaults ~99 °C (+ a stand time so a
  0-min flameout isn't zeroed), whirlpool/aroma ~85 °C or the explicit XML/text temperature.
  Manual builder control unchanged (80 °C editable default).

### Dry hop — **Shaky** (deliberate model, not a bug)
- Humulinone dissolution model, not Tinseth: 0.4% humulinone fraction, extraction
  `0.75·e^(−0.04·max(0, g/L − 4))`, response 0.54 IBU per mg/L; plus ~1% non-isomerized
  alpha at 0.62 IBU/mg·L⁻¹. Sources: Maye 2016, Lafontaine & Shellhammer 2017.
- Whether dry hopping "adds IBU" is genuinely contested in the literature; this is a
  considered modelling choice. Keep, but treat the number as indicative.

### Mash hops — **Solid** (approximation)
- `tinseth(min || 5, boilGravity) · 0.20` (BeerSmith's −80% rule). Reasonable.

---

## Colour

### SRM (Morey) — **Solid**
- `RecipeCalculationService.calculateSRM`: `SRM = 1.4922 · MCU^0.6859`,
  `MCU = Σ(°L · lbs) / batchVolumeGal`. Standard Morey equation.
- SRM→RGB (`srmColorUtils`) and SRM→OKLCH (`srmToOklchHue`) are display lookups —
  **Untested**, but cosmetic.

---

## Volumes & water

### Pre-boil / mash / sparge / post-boil — **Solid**
- `VolumeCalculationService`. Pre-boil = `(batch + losses)·shrinkage + boilOff`.
  Post-boil cold = `(preBoil − boilOff)/shrinkage` *(added this round)*. Shrinkage default 4%.
- Losses, boil-off rate, mash thickness, grain absorption are all equipment-configurable. Good.

### Strike temperature — **Solid**
- `MashScheduleService` / `VolumeCalculationService.calculateStrikeTemp`:
  `strike = (target − grain)·(0.41/thickness) + target`. The 0.41 grain:water heat-capacity
  ratio is Palmer's standard value. Grain temp assumed 20 °C.

### Mash pH — **Solid**
- `MashPhCalculationService`: proton-deficit bisection solver, malt buffering −40 mEq/kg·pH,
  grain pHdi by colour-interpolated category, effective alkalinity with Kolbach Ca/3.5,
  Mg/7 divisors. Sources: AJ deLange (MBAA TQ 2013/2015), Bru'n Water, Braukaiser. Well-founded.
- Residual alkalinity: `RA = alk − Ca/2.5 − Mg/3.33` (ppm CaCO₃). Standard.

### Water salt additions & optimizer — **Solid**
- `WaterChemistryService` ion-contribution constants are derived from salt molar masses.
- `WaterSaltOptimizer`: active-set bounded least-squares — mathematically sound, converges
  in ≤N iterations. Default ion weights prioritise the Cl:SO₄ ratio.
- Pre-defined water/style profiles are reference data (**Untested**, but not computed).

---

## Yeast & fermentation

### Starter calculations — **Solid**
- `StarterCalculationService`: viability −0.7%/day; pitch `rate · L · °Plato`; White Labs
  growth `12.548·inoc^−0.459 − 0.999` (+aeration, ×6 cap, 200 B/L saturation); Braukaiser
  1.4 B/g DME; ASBC SG→Plato polynomial; DME_PPG 45. All sourced (White Labs, Braukaiser).

### Apparent attenuation (measured) — **Solid**
- `BrewSessionCalculationService`: `AA = (OG−FG)/(OG−1) · 100`. Textbook.

### Efficiency (mash / brewhouse) — **Solid**
- `BrewSessionCalculationService`: actual vs potential gravity points at the relevant volume.

---

## Packaging

### Residual CO₂ / priming / forced carbonation — **Solid**
- `PackagingCalculationService`: residual CO₂ `3.0378 − 0.050062·°F + 0.00026555·°F²`;
  priming sugar factors (corn 4.0, sucrose 3.67, DME 5.33, honey 4.95 g/L/vol); forced-carb
  PSI polynomial. Standard homebrew regressions (Noonan / BrewersFriend lineage).
- BJCP style CO₂ ranges, bottle sizes, conditioning heuristic: reference data / heuristics.

---

## Nutrition

### Calories & carbs — **Solid**
- `RecipeCalculationService.calculateNutrition`: ASBC SG→Plato polynomial, Balling real
  extract `0.1808·OE + 0.8192·AE`, ABW, `cal/L = (6.9·ABW + 4.0·(RE−0.1))·FG·10`, scaled to
  355 mL. Source: Hall, "Brew By The Numbers", Zymurgy 1995. Standard.

---

## Measurement corrections

### Hydrometer temperature correction — **Solid**
- `src/calculators/hydrometerCorrection.ts`: Kell (1975) water-density equation. Accurate.
- Refractometer/Brix correction: **not implemented** (potential future feature).

---

## Other

### Hop flavor aggregation — **Shaky / Untested**
- `HopFlavorCalculationService`: weighted aroma sums with retention factors by addition type
  and a magnitude map `5·(1−e^(−0.7·W))`. The constants (λ=0.7, retention factors, the 1.8
  whirlpool reuse) are uncalibrated and the output is inherently subjective. Fine for a
  relative visual; not a measured quantity.

### Compare / mean-recipe — **Untested**
- `compareUtils`: straight averaging of vitals + grain/water aggregation via
  `canonicalGrains`. Logic is simple; no dedicated tests.

---

## Summary of recommendations (future rounds)

1. **Whirlpool temperature exponent (1.8)** — replace the hand-fit with an
   Arrhenius-based factor, or validate against measured data.
2. **FG-model bypass** — `useOG`/`useIBU` hooks ignore the model option (harmless today since
   OG/IBU don't depend on it, but a footgun if that ever changes).
3. **Coverage gaps** — hop-flavor aggregation, refractometer correction, compare utilities.

*Resolved since first audit:* enzyme/ODE log-space damping removed and kinetics recalibrated
(mash-aware FG overhaul); ABV duplication collapsed (`calculateABV` now delegates to
`@/calculators/abv`).
