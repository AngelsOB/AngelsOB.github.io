'use client';

import type { RecipeWithCalcs } from '../compareUtils';
import {
  getGrainBreakdown,
  normalizeGrainName,
  avg,
  GRAIN_CATEGORY_COLORS,
  GRAIN_CATEGORY_ORDER,
  type FermentableGroup,
} from '../compareUtils';

export default function GrainComparison({ items }: { items: RecipeWithCalcs[] }) {
  const breakdowns = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    breakdown: getGrainBreakdown(recipe),
  }));

  // Collect all categories present across all recipes
  const allCategories = GRAIN_CATEGORY_ORDER.filter((cat) =>
    breakdowns.some((b) => b.breakdown[cat]),
  );

  // Average percentages per category
  const avgBreakdown: Partial<Record<FermentableGroup, number>> = {};
  for (const cat of allCategories) {
    avgBreakdown[cat] = avg(breakdowns.map((b) => b.breakdown[cat]?.pct ?? 0));
  }

  // Build normalized grain data per category — merge grains with the same normalized name
  // Also build per-breakdown normalized lookup for the table cells
  const normalizedBreakdowns = breakdowns.map((b) => {
    const normalized: Record<string, Record<string, number>> = {}; // category → normalizedName → pct
    for (const cat of allCategories) {
      const entry = b.breakdown[cat];
      if (!entry) continue;
      normalized[cat] = {};
      for (const g of entry.grains) {
        const norm = normalizeGrainName(g.name);
        normalized[cat][norm] = (normalized[cat][norm] || 0) + g.pct;
      }
    }
    return { ...b, normalized };
  });

  // Collect common grains per category using normalized names
  const commonGrainsPerCategory: Partial<Record<FermentableGroup, { name: string; count: number; avgPct: number }[]>> = {};
  for (const cat of allCategories) {
    const grainCounts: Record<string, { count: number; pctSum: number }> = {};
    for (const b of normalizedBreakdowns) {
      const catData = b.normalized[cat];
      if (!catData) continue;
      for (const [normName, pct] of Object.entries(catData)) {
        if (!grainCounts[normName]) grainCounts[normName] = { count: 0, pctSum: 0 };
        grainCounts[normName].count += 1;
        grainCounts[normName].pctSum += pct;
      }
    }
    commonGrainsPerCategory[cat] = Object.entries(grainCounts)
      .map(([name, data]) => ({ name, count: data.count, avgPct: data.pctSum / items.length }))
      .sort((a, b) => b.avgPct - a.avgPct);
  }

  return (
    <section className="section-soft rounded-xl p-5">
      <h2 className="brew-section-title text-lg mb-4">Grain Bill</h2>

      {/* Stacked bars */}
      <div className="space-y-3 mb-6">
        {breakdowns.map((b) => (
          <div key={b.id}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold max-w-[200px] truncate">{b.name}</span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-full">
              {GRAIN_CATEGORY_ORDER.map((cat) => {
                const entry = b.breakdown[cat];
                if (!entry || entry.pct < 0.5) return null;
                return (
                  <div
                    key={cat}
                    className="h-full transition-all"
                    style={{
                      width: `${entry.pct}%`,
                      backgroundColor: GRAIN_CATEGORY_COLORS[cat],
                    }}
                    title={`${cat}: ${entry.pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Average bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Average</span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-full">
            {GRAIN_CATEGORY_ORDER.map((cat) => {
              const pct = avgBreakdown[cat];
              if (!pct || pct < 0.5) return null;
              return (
                <div
                  key={cat}
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: GRAIN_CATEGORY_COLORS[cat],
                  }}
                  title={`${cat}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {allCategories.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: GRAIN_CATEGORY_COLORS[cat] }}
            />
            <span>{cat}</span>
          </div>
        ))}
      </div>

      {/* Detailed breakdown per category */}
      <div className="space-y-5">
        {allCategories.map((cat) => (
          <div key={cat}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: GRAIN_CATEGORY_COLORS[cat] }} />
              {cat}
              <span className="text-[var(--fg-muted)] font-normal text-xs ml-1">
                avg {(avgBreakdown[cat] ?? 0).toFixed(1)}%
              </span>
            </h3>

            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="border-b border-[rgb(var(--brew-border))]">
                    <th className="text-left py-1.5 pr-4 font-medium text-[var(--fg-muted)] text-xs">Grain</th>
                    {breakdowns.map((b) => (
                      <th key={b.id} className="py-1.5 px-2 text-right font-medium text-[var(--fg-muted)] text-xs max-w-[100px] truncate">
                        {b.name}
                      </th>
                    ))}
                    <th className="py-1.5 pl-2 text-right font-medium text-[var(--fg-muted)] text-xs">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {(commonGrainsPerCategory[cat] || []).map((grain) => (
                    <tr key={grain.name} className="border-b border-[rgb(var(--brew-border))]/30">
                      <td className="py-1.5 pr-4 text-xs">
                        {grain.name}
                        {grain.count > 1 && (
                          <span className="ml-1 text-[10px] text-[var(--fg-muted)]">
                            ({grain.count}/{items.length})
                          </span>
                        )}
                      </td>
                      {normalizedBreakdowns.map((b) => {
                        const catData = b.normalized[cat];
                        const pct = catData?.[grain.name];
                        return (
                          <td key={b.id} className="py-1.5 px-2 text-right text-xs">
                            {pct ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-2 text-right text-xs font-semibold">
                        {grain.avgPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {/* Category total row */}
                  <tr className="bg-[color-mix(in_oklch,var(--fg-strong)_4%,transparent)]">
                    <td className="py-1.5 pr-4 text-xs font-semibold">Total</td>
                    {normalizedBreakdowns.map((b) => (
                      <td key={b.id} className="py-1.5 px-2 text-right text-xs font-semibold">
                        {b.breakdown[cat] ? `${b.breakdown[cat]!.pct.toFixed(1)}%` : '—'}
                      </td>
                    ))}
                    <td className="py-1.5 pl-2 text-right text-xs font-bold">
                      {(avgBreakdown[cat] ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
