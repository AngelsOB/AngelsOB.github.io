# PRD-005: SEO Infrastructure & Docs Section

> **Status:** Phase 4 Complete, GSC Active
> **Created:** 2026-03-06
> **Domain:** `brewing.it.com`
> **Depends on:** PRD-002 (sharing/public recipes — complete)
>
> ### Progress
> | Phase | Status |
> |-------|--------|
> | Phase 1: Technical SEO Foundation | **Complete** |
> | Phase 2: Server-Render Public Recipe Pages | **Complete** |
> | Phase 3: Docs Section | Not started |
> | Phase 4: Internal Linking & Crawlability Polish | **Complete** (Tools links; Docs links deferred to Phase 3) |
> | Phase 5: Monitoring & Iteration | **In progress** — GSC verified, sitemap submitted |
>
> ### Implementation Notes
> - Production domain is `brewing.it.com` — all `NEXT_PUBLIC_BASE_URL` references and fallbacks use this
> - Seed recipe IDs in sitemap are `seed-american-ipa`, `seed-saison`, `seed-irish-stout` (PRD originally listed `seed-hefeweizen` — corrected to match actual data)
> - `app/sitemap.ts` wraps the Firestore query in try/catch so builds succeed without `FIREBASE_ADMIN_KEY`
> - PWA icons were generated from `public/favicon.svg` using `sharp` — regenerate if the favicon changes
> - SEO regression tests live in `tests/seo.test.ts` (12 tests covering robots rules, sitemap config, icon assets, seed ID consistency)
> - Phase 2 tests live in `tests/seo-phase2.test.ts` (29 tests covering JSON-LD, noindex, OG image, PublicRecipeClient contract, seed page metadata)
> - `getPublicRecipe.ts` uses React `cache()` to deduplicate Firestore calls between `generateMetadata` and page component
> - `PublicRecipeClient` now receives `recipe`/`ownerName` as props from the server — no client-side Firestore fetch
> - `/r/[slug]/page.tsx` falls back to client-only rendering if Admin SDK is unavailable (build time)
> - Dynamic OG images at `/r/[slug]/opengraph-image` render recipe name, style, ABV/IBU/OG/SRM
> - Seed recipe pages (`/r/seed/[id]`) converted from client to server component with `generateMetadata`
> - Auth-gated pages (`/recipes/*`) all have `robots: { index: false, follow: false }`
> - `NEXT_PUBLIC_BASE_URL` and `FIREBASE_ADMIN_KEY` are set on Vercel (production) and `.env.local` (dev)
> - Google Search Console verified via DNS TXT record (Domain property: `brewing.it.com`)
> - Sitemap submitted to GSC (`https://brewing.it.com/sitemap.xml`)
> - Google has already crawled the site (first crawl: Mar 6, 2026) — indexing pending
> - Footer restructured from 2 links to multi-column layout: "Brew" (Recipe Builder, Browse, Calculators) + "Account" (My Recipes)
> - Phase 4 tests live in `tests/seo-phase4.test.ts` (7 tests covering footer link hrefs and section structure)
> - Footer "Learn" column with doc links will be added when Phase 3 builds the docs pages

---

## Context

BeerApp has public-facing content that should be discoverable by search engines: published community recipes (`/r/[slug]`), seed recipes (`/r/seed/[id]`), a recipe browse page, and a calculators page. However, the current technical SEO foundation has critical gaps that prevent this content from being effectively crawled, indexed, or ranked:

1. **No sitemap** — Google has no way to discover public recipe URLs except by following links from the browse page
2. **No robots.txt** — auth-gated routes (`/recipes/[id]`, `/recipes/sessions/[sessionId]`) are crawlable and may dilute crawl budget
3. **Recipe content is client-rendered** — the `/r/[slug]` page generates metadata server-side but loads all recipe content via client-side Firebase, meaning Google's initial crawl sees a loading skeleton
4. **No structured data** — no `schema.org` JSON-LD on any page. Recipe pages miss rich snippet eligibility
5. **No canonical URLs** — no explicit canonicals on any page
6. **Seed recipe pages have no metadata** — the `/r/seed/[id]` page is a client component with no `generateMetadata`
7. **Missing image assets** — `manifest.json` references `icon-192.png` and `icon-512.png` that don't exist. OG image is a generic SVG
8. **No docs/content section** — no educational content to capture search traffic for "how to calculate IBU", "mash pH calculator", etc.

