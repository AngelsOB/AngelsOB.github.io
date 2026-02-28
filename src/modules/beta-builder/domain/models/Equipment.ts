/**
 * Equipment Profile Domain Model
 *
 * Represents brewing equipment configurations that affect recipe calculations.
 * Equipment profiles can be saved and reused across multiple recipes.
 */

export type EquipmentProfile = {
  name: string;
  description?: string;

  // Volume settings
  batchSizeL: number;              // Target final volume in fermenter
  boilTimeMin: number;              // Length of boil in minutes
  boilOffRateL_hr: number;          // Evaporation rate during boil (L/hr)

  // Mash settings
  mashThicknessL_kg: number;        // Water-to-grain ratio (L/kg), typically 2.7-3.0
  mashTunDeadspaceL: number;        // Water below false bottom/grain basket (recovered during drain)
  mashTunLossL: number;             // Water actually lost in mash tun (not recovered), typically 0

  // Deadspace/Loss settings
  kettleDeadspaceL: number;         // Volume lost to kettle/trunnion
  chillerLossL: number;             // Volume lost in chiller transfer
  fermenterLossL: number;           // Volume lost in fermenter (trub, etc.)
  coolingShrinkagePercent: number;  // Wort contracts as it cools (~4%)

  // Absorption settings
  grainAbsorptionL_kg: number;      // Water absorbed by grain (typically ~0.8 L/kg)
  hopAbsorptionL_kg: number;        // Water absorbed by hops (typically ~0.7 L/kg)

  // Efficiency settings
  mashEfficiency: number;           // Mash efficiency % (0-100)
  brewhouseEfficiency: number;      // Overall brewhouse efficiency % (0-100)

  // Metadata
  isCustom?: boolean;               // Whether this is a user-created profile
};

/**
 * Default equipment profile values
 */
export const DEFAULT_EQUIPMENT: EquipmentProfile = {
  name: "Default 5 Gallon Setup",
  description: "Standard 5 gallon homebrewing equipment",
  batchSizeL: 18.9,                 // ~5 gallons
  boilTimeMin: 60,
  boilOffRateL_hr: 3.8,             // ~1 gallon/hr
  mashThicknessL_kg: 2.7,           // Typical water-to-grain ratio
  mashTunDeadspaceL: 0.95,          // ~1 quart
  mashTunLossL: 0,                  // Deadspace is recovered
  kettleDeadspaceL: 0.95,           // ~1 quart
  chillerLossL: 0,                  // Combined with kettle for simplicity
  fermenterLossL: 0.95,             // ~1 quart
  coolingShrinkagePercent: 4,       // ~4% wort contraction
  grainAbsorptionL_kg: 0.8,         // Brewfather standard
  hopAbsorptionL_kg: 0.7,           // Industry standard for hop pellets
  mashEfficiency: 75,
  brewhouseEfficiency: 72,
  isCustom: false,
};

/**
 * Common equipment profile presets
 */
export const EQUIPMENT_PRESETS: EquipmentProfile[] = [
  {
    name: "BIAB 5 Gallon",
    description: "Brew-in-a-bag setup for 5 gallon batches",
    batchSizeL: 18.9,
    boilTimeMin: 60,
    boilOffRateL_hr: 3.8,
    mashThicknessL_kg: 3.0,           // Full volume mash typical for BIAB
    mashTunDeadspaceL: 0,             // No separate mash tun
    mashTunLossL: 0,
    kettleDeadspaceL: 0.95,
    chillerLossL: 0,
    fermenterLossL: 0.95,
    coolingShrinkagePercent: 4,
    grainAbsorptionL_kg: 0.65,        // BIAB with moderate squeeze (~0.6-0.75 typical)
    hopAbsorptionL_kg: 0.7,
    mashEfficiency: 78,
    brewhouseEfficiency: 75,
    isCustom: false,
  },
  {
    name: "3-Vessel 5 Gallon",
    description: "Traditional 3-vessel system (HLT/Mash/Kettle) for 5 gallon batches",
    batchSizeL: 18.9,
    boilTimeMin: 60,
    boilOffRateL_hr: 3.8,
    mashThicknessL_kg: 2.7,
    mashTunDeadspaceL: 1.9,
    mashTunLossL: 0,
    kettleDeadspaceL: 1.9,
    chillerLossL: 0,
    fermenterLossL: 0.95,
    coolingShrinkagePercent: 4,
    grainAbsorptionL_kg: 0.8,
    hopAbsorptionL_kg: 0.7,
    mashEfficiency: 78,               // fly sparge capable
    brewhouseEfficiency: 72,
    isCustom: false,
  },
  {
    name: "Grainfather G30",
    description: "Grainfather G30 all-in-one system (220V)",
    batchSizeL: 23,                   // 6 gallon batches
    boilTimeMin: 60,
    boilOffRateL_hr: 3.0,             // Official Grainfather spec for 220V
    mashThicknessL_kg: 2.7,
    mashTunDeadspaceL: 3.5,           // Below grain basket, confirmed by GF docs
    mashTunLossL: 0,                  // Deadspace is recovered when basket lifts
    kettleDeadspaceL: 2.0,            // Trub + counterflow chiller loss
    chillerLossL: 0,                  // Combined with kettle deadspace
    fermenterLossL: 0.95,
    coolingShrinkagePercent: 4,
    grainAbsorptionL_kg: 0.8,         // Official Grainfather Recipe Creator value
    hopAbsorptionL_kg: 0.7,
    mashEfficiency: 75,
    brewhouseEfficiency: 72,
    isCustom: false,
  },
  {
    name: "3-Vessel 10 Gallon",
    description: "Traditional 3-vessel system for 10 gallon batches",
    batchSizeL: 37.9,                 // ~10 gallons
    boilTimeMin: 90,
    boilOffRateL_hr: 5.7,             // ~1.5 gallon/hr
    mashThicknessL_kg: 2.7,
    mashTunDeadspaceL: 2.8,           // ~0.75 gal, larger vessel
    mashTunLossL: 0,
    kettleDeadspaceL: 2.8,            // ~0.75 gal, larger vessel
    chillerLossL: 0,
    fermenterLossL: 1.9,
    coolingShrinkagePercent: 4,
    grainAbsorptionL_kg: 0.8,
    hopAbsorptionL_kg: 0.7,
    mashEfficiency: 78,               // fly sparge capable
    brewhouseEfficiency: 72,
    isCustom: false,
  },
  {
    name: "Anvil Foundry 10.5 Gallon",
    description: "Anvil Foundry all-in-one electric system (240V)",
    batchSizeL: 20.8,                 // ~5.5 gal — "10.5" is kettle capacity
    boilTimeMin: 60,
    boilOffRateL_hr: 3.8,             // ~1 gal/hr per manual (240V)
    mashThicknessL_kg: 2.7,
    mashTunDeadspaceL: 3.8,           // ~1 gal below malt pipe
    mashTunLossL: 0,
    kettleDeadspaceL: 0.95,           // ~1 qt, low with dip tube
    chillerLossL: 0,
    fermenterLossL: 0.95,             // ~1 qt for 5.5 gal batch
    coolingShrinkagePercent: 4,
    grainAbsorptionL_kg: 0.8,         // Malt pipe (no squeeze like BIAB)
    hopAbsorptionL_kg: 0.7,
    mashEfficiency: 75,
    brewhouseEfficiency: 70,          // Slightly conservative per user reports
    isCustom: false,
  },
];
