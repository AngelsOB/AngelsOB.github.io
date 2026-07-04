import { ImageResponse } from 'next/og'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'
import { renderRecipeOgImage, OG_SIZE } from './ogCard'

export const alt = 'Recipe preview'
export const size = OG_SIZE
export const contentType = 'image/png'

function fallback(text = 'Recipe Not Found') {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#f4eedd', color: '#5a4f42', fontSize: 36, fontFamily: 'sans-serif',
        }}
      >
        {text}
      </div>
    ),
    { ...OG_SIZE },
  )
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const result = await getPublicRecipe(slug)
    if (!result) return fallback()
    return await renderRecipeOgImage(result.recipe, result.calc, result.ownerName)
  } catch {
    return fallback()
  }
}
