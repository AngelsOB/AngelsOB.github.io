/**
 * Mash pH Card
 *
 * Compact right-aligned card showing estimated mash pH.
 * The whole card is a button when adjustment is needed — clicking
 * adds lactic acid or baking soda to other ingredients.
 * A handwritten "Adjust pH!" scribble sits diagonally across the top-left.
 */

import type { RecipeCalculations } from "../../../domain/models/Recipe";

type Props = {
  calculations: RecipeCalculations;
  onAddPhAdjustment: (name: string, amount: number, unit: string) => void;
};

export default function OLD_PhAdjustmentsSection({
  calculations,
  onAddPhAdjustment,
}: Props) {
  const ph = calculations.estimatedMashPh;
  if (ph == null) return null;

  const adj = calculations.mashPhAdjustment;
  // Use the displayed (rounded) value for color so 5.41 → "5.41" shows green
  const displayed = Math.round(ph * 100) / 100;
  const inIdeal = displayed >= 5.2 && displayed <= 5.4;
  const inRange = displayed >= 5.2 && displayed <= 5.6;

  const statusColor = inIdeal
    ? 'var(--brew-success)'
    : inRange
      ? 'var(--brew-warning)'
      : 'var(--brew-danger)';

  const needsLactic = adj && adj.lacticAcid88Ml > 0;
  const needsBakingSoda = adj && adj.bakingSodaG > 0;
  const needsAdjustment = needsLactic || needsBakingSoda;

  const handleClick = () => {
    if (needsLactic) {
      onAddPhAdjustment("Lactic acid (88%)", adj!.lacticAcid88Ml, "ml");
    } else if (needsBakingSoda) {
      onAddPhAdjustment("Baking soda", adj!.bakingSodaG, "g");
    }
  };

  const ctaText = needsLactic
    ? `Click to add ~${adj!.lacticAcid88Ml} mL lactic acid`
    : needsBakingSoda
      ? `Click to add ~${adj!.bakingSodaG} g baking soda`
      : null;

  const Tag = needsAdjustment ? 'button' : 'div';

  return (
    <div className="relative overflow-visible shrink-0 self-stretch">
      {/* Handwritten scribble — diagonal across top-left */}
      {needsAdjustment && (
        <span className="ph-adjust-flag">Adjust pH!</span>
      )}

      <Tag
        type={needsAdjustment ? "button" : undefined}
        onClick={needsAdjustment ? handleClick : undefined}
        className={`equip-datum flex flex-col items-center justify-center h-full ${needsAdjustment ? 'ph-card-actionable cursor-pointer active:scale-[0.98] transition-all' : ''}`}
        style={{ minWidth: '140px', padding: '14px 16px 12px' }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">
          Mash pH
        </div>
        <div
          className="text-3xl font-bold tabular-nums"
          style={{ color: statusColor }}
        >
          {ph.toFixed(2)}
        </div>
        <div className="text-[10px] text-muted mt-1">
          Target: 5.2–5.4
        </div>
        {ctaText && (
          <div
            className="text-[10px] font-semibold mt-1.5"
            style={{ color: 'var(--brew-danger)' }}
          >
            {ctaText}
          </div>
        )}
      </Tag>
    </div>
  );
}
