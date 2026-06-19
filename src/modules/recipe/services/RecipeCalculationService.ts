/**
 * RecipeCalculationService
 *
 * This is your "Manager" from SwiftUI.
 * Contains all business logic for recipe calculations.
 * NO React dependencies, NO hooks, NO localStorage - pure logic only.
 */

import type { Recipe, RecipeCalculations, Hop, Fermentable } from '../models/Recipe';
import { volumeCalculationService } from './VolumeCalculationService';
import { mashPhCalculationService, DEFAULT_TARGET_PH } from './MashPhCalculationService';
import { mashScheduleService } from './MashScheduleService';
import { inferFermentability, fermentableExtractEfficiency } from '@/modules/recipe/data/fermentablePresets';
import { abvFromOGFG } from '@/calculators/abv';
import { LITERS_TO_GALLONS, KG_TO_LBS, sgToPlato } from '@/calculators/units';

export type AttenuationModel = 'kinetic' | 'linear';

export type CalcOptions = {
  attenuationModel?: AttenuationModel;
};

export class RecipeCalculationService {
  /**
   * Calculate all recipe values
   */
  calculate(recipe: Recipe, options?: CalcOptions): RecipeCalculations {
    const og = this.calculateOG(recipe);
    const fg = this.calculateFG(recipe, options);
    const abv = this.calculateABV(og, fg);
    const srm = this.calculateSRM(recipe);

    // Volume calculations
    const preBoilVolumeL = volumeCalculationService.calculatePreBoilVolume(recipe);
    const mashWaterL = volumeCalculationService.calculateMashWater(recipe);
    const spargeWaterL = volumeCalculationService.calculateSpargeWater(recipe);
    const totalWaterL = volumeCalculationService.calculateTotalWater(recipe);

    // Pre-boil gravity: dilute OG back to pre-boil volume.
    const postBoilColdL = volumeCalculationService.calculatePostBoilVolume(recipe);
    const preBoilGravity = preBoilVolumeL > 0
      ? 1 + ((og - 1) * postBoilColdL) / preBoilVolumeL
      : og;

    // IBU uses the *average* boil gravity (Tinseth's bigness factor expects the
    // mean wort gravity over the boil), not the post-boil OG.
    const boilGravity = (preBoilGravity + og) / 2;
    const ibu = this.calculateIBU(recipe, og, boilGravity);

    // Nutrition (per 355 ml / 12 oz serving)
    const { calories, carbsG } = this.calculateNutrition(og, fg);

    // Mash pH prediction
    const estimatedMashPh = mashPhCalculationService.calculateMashPh(recipe, mashWaterL);

    // Mash pH adjustment recommendation
    const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);
    const mashPhAdjustment = estimatedMashPh != null
      ? mashPhCalculationService.calculatePhAdjustment(
          estimatedMashPh,
          DEFAULT_TARGET_PH,
          totalGrainKg,
        )
      : null;

    // Strike temperature (reuse MashScheduleService heat-balance equation)
    const strikeTempC = recipe.mashSteps.length > 0 && recipe.mashSteps[0].temperatureC != null
      ? mashScheduleService.calculateStrikeTemp(
          recipe.mashSteps[0].temperatureC,
          recipe.equipment.mashThicknessLPerKg,
          20,
          totalGrainKg,
        )
      : null;