### Competitive Landscape

- **Brewfather:** No blog, no SEO content. Ranks for nothing organic. Relies entirely on word-of-mouth and YouTube mentions.
- **Brewer's Friend:** Dominates homebrew calculator search terms with thin standalone calculator pages (e.g., `/abv-calculator`, `/ibu-calculator`). Each page is a single calculator form with minimal explanation. No citations, no depth.
- **Gap:** Nobody combines formula explanations + cited research + working calculator + modern design. This is the gap BeerApp can fill.

### Product Philosophy

BeerApp's differentiator is that everything lives in **one unified recipe builder** — no jumping between standalone calculators. The SEO strategy must respect this. The Docs section is educational content that explains the science and funnels readers to the recipe builder, not a collection of disconnected tool pages competing with the product's own calculators page.

## Goals

- All public content is crawlable, indexed, and eligible for rich results within weeks of publishing
- Public recipe pages render full content in the initial HTML response (server-side)
- A `/docs` section captures search traffic for brewing calculation queries and builds trust through cited research
- Each standalone calculator gets a dedicated doc page that embeds the calculator component and explains the formula
- Recipe builder sections get doc pages that explain the science, cite sources, and drive readers to the builder
- Google Search Console shows indexed recipe pages, doc pages, and rich results for structured data

## Non-Goals

- Multi-language support / i18n (no hreflang needed yet)
- Google Ads or paid search campaigns
- Social media automation or marketing tooling
- A/B testing of SEO content
- Server-side rendering of auth-gated pages (recipe editor, user recipe list)
- Converting the entire app to SSR — only public-facing pages need this treatment

---

## Phase 1: Technical SEO Foundation

The prerequisite for everything else. Without this, no content strategy matters.

### 1.1 — `app/robots.ts`

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/recipes/',      // auth-gated recipe editor & list
          '/api/',           // API routes
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

**Notes:**
- `/r/` (public recipes) and `/r/seed/` (seed recipes) remain crawlable
- `/browse` and `/calculators` remain crawlable
- `/recipes/` covers `/recipes/[id]`, `/recipes/new`, `/recipes/[id]/versions/[versionNumber]`, `/recipes/sessions/[sessionId]` — all auth-gated
- `/api/` prevents crawling API route handlers

### 1.2 — `app/sitemap.ts`

Dynamic sitemap generated from Firestore. Queries `publicRecipeIndex` for all published recipes.

```ts
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const { adminDb } = await import('@/config/firebase-admin')

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/browse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/calculators`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    // Doc pages added in Phase 3
  ]

  // Seed recipes (static, known IDs)
  const seedRecipeIds = ['seed-american-ipa', 'seed-hefeweizen', 'seed-irish-stout']
  const seedRoutes: MetadataRoute.Sitemap = seedRecipeIds.map((id) => ({
    url: `${BASE_URL}/r/seed/${id}`,
    lastModified: new Date('2025-01-01'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Published community recipes
  const snapshot = await adminDb.collection('publicRecipeIndex').get()
  const recipeRoutes: MetadataRoute.Sitemap = snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      url: `${BASE_URL}/r/${data.shareSlug}`,
      lastModified: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }
  })

  return [...staticRoutes, ...seedRoutes, ...recipeRoutes]
}
```

**Notes:**
- Uses `revalidate = 3600` so the sitemap refreshes hourly via ISR, not on every request
- Seed recipe IDs are hardcoded (they're bundled with the app and don't change)
- `publishedAt` from the index is used as `lastModified` — honest timestamps
- When recipe count exceeds ~50K, split into `generateSitemaps` chunks (not needed yet)

### 1.3 — `metadataBase` and Canonical URLs

Add `metadataBase` and default canonical to the root layout:

```ts
// app/layout.tsx — add to existing metadata export
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'),
  alternates: {
    canonical: './',
  },
  // ... existing metadata
}
```

This gives every page an auto-resolved canonical URL relative to the route path. Dynamic pages override via `generateMetadata` where needed.

### 1.4 — Add `NEXT_PUBLIC_BASE_URL` Environment Variable

Add to `.env.local` (dev), production environment (Vercel/hosting):

```
NEXT_PUBLIC_BASE_URL=https://brewing.it
```

Used by `robots.ts`, `sitemap.ts`, `metadataBase`, OG image URLs, and structured data.

### 1.5 — Missing PWA Icon Assets

Generate and add to `public/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `apple-touch-icon.png` (180×180)

