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
import { inferFermentability, inferType } from '../../data/fermentablePresets';

export type AttenuationModel = 'linear' | 'enzyme_kinetics' | 'brandam_ode';

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
    const ibu = this.calculateIBU(recipe, og);
    const srm = this.calculateSRM(recipe);

    // Volume calculations
    const preBoilVolumeL = volumeCalculationService.calculatePreBoilVolume(recipe);
    const mashWaterL = volumeCalculationService.calculateMashWater(recipe);
    const spargeWaterL = volumeCalculationService.calculateSpargeWater(recipe);
    const totalWaterL = volumeCalculationService.calculateTotalWater(recipe);

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

    // Pre-boil gravity: dilute OG back to pre-boil volume
    const boilOffL = (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
    const shrinkageFactor = 1 + recipe.equipment.coolingShrinkagePercent / 100;
    const postBoilColdL = Math.max(0, (preBoilVolumeL - boilOffL) / shrinkageFactor);
    const preBoilGravity = preBoilVolumeL > 0
      ? 1 + ((og - 1) * postBoilColdL) / preBoilVolumeL
      : og;

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
   * Calculate Original Gravity
   * Formula: OG = 1 + (total gravity points / batch volume in gallons)
   *
   * Mash efficiency is applied to grains and mashable adjuncts. Sugars and
   * extracts dissolve completely and use 100% efficiency.
   */
  calculateOG(recipe: Recipe): number {
    const { fermentables, batchVolumeL, equipment } = recipe;

    if (fermentables.length === 0 || batchVolumeL <= 0) {
      return 1.0;
    }

    const batchVolumeGal = batchVolumeL * 0.264172; // liters to gallons
    const mashEfficiency = equipment.mashEfficiencyPercent / 100;

    const totalGravityPoints = fermentables.reduce((sum, fermentable) => {
      const weightLbs = fermentable.weightKg * 2.20462; // kg to lbs
      const efficiency = this.getEfficiency(fermentable, mashEfficiency);
      const points = fermentable.ppg * weightLbs * efficiency;
      return sum + points;
    }, 0);

    const gravityPoints = totalGravityPoints / batchVolumeGal;
    return 1 + gravityPoints / 1000;
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
   */
  calculateFG(recipe: Recipe, options?: CalcOptions): number {
    const { fermentables, batchVolumeL, equipment } = recipe;

    // --- 1. Split gravity points by fermentability ---
    const batchVolumeGal = batchVolumeL * 0.264172;
    const mashEfficiency = equipment.mashEfficiencyPercent / 100;

    let fermentablePts = 0;
    let nonFermentablePts = 0;

    if (fermentables.length > 0 && batchVolumeGal > 0) {
      for (const f of fermentables) {
        const weightLbs = f.weightKg * 2.20462;
        const efficiency = this.getEfficiency(f, mashEfficiency);
        const pts = (f.ppg * weightLbs * efficiency) / batchVolumeGal;
        const ferm = this.getFermentability(f);
        fermentablePts += pts * ferm;
        nonFermentablePts += pts * (1 - ferm);
      }
    }

    const totalPts = fermentablePts + nonFermentablePts;
    // Guard: if no gravity points, nothing to attenuate
    if (totalPts <= 0) return 1.0;

    // --- 2. Effective attenuation (yeast + process adjustments) ---
    const model = options?.attenuationModel ?? 'linear';
    let effAtt: number;
    if (model === 'brandam_ode') {
      effAtt = this.computeEffectiveAttenuationODE(recipe);
    } else if (model === 'enzyme_kinetics') {
      effAtt = this.computeEffectiveAttenuationEnzyme(recipe);
    } else {
      effAtt = this.computeEffectiveAttenuation(recipe);
    }

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
    const type = inferType(f.name);
    if (type === 'sugar' || type === 'extract') return 1.0;
    return mashEfficiency;
  }

  /**
   * Compute effective attenuation from yeast base + mash adjustments.
   *
   * Factors: mash temperature (ref 67 °C, ~1%/°C per Braukaiser) and
   * mash duration (ref 60 min, capped ±3%). Result clamped to [0.60, 0.95].
   *
   * Reference temperature of 67 °C is the midpoint of the beta-/alpha-amylase
   * activity balance observed in Braukaiser's single-infusion mash experiments.
   *
   * Fermentation temperature, fermentation duration, and decoction bonuses
   * were removed — fermentation has a terminal gravity determined by wort
   * composition, not time or temp, and controlled experiments (Brulosophy)
   * found no measurable attenuation difference from decoction with modern malts.
   */
  private computeEffectiveAttenuation(recipe: Recipe): number {
    const baseAtt = recipe.yeasts.length > 0
      ? recipe.yeasts[0].attenuation
      : 0.75;

    // Mash adjustments
    const MASH_TEMP_REF_C = 67; // Braukaiser midpoint of the brewer's window
    let stepTimeTotal = 0;
    let tempAdjAcc = 0;
    for (const step of recipe.mashSteps) {
      const t = Math.max(0, step.durationMinutes || 0);
      stepTimeTotal += t;
      // Braukaiser research: ~1% attenuation change per °C (6% over 64→70°C)
      tempAdjAcc += (MASH_TEMP_REF_C - (step.temperatureC || MASH_TEMP_REF_C)) * 0.01 * t;
    }
    const avgTempAdj = stepTimeTotal > 0 ? tempAdjAcc / stepTimeTotal : 0;
    const totalMashTime = stepTimeTotal > 0 ? stepTimeTotal : 60;
    const mashTimeAdj = Math.max(-0.03, Math.min(0.03, ((totalMashTime - 60) / 15) * 0.005));

    return Math.max(0.6, Math.min(0.95,
      baseAtt + avgTempAdj + mashTimeAdj,
    ));
  }

  /**
   * Enzyme kinetics attenuation model.
   *
   * Models α- and β-amylase as competing enzymes with:
   *   1. Temperature-dependent catalytic activity (Gaussian curves)
   *   2. Arrhenius thermal inactivation (first-order, from mashing experiments)
   *   3. Residual thermostable β-amylase fraction (fractional conversion)
   *   4. Accumulated denaturation across mash steps
   *
   * The ratio of β-amylase work to total work determines the fermentable
   * fraction of wort sugars. This raw ratio is mapped to effective
   * attenuation through log-space damping to match the empirical ~1%/°C
   * observed by Braukaiser in the brewing range (64-72°C), while allowing
   * natural acceleration at extreme temperatures.
   *
   * Behaviour:
   *   62–72°C  ~1%/°C    (matches Braukaiser single-infusion data)
   *   72–80°C  ~2–5%/°C  (β-amylase denaturing rapidly)
   *   80°C+    att → 0   (β dead, only residual trace + α producing dextrins)
   *   < 60°C   flattens  (β dominates, diminishing returns)
   *
   * Sources:
   *   - Brandam et al., "A kinetic model for the mashing process" (2003)
   *     Arrhenius denaturation parameters from mashing experiments:
   *     β-amylase: A=7.6e60, Ea=410.7 kJ/mol; α-amylase: A=6.9e30, Ea=224.2 kJ/mol
   *   - De Schepper et al., J. Am. Soc. Brew. Chem. (2022)
   *     β-amylase fractional conversion: 13% thermostable residual
   *   - Evans et al., "Impact of Thermostability of α-Amylase, β-Amylase,
   *     and Limit Dextrinase on Potential Wort Fermentability" (2003)
   *     Validates: α-amylase retains ~100% activity after 1 hr at 65°C
   *   - Braukaiser, "Effect of Mash Parameters on Fermentability" (2009)
   *     Empirical calibration target: ~1% attenuation change per °C
   */
  private computeEffectiveAttenuationEnzyme(recipe: Recipe): number {
    const baseAtt = recipe.yeasts.length > 0
      ? recipe.yeasts[0].attenuation
      : 0.75;

    // --- Enzyme catalytic activity: Gaussian temperature optima ---
    const betaActivity  = (T: number) => Math.exp(-0.5 * ((T - 63) / 5) ** 2);
    const alphaActivity = (T: number) => Math.exp(-0.5 * ((T - 70) / 6) ** 2);

    // --- Arrhenius thermal inactivation ---
    // kd(T) = A × exp(-Ea / (R × T_K))   [min⁻¹]
    // Parameters from Brandam et al. (2003), calibrated from mashing experiments.
    const R_GAS = 8.314; // J/(mol·K)

    // β-amylase: very temperature-sensitive, denatures rapidly above 65°C
    //   Half-lives: ~38 hr at 60°C, ~2 hr at 67°C, ~33 min at 70°C, ~14 min at 72°C
    const BETA_KD_A  = 7.6e60;   // pre-exponential factor
    const BETA_KD_EA = 410700;   // activation energy (J/mol)

    // 13% of β-amylase is a thermostable isoform that resists denaturation
    // (De Schepper et al. 2022 — fractional conversion inactivation model)
    const BETA_RESIDUAL = 0.13;

    // α-amylase: very thermostable, essentially immortal at mashing temps
    //   Half-lives: ~82 hr at 67°C, ~8 hr at 80°C, ~33 min at 90°C
    //   Evans (2003): retains ~100% after 1 hr at 65°C during mashing
    const ALPHA_KD_A  = 6.9e30;
    const ALPHA_KD_EA = 224200;

    const betaKd  = (T: number) => BETA_KD_A  * Math.exp(-BETA_KD_EA  / (R_GAS * (T + 273.15)));
    const alphaKd = (T: number) => ALPHA_KD_A * Math.exp(-ALPHA_KD_EA / (R_GAS * (T + 273.15)));

    // --- Accumulate enzyme work across mash steps ---
    //
    // "Work" = ∫ activity(T) × surviving_fraction(t) dt
    //
    // For β-amylase with residual fraction f_res:
    //   surviving(t) = f_res + (1 - f_res) × labile_remaining × exp(-kd × t)
    //   ∫₀ᵗ surviving(s) ds = f_res × t + labile × (1 - exp(-kd×t)) / kd
    //
    // Denaturation accumulates across steps: if 50% of labile β-amylase
    // died in step 1 at 65°C, step 2 at 72°C starts with only 50%.

    let betaWork = 0;
    let alphaWork = 0;
    let betaLabile  = 1.0; // surviving labile β fraction (relative to initial)
    let alphaLabile = 1.0; // surviving α fraction

    const steps = recipe.mashSteps.length > 0
      ? recipe.mashSteps
      : [{ temperatureC: 67, durationMinutes: 60 }];

    for (const step of steps) {
      const T = step.temperatureC ?? 67;
      const t = Math.max(0, step.durationMinutes ?? 0);
      if (t <= 0) continue;

      const bRate = betaActivity(T);
      const aRate = alphaActivity(T);
      const bKd = betaKd(T);
      const aKd = alphaKd(T);

      // β-amylase work: residual (always active) + labile (decaying)
      const bLabileInt = bKd * t > 1e-6
        ? (1 - Math.exp(-bKd * t)) / bKd
        : t; // Taylor approx when kd≈0
      betaWork += bRate * (BETA_RESIDUAL * t + betaLabile * (1 - BETA_RESIDUAL) * bLabileInt);

      // α-amylase work: no residual fraction (already extremely thermostable)
      const aLabileInt = aKd * t > 1e-6
        ? (1 - Math.exp(-aKd * t)) / aKd
        : t;
      alphaWork += aRate * alphaLabile * aLabileInt;

      // Update surviving labile fractions for next step
      betaLabile  *= Math.exp(-bKd * t);
      alphaLabile *= Math.exp(-aKd * t);
    }

    const totalWork = betaWork + alphaWork;
    if (totalWork <= 0) return 0;

    const fermentableFraction = betaWork / totalWork;

    // --- Reference: 67°C / 60 min single infusion ---
    const refBKd = betaKd(67);
    const refAKd = alphaKd(67);
    const refBLabileInt = refBKd * 60 > 1e-6
      ? (1 - Math.exp(-refBKd * 60)) / refBKd
      : 60;
    const refBetaWork  = betaActivity(67) * (BETA_RESIDUAL * 60 + (1 - BETA_RESIDUAL) * refBLabileInt);
    const refALabileInt = refAKd * 60 > 1e-6
      ? (1 - Math.exp(-refAKd * 60)) / refAKd
      : 60;
    const refAlphaWork = alphaActivity(67) * refALabileInt;
    const refFraction  = refBetaWork / (refBetaWork + refAlphaWork);

    // --- Log-space damping with variable sensitivity ---
    //
    // Maps the enzyme work ratio to effective attenuation. The raw ratio
    // changes ~7%/°C (too steep). Log-space compression + sensitivity
    // tuning matches the empirical ~1%/°C:
    //
    //   logRatio    = ln(fraction / refFraction)
    //   sensitivity = BASE_S + ACCEL × logRatio²
    //   scaledAtt   = baseAtt × exp(logRatio × sensitivity)
    //
    // BASE_S gives ~1.3%/°C at the 67°C reference. ACCEL adds a quadratic
    // term that accelerates the curve at extreme temps where enzymes
    // denature rapidly.

    if (fermentableFraction <= 0) return 0;

    const BASE_S = 0.10;   // calibrated for ~1.3%/°C at 67°C (empirical median ~2.5%/°C; conservative)
    const ACCEL  = 0.008;  // quadratic acceleration at extremes

    const logRatio    = Math.log(fermentableFraction / refFraction);
    const sensitivity = BASE_S + ACCEL * logRatio * logRatio;
    const scaledAtt   = baseAtt * Math.exp(logRatio * sensitivity);

    return Math.max(0, Math.min(0.95, scaledAtt));
  }

  /**
   * Full ODE kinetics attenuation model (Brandam et al. 2003).
   *
   * Unlike the enzyme_kinetics model which computes a work *ratio*,
   * this model directly simulates the mash by tracking sugar species:
   *   Starch →(α)→ Dextrins (non-fermentable)
   *   Starch →(β)→ Fermentable sugars (maltose)
   *   Dextrins →(β)→ Fermentable sugars
   *
   * Enzyme denaturation uses the same Arrhenius parameters (Brandam),
   * and β-amylase retains 13% thermostable fraction (De Schepper 2022).
   *
   * The simulation is solved via semi-analytical Euler: enzyme survival
   * is computed analytically (exact exponential decay), while sugar
   * concentrations are updated with forward Euler at 0.5 min steps.
   *
   * Output: the fraction of total sugar that is fermentable (F), normalized
   * against a 67°C/60min reference, then mapped to effective attenuation
   * via log-space damping (same technique as enzyme_kinetics model).
   *
   * Advantages over enzyme_kinetics model:
   *   - Tracks substrate depletion (enzymes compete for finite starch)
   *   - Models the α→β pipeline (α produces dextrins that β then converts)
   *   - More physically accurate step mash behavior
   *
   * Sources:
   *   - Brandam et al., "A kinetic model for the mashing process" (2003)
   *     Rate constants: ka=0.07 min⁻¹ (α), kb=0.02 min⁻¹ (β)
   *   - De Schepper et al., J. Am. Soc. Brew. Chem. (2022) — 13% residual β
   *   - Evans et al. (2003) — α-amylase thermostability validation
   */
  private computeEffectiveAttenuationODE(recipe: Recipe): number {
    const baseAtt = recipe.yeasts.length > 0
      ? recipe.yeasts[0].attenuation
      : 0.75;

    // --- Brandam catalytic rate constants (min⁻¹ at optimal temp) ---
    const KA_REF = 0.07;  // α-amylase: starch → dextrins
    const KB_REF = 0.02;  // β-amylase: starch/dextrins → fermentable

    // Gaussian catalytic activity (same as enzyme_kinetics)
    const betaActivity  = (T: number) => Math.exp(-0.5 * ((T - 63) / 5) ** 2);
    const alphaActivity = (T: number) => Math.exp(-0.5 * ((T - 70) / 6) ** 2);

    // Arrhenius denaturation (same parameters as enzyme_kinetics)
    const R_GAS = 8.314;
    const BETA_KD_A  = 7.6e60,  BETA_KD_EA = 410700, BETA_RESIDUAL = 0.13;
    const ALPHA_KD_A = 6.9e30,  ALPHA_KD_EA = 224200;

    const betaKd  = (T: number) => BETA_KD_A  * Math.exp(-BETA_KD_EA  / (R_GAS * (T + 273.15)));
    const alphaKd = (T: number) => ALPHA_KD_A * Math.exp(-ALPHA_KD_EA / (R_GAS * (T + 273.15)));

    // --- ODE solver: semi-analytical Euler ---
    const DT = 0.5; // time step (minutes)

    const simulateMash = (
      mashSteps: Array<{ temperatureC?: number; durationMinutes?: number }>
    ): number => {
      let S = 1.0;  // starch (normalized, all available)
      let D = 0;    // dextrins (non-fermentable)
      let F = 0;    // fermentable sugars

      let alphaLabile = 1.0;
      let betaLabile  = 1.0;

      for (const step of mashSteps) {
        const T = step.temperatureC ?? 67;
        const totalTime = Math.max(0, step.durationMinutes ?? 0);
        if (totalTime <= 0) continue;

        const aAct = alphaActivity(T);
        const bAct = betaActivity(T);
        const aKd  = alphaKd(T);
        const bKd  = betaKd(T);

        const nSteps = Math.max(1, Math.ceil(totalTime / DT));
        const dt = totalTime / nSteps;

        for (let i = 0; i < nSteps; i++) {
          const t = i * dt;

          // Analytical enzyme survival at time t within this step
          const alpha = alphaLabile * Math.exp(-aKd * t);
          const betaSurv = BETA_RESIDUAL + (1 - BETA_RESIDUAL) * betaLabile * Math.exp(-bKd * t);

          // Effective catalytic rates
          const ka = KA_REF * aAct * alpha;
          const kb = KB_REF * bAct * betaSurv;

          // Sugar species changes (Euler step)
          // dS/dt = -(ka + kb) * S
          // dD/dt = ka * S - kb * D
          // dF/dt = kb * (S + D)
          const dS = (ka + kb) * S * dt;
          const dDfromStarch = ka * S * dt;
          const dDtaken = kb * D * dt;
          const dFfromStarch = kb * S * dt;
          const dFfromDextrin = dDtaken;

          S = Math.max(0, S - dS);
          D = Math.max(0, D + dDfromStarch - dDtaken);
          F = Math.max(0, F + dFfromStarch + dFfromDextrin);
        }

        // Carry over enzyme denaturation for next step
        alphaLabile *= Math.exp(-aKd * totalTime);
        betaLabile  *= Math.exp(-bKd * totalTime);
      }

      // Fermentable fraction of ALL sugar (including unconverted starch as non-fermentable)
      // S + D + F = 1.0 by conservation, so total = 1
      return F;
    };

    const steps = recipe.mashSteps.length > 0
      ? recipe.mashSteps
      : [{ temperatureC: 67, durationMinutes: 60 }];

    const actualF = simulateMash(steps);
    const refF = simulateMash([{ temperatureC: 67, durationMinutes: 60 }]);

    if (refF <= 0) return 0;
    if (actualF <= 0) return 0;

    // --- Log-space damping (same technique as enzyme_kinetics model) ---
    //
    // The raw ODE fermentable fraction changes ~8–10%/°C — far steeper
    // than the empirical ~1%/°C (Braukaiser). This is intrinsic to the
    // enzyme rate constants: α produces dextrins 3.5× faster than β
    // produces fermentable sugars, so small changes in the β/α balance
    // cause large swings in the output ratio.
    //
    // Log-space damping compresses the ratio to match reality while
    // preserving the ODE model's advantages (substrate depletion,
    // α→β pipeline, accumulated denaturation).
    const logRatio = Math.log(actualF / refF);
    const BASE_S = 0.10;   // calibrated for ~1.3%/°C at 67°C (empirical median ~2.5%/°C; conservative)
    const ACCEL  = 0.008;  // quadratic acceleration at extremes
    const sensitivity = BASE_S + ACCEL * logRatio * logRatio;
    const effAtt = baseAtt * Math.exp(logRatio * sensitivity);

    return Math.max(0, Math.min(0.95, effAtt));
  }

  /**
   * Calculate Alcohol By Volume
   * Formula: ABV = (OG - FG) × 131.25
   */
  calculateABV(og: number, fg: number): number {
    return (og - fg) * 131.25;
  }

  /**
   * Calculate IBU using Tinseth formula
   */
  calculateIBU(recipe: Recipe, og: number): number {
    const { hops, batchVolumeL } = recipe;

    if (hops.length === 0 || batchVolumeL <= 0) {
      return 0;
    }

    const batchVolumeGal = batchVolumeL * 0.264172;

    const totalIBU = hops.reduce((sum, hop) => {
      const ibu = this.calculateSingleHopIBU(hop, og, batchVolumeGal);
      return sum + ibu;
    }, 0);

    return Math.round(totalIBU * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate IBU contribution from a single hop addition
   */
  calculateSingleHopIBU(hop: Hop, og: number, batchVolumeGal: number): number {
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
      const batchVolumeL = batchVolumeGal / 0.264172;
      const dryHopRateGL = grams / batchVolumeL;

      // Humulinone contribution
      const humulinoneFraction = 0.004;  // ~0.4% of hop weight is humulinones (pellets)
      const humulinoneMg = grams * humulinoneFraction * 1000; // convert g → mg
      // Extraction efficiency: ~75% at moderate rates, decreasing at high rates
      // Maye 2016: ~98% at 0.5 lb/bbl (~4 g/L), ~47% at 2 lb/bbl (~16 g/L)
      const extractionRate = 0.75 * Math.exp(-0.04 * Math.max(0, dryHopRateGL - 4));
      const humulinonePpm = (humulinoneMg * extractionRate) / batchVolumeL;
      const humulinoneIbu = humulinonePpm * 0.54;

      // Non-isomerized alpha acid contribution
      // ~1% of alpha acids dissolve at fermentation temps
      // (5.9% figure from Alchemy Overlord SMPH is for hot-side oxidation, not cold dry hop)
      // Calibrated against Maye 2016: 142g Centennial/10%AA/16L → +18.5 IBU measured
      const alphaAcidMg = grams * (alphaAcid / 100) * 1000;
      const dissolvedAaMg = alphaAcidMg * 0.01;
      const dissolvedAaPpm = dissolvedAaMg / batchVolumeL;
      const alphaAcidIbu = dissolvedAaPpm * 0.62;

      return humulinoneIbu + alphaAcidIbu;
    }

    // --- All other types: Tinseth isomerization model ---
    let utilization = 0;

    switch (type) {
      case 'boil':
        utilization = this.tinsethUtilization(timeMinutes, og);
        break;
      case 'first wort':
        utilization = this.tinsethUtilization(timeMinutes + 20, og); // FWH gets bonus time
        break;
      case 'whirlpool': {
        // Use whirlpoolTimeMinutes if available, fallback to timeMinutes for backward compatibility
        const wpTime = whirlpoolTimeMinutes ?? timeMinutes ?? 15;
        utilization = this.whirlpoolUtilization(wpTime, temperatureC, og);
        break;
      }
      case 'mash':
        // BeerSmith approach: -80% reduction vs equivalent boil (i.e. 20% of boil utilization)
        // Mash temps (~65°C) are well below isomerization threshold; minimal carryover
        utilization = this.tinsethUtilization(timeMinutes || 5, og) * 0.20;
        break;
    }

    // Tinseth formula using imperial units
    // Convert grams to ounces, then calculate AAU
    const oz = grams / 28.3495;
    const aau = oz * alphaAcid;  // Alpha Acid Units
    const ibu = (aau * utilization * 75) / batchVolumeGal;

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
    // SG → °Plato (simplified polynomial, accurate to ±0.02 °P for beer range)
    const sgToPlato = (sg: number) =>
      -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;

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

    const batchVolumeGal = batchVolumeL * 0.264172;

    const totalMCU = fermentables.reduce((sum, fermentable) => {
      const weightLbs = fermentable.weightKg * 2.20462;
      const mcu = (fermentable.colorLovibond * weightLbs) / batchVolumeGal;
      return sum + mcu;
    }, 0);

    // Morey equation: SRM = 1.4922 × MCU^0.6859
    return 1.4922 * Math.pow(totalMCU, 0.6859);
  }
}

// Export singleton instance for convenience
export const recipeCalculationService = new RecipeCalculationService();
