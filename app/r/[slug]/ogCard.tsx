import { ImageResponse } from 'next/og'

import type { Recipe } from '@/modules/recipe/models/Recipe'
import type { RecipeCalculations } from '@/modules/recipe/models/Recipe'
import type { HopFlavorProfile } from '@/modules/recipe/models/Presets'
import { hopFlavorCalculationService } from '@/modules/recipe/services/HopFlavorCalculationService'
import {
  MALT_ARCHETYPES_BY_SLUG,
  aggregateMaltFlavorFrom,
  maltArchetypeForFermentable,
  type MaltFlavorProfile,
} from '@/modules/recipe/data/maltFlavor'

/**
 * Shared Open Graph card renderer for public recipes. One source of truth for
 * both the real `opengraph-image.tsx` route and the dev preview at
 * `/lab/og-preview`, so the card we iterate on IS the card that ships.
 *
 * The card mirrors the Hop Skip builder look — cream canvas, paper cards with a
 * hard ink shadow, live-number stat cards — and leads with the two flavour
 * radars (hop aroma + malt character), the differentiating viz. Everything is
 * drawn with the Satori subset next/og supports: solid fills only (no
 * `<pattern>` hatch, no `color-mix`, no CSS variables), geometry as inline
 * `<svg>` polygons, colours as literal hex/rgba.
 */

export const OG_SIZE = { width: 1200, height: 630 }

// ─── HS palette, resolved to literal values (Satori can't read var(--hs-*)) ──
const CREAM = '#f4eedd'
const PAPER = '#fffbef'
const INK = '#1a1612'
const MUTED = '#5a4f42'
const MALT = '#f2c14e'
const ROAST = '#d4452c'
const WATER = '#2b6fb8'
const HOPS = '#4a8a3d'
const SHADOW = `5px 5px 0 ${INK}`
// ink at low alpha — precomputed because Satori has no color-mix (ink = 26,22,18)
const INK_22 = 'rgba(26,22,18,0.22)'
const INK_16 = 'rgba(26,22,18,0.16)'

// ─── Font loading (module-cached across invocations) ─────────────────────────
async function loadGoogleFont(
  family: string,
  weight: number,
): Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' } | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
      {
        headers: {
          // A desktop UA makes Google serve ttf/woff (parseable) rather than woff2.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
        },
      },
    ).then((r) => r.text())
    const url = css.match(/src: url\(([^)]+)\)/)?.[1]
    if (!url) return null
    const data = await fetch(url).then((r) => r.arrayBuffer())
    return { name: family, data, weight: weight >= 700 ? 700 : 400, style: 'normal' }
  } catch {
    return null
  }
}

