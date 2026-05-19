/**
 * BrewDayNumbersSection
 *
 * Quick-reference grid of brew day numbers:
 * water volumes (mash, sparge, total), strike temp, mash pH,
 * pre-boil volume & gravity, OG, FG, plus boil concentration strip.
 */

import type { Recipe, RecipeCalculations } from '../../domain/models/Recipe';

interface Props {
  recipe: Recipe;
  calculations: RecipeCalculations | null;
}

/** Celsius → Fahrenheit */
const cToF = (c: number) => Math.round(c * 9 / 5 + 32);

/** Liters → US gallons */
const lToGal = (l: number) => (l * 0.264172).toFixed(2);

/** @deprecated Classic UI. Migrating to HS — see HOPSKIP_MIGRATION_PRD.md §2.5. */
export default function BrewDayNumbersSection({ recipe, calculations }: Props) {
  const hasData = calculations && (calculations.og > 1 || calculations.strikeTempC != null);
  const hasGravity = calculations && calculations.og > 1.0;

  const cardStyle: React.CSSProperties = {
    background: 'color-mix(in oklch, var(--brew-card-bg), var(--brew-accent-200) 12%)',
    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
  };

  // Boil concentration strip values
  const boilOffL = calculations
    ? (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60
    : 0;
  const postBoilHotL = calculations
    ? Math.max(0, calculations.preBoilVolumeL - boilOffL)
    : 0;

  return (
    <div className="brew-section brew-animate-in brew-stagger-9" data-accent="targets">
      <h2 className="brew-section-title">Brew Day Numbers</h2>
      <p className="text-sm text-muted mt-1 mb-4">
        Key volumes and targets for brew day.
      </p>

      {!hasData ? (
        <p className="text-sm text-muted italic py-4 text-center">
          Add fermentables and mash steps to see brew day numbers.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Mash Water */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Mash Water</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.mashWaterL.toFixed(1)}
                <span className="text-lg ml-1">L</span>
              </div>
              <div className="text-xs text-muted mt-1">{lToGal(calculations.mashWaterL)} gal</div>
            </div>

            {/* Sparge Water */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Sparge Water</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.spargeWaterL.toFixed(1)}
                <span className="text-lg ml-1">L</span>
              </div>
              <div className="text-xs text-muted mt-1">{lToGal(calculations.spargeWaterL)} gal</div>
            </div>

            {/* Total Water */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Total Water</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.totalWaterL.toFixed(1)}
                <span className="text-lg ml-1">L</span>
              </div>
              <div className="text-xs text-muted mt-1">{lToGal(calculations.totalWaterL)} gal</div>
            </div>

            {/* Strike Temperature */}
            {calculations.strikeTempC != null && (
              <div className="rounded-lg p-4" style={cardStyle}>
                <div className="text-sm mb-1 font-medium brew-link">Strike Temp</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                  {calculations.strikeTempC.toFixed(1)}
                  <span className="text-lg ml-1">°C</span>
                </div>
                <div className="text-xs text-muted mt-1">{cToF(calculations.strikeTempC)}°F</div>
              </div>
            )}

            {/* Mash pH */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Mash pH</div>
              {calculations.estimatedMashPh != null ? (
                <>
                  <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                    {calculations.estimatedMashPh.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted mt-1">target 5.2–5.6</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted">—</div>
                  <div className="text-xs text-muted mt-1">Add grains to estimate</div>
                </>
              )}
            </div>

            {/* Pre-Boil Volume */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Pre-Boil Vol</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.preBoilVolumeL.toFixed(1)}
                <span className="text-lg ml-1">L</span>
              </div>
              <div className="text-xs text-muted mt-1">
                {lToGal(calculations.preBoilVolumeL)} gal
              </div>
            </div>

            {/* Pre-Boil Gravity */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">Pre-Boil SG</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.preBoilGravity.toFixed(3)}
              </div>
              <div className="text-xs text-muted mt-1">target gravity</div>
            </div>

            {/* Original Gravity */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">OG</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.og.toFixed(3)}
              </div>
              <div className="text-xs text-muted mt-1">post-boil</div>
            </div>

            {/* Final Gravity */}
            <div className="rounded-lg p-4" style={cardStyle}>
              <div className="text-sm mb-1 font-medium brew-link">FG</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--fg-strong)' }}>
                {calculations.fg.toFixed(3)}
              </div>
              <div className="text-xs text-muted mt-1">estimated</div>
            </div>
          </div>

          {/* Boil concentration strip */}
          {hasGravity && (
            <div
              className="mt-4 rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap"
              style={{
                ...cardStyle,
                background: 'color-mix(in oklch, var(--brew-accent-900) 10%, color-mix(in oklch, var(--brew-card-inset) 20%, transparent))',
                border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))',
              }}
            >
              {/* Pre-Boil SG */}
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-xs text-muted uppercase tracking-wide">Pre-Boil</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
                  {calculations.preBoilGravity.toFixed(3)}
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
                <span className="text-xs text-muted uppercase tracking-wide">Post-Boil</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
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
                <span className="text-xs font-medium brew-link uppercase tracking-wide">OG</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
                  {calculations.og.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