These are already referenced by `manifest.json` but don't exist, causing 404s.

---

## Phase 2: Server-Render Public Recipe Pages

The most impactful SEO change. Recipe content must be in the initial HTML.

### 2.1 — Server-Side Recipe Data Fetching

Create a cached data-fetching function shared between `generateMetadata` and the page component:

```ts
// src/modules/sharing/getPublicRecipe.ts
import { cache } from 'react'

export const getPublicRecipe = cache(async (slug: string) => {
  const { adminDb } = await import('@/config/firebase-admin')
  const { RecipeCalculationService } = await import(
    '@/modules/beta-builder/domain/services/RecipeCalculationService'
  )

  const snapshot = await adminDb
    .collection('recipes')
    .where('shareSlug', '==', slug)
    .limit(1)
    .get()

  if (snapshot.empty) return null

  const doc = snapshot.docs[0]
  const data = doc.data()
  if (data.isPublic === false) return null

  // Get owner name from publicRecipeIndex
  const indexSnap = await adminDb
    .collection('publicRecipeIndex')
    .doc(doc.id)
    .get()
  const ownerName = indexSnap.data()?.ownerName || 'Anonymous Brewer'

  const recipe = { id: doc.id, ...data }
  const calc = new RecipeCalculationService().calculate(recipe as any)

  return { recipe, calc, ownerName }
})
```

React's `cache()` deduplicates calls within a single request — `generateMetadata` and the page component both call `getPublicRecipe(slug)` but only one Firestore query runs.

### 2.2 — Rewrite `/r/[slug]/page.tsx` as Server Component with Client Interactivity

The page server component fetches data and passes it to the client component as props. The initial HTML contains the full recipe content. The client component adds interactivity (fork button, share, theme, etc.) via hydration.

