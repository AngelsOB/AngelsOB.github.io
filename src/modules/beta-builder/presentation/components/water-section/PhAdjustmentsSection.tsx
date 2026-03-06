/**
 * pH Adjustments Section Component
 *
 * Displays the estimated mash pH with status indicators and
 * action buttons to add pH adjustment ingredients (lactic acid or baking soda).
 */

import type { RecipeCalculations } from "../../../domain/models/Recipe";

type Props = {
  /** Recipe calculations containing mash pH data */
  calculations: RecipeCalculations;
  /** Whether water chemistry has been configured */
  hasWaterChemistry: boolean;
  /** Callback when user adds a pH adjustment ingredient */
  onAddPhAdjustment: (name: string, amount: number, unit: string) => void;
};

export default function PhAdjustmentsSection({
  calculations,
  hasWaterChemistry,
  onAddPhAdjustment,
}: Props) {
  const ph = calculations.estimatedMashPh;
  if (ph == null) return null;

  const adj = calculations.mashPhAdjustment;
  const inRange = ph >= 5.2 && ph <= 5.6;
  const inIdeal = ph >= 5.2 && ph <= 5.4;

  // Semantic colors for pH status (data-driven, not theme colors)
  const statusColor = inIdeal
    ? 'var(--brew-success)'
    : inRange
      ? 'var(--brew-warning)'
      : 'var(--brew-danger)';

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fg-strong)' }}>
        Estimated Mash pH
      </h3>
      <div
        className="rounded-lg p-4"
        style={{
          background: `color-mix(in oklch, ${statusColor} 10%, rgb(var(--brew-card-inset) / 0.4))`,
          border: `1px solid color-mix(in oklch, ${statusColor} 25%, rgb(var(--brew-border-subtle)))`,
          borderLeft: `3px solid ${statusColor}`,
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className="text-3xl font-bold"
              style={{ color: statusColor }}
            >
              {ph.toFixed(2)}
            </div>
            <div className="text-xs text-muted mt-1">
              {hasWaterChemistry ? "With water profile" : "DI water estimate"} &middot;
              Target: 5.2–5.6
            </div>
          </div>
          {adj && adj.lacticAcid88Ml > 0 && (
            <button
              onClick={() =>
                onAddPhAdjustment("Lactic acid (88%)", adj.lacticAcid88Ml, "ml")
              }
              className="brew-chip-active text-xs px-3 py-1.5 rounded-md text-right transition-colors cursor-pointer"
            >
              <div className="font-semibold">
                + Add ~{adj.lacticAcid88Ml} mL lactic acid (88%)
              </div>
              <div className="text-muted">
                to reach pH {adj.targetPh.toFixed(1)}
              </div>
            </button>
          )}
          {adj && adj.bakingSodaG > 0 && (
            <button
              onClick={() => onAddPhAdjustment("Baking soda", adj.bakingSodaG, "g")}
              className="brew-chip-active text-xs px-3 py-1.5 rounded-md text-right transition-colors cursor-pointer"
            >
              <div className="font-semibold">
                + Add ~{adj.bakingSodaG} g baking soda
              </div>
              <div className="text-muted">
                to reach pH {adj.targetPh.toFixed(1)}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
