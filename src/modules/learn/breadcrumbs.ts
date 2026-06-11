import { breadcrumbJsonLd } from '@/utils/seo'
import { learnNav } from './docsConfig'

/**
 * BreadcrumbList JSON-LD for a learn article/calculator page. The crumb name
 * comes from docsConfig (the same source the nav renders), so pages only need
 * to pass their slug.
 */
export function learnBreadcrumb(slug: string) {
  const path = `/learn/${slug}`
  const link = learnNav.flatMap((s) => s.links).find((l) => l.href === path)
  return breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Learn', path: '/learn' },
    { name: link?.label ?? slug, path },
  ])
}
