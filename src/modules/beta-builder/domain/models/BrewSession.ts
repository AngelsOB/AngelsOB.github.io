/**
 * Brew Session Domain Models
 *
 * A BrewSession represents an actual brew day where a recipe is executed.
 * It tracks:
 * - The original recipe (what was planned)
 * - The brew day recipe (what was actually used - may have modifications)
 * - Actual measurements taken during brewing
 * - Calculated efficiency metrics
 */

import type { Recipe } from './Recipe';

export type SessionId = string;

export type SessionStatus =
  | 'planning'      // Session created but not started
  | 'brewing'       // Currently brewing
  | 'fermenting'    // In fermentation
  | 'conditioning'  // Conditioning/carbonating
  | 'completed';    // Finished

/**
 * Per-mash-step actual measurements (HS Brew Mode — Phase 2.5b)
 */
export type MashStepActual = {
  actualTempC?: number;
  /** Minutes into the brew when this rest temp was reached */
  timeHitMin?: number;
};

/**
 * Per-fermentation-step actual measurements (HS Brew Mode — Phase 2.5b)
 */
export type FermentationStepActual = {
  actualTempC?: number;
  actualDays?: number;
};

/**
 * Per-mash-addition actual amount (HS Brew Mode — Phase 2.5b).
 * Unit is taken from the recipe's otherIngredient; only the amount is tracked.
 */
export type MashAdditionActual = {
  actualAmount?: number;
};

/**
 * One row in the 10-row gravity log (HS Brew Mode — Phase 2.5b)
 */
export type GravityLogEntry = {
  date?: string;
  sg?: number;
  ph?: number;
  tempC?: number;
  notes?: string;
};

/**
 * Actual measurements taken during brew day
 */
export type SessionActuals = {
  // Volume measurements (liters)
  strikeWaterL?: number;
  spargeWaterL?: number;
  preBoilVolumeL?: number;
  postBoilVolumeL?: number;
  /** Hot post-boil volume (before chilling); separate from postBoilVolumeL which is cooled-into-fermenter */
  postBoilVolumeHotL?: number;
  intoFermenterL?: number;
  packagedVolumeL?: number;

  // Temperature measurements (°C)
  strikeWaterTempC?: number;
  spargeWaterTempC?: number;
  mashTempC?: number;

  // Gravity measurements (specific gravity, e.g., 1.050)
  preBoilGravity?: number;
  originalGravity?: number;
  finalGravity?: number;

  // Chemistry measurements
  mashPH?: number;
  finalPH?: number;

  // Time tracking
  boilTimeMin?: number;
  fermentationDays?: number;

  // Per-step actuals (HS Brew Mode — Phase 2.5b)
  /** Keyed by mashStep.id */
  mashStepActuals?: Record<string, MashStepActual>;
  /** Keyed by fermentationStep.id */
  fermentationStepActuals?: Record<string, FermentationStepActual>;
  /** Keyed by otherIngredient.id (timing === "mash") */
  mashAdditionActuals?: Record<string, MashAdditionActual>;
  /** Sparse 10-row gravity log */
  gravityLog?: GravityLogEntry[];
  /** Mash check measurements (iodine test result + runnings SGs) */
  mashChecks?: {
    iodineNegative?: boolean;
    firstRunningsSG?: number;
    lastRunningsSG?: number;
  };

  /**
   * Per-ingredient actual amounts used during brew day, keyed by ingredient id.
   * Values are in the ingredient's native unit (kg for grains, g for hops,
   * g for salts, recipe-defined unit for otherIngredients). Used to recompute
   * OG / IBU / water profile from actuals when measurements differ from plan.
   *
   * Sentinel ids for water salts: `salt:mash:<key>` and `salt:sparge:<key>`
   * (e.g. `salt:mash:gypsum_g`), plus `salt:mash:lacticAcid` and
   * `salt:mash:bakingSodaPh` for pH-adjustment additions.
   *
   * (HS Brew Mode — Phase 2.5b)
   */
  ingredientActualAmounts?: Record<string, number>;
};

/**
 * Calculated metrics from actuals
 */
export type SessionCalculated = {
  /** Actual ABV calculated from measured OG/FG */
  actualABV?: number;

  /** Mash efficiency % (from pre-boil gravity vs expected) */
  mashEfficiency?: number;

  /** Brewhouse efficiency % (from OG vs expected) */
  brewhouseEfficiency?: number;

  /** Apparent attenuation % (from OG/FG) */
  apparentAttenuation?: number;
};

/**
 * A complete brew session
 */
export type BrewSession = {
  /** Unique session ID */
  id: SessionId;

  /** Link to original recipe */
  recipeId: string;
  recipeVersionNumber: number;
  recipeName: string; // Snapshot for display even if recipe deleted
  brewedVersionNumber?: number;

  /** Original recipe (what was planned - read-only reference) */
  originalRecipe: Recipe;

  /** Brew day recipe (what was actually used - can be modified) */
  brewDayRecipe: Recipe;

  /** Actual measurements taken during brew day */
  actuals: SessionActuals;

  /**
   * Workflow state — which hop / other-ingredient additions have been physically
   * added during the boil. Keyed by hop.id or otherIngredient.id.
   * Not a measurement, so it lives on BrewSession rather than SessionActuals.
   * (HS Brew Mode — Phase 2.5b)
   */
  addedFlags?: Record<string, boolean>;

  /** Auto-calculated metrics */
  calculated?: SessionCalculated;

  /** Brew day metadata */
  brewDate: string; // ISO timestamp
  status: SessionStatus;

  /** Free-form notes about the brew day */
  notes?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
};
