/**
 * Domain Models for Beta Builder
 *
 * These are pure TypeScript types with no logic.
 * They represent the core data structures of the application.
 */

export type RecipeId = string;

export type Fermentable = {
  id: string;
  name: string;
  /** Weight in kilograms */
  weightKg: number;
  /** Color in Lovibond */
  colorLovibond: number;
  /** Potential gravity points per pound per gallon (e.g., 36 for 2-row malt) */
  ppg: number;
  /** Extract efficiency as percentage (e.g., 80 means 80% efficiency) */
  efficiencyPercent: number;
  /** Origin country code (e.g., "US", "DE") */
  originCode?: string;
  /** Fermentability 0-1 (e.g., 0.82 for base malt, 0 for lactose). If unset, inferred from name/category. */
  fermentability?: number;
};

export type Hop = {
  id: string;
  name: string;
  /** Alpha acid percentage (e.g., 12.5 for 12.5% AA) */
  alphaAcid: number;
  /** Weight in grams */
  grams: number;
  /** Hop addition type */
  type: 'boil' | 'whirlpool' | 'dry hop' | 'first wort' | 'mash';
  /** Time in minutes (for boil) */
  timeMinutes?: number;
  /** Temperature in Celsius (for whirlpool) */
  temperatureC?: number;
  /** Whirlpool/hopstand time in minutes (separate from boil time) */
  whirlpoolTimeMinutes?: number;
  /** Dry hop start day (day of fermentation to add, e.g., 0 = pitch day, 7 = 1 week in) */
  dryHopStartDay?: number;
  /** Dry hop duration in days */
  dryHopDays?: number;
  /** Hop flavor profile (optional) */
  flavor?: {
    citrus: number;
    tropicalFruit: number;
    stoneFruit: number;
    berry: number;
    floral: number;
    grassy: number;
    herbal: number;
    spice: number;
    resinPine: number;
  };
};

export type YeastType = "liquid-100" | "liquid-200" | "dry" | "slurry";

export type StarterStep = {
  id: string;
  /** Starter volume in liters */
  liters: number;
  /** Starter gravity (e.g., 1.036) */
  gravity: number;
  /** Growth model */
  model: { kind: "white"; aeration: "none" | "shaking" } | { kind: "braukaiser" };
};

export type StarterInfo = {
  /** Package type */
  yeastType: YeastType;
  /** Number of packages/packs */
  packs: number;
  /** Manufacturing date (for viability calculation) */
  mfgDate?: string;
  /** Slurry volume in liters (for slurry type) */
  slurryLiters?: number;
  /** Slurry density in billion cells per mL (for slurry type) */
  slurryBillionPerMl?: number;
  /** Starter steps (up to 3) */
  steps: StarterStep[];
};

export type Yeast = {
  id: string;
  name: string;
  /** Attenuation percentage (e.g., 0.75 for 75% attenuation) */
  attenuation: number;
  /** Laboratory/manufacturer (e.g., "Wyeast", "White Labs") */
  laboratory?: string;
  /** Starter information (optional) */
  starter?: StarterInfo;
};

/**
 * A single step in the mash schedule
 */
export type MashStep = {
  id: string;
  /** Step name (e.g., "Protein Rest", "Beta Rest", "Mash Out") */
  name: string;
  /** Target temperature in Celsius */
  temperatureC: number;
  /** Step duration in minutes */
  durationMinutes: number;
  /** Decoction volume in liters (for decoction steps) */
  decoctionVolumeLiters?: number;
};

/**
 * Fermentation step types
 */
export type FermentationStepType = 'primary' | 'secondary' | 'conditioning' | 'cold-crash' | 'diacetyl-rest';

/**
 * A single step in the fermentation schedule
 */
export type FermentationStep = {
  id: string;
  /** Step name (e.g., "Primary Fermentation", "Dry Hop", "Cold Crash") */
  name: string;
  /** Step type */
  type: FermentationStepType;
  /** Duration in days */
  durationDays: number;
  /** Temperature in Celsius */
  temperatureC: number;
  /** Optional notes for this step */
  notes?: string;
};

/**
 * Category for other/miscellaneous ingredients
 */
