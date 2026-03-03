/**
 * BrewDayTargetsSection
 *
 * Shows a quick-reference grid of brew day target numbers:
 * strike temp, mash pH, pre-boil volume & gravity, OG, FG.
 */

import type { Recipe, RecipeCalculations } from '../../domain/models/Recipe';

interface Props {
  recipe: Recipe;
  calculations: RecipeCalculations | null;
}

/** Celsius → Fahrenheit */
const cToF = (c: number) => Math.round(c * 9 / 5 + 32);

export default function BrewDayTargetsSection({ calculations }: Props) {
  const hasData = calculations && (calculations.og > 1 || calculations.strikeTempC != null);

  const cardStyle: React.CSSProperties = {
    background: 'color-mix(in oklch, var(--brew-card-bg), var(--brew-accent-200) 12%)',
    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-8" data-accent="targets">
      <h2 className="brew-section-title">Brew Day Targets</h2>
      <p className="text-sm text-muted mt-1 mb-4">
        Key numbers to hit on brew day.
      </p>

      {!hasData ? (
        <p className="text-sm text-muted italic py-4 text-center">
          Add fermentables and mash steps to see brew day targets.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              {(calculations.preBoilVolumeL * 0.264172).toFixed(2)} gal
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
      )}
    </div>
  );
}
