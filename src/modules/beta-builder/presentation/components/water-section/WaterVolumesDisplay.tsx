/**
 * Water Volumes Display Component
 *
 * Shows the calculated water volumes for brew day:
 * - Mash Water (strike water)
 * - Sparge Water
 * - Pre-Boil Volume (with gravity)
 * - Total Water
 *
 * Also shows the boil concentration summary: how gravity evolves
 * from pre-boil through boil-off and cooling to OG.
 */

import type { Recipe, RecipeCalculations } from "../../../domain/models/Recipe";

type Props = {
  /** Recipe calculations containing water volume data */
  calculations: RecipeCalculations;
  /** Recipe for equipment parameters needed to derive gravity stats */
  recipe: Recipe;
};

export default function WaterVolumesDisplay({ calculations, recipe }: Props) {
  // Derive boil concentration stats
  const boilOffL =
    (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const postBoilHotL = Math.max(0, calculations.preBoilVolumeL - boilOffL);
  const shrinkageFactor = 1 + recipe.equipment.coolingShrinkagePercent / 100;
  const postBoilColdL = postBoilHotL / shrinkageFactor;
  const preBoilGravity =
    calculations.preBoilVolumeL > 0
      ? 1 + ((calculations.og - 1) * postBoilColdL) / calculations.preBoilVolumeL
      : calculations.og;

  const cardStyle = {
    background: 'rgb(var(--brew-card-inset) / 0.4)',
    border: '1px solid rgb(var(--brew-border-subtle))',
    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
  };

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fg-strong)' }}>
        Volumes
      </h3>

      {/* Main volume cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Mash Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">
            Mash Water
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
            {calculations.mashWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">
            Strike water
          </div>
        </div>

        {/* Sparge Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">
            Sparge Water
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
            {calculations.spargeWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">
            For sparging
          </div>
        </div>

        {/* Pre-Boil Volume */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">
            Pre-Boil
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
            {calculations.preBoilVolumeL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">
            In kettle
          </div>
        </div>

        {/* Total Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">
            Total Water
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
            {calculations.totalWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">
            Grand total
          </div>
        </div>
      </div>

      {/* Boil concentration summary */}
      {calculations.og > 1.0 && (
        <div
          className="mt-3 rounded-lg px-4 py-3 flex items-center gap-2 overflow-x-auto"
          style={{
            ...cardStyle,
            background: 'rgb(var(--brew-card-inset) / 0.25)',
          }}
        >
          {/* Pre-Boil */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs text-muted">Pre-Boil</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
              {preBoilGravity.toFixed(3)}
            </span>
          </div>

          {/* Arrow + boil off */}
          <div className="flex items-center gap-1 shrink-0 mx-1">
            <span className="text-muted text-xs">—</span>
            <span className="text-[10px] text-muted whitespace-nowrap">
              {boilOffL.toFixed(1)}L boil-off
            </span>
            <span className="text-muted text-xs">→</span>
          </div>

          {/* Post-Boil */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs text-muted">Post-Boil</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
              {postBoilHotL.toFixed(1)}
              <span className="text-xs font-normal ml-0.5">L</span>
            </span>
          </div>

          {/* Arrow + cooling */}
          <div className="flex items-center gap-1 shrink-0 mx-1">
            <span className="text-muted text-xs">—</span>
            <span className="text-[10px] text-muted whitespace-nowrap">
              cool {recipe.equipment.coolingShrinkagePercent}%
            </span>
            <span className="text-muted text-xs">→</span>
          </div>

          {/* OG */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs font-medium brew-link">OG</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
              {calculations.og.toFixed(3)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
