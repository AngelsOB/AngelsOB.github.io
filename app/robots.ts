import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/recipes/', // auth-gated recipe editor & list (public recipes live at /r/)
          '/account', // auth-gated settings
          '/api/', // API routes
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
