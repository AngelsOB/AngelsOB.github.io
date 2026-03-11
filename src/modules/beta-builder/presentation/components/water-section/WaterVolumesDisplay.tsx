/**
 * Water Volumes Display Component
 *
 * Shows the calculated water volumes for brew day:
 * - Mash Water (strike water)
 * - Sparge Water
 * - Pre-Boil Volume + target gravity (the brew-day checkpoint)
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
  const preBoilGravity = calculations.preBoilGravity;
  const hasGravity = calculations.og > 1.0;

  // Derived values for the boil concentration strip
  const boilOffL =
    (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const postBoilHotL = Math.max(0, calculations.preBoilVolumeL - boilOffL);

  const borderBase = "1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))";
  const cardStyle: React.CSSProperties = {
    background: "color-mix(in oklch, var(--brew-accent-900) 15%, color-mix(in oklch, var(--brew-card-inset) 35%, transparent))",
    borderTop: borderBase,
    borderRight: borderBase,
    borderBottom: borderBase,
    borderLeft: borderBase,
    boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.04)",
  };

  return (
    <div className="mb-6">
      <h3
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--fg-strong)" }}
      >
        Volumes
      </h3>

      {/* ── Volume cards ── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Mash Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">Mash Water</div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--fg-strong)" }}
          >
            {calculations.mashWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">Strike water</div>
        </div>

        {/* Sparge Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">Sparge Water</div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--fg-strong)" }}
          >
            {calculations.spargeWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">For sparging</div>
        </div>

        {/* Pre-Boil — the brew-day checkpoint */}
        <div
          className="rounded-lg p-4"
          style={
            hasGravity
              ? {
                  ...cardStyle,
                  borderLeft: "3px solid var(--brew-accent-400)",
                }
              : cardStyle
          }
        >
          <div className="text-sm mb-1 font-medium brew-link">Pre-Boil</div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--fg-strong)" }}
          >
            {calculations.preBoilVolumeL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          {hasGravity ? (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className="text-base font-bold tabular-nums"
                style={{ color: "var(--fg-strong)" }}
              >
                {preBoilGravity.toFixed(3)}
              </span>
              <span className="text-[10px] text-muted">target SG</span>
            </div>
          ) : (
            <div className="text-xs text-muted mt-1">In kettle</div>
          )}
        </div>

        {/* Total Water */}
        <div className="rounded-lg p-4" style={cardStyle}>
          <div className="text-sm mb-1 font-medium brew-link">Total Water</div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--fg-strong)" }}
          >
            {calculations.totalWaterL.toFixed(1)}
            <span className="text-lg ml-1">L</span>
          </div>
          <div className="text-xs text-muted mt-1">Grand total</div>
        </div>
      </div>

      {/* ── Boil concentration strip ── */}
      {hasGravity && (
        <div
          className="mt-3 rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap"
          style={{
            ...cardStyle,
            background: "color-mix(in oklch, var(--brew-accent-900) 10%, color-mix(in oklch, var(--brew-card-inset) 20%, transparent))",
          }}
        >
          {/* Pre-Boil SG */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs text-muted uppercase tracking-wide">
              Pre-Boil
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--fg-strong)" }}
            >
              {preBoilGravity.toFixed(3)}
            </span>
          </div>

          {/* → boil-off → */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted">—</span>
            <span className="text-[10px] text-muted whitespace-nowrap">
              {boilOffL.toFixed(1)}L boil-off
            </span>
            <span className="text-xs text-muted">→</span>
          </div>

          {/* Post-Boil volume */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs text-muted uppercase tracking-wide">
              Post-Boil
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--fg-strong)" }}
            >
              {postBoilHotL.toFixed(1)}
              <span className="text-xs font-normal ml-0.5">L</span>
            </span>
          </div>

          {/* → cooling → */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted">—</span>
            <span className="text-[10px] text-muted whitespace-nowrap">
              cool {recipe.equipment.coolingShrinkagePercent}%
            </span>
            <span className="text-xs text-muted">→</span>
          </div>

          {/* OG */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs font-medium brew-link uppercase tracking-wide">
              OG
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--fg-strong)" }}
            >
              {calculations.og.toFixed(3)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
