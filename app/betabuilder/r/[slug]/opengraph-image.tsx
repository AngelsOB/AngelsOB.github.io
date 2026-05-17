import { ImageResponse } from 'next/og'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'

export const alt = 'Recipe preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Fetch Caveat Bold from Google Fonts (cached across invocations in the module scope). */
async function loadCaveatFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Caveat:wght@700',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' } },
    ).then((r) => r.text())
    const url = css.match(/src: url\(([^)]+)\)/)?.[1]
    if (!url) return null
    return fetch(url).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

/** Inline SRM to hex — pure function, zero deps. */
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
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function fallback(text = 'Recipe Not Found') {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#64748b',
          fontSize: 36,
          fontFamily: 'sans-serif',
        }}
      >
        {text}
      </div>
    ),
    { ...size },
  )
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
    return fallback()
  }

  if (!result) return fallback()

  try {
    const { recipe, calc, ownerName } = result
    const beerColor = srmToHex(calc.srm)
    const styleName = recipe.style ? recipe.style.toUpperCase() : ''
    const caveatFont = await loadCaveatFont()

    const fonts = caveatFont
      ? [{ name: 'Caveat', data: caveatFont, weight: 700 as const, style: 'normal' as const }]
      : []

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg, #0f0f1e 0%, #16213e 100%)',
            fontFamily: 'sans-serif',
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {/* Beer color circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: beerColor,
                    border: '2px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    marginRight: 16,
                  }}
                />

                {styleName ? (
                  <div
                    style={{
                      fontSize: 20,
                      color: '#94a3b8',
                      fontWeight: 500,
                      letterSpacing: 1,
                    }}
                  >
                    {styleName}
                  </div>
                ) : null}
              </div>

              {/* Recipe name — Caveat handwritten font, large */}
              <div
                style={{
                  fontSize: recipe.name.length > 30 ? 56 : 72,
                  fontFamily: caveatFont ? 'Caveat' : 'sans-serif',
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.15,
                  display: 'flex',
                }}
              >
                {recipe.name}
              </div>

              {/* Brewer name */}
              <div
                style={{
                  fontSize: 22,
                  color: '#64748b',
                  marginTop: 12,
                  display: 'flex',
                }}
              >
                {`by ${ownerName}`}
              </div>
            </div>

            {/* Bottom: Stats row */}
            <div style={{ display: 'flex', gap: 20 }}>
              {/* ABV */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 36px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1,
                    marginBottom: 8,
                    display: 'flex',
                  }}
                >
                  {`${calc.abv.toFixed(1)}%`}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: 2,
                    display: 'flex',
                  }}
                >
                  ABV
                </div>
              </div>

              {/* IBU */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 36px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1,
                    marginBottom: 8,
                    display: 'flex',
                  }}
                >
                  {`${Math.round(calc.ibu)}`}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: 2,
                    display: 'flex',
                  }}
                >
                  IBU
                </div>
              </div>

              {/* OG */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 36px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1,
                    marginBottom: 8,
                    display: 'flex',
                  }}
                >
                  {calc.og.toFixed(3)}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: 2,
                    display: 'flex',
                  }}
                >
                  OG
                </div>
              </div>

              {/* SRM */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 36px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: beerColor,
                    lineHeight: 1,
                    marginBottom: 8,
                    display: 'flex',
                  }}
                >
                  {calc.srm.toFixed(1)}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: 2,
                    display: 'flex',
                  }}
                >
                  SRM
                </div>
              </div>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 600,
              height: 4,
              background: `linear-gradient(90deg, ${beerColor}, transparent)`,
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
              display: 'flex',
            }}
          >
            brewing.it.com
          </div>
        </div>
      ),
      { ...size, fonts },
    )
  } catch {
    return fallback()
  }
}
