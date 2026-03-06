import { ImageResponse } from 'next/og'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'

export const alt = 'Recipe preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
            background: '#1a1a2e',
            color: '#ffffff',
            fontSize: 40,
            fontFamily: 'sans-serif',
          }}
        >
          Recipe Not Found
        </div>
      ),
      { ...size },
    )
  }

  const { recipe, calc } = result

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px',
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 'bold',
            marginBottom: 20,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {recipe.name}
        </div>
        {recipe.style && (
          <div style={{ fontSize: 28, opacity: 0.7, marginBottom: 40 }}>
            {recipe.style}
          </div>
        )}
        <div style={{ display: 'flex', gap: '40px', fontSize: 24 }}>
          <div>ABV {calc.abv.toFixed(1)}%</div>
          <div>IBU {Math.round(calc.ibu)}</div>
          <div>OG {calc.og.toFixed(3)}</div>
          <div>SRM {calc.srm.toFixed(1)}</div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            fontSize: 18,
            opacity: 0.4,
          }}
        >
          brewing.it
        </div>
      </div>
    ),
    { ...size },
  )
}
