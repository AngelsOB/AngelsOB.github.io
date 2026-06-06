import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import robots from '../app/robots'

const publicDir = resolve(__dirname, '..', 'public')
const appDir = resolve(__dirname, '..', 'app')

// ── robots.txt ──────────────────────────────────────────────────────────

describe('SEO: robots.txt', () => {
  const result = robots()
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules

  test('targets all user agents', () => {
    expect(rule.userAgent).toBe('*')
  })

  test('allows root', () => {
    expect(rule.allow).toBe('/')
  })

  test('disallows auth-gated /recipes/ path', () => {
    expect(rule.disallow).toContain('/recipes/')
  })

  test('disallows /api/ path', () => {
    expect(rule.disallow).toContain('/api/')
  })

  test('does NOT disallow public recipe paths (/r/)', () => {
    const disallowed = Array.isArray(rule.disallow)
      ? rule.disallow
      : [rule.disallow]
    const blocksPublicRecipes = disallowed.some(
      (d) => d === '/r/' || d === '/r'
    )
    expect(blocksPublicRecipes).toBe(false)
  })

  test('references sitemap', () => {
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})

// ── sitemap config ──────────────────────────────────────────────────────

describe('SEO: sitemap config', () => {
  test('exports force-dynamic and hourly revalidation', async () => {
    const mod = await import('../app/sitemap')
    expect(mod.dynamic).toBe('force-dynamic')
    expect(mod.revalidate).toBe(3600)
    expect(typeof mod.default).toBe('function')
  })
})

// ── PWA icons ───────────────────────────────────────────────────────────

describe('SEO: PWA icon assets', () => {
  test('icon-192.png exists', () => {
    expect(existsSync(resolve(publicDir, 'icon-192.png'))).toBe(true)
  })

  test('icon-512.png exists', () => {
    expect(existsSync(resolve(publicDir, 'icon-512.png'))).toBe(true)
  })

  test('apple-touch-icon.png exists', () => {
    expect(existsSync(resolve(publicDir, 'apple-touch-icon.png'))).toBe(true)
  })

  test('every icon in manifest.json exists on disk', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(publicDir, 'manifest.json'), 'utf-8')
    )
    for (const icon of manifest.icons) {
      const iconPath = resolve(publicDir, icon.src.replace(/^\//, ''))
      expect(existsSync(iconPath), `Missing icon: ${icon.src}`).toBe(true)
    }
  })
})

// ── Sitemap recipe inclusion ────────────────────────────────────────────

// Seed recipes are now published into Firestore and emitted dynamically by
// the sitemap (from the publicRecipeIndex collection), not a hardcoded array.
describe('SEO: sitemap includes published recipes dynamically', () => {
  test('sitemap sources published recipes from Firestore', () => {
    const sitemapSource = readFileSync(resolve(appDir, 'sitemap.ts'), 'utf-8')
    expect(sitemapSource).toContain('publicRecipeIndex')
  })
})
