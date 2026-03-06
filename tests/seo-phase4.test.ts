import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Phase 4 — Internal Linking', () => {
  describe('Footer links', () => {
    const footerSrc = readSrc('src/components/Footer.tsx')

    it('links to Recipe Builder (/recipes/new)', () => {
      expect(footerSrc).toContain('href: "/recipes/new"')
    })

    it('links to Browse Recipes (/browse)', () => {
      expect(footerSrc).toContain('href: "/browse"')
    })

    it('links to Calculators (/calculators)', () => {
      expect(footerSrc).toContain('href: "/calculators"')
    })

    it('links to My Recipes (/recipes)', () => {
      // Match the exact "/recipes" href (not /recipes/new)
      expect(footerSrc).toMatch(/href:\s*"\/recipes"/)
    })

    it('has a "Brew" section', () => {
      expect(footerSrc).toContain('"Brew"')
    })

    it('has an "Account" section', () => {
      expect(footerSrc).toContain('"Account"')
    })

    it('uses aria-label for footer navigation', () => {
      expect(footerSrc).toContain('aria-label="Footer navigation"')
    })
  })
})
