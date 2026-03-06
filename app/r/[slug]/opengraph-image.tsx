import { ImageResponse } from 'next/og'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'

export const alt = 'Recipe preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Inline SRM→hex so this server component has zero client deps. */
function srmToHex(srm: number): string {
  const s = Math.max(1, Math.min(40, srm))
  const table: [number, number, number, number][] = [
    [1, 255, 230, 153],
    [2, 255, 216, 120],
    [3, 255, 202, 90],
    [4, 255, 191, 66],
    [5, 251, 177, 35],
    [6, 248, 166, 0],
    [7, 243, 156, 0],
    [8, 234, 143, 0],
    [9, 229, 133, 0],
    [10, 222, 124, 0],
    [12, 205, 104, 0],
    [14, 187, 85, 0],
    [16, 173, 71, 0],
    [18, 160, 58, 0],
    [20, 149, 48, 0],
    [24, 122, 25, 0],
    [28, 105, 13, 0],
    [32, 92, 6, 0],
    [36, 80, 2, 0],
    [40, 68, 0, 0],
  ]
  let lo = table[0],
    hi = table[table.length - 1]
  for (let i = 0; i < table.length - 1; i++) {
    if (s >= table[i][0] && s <= table[i + 1][0]) {
      lo = table[i]
      hi = table[i + 1]
      break
    }
  }
  const t = hi[0] === lo[0] ? 0 : (s - lo[0]) / (hi[0] - lo[0])
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * t)
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * t)
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * t)
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let result
  try {
    result = await getPublicRecipe(slug)
  } catch {
    result = null
  }

  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, #0f0f1e 0%, #1a1a2e 40%, #16213e 100%)',
            color: '#64748b',
            fontSize: 36,
            fontFamily: 'sans-serif',
          }}
        >
          Recipe Not Found
        </div>
      ),
      { ...size },
    )
  }

  const { recipe, calc, ownerName } = result
  const beerColor = srmToHex(calc.srm)

  const stats: { label: string; value: string }[] = [
    { label: 'ABV', value: `${calc.abv.toFixed(1)}%` },
    { label: 'IBU', value: `${Math.round(calc.ibu)}` },
    { label: 'OG', value: calc.og.toFixed(3) },
    { label: 'SRM', value: calc.srm.toFixed(1) },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(145deg, #0f0f1e 0%, #1a1a2e 40%, #16213e 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* SRM color accent bar — left edge */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 8,
            height: '100%',
            background: beerColor,
            display: 'flex',
          }}
        />

        {/* Subtle glow from beer color */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: -60,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${beerColor}22 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Main content area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '56px 72px 48px 72px',
          }}
        >
          {/* Top section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Style badge + beer color swatch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              {/* Beer color circle */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: beerColor,
                  border: '2px solid rgba(255,255,255,0.15)',
                  boxShadow: `0 0 20px ${beerColor}44`,
                  display: 'flex',
                }}
              />

              {recipe.style && (
                <div
                  style={{
                    fontSize: 20,
                    color: '#94a3b8',
                    fontWeight: 500,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {recipe.style}
                </div>
              )}
            </div>

            {/* Recipe name */}
            <div
              style={{
                fontSize: recipe.name.length > 30 ? 44 : 56,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                letterSpacing: -1,
                maxWidth: '90%',
              }}
            >
              {recipe.name}
            </div>

            {/* Brewer name */}
            <div
              style={{
                fontSize: 20,
                color: '#64748b',
                marginTop: 16,
                fontWeight: 400,
              }}
            >
              by {ownerName}
            </div>
          </div>

          {/* Bottom: Stats row */}
          <div style={{ display: 'flex', gap: 20 }}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 36px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: stat.label === 'SRM' ? beerColor : '#ffffff',
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${beerColor} 0%, transparent 60%)`,
            display: 'flex',
          }}
        />

        {/* Watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 36,
            fontSize: 16,
            color: 'rgba(148,163,184,0.35)',
            fontWeight: 400,
          }}
        >
          brewing.it.com
        </div>
      </div>
    ),
    { ...size },
  )
}
