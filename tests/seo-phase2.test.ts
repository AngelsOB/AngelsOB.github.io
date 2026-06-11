import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const appDir = resolve(__dirname, '..', 'app')
const srcDir = resolve(__dirname, '..', 'src')

// ── buildRecipeJsonLd ──────────────────────────────────────────────────

describe('SEO Phase 2: buildRecipeJsonLd', () => {
  test('produces valid schema.org/Recipe structure', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Recipe')
    expect(jsonLd.name).toBe(recipe.name)
    expect(jsonLd.author).toEqual({ '@type': 'Person', name: 'Test Brewer' })
    expect(jsonLd.recipeCategory).toBe('Beverage')
    expect(jsonLd.recipeCuisine).toBe('Beer')
    expect(jsonLd.url).toContain('/r/test-slug')
  })

  test('maps fermentables to recipeIngredient', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    const fermentableIngredients = jsonLd.recipeIngredient.filter(
      (i: string) => i.includes(' kg ')
    )
    expect(fermentableIngredients.length).toBe(recipe.fermentables.length)

    for (const f of recipe.fermentables) {
      const match = fermentableIngredients.find(
        (i: string) => i.includes(f.name) && i.includes(`${f.weightKg} kg`)
      )
      expect(match, `Missing fermentable: ${f.name}`).toBeDefined()
    }
  })

  test('maps hops to recipeIngredient', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    const hopIngredients = jsonLd.recipeIngredient.filter(
      (i: string) => i.includes(' g ') && !i.includes(' kg ')
    )
    expect(hopIngredients.length).toBe(recipe.hops.length)

    for (const h of recipe.hops) {
      const match = hopIngredients.find(
        (i: string) => i.includes(h.name) && i.includes(`${h.grams} g`)
      )
      expect(match, `Missing hop: ${h.name}`).toBeDefined()
    }
  })

  test('maps yeasts to recipeIngredient', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    const yeastIngredients = jsonLd.recipeIngredient.filter(
      (i: string) => i.includes('yeast')
    )
    expect(yeastIngredients.length).toBe(recipe.yeasts.length)
  })

  test('handles empty ingredient arrays', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = { ...SEED_RECIPES[0], fermentables: [], hops: [], yeasts: [] }
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    expect(jsonLd.recipeIngredient).toEqual([])
  })

  test('includes nutrition calories from calc', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    expect(jsonLd.nutrition['@type']).toBe('NutritionInformation')
    expect(jsonLd.nutrition.calories).toContain('cal per 355mL')
    expect(jsonLd.nutrition.calories).toContain(
      String(Math.round(calc.calories))
    )
  })

  test('includes recipeYield from batch volume', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = SEED_RECIPES[0]
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    expect(jsonLd.recipeYield).toBe(`${recipe.batchVolumeL} liters`)
  })

  test('builds keywords from style and tags', async () => {
    const { buildRecipeJsonLd } = await import(
      '../src/modules/sharing/getPublicRecipe'
    )
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    const recipe = { ...SEED_RECIPES[0], tags: ['hoppy', 'west-coast'] }
    const calc = new RecipeCalculationService().calculate(recipe)
    const jsonLd = buildRecipeJsonLd(recipe, calc, 'Test Brewer', 'test-slug')

    expect(jsonLd.keywords).toContain('homebrew')
    expect(jsonLd.keywords).toContain('beer recipe')
    if (recipe.style) {
      expect(jsonLd.keywords).toContain(recipe.style)
    }
    expect(jsonLd.keywords).toContain('hoppy')
    expect(jsonLd.keywords).toContain('west-coast')
  })
})

// ── getPublicRecipe structure ──────────────────────────────────────────

describe('SEO Phase 2: getPublicRecipe module', () => {
  test('exports getPublicRecipe as a function', async () => {
    const mod = await import('../src/modules/sharing/getPublicRecipe')
    expect(typeof mod.getPublicRecipe).toBe('function')
  })

  test('exports buildRecipeJsonLd as a function', async () => {
    const mod = await import('../src/modules/sharing/getPublicRecipe')
    expect(typeof mod.buildRecipeJsonLd).toBe('function')
  })

  test('module does not contain "use client" directive', () => {
    const source = readFileSync(
      resolve(srcDir, 'modules', 'sharing', 'getPublicRecipe.ts'),
      'utf-8',
    )
    expect(source).not.toContain("'use client'")
    expect(source).not.toContain('"use client"')
  })
})