export type OtherIngredientCategory =
  | 'water-agent'
  | 'fining'
  | 'spice'
  | 'flavor'
  | 'herb'
  | 'other';

/**
 * A miscellaneous ingredient (water agents, finings, spices, etc.)
 * Excludes water salts (those are in waterChemistry.saltAdditions)
 */
export type OtherIngredient = {
  id: string;
  /** Ingredient name (e.g., "Whirlfloc", "Lactic acid") */
  name: string;
  /** Ingredient category */
  category: OtherIngredientCategory;
  /** Amount (numeric value, interpreted with unit) */
  amount: number;
  /** Unit of measurement (g, kg, tsp, tbsp, oz, lb, ml, l, drops, capsule, tablet, packet) */
  unit: string;
  /** When in the process to add this ingredient */
  timing: 'mash' | 'boil' | 'whirlpool' | 'secondary' | 'kegging' | 'bottling';
  /** Optional free-form notes */
  notes?: string;
};

/**
 * Brew day checkpoint stages — defines when a checklist item appears in the markdown
 */
export type BrewDayStage =
  | 'water-prep'       // Before mashing (strike water heating)
  | 'mash'             // During mash
  | 'pre-boil'         // After mash, before boil
  | 'boil'             // During the boil
  | 'post-boil'        // Immediately after boil / whirlpool
  | 'pitch'            // Yeast pitching
  | 'fermentation'     // During fermentation
  | 'dry-hop'          // Dry hop timing
  | 'cold-crash'       // Cold crash start
  | 'packaging';       // Packaging / carbonation

/**
 * A single brew day checklist item — can be a static default or user-customised
 */
export type BrewDayChecklistItem = {
  id: string;
  /** Short label shown as the checkbox line */
  label: string;
  /** When in the brew day this checkpoint appears */
  stage: BrewDayStage;
  /** Optional longer description / instructions */
  details?: string;
  /** Whether this item is enabled (user can toggle off defaults they don't need) */
  enabled: boolean;
};

export type Recipe = {
  id: RecipeId;
  name: string;

  /** Recipe metadata */
  style?: string; // BJCP style name (e.g., "American IPA")
  notes?: string; // Brew notes, tasting notes, etc.
  tags?: string[]; // User-defined tags (e.g., ["hoppy", "sessionable", "summer"])

  /** Version control */
  currentVersion: number; // Current version number (starts at 1)
  parentRecipeId?: string; // If this is a variation/fork, the ID of the parent recipe
  parentVersionNumber?: number; // If this is a variation/fork, which version was forked
  parentRecipeName?: string; // Denormalized parent recipe name (for fork attribution)
  parentRecipeOwnerName?: string; // Denormalized parent recipe owner name (for fork attribution)
  parentRecipeShareSlug?: string; // Share slug for linking back to the parent public recipe

  /** Target batch volume in liters (final packaged volume — fermenter loss is added on top) */
  batchVolumeL: number;

  /** Equipment profile name (references saved equipment profile) */
  equipmentProfileName?: string;

  /** Equipment settings */
  equipment: {
    /** Boil time in minutes */
    boilTimeMin: number;
    /** Boil-off rate in liters per hour */
    boilOffRateLPerHour: number;
    /** Mash efficiency percentage */
    mashEfficiencyPercent: number;
    /** Mash thickness in liters per kilogram (typical: 3.0) */
    mashThicknessLPerKg: number;
    /** Grain absorption in liters per kilogram (typical: 1.04) */
    grainAbsorptionLPerKg: number;
    /** Mash tun deadspace in liters — water below false bottom/grain basket, recovered during drain (typical: 3.5) */
    mashTunDeadspaceLiters: number;
    /** Mash tun loss in liters — water actually lost in the mash tun that doesn't reach the kettle (typical: 0) */
    mashTunLossLiters: number;
    /** Kettle/trub loss in liters (typical: 1.0) */
    kettleLossLiters: number;
    /** Hop absorption in liters per kilogram (typical: 0.7) - NO LONGER OPTIONAL! */
    hopsAbsorptionLPerKg: number;
    /** Chiller loss in liters (typical: 0.5) */
    chillerLossLiters: number;
    /** Fermenter loss in liters (typical: 0.5) */
    fermenterLossLiters: number;
    /** Cooling shrinkage percentage (typical: 4.0) */
    coolingShrinkagePercent: number;
  };

  /** Ingredients */
  fermentables: Fermentable[];
  hops: Hop[];
  yeasts: Yeast[];
  otherIngredients: OtherIngredient[];

  /** Mash schedule (optional - for all-grain recipes) */
  mashSteps: MashStep[];

  /** Water chemistry (optional) */
  waterChemistry?: {
    /** Source water profile in ppm */
    sourceProfile: {
      Ca: number;
      Mg: number;
      Na: number;
      Cl: number;
      SO4: number;
      HCO3: number;
    };
    /** Total salt additions in grams (will be auto-split between mash and sparge) */
    saltAdditions: {
      gypsum_g?: number; // CaSO4·2H2O
      cacl2_g?: number; // CaCl2·2H2O
      epsom_g?: number; // MgSO4·7H2O
      nacl_g?: number; // NaCl
      nahco3_g?: number; // NaHCO3 (baking soda)
    };
    /** Source profile name for UI (e.g., "RO", "Montreal") */
    sourceProfileName?: string;
    /** Target beer style name for reference (e.g., "NEIPA", "American Pale Ale") */
    targetStyleName?: string;
    /** Custom target profile when user defines their own target (not a built-in style) */
    customTargetProfile?: {
      Ca: number;
      Mg: number;
      Na: number;
      Cl: number;
      SO4: number;
      HCO3: number;
    };
  };

  /** Fermentation schedule - list of fermentation steps */
  fermentationSteps: FermentationStep[];

  /** Brew day checklist — per-recipe overrides (optional, defaults generated at export time) */
  brewDayChecklist?: BrewDayChecklistItem[];

  /** Source — distinguishes bundled seed recipes from user recipes */
  source?: 'official' | 'community';

  /** Sharing */
  isPublic?: boolean;
  shareSlug?: string;
  publishedAt?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
};

