'use client';

import type { MeanRecipeData } from '../compareUtils';
import { GRAIN_CATEGORY_COLORS, GRAIN_CATEGORY_ORDER } from '../compareUtils';
import { srmToRgb } from '../../beta-builder/utils/srmColorUtils';

export default function MeanRecipeSummary({
  mean,
  recipeCount,
}: {
  mean: MeanRecipeData;
  recipeCount: number;
}) {
  const avgSrmColor = srmToRgb(mean.avgSrm);

  const grainCategories = GRAIN_CATEGORY_ORDER.filter(
    (cat) => mean.grainBreakdown[cat] && mean.grainBreakdown[cat]!.pct > 0.5,
  );

  return (
    <section className="card-glass rounded-2xl p-6 border-2 border-[var(--accent)]/20">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h2 className="brew-section-title text-xl">Mean Brew</h2>
          <p className="text-muted text-xs">Average across {recipeCount} recipes</p>
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'ABV', value: `${mean.avgAbv.toFixed(1)}%` },
          { label: 'OG', value: mean.avgOg.toFixed(3) },
          { label: 'FG', value: mean.avgFg.toFixed(3) },
          { label: 'IBU', value: Math.round(mean.avgIbu).toString() },
          {
            label: 'SRM',
            value: Math.round(mean.avgSrm).toString(),
            swatch: avgSrmColor,
          },
          { label: 'Cal', value: Math.round(mean.avgCalories).toString() },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
              {stat.label}
            </div>
            <div className="text-lg font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {stat.swatch && (
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10 mr-1 align-middle"
                  style={{ backgroundColor: stat.swatch }}
                />
              )}
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Grain breakdown bar + detail */}
      {grainCategories.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-2">Grain Bill</h3>
          <div className="flex h-5 w-full overflow-hidden rounded-full mb-3">
            {grainCategories.map((cat) => (
              <div
                key={cat}
                className="h-full"
                style={{
                  width: `${mean.grainBreakdown[cat]!.pct}%`,
                  backgroundColor: GRAIN_CATEGORY_COLORS[cat],
                }}
                title={`${cat}: ${mean.grainBreakdown[cat]!.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          {/* Grain detail by category */}
          <div className="space-y-2">
            {grainCategories.map((cat) => {
              const grains = mean.grainDetail.filter((g) => g.category === cat);
              if (grains.length === 0) return null;
              return (
                <div key={cat} className="flex flex-wrap items-baseline gap-x-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <span className="h-2 w-2 rounded-sm inline-block" style={{ backgroundColor: GRAIN_CATEGORY_COLORS[cat] }} />
                    {cat} ({mean.grainBreakdown[cat]!.pct.toFixed(0)}%):
                  </span>
                  {grains.map((g, i) => (
                    <span key={g.name}>
                      {g.name}
                      <span className="text-[var(--fg-muted)]"> {g.avgPct.toFixed(0)}%</span>
                      {g.count > 1 && (
                        <span className="text-[10px] text-[var(--fg-muted)]"> ({g.count}/{recipeCount})</span>
                      )}
                      {i < grains.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hops & Mash */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hops */}
        <div className="rounded-lg border border-[rgb(var(--brew-border))]/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-2">Hops</h3>
          {mean.commonHops.length > 0 ? (
            <div className="mb-2">
              <span className="text-xs text-[var(--fg-muted)]">Most common: </span>
              <span className="text-sm font-medium">{mean.commonHops.join(', ')}</span>
            </div>
          ) : (
            <p className="text-xs text-[var(--fg-muted)] mb-2">No shared hops across recipes</p>
          )}
          <div className="text-sm">
            <span className="text-[var(--fg-muted)]">Avg hop rate: </span>
            <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {mean.avgHopRate.toFixed(1)} g/L
            </span>
          </div>
        </div>

        {/* Mash & Water */}
        <div className="rounded-lg border border-[rgb(var(--brew-border))]/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-2">Mash & Water</h3>
          {mean.avgMashTempC != null ? (
            <div className="text-sm mb-2">
              <span className="text-[var(--fg-muted)]">Avg mash temp: </span>
              <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {mean.avgMashTempC.toFixed(1)}°C
              </span>
            </div>
          ) : (
            <p className="text-xs text-[var(--fg-muted)] mb-2">No mash data</p>
          )}
          {mean.avgWater ? (
            <div className="text-xs text-[var(--fg-muted)]">
              Avg water: Ca {Math.round(mean.avgWater.Ca)} · Cl {Math.round(mean.avgWater.Cl)} · SO₄ {Math.round(mean.avgWater.SO4)}
              {mean.avgWater.SO4 > 0 && (
                <span className="ml-2 font-medium">
                  (Cl:SO₄ {(mean.avgWater.Cl / mean.avgWater.SO4).toFixed(2)})
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--fg-muted)]">No water data</p>
          )}
        </div>
      </div>
    </section>
  );
}
