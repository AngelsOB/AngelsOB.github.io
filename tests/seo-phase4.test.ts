import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Phase 4 — Internal Linking', () => {
  describe('Footer links (HSFooter)', () => {
    const footerSrc = readSrc('src/modules/builder/components/HSFooter.tsx')

    it('links to Start a recipe (/recipes/new)', () => {
      expect(footerSrc).toContain('href: "/recipes/new"')
    })

    it('links to Calculators (/calculators)', () => {
      expect(footerSrc).toContain('href: "/calculators"')
    })

    it('links to My Recipes (/recipes)', () => {
      // Match the exact "/recipes" href (not /recipes/new)
      expect(footerSrc).toMatch(/href:\s*"\/recipes"/)
    })

    it('links to Learn (/learn)', () => {
      expect(footerSrc).toContain('href: "/learn"')
    })

    it('has a "Brew" section', () => {
      expect(footerSrc).toContain('"Brew"')
    })

    it('has a "Learn" section', () => {
      expect(footerSrc).toContain('"Learn"')
    })

    it('uses aria-label for footer navigation', () => {
      expect(footerSrc).toContain('aria-label="Footer navigation"')
    })
  })
})