/**
 * Calculated values for a recipe.
 * These are NOT stored in the Recipe object - they are computed on-demand.
 */
export type RecipeCalculations = {
  /** Original Gravity (e.g., 1.050) */
  og: number;
  /** Final Gravity (e.g., 1.010) - estimated for now */
  fg: number;
  /** Alcohol by Volume percentage (e.g., 5.2) */
  abv: number;
  /** International Bitterness Units */
  ibu: number;
  /** Standard Reference Method color */
  srm: number;
  /** Estimated calories per 355 ml (12 oz) serving */
  calories: number;
  /** Estimated carbohydrates (g) per 355 ml (12 oz) serving */
  carbsG: number;
  /** Pre-boil volume in liters */
  preBoilVolumeL: number;
  /** Mash water volume in liters */
  mashWaterL: number;
  /** Sparge water volume in liters */
  spargeWaterL: number;
  /** Total water needed in liters */
  totalWaterL: number;
  /** Estimated mash pH (null if cannot be calculated, e.g., extract-only) */
  estimatedMashPh: number | null;
  /** Recommended acid/base adjustment to reach target pH (null if none needed or pH unavailable) */
  mashPhAdjustment: {
    targetPh: number;
    lacticAcid88Ml: number;
    bakingSodaG: number;
  } | null;
  /** Strike water temperature in Celsius (null if no mash steps) */
  strikeTempC: number | null;
  /** Pre-boil gravity (e.g., 1.042) */
  preBoilGravity: number;
};

/**
 * Recipe version snapshot
 * Stores a complete snapshot of a recipe at a specific version number
 */
export type RecipeVersion = {
  id: string;
  /** ID of the recipe this version belongs to */
  recipeId: string;
  /** Version number (e.g., 1, 2, 3) */
  versionNumber: number;
  /** When this version was created */
  createdAt: string;
  /** Optional notes about changes in this version */
  changeNotes?: string;
  /** Full snapshot of the recipe at this version */
  recipeSnapshot: Recipe;
};

/**
 * Deep clone a Recipe object.
 * Uses structuredClone when available, falls back to JSON serialization.
 */
export function deepCloneRecipe(recipe: Recipe): Recipe {
  if (typeof structuredClone === 'function') {
    return structuredClone(recipe);
  }
  return JSON.parse(JSON.stringify(recipe));
}