// ── Auth-gated pages noindex ───────────────────────────────────────────

describe('SEO Phase 2: auth-gated pages have noindex', () => {
  const authPages = [
    {
      name: 'recipes/[id]',
      path: resolve(appDir, 'recipes', '[id]', 'page.tsx'),
    },
    {
      name: 'recipes/new',
      path: resolve(appDir, 'recipes', 'new', 'page.tsx'),
    },
    {
      name: 'recipes (list)',
      path: resolve(appDir, 'recipes', 'page.tsx'),
    },
  ]

  for (const { name, path } of authPages) {
    test(`${name} exports metadata with robots noindex`, () => {
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('robots')
      expect(source).toContain('index: false')
    })
  }
})

// ── Seed recipe page metadata ──────────────────────────────────────────

// Seed recipes are now published into Firestore as regular public recipes
// (served by /r/[slug] — see scripts/publish-seeds.ts). The old static
// /r/seed/[id] route was removed; its server-component / generateMetadata
// coverage now lives in the /r/[slug] suite below. We still validate the data.
describe('SEO Phase 2: seed recipes', () => {
  test('all seed recipes produce valid calculations', async () => {
    const { SEED_RECIPES } = await import('../src/data/seed-recipes')
    const { RecipeCalculationService } = await import(
      '../src/modules/beta-builder/domain/services/RecipeCalculationService'
    )

    for (const recipe of SEED_RECIPES) {
      const calc = new RecipeCalculationService().calculate(recipe)
      expect(calc.og, `${recipe.name}: OG should be > 1`).toBeGreaterThan(1)
      expect(calc.abv, `${recipe.name}: ABV should be > 0`).toBeGreaterThan(0)
      expect(calc.ibu, `${recipe.name}: IBU should be >= 0`).toBeGreaterThanOrEqual(0)
      expect(calc.srm, `${recipe.name}: SRM should be > 0`).toBeGreaterThan(0)
    }
  })
})

// ── OG image ───────────────────────────────────────────────────────────

describe('SEO Phase 2: OG image', () => {
  const ogImagePath = resolve(appDir, 'r', '[slug]', 'opengraph-image.tsx')

  test('opengraph-image.tsx exists', () => {
    expect(existsSync(ogImagePath)).toBe(true)
  })

  test('exports alt, size, and contentType constants', () => {
    const source = readFileSync(ogImagePath, 'utf-8')
    expect(source).toContain('export const alt')
    expect(source).toContain('export const size')
    expect(source).toContain('export const contentType')
  })
})

// ── HSPublicRecipeShell props contract ─────────────────────────────────
// (the client component /r/[slug] hands the server-fetched recipe to)

describe('SEO Phase 2: HSPublicRecipeShell', () => {
  const clientPath = resolve(
    srcDir,
    'modules/hopskip/components/public/HSPublicRecipeShell.tsx',
  )

  test('is a client component', () => {
    const source = readFileSync(clientPath, 'utf-8')
    expect(source).toContain("'use client'")
  })

  test('does NOT import from firebase/firestore (no client-side fetch)', () => {
    const source = readFileSync(clientPath, 'utf-8')
    expect(source).not.toContain('firebase/firestore')
    expect(source).not.toContain("from '@/config/firebase'")
  })

  test('accepts recipe and ownerName props', () => {
    const source = readFileSync(clientPath, 'utf-8')
    expect(source).toContain('recipe')
    expect(source).toContain('ownerName')
  })
})

// ── Public recipe page (slug) structure ────────────────────────────────

describe('SEO Phase 2: /r/[slug]/page.tsx', () => {
  const pagePath = resolve(appDir, 'r', '[slug]', 'page.tsx')

  test('is a server component (no "use client")', () => {
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).not.toContain("'use client'")
  })

  test('imports getPublicRecipe', () => {
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).toContain('getPublicRecipe')
  })

  test('imports buildRecipeJsonLd', () => {
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).toContain('buildRecipeJsonLd')
  })

  test('renders JSON-LD script tag', () => {
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).toContain('application/ld+json')
  })

  test('has generateMetadata export', () => {
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).toContain('generateMetadata')
  })
})