```tsx
// app/r/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'
import PublicRecipeClient from '@/modules/sharing/PublicRecipeClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getPublicRecipe(slug)

  if (!result) return { title: 'Recipe Not Found' }

  const { recipe, calc, ownerName } = result
  const description = [
    recipe.style,
    `${calc.abv.toFixed(1)}% ABV`,
    `${Math.round(calc.ibu)} IBU`,
    `OG ${calc.og.toFixed(3)}`,
  ].filter(Boolean).join(' | ')

  return {
    title: recipe.name,
    description,
    alternates: { canonical: `/r/${slug}` },
    openGraph: {
      title: `${recipe.name} — BeerApp`,
      description,
      type: 'article',
      siteName: 'BeerApp',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${recipe.name} — BeerApp`,
      description,
    },
  }
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params
  const result = await getPublicRecipe(slug)

  if (!result) return notFound()

  const { recipe, calc, ownerName } = result

  // JSON-LD structured data (see Phase 2.3)
  const jsonLd = buildRecipeJsonLd(recipe, calc, ownerName, slug)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <PublicRecipeClient
        recipe={recipe}
        ownerName={ownerName}
        slug={slug}
      />
    </>
  )
}
```

**Changes to `PublicRecipeClient`:**
- Accept `recipe` and `ownerName` as props (server-provided data) instead of fetching client-side
- Remove the `useEffect` that queries Firestore — data comes from the server
- Keep all interactivity (fork button, share URL, copy, etc.)
- The component remains `'use client'` for interactivity, but receives its data via props from the server component

**Result:** The initial HTML contains the full recipe content. Googlebot sees everything on the first crawl pass. LCP improves dramatically (no client-side fetch waterfall).

### 2.3 — JSON-LD Structured Data on Recipe Pages

Add `schema.org/Recipe` structured data to every public recipe page. This makes recipes eligible for Google's recipe rich results (ingredient lists, stats, author).

```ts
function buildRecipeJsonLd(recipe: any, calc: any, ownerName: string, slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.notes || `${recipe.style} homebrew recipe`,
    author: { '@type': 'Person', name: ownerName },
    datePublished: recipe.publishedAt,
    recipeCategory: 'Beverage',
    recipeCuisine: 'Beer',
    recipeYield: `${recipe.batchVolumeL} liters`,
    url: `${baseUrl}/r/${slug}`,

    // Ingredients: fermentables + hops + yeast
    recipeIngredient: [
      ...(recipe.fermentables || []).map(
        (f: any) => `${f.amount} kg ${f.name}`
      ),
      ...(recipe.hops || []).map(
        (h: any) => `${h.amount} g ${h.name} (${h.use}, ${h.time} min)`
      ),
      ...(recipe.yeast ? [`${recipe.yeast.name} yeast`] : []),
    ],

    // Nutrition-like info (brewing stats)
    nutrition: {
      '@type': 'NutritionInformation',
      calories: `${Math.round(calc.caloriesPerServing)} cal per 355mL`,
    },

    // Keywords for search
    keywords: [
      recipe.style,
      'homebrew',
      'beer recipe',
      'all-grain',
      ...(recipe.tags || []),
    ].filter(Boolean).join(', '),
  }
}
```

**Notes:**
- `recipeIngredient` maps fermentables, hops, and yeast into the schema's expected format
- `recipeCategory: 'Beverage'` and `recipeCuisine: 'Beer'` help Google classify the recipe
- `keywords` includes style, tags, and generic brewing terms
- Validate with Google's Rich Results Test after deployment

### 2.4 — Fix Seed Recipe Pages

Convert `/r/seed/[id]/page.tsx` from a client component to a server component with `generateMetadata`:

```tsx
// app/r/seed/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findSeedRecipe } from '@/data/seed-recipes'
import { RecipeCalculationService } from '@/modules/beta-builder/domain/services/RecipeCalculationService'
import BetaBuilderPage from '@/modules/beta-builder/presentation/components/BetaBuilderPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = findSeedRecipe(id)
  if (!recipe) return { title: 'Recipe Not Found' }

  const calc = new RecipeCalculationService().calculate(recipe)
  const description = [
    recipe.style,
    `${calc.abv.toFixed(1)}% ABV`,
    `${Math.round(calc.ibu)} IBU`,
    `OG ${calc.og.toFixed(3)}`,
  ].filter(Boolean).join(' | ')

  return {
    title: recipe.name,
    description,
    alternates: { canonical: `/r/seed/${id}` },
    openGraph: {
      title: `${recipe.name} — BeerApp`,
      description,
      type: 'article',
      siteName: 'BeerApp',
    },
  }
}

export default async function SeedRecipePage({ params }: PageProps) {
  const { id } = await params
  const recipe = findSeedRecipe(id)
  if (!recipe) return notFound()

  return <BetaBuilderPage sharedRecipe={recipe} sharedOwnerName="The Brewing.It Team" />
}
```

**Changes:**
- No longer `'use client'` — server component
- Has `generateMetadata` with dynamic title, description, OG tags
- Uses `await params` (Next.js 16 pattern)
- Seed recipe data is already in-process (from `seed-recipes.ts`), so no Firestore query needed

### 2.5 — `noindex` on Auth-Gated Pages

Add robots metadata to auth-gated pages to prevent indexing even if `robots.txt` is ignored:

```ts
// app/recipes/[id]/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

