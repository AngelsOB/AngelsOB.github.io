import { hsTokens } from '@/modules/builder/tokens'
import type { Recipe, RecipeCalculations } from '@/modules/recipe/models/Recipe'
import { buildRecipeMarkdown } from '@/modules/sharing/getPublicRecipe'

import CopyMarkdownButton from './CopyMarkdownButton'

/**
 * Server-rendered recipe summary band shown at the foot of a public recipe
 * page. The interactive builder above sets its data in a useEffect, so the HTML
 * it ships has no <h1> and almost no body text. This band carries the
 * server-rendered <h1> plus the full recipe as crawlable text (collapsed into
 * an accordion so it stays tidy), and doubles as a "Copy as Markdown" export.
 */

const subhead = {
  fontFamily: hsTokens.body,
  fontSize: 13,
  fontWeight: 700,
  color: hsTokens.ink,
  margin: '16px 0 6px',
}
const listStyle = { margin: '0 0 4px', paddingLeft: 18 }

function Section({
  title,
  rows,
  ordered,
}: {
  title: string
  rows: (string | null)[]
  ordered?: boolean
}) {
  const clean = rows.filter(Boolean) as string[]
  if (!clean.length) return null
  const items = clean.map((r, i) => <li key={i}>{r}</li>)
  return (
    <>
      <h2 style={subhead}>{title}</h2>
      {ordered ? <ol style={listStyle}>{items}</ol> : <ul style={listStyle}>{items}</ul>}
    </>
  )
}

