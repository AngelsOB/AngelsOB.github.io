'use client';

import type { RecipeWithCalcs } from '../compareUtils';
import { getWeightedMashTemp, avg } from '../compareUtils';

export default function MashComparison({ items }: { items: RecipeWithCalcs[] }) {
  const mashData = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    steps: recipe.mashSteps || [],
    weightedTemp: getWeightedMashTemp(recipe),
  }));

  // If no recipes have mash steps, hide the section
  const hasMashData = mashData.some((m) => m.steps.length > 0);
  if (!hasMashData) return null;

  const temps = mashData.map((m) => m.weightedTemp).filter((t): t is number => t !== null);
  const avgTemp = temps.length > 0 ? avg(temps) : null;

  // Max number of steps across all recipes
  const maxSteps = Math.max(...mashData.map((m) => m.steps.length));

  return (
    <section className="section-soft rounded-xl p-5">
      <h2 className="brew-section-title text-lg mb-4">Mash Schedule</h2>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-[rgb(var(--brew-border))]">
              <th className="text-left py-2 pr-4 font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Step</th>
              {mashData.map((m) => (
                <th key={m.id} className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider max-w-[140px] truncate">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSteps }).map((_, stepIdx) => (
              <tr key={stepIdx} className="border-b border-[rgb(var(--brew-border))]/50">
                <td className="py-2 pr-4 font-medium text-[var(--fg-muted)]">
                  Step {stepIdx + 1}
                </td>
                {mashData.map((m) => {
                  const step = m.steps[stepIdx];
                  return (
                    <td key={m.id} className="py-2 px-3 text-right">
                      {step ? (
                        <div>
                          <span className="font-medium">{step.temperatureC}°C</span>
                          <span className="text-[var(--fg-muted)] ml-1 text-xs">
                            {step.durationMinutes}min
                          </span>
                          {step.name && (
                            <div className="text-[var(--fg-muted)] text-xs truncate">
                              {step.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Weighted average temperature row */}
            <tr className="bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] font-bold">
              <td className="py-2 pr-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                Weighted Avg
              </td>
              {mashData.map((m) => (
                <td key={m.id} className="py-2 px-3 text-right">
                  {m.weightedTemp != null ? `${m.weightedTemp.toFixed(1)}°C` : '—'}
                </td>
              ))}
            </tr>
            {avgTemp != null && (
              <tr className="bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] font-bold">
                <td className="py-2 pr-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                  Overall Avg
                </td>
                <td colSpan={mashData.length} className="py-2 px-3 text-right">
                  {avgTemp.toFixed(1)}°C
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