    return {
      og,
      fg,
      abv,
      ibu,
      srm,
      calories,
      carbsG,
      preBoilVolumeL,
      mashWaterL,
      spargeWaterL,
      totalWaterL,
      estimatedMashPh,
      mashPhAdjustment,
      strikeTempC,
      preBoilGravity,
    };
  }

  /**
   * Gravity points per the into-fermenter volume, split by fermentability.
   *
   * Shared by calculateOG and calculateFG so they always use the same extract
   * total and the same denominator — they can't drift apart. Points are scaled
   * so that gravity = 1 + points / 1000.
   *
   * OG is measured in the fermenter, so the denominator is the into-fermenter
   * volume (= finished batch + fermenter loss; see calculateIntoFermenterVolume),
   * paired with BREWHOUSE efficiency — which already nets out kettle/chiller/hop
   * losses, so those must NOT be added back into the denominator. Dividing by the
   * full post-boil volume would double-count those losses and understate OG.
   * Sugars and extracts dissolve completely and use 100% efficiency.
   */
  private gravityPointsSplit(recipe: Recipe): { fermentablePts: number; nonFermentablePts: number } {
    const { fermentables, batchVolumeL, equipment } = recipe;
    const intoFermenterGal = volumeCalculationService.calculateIntoFermenterVolume(recipe) * LITERS_TO_GALLONS;

    if (fermentables.length === 0 || batchVolumeL <= 0 || intoFermenterGal <= 0) {
      return { fermentablePts: 0, nonFermentablePts: 0 };
    }

    // Default to 75% if the field is somehow absent, so a malformed/legacy
    // recipe can never produce a NaN OG that cascades through every metric.
    const brewhouseEfficiency = (equipment.brewhouseEfficiencyPercent ?? 75) / 100;
    let fermentablePts = 0;
    let nonFermentablePts = 0;

    for (const f of fermentables) {
      const weightLbs = f.weightKg * KG_TO_LBS;
      const efficiency = this.getEfficiency(f, brewhouseEfficiency);
      const pts = (f.ppg * weightLbs * efficiency) / intoFermenterGal;
      const ferm = this.getFermentability(f);
      fermentablePts += pts * ferm;
      nonFermentablePts += pts * (1 - ferm);
    }

    return { fermentablePts, nonFermentablePts };
  }

  /**
   * Calculate Original Gravity
   * Formula: OG = 1 + (total gravity points / into-fermenter volume in gallons)
   *
   * Measured at the into-fermenter volume with brewhouse efficiency, matching
   * Brewfather. Brewhouse efficiency is applied to grains and mashable adjuncts;
   * sugars and extracts dissolve completely and use 100% efficiency.
   */
  calculateOG(recipe: Recipe): number {
    const { fermentablePts, nonFermentablePts } = this.gravityPointsSplit(recipe);
    return 1 + (fermentablePts + nonFermentablePts) / 1000;
  }

  /**
   * Calculate Final Gravity
   *
   * Two-layer model:
   *  1. Per-ingredient fermentability — splits each fermentable's gravity points
   *     into a fermentable share and a non-fermentable share (e.g. lactose = 0%).
   *  2. Effective attenuation — yeast base attenuation adjusted for mash temp,
   *     decoction, mash duration, fermentation temp, and fermentation duration.
   *     Applied only to the fermentable share.
   *
   * FG = 1 + (nonFermentablePts + fermentablePts × (1 − effAtt)) / 1000
   *
   * `effAtt` is the wort's apparent attenuation, set by the mash (see the model
   * implementations). The non-fermentable share (lactose, maltodextrin, part of
   * crystal/specialty) is held back regardless of model.
   */
  calculateFG(recipe: Recipe, options?: CalcOptions): number {
    // --- 1. Split gravity points by fermentability (shared with calculateOG) ---
    const { fermentablePts, nonFermentablePts } = this.gravityPointsSplit(recipe);

    const totalPts = fermentablePts + nonFermentablePts;
    // Guard: if no gravity points, nothing to attenuate
    if (totalPts <= 0) return 1.0;

    // --- 2. Effective attenuation (mash-aware) ---
    const effAtt = this.computeEffectiveAttenuation(recipe, options?.attenuationModel);

    return 1 + (nonFermentablePts + fermentablePts * (1 - effAtt)) / 1000;
  }

  /**
   * Get the fermentability (0-1) for a recipe fermentable.
   * Uses the explicit value if set, otherwise infers from name/category.
   */
  private getFermentability(f: Fermentable): number {
    if (f.fermentability != null) return f.fermentability;
    return inferFermentability(f);
  }

  /**
   * Get the extract efficiency for a fermentable.
   *
   * Sugars and extracts dissolve completely — they bypass the mash and should
   * not be penalised by mash efficiency. Grains and mashable adjuncts use the
   * system's mash efficiency.
   */
  private getEfficiency(f: Fermentable, mashEfficiency: number): number {
    return fermentableExtractEfficiency(f, mashEfficiency);
  }

  /** Yeast's published apparent attenuation (fraction). Defaults to 0.75. */
  private nominalAttenuation(recipe: Recipe): number {
    return recipe.yeasts.length > 0 ? recipe.yeasts[0].attenuation : 0.75;
  }

  // "Brewer's window": the saccharification-rest range that sets wort
  // fermentability. 67.5 °C is the neutral point where a yeast reaches exactly
  // its published attenuation (Brewfather/Grainfather convention).
  private static readonly MASH_WINDOW = { lo: 62.5, hi: 72.5, center: 67.5 };

  /**
   * Lowest saccharification rest inside the brewer's window (62.5–72.5 °C) — the
   * rest that governs fermentability in the simple Linear model (Grainfather
   * convention). Sub-rests (protein/ferulic) and the mash-out are ignored.
   *
   * No in-window rest: a sub-saccharification rest (55–62.5 °C) clamps up to the
   * floor; an all-too-hot mash (>72.5 °C) clamps to the ceiling (so a 74 °C mash
   * reads dextrinous, not neutral); otherwise falls back to the neutral 67.5 °C.
   */
  private saccharificationTempC(recipe: Recipe): number {
    const { lo, hi, center } = RecipeCalculationService.MASH_WINDOW;
    const temps = recipe.mashSteps
      .map((s) => s.temperatureC)
      .filter((t): t is number => t != null);

    const inWindow = temps.filter((t) => t >= lo && t <= hi);
    if (inWindow.length > 0) return Math.min(...inWindow);
    if (temps.some((t) => t >= 55 && t < lo)) return lo;
    if (temps.length > 0 && temps.every((t) => t > hi)) return hi;
    return center;
  }

  /**
   * Public accessor for the effective apparent attenuation under a given model
   * (defaults to kinetic). Used by the builder's weight↔ABV back-calc.
   */
  getEffectiveAttenuation(recipe: Recipe, model?: AttenuationModel): number {
    return this.computeEffectiveAttenuation(recipe, model);
  }

  /** Dispatch to the selected attenuation model (default: kinetic). */
  private computeEffectiveAttenuation(recipe: Recipe, model: AttenuationModel = 'kinetic'): number {
    if (model === 'linear') return this.computeEffectiveAttenuationLinear(recipe);
    return this.computeEffectiveAttenuationKinetic(recipe);
  }

  /**
   * Linear apparent attenuation — the simple "matches other apps" model.
   *
   * The Grainfather/Brewfather-style published formula: scale the yeast's
   * attenuation linearly off the neutral 67.5 °C point using the lowest
   * saccharification rest.
   *
   *   effAtt = nominal − 0.0225 × (T_sacch − 67.5),  clamped to [0.50, 0.95]
   *
   * Provided for parity with other brewing software (it reproduces Grainfather's
   * documented calc — the only competitor mash-temp formula that's actually
   * published; Brewfather and Brewers Friend also move FG with mash temp but don't
   * disclose their formulas). On our measured-FG dataset
   * it's less accurate than the kinetic model (MAE ~6 % vs ~4.7 %) — it over-credits
   * a low single rest and a straight line over-predicts at very low mash temps.
   */
  private computeEffectiveAttenuationLinear(recipe: Recipe): number {
    const nominal = this.nominalAttenuation(recipe);
    const tSacch = this.saccharificationTempC(recipe);
    const effAtt = nominal - 0.0225 * (tSacch - RecipeCalculationService.MASH_WINDOW.center);
    return Math.max(0.5, Math.min(0.95, effAtt));
  }

  /**
   * Kinetic attenuation model (default) — a Brandam-style mash simulation.
   *
   * Simulates the mash via forward Euler (0.5 min steps) over four sugar pools:
   *   Starch        →(α)→ fermentable + β-convertible dextrin + branched limit dextrin
   *   Starch, Dc    →(β)→ fermentable (maltose)
   *   limit dextrin →(LD)→ β-convertible dextrin   (debranching)
   * α yields a fermentable-rich spectrum (floor); branched limit dextrins are
   * unfermentable until **limit dextrinase** debranches them — the strongest
   * fermentability driver (r=0.84; Stenholm & Home 1999), active ~61 °C, dead by
   * ~67 °C. β retains a 13 % thermostable isoform (De Schepper 2022). Enzyme
   * survival uses **in-mash decay (Muller 1991)**, not buffer Arrhenius rates.
   * Fermentable sugar accumulates and never reverts, so a low maltose rest is
   * "banked" across a step mash.
   *
   * The simulated fermentable fraction is the wort's attenuation limit (AL).
   * Apparent attenuation maps AL against the 67.5 °C reference through an *asymmetric*
   * reach: a cool/maltose-rich wort is nearly fully fermented (reach compressed toward
   * the limit), a hot/maltotriose-heavy wort falls short of it (reach amplified away) —
   * the gap is the well-known incomplete uptake of maltotriose, widening with mash temp.
   * The two blend smoothly (logistic, no kink); see the mapping comment for the mechanism.
   * Calibrated against ~33 real measured-FG beers (single infusions + step mashes, all
   * real ale/lager data kept in); clean-data MAE ~4.3 % apparent attenuation, hot-region
   * bias ~0. Least-certain region: the very hot (≥71 °C) end, where the magnitude rests
   * on ~3 batches and the yeast strain matters more than the mash.
   *
   * Sources: Brandam et al. (2003); Muller (1991, J. Inst. Brew.); De Schepper
   * et al. (2022); Stenholm & Home (1999, limit dextrinase); Laus et al. (2022,
   * isothermal fermentability vs temperature, 55–80 °C); Stewart (maltotriose uptake);
   * Braukaiser/Woodland single-infusion data; Brulosophy/BYO measured-FG dataset.
   */
  private computeEffectiveAttenuationKinetic(recipe: Recipe): number {
    const baseAtt = recipe.yeasts.length > 0
      ? recipe.yeasts[0].attenuation
      : 0.75;

    // --- Catalytic rate constants (min⁻¹ at optimal temp). Brandam-inspired form,
    // but magnitudes are calibrated to the measured-FG dataset, not Brandam's buffer
    // values (see AttenuationModelValidation.test.ts). ---
    const KA_REF = 0.11;  // α-amylase: starch → dextrins
    const KB_REF = 0.050; // β-amylase: starch/dextrins → fermentable

    // Gaussian catalytic activity
    const betaActivity  = (T: number) => Math.exp(-0.5 * ((T - 63) / 5) ** 2);
    const alphaActivity = (T: number) => Math.exp(-0.5 * ((T - 70) / 6) ** 2);
    // Limit dextrinase: debranching enzyme, optimum ~61 °C, near-dead above ~67 °C
    // (Stenholm & Home 1999). It's the single strongest predictor of wort
    // fermentability (r=0.84, beating α and β) — it cleaves the α-1,6 branch
    // points β-amylase can't, turning limit dextrin back into β-convertible chains.
    const ldActivity = (T: number) => Math.exp(-0.5 * ((T - 61) / 3.5) ** 2);

    // In-mash thermal inactivation, anchored to Muller (1991) directly-measured
    // first-order decay constants: k₆₅ = 0.0434 min⁻¹ (β, 16-min half-life),
    // 0.0163 min⁻¹ (α, 43-min half-life). The buffer-measured Brandam/De Schepper
    // Arrhenius rates leave β fully active for an hour at 67 °C — wrong for a
    // substrate-protected mash, and it flattens the fermentability spread. β has
    // the steeper thermal cliff (dies hard >67 °C); α survives toward ~78 °C.
    // 13 % of β is a thermostable isoform that resists denaturation (De Schepper 2022).
    const BETA_RESIDUAL = 0.13;
    const betaKd  = (T: number) => 0.0434 * Math.exp(0.23 * (T - 65));
    const alphaKd = (T: number) => 0.0163 * Math.exp(0.103 * (T - 65));
    // Limit dextrinase thermal decay: stable to ~62.5 °C, ~60 % surviving 1 h at
    // 65 °C, near-total loss approaching 70 °C (Stenholm & Home 1999).
    const ldKd    = (T: number) => 0.0085 * Math.exp(0.45  * (T - 65));

    // --- ODE solver: semi-analytical Euler ---
    const DT = 0.5; // time step (minutes)

    // α-amylase is an endo-enzyme: it yields a fermentable-rich spectrum
    // (maltose/maltotriose/glucose), NOT pure dextrin. ALPHA_FERM is the
    // fermentable share of α's output — it sets the high-temperature floor (an
    // α-only mash still ferments ~62%). Of the non-fermentable remainder, CONV_FRAC
    // is β-convertible dextrin and the rest is branch-limited dextrin β can never
    // reach — this caps the low-temperature limit (~86%). These two constants are
    // what make wort fermentability vary ~2%/°C instead of the raw enzyme swing.
    const ALPHA_FERM = 0.62;
    const CONV_FRAC = 0.40;  // β-reachable share of α's dextrin output; the rest
                             // is α-1,6 branch-limited, reachable only via LD
    const KLD_REF = 0.28;    // limit dextrinase debranching rate (min⁻¹ at optimum)

    const simulateMash = (
      mashSteps: Array<{ temperatureC?: number; durationMinutes?: number }>
    ): number => {
      let S = 1.0;   // unconverted starch
      let Dc = 0;    // β-convertible dextrin
      let Dl = 0;    // limit (branched) dextrin — fermentable only once debranched
      let F = 0;     // fermentable sugar

      let alphaLabile = 1.0;
      let betaLabile  = 1.0;
      let ldLabile    = 1.0;

      for (const step of mashSteps) {
        const T = step.temperatureC ?? RecipeCalculationService.MASH_WINDOW.center;
        const totalTime = Math.max(0, step.durationMinutes ?? 0);
        if (totalTime <= 0) continue;

        const aAct = alphaActivity(T);
        const bAct = betaActivity(T);
        const ldAct = ldActivity(T);
        const aKd  = alphaKd(T);
        const bKd  = betaKd(T);
        const ldKdT = ldKd(T);

        const nSteps = Math.max(1, Math.ceil(totalTime / DT));
        const dt = totalTime / nSteps;

        for (let i = 0; i < nSteps; i++) {
          const t = i * dt;

          // Analytical enzyme survival at time t within this step
          const alpha = alphaLabile * Math.exp(-aKd * t);
          const betaSurv = BETA_RESIDUAL + (1 - BETA_RESIDUAL) * betaLabile * Math.exp(-bKd * t);
          const ldSurv = ldLabile * Math.exp(-ldKdT * t);

          const ka = KA_REF * aAct * alpha;
          const kb = KB_REF * bAct * betaSurv;
          const kld = KLD_REF * ldAct * ldSurv;

          // α on starch → fermentable + convertible dextrin + limit dextrin
          const aFlux = ka * S * dt;
          // β on starch → maltose; β on convertible dextrin → maltose
          const bFromS = kb * S * dt;
          const bFromDc = kb * Dc * dt;
          // limit dextrinase debranches limit dextrin → β-convertible dextrin
          const ldFlux = Math.min(Dl, kld * Dl * dt);

          S  = Math.max(0, S - aFlux - bFromS);
          Dc = Math.max(0, Dc + aFlux * (1 - ALPHA_FERM) * CONV_FRAC - bFromDc + ldFlux);
          Dl = Math.max(0, Dl + aFlux * (1 - ALPHA_FERM) * (1 - CONV_FRAC) - ldFlux);
          F  = Math.max(0, F + aFlux * ALPHA_FERM + bFromS + bFromDc);
        }

        // Carry over enzyme denaturation for next step (banked across the mash)
        alphaLabile *= Math.exp(-aKd * totalTime);
        betaLabile  *= Math.exp(-bKd * totalTime);
        ldLabile    *= Math.exp(-ldKdT * totalTime);
      }

      // Fermentable fraction of all extract (S + Dc + Dl + F = 1). Fermentable
      // sugar accumulates and never reverts, so a low β-rest is "banked" even if
      // later steps run hot — the physical basis for step-mash fermentability.
      return F + S * ALPHA_FERM; // treat any residual starch as if α-converted
    };

    const center = RecipeCalculationService.MASH_WINDOW.center;
    const steps = recipe.mashSteps.length > 0
      ? recipe.mashSteps
      : [{ temperatureC: center, durationMinutes: 60 }];

    const actualAL = simulateMash(steps);
    const refAL = simulateMash([{ temperatureC: center, durationMinutes: 60 }]);
    if (refAL <= 0 || actualAL <= 0) return baseAtt;

    // Map the wort's attenuation-limit ratio to apparent attenuation, anchored so the
    // 67.5 °C reference returns the yeast's published number. Real attenuation is always
    // ≤ the wort's chemical limit, and the GAP is set by the sugar spectrum — which mash
    // temperature controls:
    //   • cool mash (β-amylase) → maltose-rich → fermented fast & fully → AA ≈ limit;
    //   • hot mash (α-amylase, β denatured) → more maltotriose + dextrins → maltotriose is
    //     taken up last and often incompletely (AGT1; strain-dependent, "maltotriose-negative"
    //     is a known trait — Stewart), dextrins not at all → AA pulls progressively *below*
    //     the limit.
    // So the reach gain is asymmetric: a fermentable (cool, ratio > 1) wort is compressed
    // toward the limit (GAIN_FERMENTABLE < 1); a dextriny (hot, ratio < 1) wort falls away
    // from it (GAIN_DEXTRINOUS > 1). The two blend with a logistic in d = ratio − 1, so the
    // slope is continuous (no kink at the reference — that point is just our anchor). The
    // DIRECTION is mechanistic (the flat/proportional hot side wrongly assumes constant
    // reach); the MAGNITUDE is calibrated to the measured beers, like every rate above.
    // Calibrated to ~33 measured-FG beers; clean-data MAE ~4.3 %, hot-region bias ~0 (the
    // earlier proportional hot side ran +6–10 high on 71–73 °C lagers). Hot end rests on ~3
    // single-infusion batches, so it's the least-certain region — now unbiased, not high.
    const ratio = actualAL / refAL;
    const d = ratio - 1;
    const GAIN_FERMENTABLE = 0.45; // cool/maltose-rich wort: yeast nearly reaches the limit
    const GAIN_DEXTRINOUS = 1.60;  // hot/maltotriose-heavy wort: yeast falls short of it
    const GAIN_WIDTH = 0.06;       // logistic transition half-width (≈ β-denaturation band)
    const gain = GAIN_FERMENTABLE + (GAIN_DEXTRINOUS - GAIN_FERMENTABLE) / (1 + Math.exp(d / GAIN_WIDTH));
    const scaled = 1 + d * gain;
    return Math.max(0.5, Math.min(0.95, baseAtt * scaled));
  }

  /**
   * Calculate Alcohol By Volume
   * Formula: ABV = (OG - FG) × 131.25
   *
   * Delegates to the shared `abvFromOGFG` helper (`@/calculators/abv`) so the
   * formula lives in exactly one place and the two implementations can't drift.
   */
  calculateABV(og: number, fg: number): number {
    return abvFromOGFG(og, fg);
  }

  /**
   * Calculate IBU using Tinseth formula.
   *
   * `boilGravity` is the average wort gravity over the boil (Tinseth's bigness
   * factor expects the mean, not the post-boil OG). Defaults to `og` for callers
   * that don't compute it.
   */
  calculateIBU(recipe: Recipe, og: number, boilGravity: number = og): number {
    const { hops, batchVolumeL, equipment } = recipe;

    if (hops.length === 0 || batchVolumeL <= 0) {
      return 0;
    }

    // IBU is the iso-alpha concentration fixed at flameout, so it references the
    // post-boil (kettle) volume — the standard Tinseth convention, NOT the
    // finished/into-fermenter volume.
    const ibuVolumeGal = volumeCalculationService.calculatePostBoilVolume(recipe) * LITERS_TO_GALLONS;
    if (ibuVolumeGal <= 0) {
      return 0;
    }

    const totalIBU = hops.reduce((sum, hop) => {
      const ibu = this.calculateSingleHopIBU(hop, og, ibuVolumeGal, boilGravity, equipment.boilTimeMin);
      return sum + ibu;
    }, 0);

    return Math.round(totalIBU * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate IBU contribution from a single hop addition.
   *
   * `ibuVolumeGal` is the post-boil (kettle) volume in gallons — the volume the
   * iso-alpha is dissolved in at flameout (standard Tinseth convention).
   * Kettle additions (boil, first wort, mash) use `boilGravity` (boil average);
   * whirlpool uses `og` since it happens after the boil. `boilTimeMin` anchors
   * first-wort hops to the full boil duration. A +10% utilization factor is
   * applied to the isomerization model (assumes pellet hops, the common case;
   * matches Brewer's Friend / Brewfather defaults).
   */
  calculateSingleHopIBU(
    hop: Hop,
    og: number,
    ibuVolumeGal: number,
    boilGravity: number = og,
    boilTimeMin: number = 60,
  ): number {
    const { alphaAcid, grams, type, timeMinutes = 0, temperatureC = 80, whirlpoolTimeMinutes } = hop;

    // --- Dry hop: humulinone dissolution model (not Tinseth) ---
    // Dry hopping contributes bitterness via humulinone (oxidized alpha acid)
    // extraction, NOT via thermal isomerization. Requires its own model.
    //
    // Science basis (Maye et al. 2016, Lafontaine & Shellhammer 2017):
    //   - Pellet hops contain ~0.3-0.5% humulinones by weight (use 0.4% avg)
    //   - ~75% of humulinones extract into beer at fermentation temps in 24h
    //   - Extraction rate drops at very high dry-hop rates (saturation)
    //   - Humulinones have an IBU spectrophotometer response factor of 0.54
    //     (i.e. 1 mg/L humulinones ≈ 0.54 IBU on a spectrophotometer)
    //   - Non-isomerized alpha acids also dissolve (~1% at fermentation temps),
    //     contributing at ~0.62 IBU response factor per mg/L
    if (type === 'dry hop') {
      const beerVolumeL = ibuVolumeGal / LITERS_TO_GALLONS;
      const dryHopRateGL = grams / beerVolumeL;

      // Humulinone contribution
      const humulinoneFraction = 0.004;  // ~0.4% of hop weight is humulinones (pellets)
      const humulinoneMg = grams * humulinoneFraction * 1000; // convert g → mg
      // Extraction efficiency: ~75% at moderate rates, decreasing at high rates
      // Maye 2016: ~98% at 0.5 lb/bbl (~4 g/L), ~47% at 2 lb/bbl (~16 g/L)
      const extractionRate = 0.75 * Math.exp(-0.04 * Math.max(0, dryHopRateGL - 4));
      const humulinonePpm = (humulinoneMg * extractionRate) / beerVolumeL;
      const humulinoneIbu = humulinonePpm * 0.54;

      // Non-isomerized alpha acid contribution
      // ~1% of alpha acids dissolve at fermentation temps
      // (5.9% figure from Alchemy Overlord SMPH is for hot-side oxidation, not cold dry hop)
      // Calibrated against Maye 2016: 142g Centennial/10%AA/16L → +18.5 IBU measured
      const alphaAcidMg = grams * (alphaAcid / 100) * 1000;
      const dissolvedAaMg = alphaAcidMg * 0.01;
      const dissolvedAaPpm = dissolvedAaMg / beerVolumeL;
      const alphaAcidIbu = dissolvedAaPpm * 0.62;

      return humulinoneIbu + alphaAcidIbu;
    }

    // --- All other types: Tinseth isomerization model ---
    let utilization = 0;

    switch (type) {
      case 'boil':
        utilization = this.tinsethUtilization(timeMinutes, boilGravity);
        break;
      case 'first wort':
        // FWH steeps for the entire boil, so anchor utilization to the full boil
        // time (the per-hop time is intentionally unset for FWH). The +20 min
        // bonus reflects extra isomerization during lauter/heat-up.
        utilization = this.tinsethUtilization(boilTimeMin + 20, boilGravity);
        break;
      case 'whirlpool': {
        // Post-boil addition: wort is at OG by now, so use og (not the boil average).
        // Use whirlpoolTimeMinutes if available, fallback to timeMinutes for backward compatibility
        const wpTime = whirlpoolTimeMinutes ?? timeMinutes ?? 15;
        utilization = this.whirlpoolUtilization(wpTime, temperatureC, og);
        break;
      }
      case 'mash':
        // BeerSmith approach: -80% reduction vs equivalent boil (i.e. 20% of boil utilization)
        // Mash temps (~65°C) are well below isomerization threshold; minimal carryover
        utilization = this.tinsethUtilization(timeMinutes || 5, boilGravity) * 0.20;
        break;
    }

    // Pellet utilization bonus: +10% on the Tinseth isomerization model, matching
    // Brewer's Friend's documented default and Brewfather's pellet handling. Whole
    // leaf gets no bonus (lower utilization than pellets); an unset form defaults
    // to pellet (the common case). Dry hop returned earlier, so it's unaffected.
    if (hop.form !== 'leaf') utilization *= 1.1;

    // Tinseth formula using imperial units
    // Convert grams to ounces, then calculate AAU
    const oz = grams / 28.3495;
    const aau = oz * alphaAcid;  // Alpha Acid Units
    const ibu = (aau * utilization * 75) / ibuVolumeGal;

    return ibu;
  }

  /**
   * Tinseth utilization formula
   */
  private tinsethUtilization(minutes: number, wortGravity: number): number {
    const gravityFactor = 1.65 * Math.pow(0.000125, wortGravity - 1);
    const timeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
    return gravityFactor * timeFactor;
  }

  /**
   * Whirlpool utilization with temperature adjustment
   */
  private whirlpoolUtilization(
    minutes: number,
    tempC: number,
    wortGravity: number
  ): number {
    const clampedTemp = Math.max(60, Math.min(100, tempC));
    const tempFactor = tempC <= 60 ? 0 : Math.pow((clampedTemp - 60) / 40, 1.8);
    return this.tinsethUtilization(minutes, wortGravity) * tempFactor;
  }

  /**
   * Calculate calories and carbohydrates per 355 ml (12 oz) serving.
   *
   * Uses the standard brewing formulas:
   *   OE (Original Extract, °P)  = SG-to-Plato conversion of OG
   *   AE (Apparent Extract, °P)  = SG-to-Plato conversion of FG
   *   RE (Real Extract, °P)      = 0.1808 × OE + 0.8192 × AE
   *   ABW (Alcohol by Weight %)  = (OE - RE) / (2.0665 - 0.010665 × OE)
   *   Calories per litre          = (6.9 × ABW + 4.0 × (RE - 0.1)) × FG × 10
   *   Carbs (g/L)                = (RE − 0.1) × FG × 10  (residual extract as carbs)
   *
   * Reference: "Brew By The Numbers" – Hall, Zymurgy 1995
   */
  calculateNutrition(og: number, fg: number): { calories: number; carbsG: number } {
    // SG → °Plato via the shared ASBC polynomial (see @/calculators/units).
    const oe = sgToPlato(og); // Original Extract in °Plato
    const ae = sgToPlato(fg); // Apparent Extract in °Plato

    // Real Extract (Balling formula)
    const re = 0.1808 * oe + 0.8192 * ae;

    // Alcohol by Weight
    const abw = (oe - re) / (2.0665 - 0.010665 * oe);

    // Calories per litre of beer
    const calPerL = (6.9 * abw + 4.0 * (re - 0.1)) * fg * 10;

    // Carbohydrates per litre (residual extract approximated as carbs)
    const carbsPerL = (re - 0.1) * fg * 10;

    // Scale to 355 ml (12 oz) serving
    const servingL = 0.355;

    return {
      calories: Math.max(0, Math.round(calPerL * servingL)),
      carbsG: Math.max(0, Math.round(carbsPerL * servingL * 10) / 10),
    };
  }

  /**
   * Calculate SRM color using Morey equation
   */
  calculateSRM(recipe: Recipe): number {
    const { fermentables, batchVolumeL } = recipe;

    if (fermentables.length === 0 || batchVolumeL <= 0) {
      return 0;
    }

    const batchVolumeGal = batchVolumeL * LITERS_TO_GALLONS;

    const totalMCU = fermentables.reduce((sum, fermentable) => {
      const weightLbs = fermentable.weightKg * KG_TO_LBS;
      const mcu = (fermentable.colorLovibond * weightLbs) / batchVolumeGal;
      return sum + mcu;
    }, 0);

    // Morey equation: SRM = 1.4922 × MCU^0.6859
    return 1.4922 * Math.pow(totalMCU, 0.6859);
  }
}

// Export singleton instance for convenience
export const recipeCalculationService = new RecipeCalculationService();