Apply to:
- `app/recipes/[id]/page.tsx`
- `app/recipes/[id]/versions/[versionNumber]/page.tsx`
- `app/recipes/sessions/[sessionId]/page.tsx`
- `app/recipes/new/page.tsx` (debatable — could be indexed as a landing page, but it's behind auth)

### 2.6 — Dynamic OG Image Generation

Create `app/r/[slug]/opengraph-image.tsx` to generate recipe-specific OG images:

```tsx
// app/r/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { getPublicRecipe } from '@/modules/sharing/getPublicRecipe'

export const alt = 'Recipe preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getPublicRecipe(slug)

  if (!result) {
    return new ImageResponse(
      <div style={{ /* fallback design */ }}>Recipe Not Found</div>,
      { ...size }
    )
  }

  const { recipe, calc } = result

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '60px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
        color: 'white', fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 56, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
          {recipe.name}
        </div>
        <div style={{ fontSize: 28, opacity: 0.7, marginBottom: 40 }}>
          {recipe.style}
        </div>
        <div style={{ display: 'flex', gap: '40px', fontSize: 24 }}>
          <div>ABV {calc.abv.toFixed(1)}%</div>
          <div>IBU {Math.round(calc.ibu)}</div>
          <div>OG {calc.og.toFixed(3)}</div>
          <div>SRM {calc.srm.toFixed(1)}</div>
        </div>
        <div style={{ position: 'absolute', bottom: 30, fontSize: 18, opacity: 0.4 }}>
          BeerApp
        </div>
      </div>
    ),
    { ...size }
  )
}
```

**Result:** Every shared recipe link on social media shows a branded card with the recipe name, style, and key stats — instead of a generic SVG placeholder.

---

## Phase 3: Docs Section

Educational content pages that explain the science and embed calculator components. Two types:

1. **Recipe builder docs** — explain the math behind each section of the recipe builder (IBU, gravity, pH, hop flavor, yeast starters)
2. **Calculator docs** — one page per standalone calculator, embeds the calculator component inline, explains the formula

### 3.1 — Route Structure

```
app/docs/
├── page.tsx                    → Docs index (links to all doc pages)
├── layout.tsx                  → Docs layout (sidebar nav, breadcrumbs)
├── ibu/page.tsx                → "Understanding IBU"
├── gravity/page.tsx            → "Gravity, Attenuation, and ABV"
├── mash-temperature/page.tsx   → "Mash Temperature & FG: Enzyme Kinetics"
├── mash-ph/page.tsx            → "Mash pH: The Proton Deficit Model"
├── hop-flavor/page.tsx         → "The Hop Flavor Radar"
├── yeast-starters/page.tsx     → "Yeast Starters & Pitching Rate"
├── dilution-calculator/page.tsx   → Dilution calculator doc
├── boil-off-calculator/page.tsx   → Boil-off calculator doc
└── abv-calculator/page.tsx        → ABV calculator doc
```

### 3.2 — Doc Page Architecture

Each doc page is a **server component** with static metadata:

```tsx
// app/docs/ibu/page.tsx
import type { Metadata } from 'next'
import IbuDoc from '@/modules/docs/IbuDoc'

export const metadata: Metadata = {
  title: 'Understanding IBU: How Bitterness Is Calculated',
  description:
    'Learn how IBU is calculated across boil, whirlpool, first wort, mash, and dry hop additions. Tinseth formula, humulinone research, and cited sources.',
  alternates: { canonical: '/docs/ibu' },
  keywords: [
    'IBU calculator', 'tinseth formula', 'how IBU is calculated',
    'whirlpool hop IBU', 'dry hop bitterness', 'humulinone',
  ],
}

export default function IbuDocPage() {
  return <IbuDoc />
}
```

The actual doc content (`IbuDoc`) is a client component that:
- Renders markdown-like educational content (JSX, not MDX — keeps the build simple)
- Embeds interactive examples where relevant (e.g., a mini IBU comparison showing boil vs. whirlpool vs. dry hop contributions)
- Ends with a CTA section linking to the recipe builder and calculators page

### 3.3 — Calculator Doc Pages

Each calculator doc page embeds the existing calculator component directly:

```tsx
// app/docs/dilution-calculator/page.tsx
import type { Metadata } from 'next'
import DilutionCalculator from '@/components/DilutionCalculator'

export const metadata: Metadata = {
  title: 'Dilution Calculator — Adjust Wort or Beer Gravity',
  description:
    'Calculate how much water to add to hit your target gravity. Uses conservation of gravity points. Free brewing dilution calculator.',
  alternates: { canonical: '/docs/dilution-calculator' },
  keywords: ['dilution calculator', 'dilute wort gravity', 'adjust beer gravity', 'water addition calculator'],
}

export default function DilutionCalcDocPage() {
  return (
    <article>
      {/* Educational content */}
      <h1>Dilution Calculator</h1>
      <p>...</p>

      {/* Embedded calculator component */}
      <DilutionCalculator />

      {/* Formula explanation */}
      <section>
        <h2>How It Works</h2>
        <p>...</p>
      </section>

      {/* Link to full calculators page */}
      <footer>
        <p>Need more calculators? <Link href="/calculators">See all brewing calculators</Link></p>
        <p>Want everything in one place? <Link href="/recipes/new">Try the recipe builder</Link></p>
      </footer>
    </article>
  )
}
```

**Key principle:** The calculator component is the same one used on `/calculators`. No duplication. One component, two contexts — the calculators page (all tools together) and the doc page (one tool with educational context).

### 3.4 — Docs Layout with Navigation

```tsx
// app/docs/layout.tsx
import type { Metadata } from 'next'
import DocsNav from '@/modules/docs/DocsNav'

export const metadata: Metadata = {
  title: { template: '%s | BeerApp Docs' },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <DocsNav />
      <main>{children}</main>
    </div>
  )
}
```

`DocsNav` is a sidebar or top nav showing all doc pages. Provides internal links for crawlability and user navigation.

### 3.5 — JSON-LD on Doc Pages

Each doc page includes `HowTo` or `Article` structured data:

```ts
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Understanding IBU: How Bitterness Is Calculated',
  description: '...',
  author: { '@type': 'Organization', name: 'BeerApp' },
  publisher: { '@type': 'Organization', name: 'BeerApp' },
  datePublished: '2026-03-15',
  dateModified: '2026-03-15',
}
```

Calculator doc pages use `SoftwareApplication` schema:

```ts
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Dilution Calculator',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}
```

### 3.6 — Add Docs to Sitemap

Update `app/sitemap.ts` to include doc pages:

```ts
const docRoutes: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/docs`, priority: 0.8 },
  { url: `${BASE_URL}/docs/ibu`, priority: 0.9 },
  { url: `${BASE_URL}/docs/gravity`, priority: 0.7 },
  { url: `${BASE_URL}/docs/mash-temperature`, priority: 0.9 },
  { url: `${BASE_URL}/docs/mash-ph`, priority: 0.8 },
  { url: `${BASE_URL}/docs/hop-flavor`, priority: 0.8 },
  { url: `${BASE_URL}/docs/yeast-starters`, priority: 0.7 },
  { url: `${BASE_URL}/docs/dilution-calculator`, priority: 0.7 },
  { url: `${BASE_URL}/docs/boil-off-calculator`, priority: 0.7 },
  { url: `${BASE_URL}/docs/abv-calculator`, priority: 0.8 },
].map((r) => ({ ...r, changeFrequency: 'monthly' as const, lastModified: new Date() }))
```

### 3.7 — Add Docs to Navigation

Add a "Docs" link to the main `NavBar` and `Footer`:

```ts
// NavBar
const navLinks = [
  { href: '/recipes', label: 'My Recipes' },
  { href: '/browse', label: 'Browse' },
  { href: '/calculators', label: 'Calculators' },
  { href: '/docs', label: 'Docs' },   // new
]
```

---

## Phase 4: Internal Linking & Crawlability Polish

### 4.1 — Footer Link Enhancement

Add comprehensive internal links to the footer:

```tsx
<footer>
  <nav>
    <section>
      <h4>Tools</h4>
      <Link href="/recipes/new">Recipe Builder</Link>
      <Link href="/calculators">Calculators</Link>
      <Link href="/browse">Browse Recipes</Link>
    </section>
    <section>
      <h4>Docs</h4>
      <Link href="/docs/ibu">IBU Calculation</Link>
      <Link href="/docs/mash-ph">Mash pH</Link>
      <Link href="/docs/hop-flavor">Hop Flavor Radar</Link>
      <Link href="/docs/gravity">Gravity & ABV</Link>
    </section>
  </nav>