// ─── SRM → hex (inline, pure) ────────────────────────────────────────────────
export function srmToHex(srm: number): string {
  const s = Math.max(1, Math.min(40, srm))
  const table: [number, number, number, number][] = [
    [1, 255, 230, 153], [2, 255, 216, 120], [3, 255, 202, 90], [4, 255, 191, 66],
    [5, 251, 177, 35], [6, 248, 166, 0], [7, 243, 156, 0], [8, 234, 143, 0],
    [9, 229, 133, 0], [10, 222, 124, 0], [12, 205, 104, 0], [14, 187, 85, 0],
    [16, 173, 71, 0], [18, 160, 58, 0], [20, 149, 48, 0], [24, 122, 25, 0],
    [28, 105, 13, 0], [32, 92, 6, 0], [36, 80, 2, 0], [40, 68, 0, 0],
  ]
  let lo = table[0], hi = table[table.length - 1]
  for (let i = 0; i < table.length - 1; i++) {
    if (s >= table[i][0] && s <= table[i + 1][0]) { lo = table[i]; hi = table[i + 1]; break }
  }
  const t = hi[0] === lo[0] ? 0 : (s - lo[0]) / (hi[0] - lo[0])
  const c = (a: number, b: number) => Math.round(a + (b - a) * t)
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(c(lo[1], hi[1]))}${toHex(c(lo[2], hi[2]))}${toHex(c(lo[3], hi[3]))}`
}

// ─── Flavour axis metadata ───────────────────────────────────────────────────
// Hop radar: uniform 0–5 axes, one hop-green series (mirrors HOP_FLAVOR_KEYS order).
const HOP_AXES: { key: keyof HopFlavorProfile; max: number }[] = [
  { key: 'citrus', max: 5 }, { key: 'tropicalFruit', max: 5 }, { key: 'stoneFruit', max: 5 },
  { key: 'berry', max: 5 }, { key: 'floral', max: 5 }, { key: 'grassy', max: 5 },
  { key: 'herbal', max: 5 }, { key: 'spice', max: 5 }, { key: 'resinPine', max: 5 },
]
// Malt radar: per-axis ceilings (the cloud p99), mirrors GrainFlavorCard's MALT_AXIS_META.
const MALT_AXES: { key: keyof MaltFlavorProfile; max: number }[] = [
  { key: 'grainy', max: 1.5 }, { key: 'biscuit', max: 2.5 }, { key: 'caramel', max: 2.5 },
  { key: 'darkFruit', max: 2 }, { key: 'chocolate', max: 2.5 }, { key: 'coffee', max: 2.5 },
  { key: 'roast', max: 2.5 }, { key: 'nutty', max: 1.5 }, { key: 'honey', max: 2 },
]
const OVERFLOW = 1.25 // off-the-charts headroom past the rim

// ─── Radar geometry, drawn as an inline SVG of solid-fill shapes ─────────────
function RadarSvg({
  values, maxes, seriesColor, size,
}: {
  values: number[]; maxes: number[]; seriesColor: string; size: number
}) {
  const n = values.length
  const pad = 16
  const radius = size / 2 - pad
  const cx = size / 2
  const cy = size / 2
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pointAt = (i: number, v: number, max: number): [number, number] => {
    const r = (Math.min(max * OVERFLOW, Math.max(0, v)) / max) * radius
    const a = angleFor(i)
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const ring = (mult: number) =>
    values.map((_, i) => {
      const a = angleFor(i)
      return `${cx + radius * mult * Math.cos(a)},${cy + radius * mult * Math.sin(a)}`
    }).join(' ')
  const verts = values.map((v, i) => pointAt(i, v, maxes[i]))
  const poly = verts.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* outer disc — paper fill, like the mock radar */}
      <polygon points={ring(1)} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {[0.25, 0.5, 0.75].map((m) => (
        <polygon key={m} points={ring(m)} fill="none" stroke={INK_22} strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const a = angleFor(i)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(a)}
            y2={cy + radius * Math.sin(a)}
            stroke={INK_16}
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={poly}
        fill={seriesColor}
        fillOpacity={0.35}
        stroke={seriesColor}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {verts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={INK} />
      ))}
    </svg>
  )
}

// ─── A live-number stat card ─────────────────────────────────────────────────
function Stat({ k, v, u, accent }: { k: string; v: string; u?: string; accent: string }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        border: `2px solid ${INK}`,
        borderRadius: 12,
        boxShadow: `4px 4px 0 ${INK}`,
        padding: '14px 18px',
        overflow: 'hidden',
        minWidth: 150,
      }}
    >
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          background: accent, display: 'flex',
        }}
      />
      <div
        style={{
          fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 19,
          letterSpacing: 2, textTransform: 'uppercase', color: INK, marginTop: 6,
        }}
      >
        {k}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 2 }}>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, color: INK }}>
          {v}
        </span>
        {u ? (
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 17, color: MUTED, marginLeft: 3 }}>
            {u}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ─── A radar card (radar + caption) ──────────────────────────────────────────
function RadarCard({
  title, note, values, maxes, seriesColor,
}: {
  title: string; note: string; values: number[]; maxes: number[]; seriesColor: string
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: PAPER, border: `2px solid ${INK}`, borderRadius: 18,
        boxShadow: SHADOW, padding: '18px 20px 14px',
      }}
    >
      <RadarSvg values={values} maxes={maxes} seriesColor={seriesColor} size={252} />
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 6 }}>
        <span
          style={{
            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16,
            letterSpacing: 2, textTransform: 'uppercase', color: seriesColor,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, color: MUTED, marginTop: 2 }}>
        {note}
      </div>
    </div>
  )
}

// ─── Compute the two profiles from the stored recipe ─────────────────────────
function computeProfiles(recipe: Recipe) {
  // Hop aroma — build the name→flavour map from inline vectors saved on each
  // hop (the builder stores them), then run the exact recipe combiner.
  const map = new Map<string, HopFlavorProfile>()
  for (const h of recipe.hops ?? []) if (h.flavor) map.set(h.name, h.flavor as HopFlavorProfile)
  const hop = hopFlavorCalculationService.calculateCombinedFlavor(
    recipe.hops ?? [],
    map,
    recipe.batchVolumeL || 20,
  )

  // Malt character — match each fermentable to an archetype, aggregate.
  const matched = (recipe.fermentables ?? []).map((f) => ({
    f,
    arch: MALT_ARCHETYPES_BY_SLUG.get(maltArchetypeForFermentable(f.name, f.colorLovibond).archetype) ?? null,
  }))
  const malt = aggregateMaltFlavorFrom(
    matched
      .filter((m) => m.arch)
      .map((m) => ({ flavor: m.arch!.flavor, intensity: m.arch!.intensity, amount: m.f.weightKg })),
  )

  return {
    hopValues: HOP_AXES.map((a) => hop[a.key] || 0),
    maltValues: MALT_AXES.map((a) => malt[a.key] || 0),
  }
}

/** Dominant flavour note for the caption (or a gentle fallback). */
function topNote(values: number[], labels: string[], fallback: string): string {
  let bi = -1, bv = 0
  values.forEach((v, i) => { if (v > bv) { bv = v; bi = i } })
  return bi >= 0 && bv > 0.05 ? `${labels[bi].toLowerCase()}-forward` : fallback
}
const HOP_LABELS = ['Citrus', 'Tropical', 'Stone fruit', 'Berry', 'Floral', 'Grassy', 'Herbal', 'Spice', 'Pine']
const MALT_LABELS = ['Grainy', 'Biscuit', 'Caramel', 'Dark fruit', 'Chocolate', 'Coffee', 'Roast', 'Nutty', 'Honey']

// ─── The card ────────────────────────────────────────────────────────────────
export async function renderRecipeOgImage(
  recipe: Recipe,
  calc: RecipeCalculations,
  ownerName: string,
): Promise<ImageResponse> {
  const beer = srmToHex(calc.srm)
  const { hopValues, maltValues } = computeProfiles(recipe)

  const [caveat, grotesk, groteskBold] = await Promise.all([
    loadGoogleFont('Caveat', 700),
    loadGoogleFont('Space Grotesk', 400),
    loadGoogleFont('Space Grotesk', 700),
  ])
  const fonts = [caveat, grotesk, groteskBold].filter(Boolean) as NonNullable<
    Awaited<ReturnType<typeof loadGoogleFont>>
  >[]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: CREAM, fontFamily: 'Space Grotesk', padding: '40px 52px 36px 60px',
          position: 'relative',
        }}
      >
        {/* SRM accent rail */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: 12, height: '100%',
            background: beer, display: 'flex',
          }}
        />

        {/* Header: name + style + brewer */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: 15, background: beer,
                border: `2px solid ${INK}`, display: 'flex', marginRight: 14,
              }}
            />
            <span
              style={{
                fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18,
                letterSpacing: 2, textTransform: 'uppercase', color: MUTED,
              }}
            >
              {recipe.style || 'Homebrew recipe'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 2 }}>
            <span
              style={{
                fontFamily: 'Caveat', fontWeight: 700,
                fontSize: recipe.name.length > 26 ? 58 : 72, color: INK, lineHeight: 1.05,
              }}
            >
              {recipe.name}
            </span>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 22, color: MUTED, marginLeft: 16, marginBottom: 8 }}>
              {`by ${ownerName}`}
            </span>
          </div>
        </div>

        {/* Radars — the hero */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
          <RadarCard
            title="Malt character"
            note={topNote(maltValues, MALT_LABELS, 'crisp / light malt')}
            values={maltValues}
            maxes={MALT_AXES.map((a) => a.max)}
            seriesColor={MALT}
          />
          <RadarCard
            title="Hop aroma"
            note={topNote(hopValues, HOP_LABELS, 'clean / low aroma')}
            values={hopValues}
            maxes={HOP_AXES.map((a) => a.max)}
            seriesColor={HOPS}
          />
        </div>

        {/* Live numbers */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <Stat k="OG" v={calc.og.toFixed(3)} accent={MALT} />
          <Stat k="FG" v={calc.fg.toFixed(3)} accent={MALT} />
          <Stat k="ABV" v={calc.abv.toFixed(1)} u="%" accent={ROAST} />
          <Stat k="IBU" v={String(Math.round(calc.ibu))} accent={HOPS} />
          <Stat k="SRM" v={calc.srm.toFixed(1)} accent={beer} />
        </div>

        {/* Watermark */}
        <div
          style={{
            position: 'absolute', bottom: 16, right: 24,
            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 17, color: WATER,
          }}
        >
          brewing.it.com
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  )
}