export default function RecipeSummary({
  recipe,
  calc,
  ownerName,
  slug,
}: {
  recipe: Recipe
  calc: RecipeCalculations
  ownerName: string
  slug: string
}) {
  const statLine = [
    recipe.style,
    `${calc.abv.toFixed(1)}% ABV`,
    `${Math.round(calc.ibu)} IBU`,
    `OG ${calc.og.toFixed(3)}`,
    `FG ${calc.fg.toFixed(3)}`,
    `${Math.round(calc.srm)} SRM`,
    recipe.batchVolumeL ? `${recipe.batchVolumeL} L batch` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // BJCP code stripped (e.g. "18B. American Pale Ale" → "American Pale Ale") so
  // the lead line reads as the natural search phrase "<style> recipe".
  const styleName = recipe.style ? recipe.style.replace(/^\d+[A-Z]?\.\s*/, '').trim() : ''
  const markdown = buildRecipeMarkdown(recipe, calc, ownerName, slug)

  const wc = recipe.waterChemistry
  const sp = wc?.sourceProfile
  const sa = wc?.saltAdditions || {}
  const salts = [
    sa.gypsum_g ? `Gypsum ${sa.gypsum_g} g` : null,
    sa.cacl2_g ? `CaCl₂ ${sa.cacl2_g} g` : null,
    sa.epsom_g ? `Epsom ${sa.epsom_g} g` : null,
    sa.nacl_g ? `Table salt ${sa.nacl_g} g` : null,
    sa.nahco3_g ? `Baking soda ${sa.nahco3_g} g` : null,
  ].filter(Boolean)
  const eq = recipe.equipment
  const pk = recipe.packaging

  return (
    <section
      style={{
        borderTop: `2px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
        padding: '32px clamp(20px, 4vw, 56px) 32px',
        // Cancel HSFooter's marginTop: 96 so this filled band sits flush above
        // the footer instead of floating over a 96px cream gap (−96 + 96 = 0).
        marginBottom: -96,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: hsTokens.muted,
              }}
            >
              Recipe summary
            </div>
            <h1
              style={{
                fontFamily: hsTokens.display,
                fontSize: 'clamp(24px, 3.2vw, 34px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.04,
                margin: '4px 0 0',
                color: hsTokens.ink,
              }}
            >
              {recipe.name}
            </h1>
            {recipe.subtitle ? (
              <div
                style={{
                  fontFamily: hsTokens.script,
                  fontSize: 18,
                  color: hsTokens.muted,
                  marginTop: 2,
                }}
              >
                {recipe.subtitle}
              </div>
            ) : null}
            <p
              style={{
                fontFamily: hsTokens.body,
                fontSize: 13,
                color: hsTokens.muted,
                margin: '8px 0 0',
              }}
            >
              {statLine}
              {ownerName ? ` · by ${ownerName}` : ''}
            </p>
            {styleName ? (
              <p
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 14,
                  color: hsTokens.ink,
                  margin: '10px 0 0',
                  maxWidth: 640,
                  lineHeight: 1.5,
                }}
              >
                {recipe.name} is a homebrew {styleName} recipe.
              </p>
            ) : null}
          </div>
          <CopyMarkdownButton markdown={markdown} />
        </div>

        <details style={{ marginTop: 18 }}>
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: hsTokens.body,
              fontSize: 13,
              fontWeight: 600,
              color: hsTokens.ink,
            }}
          >
            Full recipe details
          </summary>
          <div
            style={{
              marginTop: 8,
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.ink,
              lineHeight: 1.6,
            }}
          >
            <Section
              title="Vitals"
              rows={[
                `OG ${calc.og.toFixed(3)}`,
                `FG ${calc.fg.toFixed(3)}`,
                `ABV ${calc.abv.toFixed(1)}%`,
                `IBU ${Math.round(calc.ibu)}`,
                `Color ${Math.round(calc.srm)} SRM`,
                calc.estimatedMashPh != null ? `Est. mash pH ${calc.estimatedMashPh.toFixed(2)}` : null,
                `${Math.round(calc.calories)} cal / 355 mL`,
                `${calc.carbsG.toFixed(1)} g carbs / 355 mL`,
              ]}
            />
            <Section
              title="Fermentables"
              rows={(recipe.fermentables || []).map(
                (f) =>
                  `${f.weightKg} kg — ${f.name}${typeof f.colorLovibond === 'number' ? ` (${f.colorLovibond} °L)` : ''}`,
              )}
            />
            <Section
              title="Hops"
              rows={(recipe.hops || []).map((h) => {
                const bits = [
                  typeof h.alphaAcid === 'number' ? `${h.alphaAcid}% AA` : null,
                  h.type,
                  typeof h.timeMinutes === 'number' ? `${h.timeMinutes} min` : null,
                ].filter(Boolean)
                return `${h.grams} g — ${h.name}${bits.length ? ` (${bits.join(', ')})` : ''}`
              })}
            />
            <Section title="Yeast" rows={(recipe.yeasts || []).map((y) => y.name)} />
            <Section
              title="Other ingredients"
              rows={(recipe.otherIngredients || []).map((o) => `${o.amount} ${o.unit} — ${o.name}`)}
            />
            <Section
              title="Water"
              rows={[
                sp
                  ? `Source${wc?.sourceProfileName ? ` (${wc.sourceProfileName})` : ''}: Ca ${sp.Ca}, Mg ${sp.Mg}, Na ${sp.Na}, Cl ${sp.Cl}, SO₄ ${sp.SO4}, HCO₃ ${sp.HCO3} ppm`
                  : null,
                salts.length ? `Salts: ${salts.join(', ')}` : null,
                wc?.targetStyleName ? `Target: ${wc.targetStyleName}` : null,
              ]}
            />
            <Section
              title="Mash schedule"
              ordered
              rows={(recipe.mashSteps || []).map(
                (s) => `${s.name} — ${s.temperatureC}°C for ${s.durationMinutes} min`,
              )}
            />
            <Section
              title="Fermentation"
              ordered
              rows={(recipe.fermentationSteps || []).map(
                (s) =>
                  `${s.name || s.type}${typeof s.temperatureC === 'number' ? ` — ${s.temperatureC}°C` : ''}${typeof s.durationDays === 'number' ? ` for ${s.durationDays} days` : ''}`,
              )}
            />
            <Section
              title="Process"
              rows={
                eq
                  ? [
                      `Efficiency: ${eq.brewhouseEfficiencyPercent}%`,
                      `Boil: ${eq.boilTimeMin} min`,
                      `Boil-off: ${eq.boilOffRateLPerHour} L/hr`,
                      `Mash thickness: ${eq.mashThicknessLPerKg} L/kg`,
                      `Batch volume: ${recipe.batchVolumeL} L`,
                    ]
                  : []
              }
            />
            <Section
              title="Packaging"
              rows={
                pk
                  ? [
                      pk.methods?.length ? `Method: ${pk.methods.join(' + ')}` : null,
                      typeof pk.targetCo2Volumes === 'number'
                        ? `Target CO₂: ${pk.targetCo2Volumes} volumes`
                        : null,
                      pk.primingSugarType ? `Priming sugar: ${pk.primingSugarType}` : null,
                      typeof pk.conditioningDays === 'number'
                        ? `Conditioning: ${pk.conditioningDays} days${typeof pk.conditioningTempC === 'number' ? ` at ${pk.conditioningTempC}°C` : ''}`
                        : null,
                      typeof pk.servingTempC === 'number' ? `Serving temp: ${pk.servingTempC}°C` : null,
                    ]
                  : []
              }
            />
            {recipe.tags?.length ? <Section title="Tags" rows={[recipe.tags.join(', ')]} /> : null}
            {recipe.notes ? (
              <>
                <h2 style={subhead}>Notes</h2>
                <p style={{ margin: 0, maxWidth: 680 }}>{recipe.notes}</p>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  )
}