</footer>
```

Every page on the site links to key doc pages through the footer — maximum internal link distribution.

### 4.2 — Cross-Linking Within Doc Pages

Each doc page links to related docs:

- IBU doc links to → Hop Flavor doc, Recipe Builder
- Gravity doc links to → Mash pH doc (mash temp affects FG), Recipe Builder
- Mash pH doc links to → Gravity doc (enzyme activity), Recipe Builder
- Hop Flavor doc links to → IBU doc (bitterness vs. flavor), Recipe Builder
- Calculator docs link to → Full calculators page, Recipe Builder, relevant builder doc

### 4.3 — Browse Page Internal Linking

Ensure the browse page renders recipe links in a format that survives without JavaScript. Currently the links are `<Link>` components (good), but the recipe list is client-rendered.

**No change needed here for now** — Google's JavaScript rendering handles client-rendered `<Link>` components. The sitemap is the primary discovery mechanism for recipe pages.

---

## Phase 5: Monitoring & Iteration

### 5.1 — Google Search Console Setup

- Verify domain ownership
- Submit sitemap URL (`/sitemap.xml`)
- Monitor:
  - Indexed page count (recipes, docs, calculators)
  - Rich result eligibility (Recipe schema validation)
  - Core Web Vitals (LCP improvement from server rendering)
  - Crawl errors and excluded pages

### 5.2 — Validate Structured Data

After deployment:
- Run Google Rich Results Test on `/r/[slug]` pages
- Run Schema Markup Validator on doc pages
- Fix any errors or warnings

### 5.3 — Content Freshness

The publish API route should update `publishedAt` in the `publicRecipeIndex` when a recipe is re-published after edits. This keeps sitemap `lastModified` dates honest.

Consider adding an `updatedAt` field to `publicRecipeIndex` that updates when the underlying recipe is modified (currently only `publishedAt` is stored in the index).

---

## Implementation Priority

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| Phase 1: Technical foundation (robots, sitemap, canonicals, icons) | Small | High — prerequisite for everything | **1st** |
| Phase 2: Server-render recipes + structured data + OG images | Medium | Very High — makes all recipe content crawlable | **2nd** |
| Phase 3: First doc pages (IBU + 1 calculator doc) | Medium | High — starts capturing search traffic | **3rd** |
| Phase 4: Internal linking + nav updates | Small | Medium — improves crawl distribution | **4th** |
| Phase 3 continued: Remaining doc pages | Large (content) | Medium — cumulative SEO value | **5th** |
| Phase 5: Monitoring | Small | Ongoing | **Continuous** |

---

## Doc Page Content Roadmap

Detailed outlines for each doc page are maintained in `docs/calculation-methods.md` under the "Docs Section Roadmap" heading.

### Writing Priority

| Priority | Page | Type | SEO Target |
|----------|------|------|------------|
| 1 | IBU | Builder doc | "how IBU is calculated", "tinseth formula", "dry hop bitterness" |
| 2 | Hop flavor radar | Builder doc | "hop flavor profile", "compare hop flavors" |
| 3 | Mash pH | Builder doc | "mash pH calculator", "water chemistry brewing" |
| 4 | Mash temperature & FG | Builder doc | "mash temperature final gravity", "enzyme kinetics brewing", "alpha beta amylase mash" |
| 5 | Dilution calculator | Calculator doc | "dilution calculator brewing" |
| 6 | ABV calculator | Calculator doc | "ABV calculator homebrew" |
| 7 | Gravity & ABV | Builder doc | "how OG is calculated", "final gravity prediction" |
| 8 | Yeast starters | Builder doc | "yeast starter calculator", "pitching rate" |
| 9 | Boil-off calculator | Calculator doc | "boil off calculator brewing" |

---

## Appendix: Current State Audit

### What exists today

| Item | Status |
|------|--------|
| Root layout metadata (title, description, OG, Twitter) | Present, comprehensive |
| Per-page static metadata (browse, calculators, recipes) | Present |
| Dynamic metadata on `/r/[slug]` (generateMetadata) | Present, uses admin SDK |
| Internal links via Next.js `<Link>` | Present, all crawlable |
| `manifest.json` | Present |
| `favicon.svg` | Present |
| `og-image.svg` | Present (generic placeholder) |

### What's missing

| Item | Impact |
|------|--------|
| `robots.txt` | Auth-gated pages crawlable, wasted crawl budget |
| `sitemap.xml` | Google can't discover recipe URLs efficiently |
| Canonical URLs | No explicit canonicals on any page |
| JSON-LD structured data | No rich result eligibility |
| Server-rendered recipe content | Google sees loading skeleton on first crawl |
| Seed recipe metadata | No title/description/OG on seed pages |
| `noindex` on auth pages | Private recipe editor could be indexed |
| Dynamic OG images | Social shares use generic SVG |
| `icon-192.png`, `icon-512.png` | Referenced in manifest but missing (404) |
| Docs section | No educational content, no search traffic capture |

---

## Known Issue: BeerXML Import Batch Size Mismatch

**Discovered during:** Phase 3 docs writing (March 2026)
**Severity:** Low — ~0.5L practical difference on a 20L batch
**Affects:** `src/modules/beta-builder/domain/services/BeerXmlImportService.ts` line 45

### Problem

Our `batchVolumeL` is defined as **final packaged volume** — how much finished beer you end up with. Fermenter loss, trub loss, etc. are added on top when calculating water volumes (see `VolumeCalculationService.ts`).

The BeerXML spec defines `BATCH_SIZE` as **"the target volume of the batch at the start of fermentation"** — i.e., fermenter volume, not final volume. Most brewing software (BeerSmith, Brewfather, Brewer's Friend) follows this convention.

Our import currently does:
```ts
const batchVolumeL = toNumber(text(recipeEl, 'BATCH_SIZE')) ?? 20;
```

This takes the BeerXML fermenter volume and treats it as our final-packaged volume. The result: we add `fermenterLossLiters` (default 0.5L) on top of what was already the fermenter volume, slightly inflating all water calculations.

### Fix

During BeerXML import, subtract the default fermenter loss from `BATCH_SIZE`:

```ts
const rawBatchSize = toNumber(text(recipeEl, 'BATCH_SIZE')) ?? 20;
const batchVolumeL = Math.max(1, rawBatchSize - recipe.equipment.fermenterLossLiters);
```

This requires restructuring the import slightly since equipment is built after `batchVolumeL` is set. Options:
1. Use a default fermenter loss constant (0.5L) for the adjustment
2. Build equipment first, then derive `batchVolumeL`
3. Add a post-import adjustment step

Option 1 is simplest and handles 95% of cases. The user can always tweak the number after import.

### Also consider

- BeerXML export (`BeerXmlExportService.ts`) should do the reverse: add fermenter loss back to `batchVolumeL` when writing `BATCH_SIZE` so exported recipes are compatible with other tools.
- The getting-started learn page (`/learn/getting-started`) now documents this difference and advises users to adjust batch size down after importing.

---

*Last updated: March 2026*
