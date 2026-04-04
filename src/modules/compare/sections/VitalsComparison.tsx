'use client';

import { useMemo } from 'react';
import type { RecipeWithCalcs } from '../compareUtils';
import { avg } from '../compareUtils';
import { srmToRgb } from '../../beta-builder/utils/srmColorUtils';
import { getBjcpStyleSpec, type RangeTuple } from '../../../utils/bjcpSpecs';

function extractBjcpCode(style?: string): string | undefined {
  if (!style) return undefined;
  return style.split('.')[0]?.trim();
}

function formatRange(range: RangeTuple | undefined, decimals = 0): string {
  if (!range) return '—';
  if (decimals > 0) return `${range[0].toFixed(decimals)}–${range[1].toFixed(decimals)}`;
  return `${range[0]}–${range[1]}`;
}

export default function VitalsComparison({ items }: { items: RecipeWithCalcs[] }) {
  const calcs = items.map((i) => i.calcs);

  // Find the most common BJCP style among recipes
  const bjcpInfo = useMemo(() => {
    const styleCounts: Record<string, number> = {};
    const styleNames: Record<string, string> = {};
    for (const { recipe } of items) {
      const code = extractBjcpCode(recipe.style);
      if (code) {
        styleCounts[code] = (styleCounts[code] || 0) + 1;
        styleNames[code] = recipe.style || '';
      }
    }
    // Find most common style
    let bestCode: string | undefined;
    let bestCount = 0;
    for (const [code, count] of Object.entries(styleCounts)) {
      if (count > bestCount) {
        bestCode = code;
        bestCount = count;
      }
    }
    if (!bestCode) return null;
    const spec = getBjcpStyleSpec(bestCode);
    if (!spec) return null;
    return { code: bestCode, name: styleNames[bestCode], spec, count: bestCount };
  }, [items]);

  return (
    <section className="section-soft rounded-xl p-5">
      <h2 className="brew-section-title text-lg mb-4">Vitals</h2>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-[rgb(var(--brew-border))]">
              <th className="text-left py-2 pr-4 font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Recipe</th>
              <th className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">ABV</th>
              <th className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">OG</th>
              <th className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">FG</th>
              <th className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">IBU</th>
              <th className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">SRM</th>
              <th className="py-2 pl-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Cal</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ recipe: r, calcs: c }) => {
              const srmColor = srmToRgb(c.srm);
              return (
                <tr key={r.id} className="border-b border-[rgb(var(--brew-border))]/50">
                  <td className="py-2.5 pr-4 max-w-[180px]">
                    <div className="font-medium truncate">{r.name}</div>
                    {r.style && (
                      <div className="text-[var(--fg-muted)] text-xs italic truncate">{r.style}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">{c.abv.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right">{c.og.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-right">{c.fg.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-right">{Math.round(c.ibu)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: srmColor }}
                      />
                      {Math.round(c.srm)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3 text-right">{Math.round(c.calories)}</td>
                </tr>
              );
            })}
            {/* Average row */}
            <tr className="bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] font-bold">
              <td className="py-2.5 pr-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                Average
              </td>
              <td className="py-2.5 px-3 text-right">{avg(calcs.map((c) => c.abv)).toFixed(1)}%</td>
              <td className="py-2.5 px-3 text-right">{avg(calcs.map((c) => c.og)).toFixed(3)}</td>
              <td className="py-2.5 px-3 text-right">{avg(calcs.map((c) => c.fg)).toFixed(3)}</td>
              <td className="py-2.5 px-3 text-right">{Math.round(avg(calcs.map((c) => c.ibu)))}</td>
              <td className="py-2.5 px-3 text-right">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: srmToRgb(avg(calcs.map((c) => c.srm))) }}
                  />
                  {Math.round(avg(calcs.map((c) => c.srm)))}
                </span>
              </td>
              <td className="py-2.5 pl-3 text-right">{Math.round(avg(calcs.map((c) => c.calories)))}</td>
            </tr>
            {/* BJCP guideline row */}
            {bjcpInfo && (
              <tr className="bg-[color-mix(in_oklch,var(--brew-info)_10%,transparent)]">
                <td className="py-2.5 pr-4 text-xs">
                  <span className="font-semibold">BJCP</span>
                  <div className="text-[var(--fg-muted)] truncate max-w-[160px]">{bjcpInfo.name}</div>
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-[var(--fg-muted)]">
                  {formatRange(bjcpInfo.spec.abv, 1)}%
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-[var(--fg-muted)]">
                  {formatRange(bjcpInfo.spec.og, 3)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-[var(--fg-muted)]">
                  {formatRange(bjcpInfo.spec.fg, 3)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-[var(--fg-muted)]">
                  {formatRange(bjcpInfo.spec.ibu)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-[var(--fg-muted)]">
                  {formatRange(bjcpInfo.spec.srm)}
                </td>
                <td className="py-2.5 pl-3 text-right text-xs text-[var(--fg-muted)]">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
