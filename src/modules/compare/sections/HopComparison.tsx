'use client';

import type { RecipeWithCalcs } from '../compareUtils';
import { getHopSummary, getRecipeFlavorProfile, avg } from '../compareUtils';
// Classic compare module is quarantined as of Phase 1.3; HS Compare uses its own
// inline radar. The OLD_ import is allowed via relative-path exemption from the
// no-restricted-imports rule (rule globs match absolute/@-prefixed paths only).
import OLD_HopFlavorRadar from '../../beta-builder/presentation/components/OLD_HopFlavorRadar';
import type { HopFlavorProfile } from '../../beta-builder/domain/models/Presets';

export default function HopComparison({ items }: { items: RecipeWithCalcs[] }) {
  const summaries = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    summary: getHopSummary(recipe),
  }));

  // Build radar series from each recipe's gram-weighted flavor profile
  const radarSeries: { name: string; flavor: HopFlavorProfile }[] = [];
  for (const { recipe } of items) {
    const profile = getRecipeFlavorProfile(recipe);
    if (profile) {
      radarSeries.push({ name: recipe.name, flavor: profile });
    }
  }

  // Collect all unique hop names across recipes
  const allHopNames = Array.from(
    new Set(summaries.flatMap((s) => s.summary.hops.map((h) => h.name))),
  ).sort();

  return (
    <section className="section-soft rounded-xl p-5">
      <h2 className="brew-section-title text-lg mb-4">Hops</h2>

      {/* Hop table per recipe */}
      <div className="overflow-x-auto -mx-5 px-5 mb-6">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-[rgb(var(--brew-border))]">
              <th className="text-left py-2 pr-4 font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Hop</th>
              {summaries.map((s) => (
                <th key={s.id} className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider max-w-[120px] truncate">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allHopNames.map((hopName) => (
              <tr key={hopName} className="border-b border-[rgb(var(--brew-border))]/50">
                <td className="py-2 pr-4 font-medium">{hopName}</td>
                {summaries.map((s) => {
                  const hop = s.summary.hops.find((h) => h.name === hopName);
                  return (
                    <td key={s.id} className="py-2 px-3 text-right">
                      {hop ? (
                        <span>
                          {hop.totalGrams.toFixed(0)}g
                          <span className="text-[var(--fg-muted)] ml-1 text-xs">
                            ({hop.avgAlphaAcid.toFixed(1)}% AA)
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Summary rows */}
            <tr className="border-t-2 border-[rgb(var(--brew-border))]">
              <td className="py-2 pr-4 font-semibold text-[var(--fg-muted)]">Total</td>
              {summaries.map((s) => (
                <td key={s.id} className="py-2 px-3 text-right font-semibold">
                  {s.summary.totalGrams.toFixed(0)}g
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold text-[var(--fg-muted)]">Hop Rate</td>
              {summaries.map((s) => (
                <td key={s.id} className="py-2 px-3 text-right font-semibold">
                  {s.summary.gramsPerLiter.toFixed(1)} g/L
                </td>
              ))}
            </tr>
            {/* Average row */}
            <tr className="bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] font-bold">
              <td className="py-2 pr-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Avg Rate</td>
              <td
                colSpan={summaries.length}
                className="py-2 px-3 text-right"
              >
                {avg(summaries.map((s) => s.summary.gramsPerLiter)).toFixed(1)} g/L
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Hop addition types per recipe */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-3">Addition Types</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summaries.map((s) => (
            <div key={s.id} className="rounded-lg border border-[rgb(var(--brew-border))]/50 p-3">
              <p className="text-xs font-semibold mb-2 truncate">{s.name}</p>
              <div className="space-y-1 text-xs">
                {s.summary.hops.flatMap((hop) =>
                  hop.additions.map((a, i) => (
                    <div key={`${hop.name}-${i}`} className="flex justify-between">
                      <span>
                        {hop.name} <span className="text-[var(--fg-muted)]">({a.type})</span>
                      </span>
                      <span className="tabular-nums">
                        {a.grams.toFixed(0)}g
                        {a.timeMinutes != null && ` @ ${a.timeMinutes}min`}
                      </span>
                    </div>
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hop flavor radar */}
      {radarSeries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-3">Flavor Profile</h3>
          <div className="flex justify-center">
            <OLD_HopFlavorRadar
              series={radarSeries}
              colorStrategy="index"
              legendPosition="bottom"
              responsive
            />
          </div>
        </div>
      )}
    </section>
  );
}
