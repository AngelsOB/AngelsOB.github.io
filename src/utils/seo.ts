const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

/**
 * schema.org BreadcrumbList for JSON-LD. Pass crumbs root-first; paths are
 * site-relative and resolved against the canonical base URL.
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  }
}
