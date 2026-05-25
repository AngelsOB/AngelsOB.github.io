/**
 * Water Section Sub-components — QUARANTINED (Phase 2.7 migration)
 *
 * Originally extracted components for the classic WaterSection.
 * Each implementation is now prefixed with `OLD_` and gated by the
 * `no-restricted-imports` ESLint rule. New code should import the HS-native
 * equivalents from `@/modules/hopskip/components/builder/WaterSection` and
 * `@/modules/hopskip/components/modals/`.
 */

export { default as OLD_WaterVolumesDisplay } from "./OLD_WaterVolumesDisplay";
export { default as OLD_PhAdjustmentsSection } from "./OLD_PhAdjustmentsSection";
export { default as OLD_SaltSummary } from "./OLD_SaltSummary";
export { default as OLD_SaltAdditionsPanel } from "./OLD_SaltAdditionsPanel";
export { default as OLD_WaterProfileComparison } from "./OLD_WaterProfileComparison";
export { default as OLD_WaterChemistrySection } from "./OLD_WaterChemistrySection";
export { default as OLD_OtherIngredientsPanel } from "./OLD_OtherIngredientsPanel";
export { default as OLD_WaterIngredientPickerModal } from "./OLD_WaterIngredientPickerModal";
export { default as OLD_CustomWaterIngredientModal } from "./OLD_CustomWaterIngredientModal";

// Re-export constants and utilities — unchanged, still used by HS-native code
export * from "./constants";
