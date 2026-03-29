'use client';

import type { RecipeWithCalcs } from '../compareUtils';
import { getEffectiveWaterProfile, averageWaterProfiles, avg, type WaterProfile } from '../compareUtils';

const IONS: (keyof WaterProfile)[] = ['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'];
const ION_LABELS: Record<keyof WaterProfile, string> = {
  Ca: 'Ca²⁺',
  Mg: 'Mg²⁺',
  Na: 'Na⁺',
  Cl: 'Cl⁻',
  SO4: 'SO₄²⁻',
  HCO3: 'HCO₃⁻',
};

const SALT_KEYS = ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g', 'nahco3_g'] as const;
const SALT_LABELS: Record<string, string> = {
  gypsum_g: 'Gypsum',
  cacl2_g: 'CaCl₂',
  epsom_g: 'Epsom',
  nacl_g: 'NaCl',
  nahco3_g: 'NaHCO₃',
};

export default function WaterComparison({ items }: { items: RecipeWithCalcs[] }) {
  const waterData = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    profile: getEffectiveWaterProfile(recipe),
    salts: recipe.waterChemistry?.saltAdditions,
  }));

  const hasWaterData = waterData.some((w) => w.profile !== null);
  if (!hasWaterData) return null;

  const avgProfile = averageWaterProfiles(items.map((i) => i.recipe));
  const hasSalts = waterData.some((w) => w.salts && Object.values(w.salts).some((v) => (v ?? 0) > 0));

  return (
    <section className="section-soft rounded-xl p-5">
      <h2 className="brew-section-title text-lg mb-4">Water Chemistry</h2>

      {/* Ion profile table */}
      <div className="overflow-x-auto -mx-5 px-5 mb-6">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-[rgb(var(--brew-border))]">
              <th className="text-left py-2 pr-4 font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Ion (ppm)</th>
              {waterData.map((w) => (
                <th key={w.id} className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider max-w-[120px] truncate">
                  {w.name}
                </th>
              ))}
              <th className="py-2 pl-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Avg</th>
            </tr>
          </thead>
          <tbody>
            {IONS.map((ion) => (
              <tr key={ion} className="border-b border-[rgb(var(--brew-border))]/50">
                <td className="py-2 pr-4 font-medium">{ION_LABELS[ion]}</td>
                {waterData.map((w) => (
                  <td key={w.id} className="py-2 px-3 text-right">
                    {w.profile ? Math.round(w.profile[ion]) : '—'}
                  </td>
                ))}
                <td className="py-2 pl-3 text-right font-semibold">
                  {avgProfile ? Math.round(avgProfile[ion]) : '—'}
                </td>
              </tr>
            ))}
            {/* Cl:SO4 ratio */}
            <tr className="bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] font-bold">
              <td className="py-2 pr-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                Cl:SO₄
              </td>
              {waterData.map((w) => (
                <td key={w.id} className="py-2 px-3 text-right">
                  {w.profile && w.profile.SO4 > 0
                    ? (w.profile.Cl / w.profile.SO4).toFixed(2)
                    : '—'}
                </td>
              ))}
              <td className="py-2 pl-3 text-right">
                {avgProfile && avgProfile.SO4 > 0
                  ? (avgProfile.Cl / avgProfile.SO4).toFixed(2)
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Salt additions table */}
      {hasSalts && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-3">Salt Additions (grams)</h3>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b border-[rgb(var(--brew-border))]">
                  <th className="text-left py-2 pr-4 font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Salt</th>
                  {waterData.map((w) => (
                    <th key={w.id} className="py-2 px-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider max-w-[120px] truncate">
                      {w.name}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right font-semibold text-[var(--fg-muted)] text-xs uppercase tracking-wider">Avg</th>
                </tr>
              </thead>
              <tbody>
                {SALT_KEYS.map((saltKey) => {
                  const values = waterData.map((w) => (w.salts as Record<string, number | undefined>)?.[saltKey] ?? 0);
                  if (values.every((v) => v === 0)) return null;
                  return (
                    <tr key={saltKey} className="border-b border-[rgb(var(--brew-border))]/50">
                      <td className="py-2 pr-4 font-medium">{SALT_LABELS[saltKey]}</td>
                      {values.map((v, i) => (
                        <td key={waterData[i].id} className="py-2 px-3 text-right">
                          {v > 0 ? v.toFixed(1) : '—'}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right font-semibold">
                        {avg(values.filter((v) => v > 0)).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
