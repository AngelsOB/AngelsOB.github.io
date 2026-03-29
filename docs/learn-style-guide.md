# Learn Section Style Guide

A reference for writing and designing pages in the `/learn` section. Every page should feel like it was written by the same person — approachable, honest, and visually polished.

---

## Voice & Tone

**Who we're writing for:** New brewers who want to understand what the numbers mean, and experienced brewers who want to know exactly how we calculate things and where our approach differs from what they're used to.

**How it should read:**
- Conversational, not academic. Write like you're explaining it to a friend at the homebrew shop.
- Lead with what things *mean*, not where they came from. "IBU measures hop bitterness. A light lager is around 10, a West Coast IPA pushes 60+." — not "Published by Glenn Tinseth in 1995..."
- Short sentences. One idea per paragraph when explaining concepts.
- Use "we" when talking about BeerApp's approach. "We use the Tinseth model." "We include dry hop bitterness."
- Use "you" when talking to the brewer. "When you add hops..." "Your OG reading..."

**What to avoid:**
- Don't name-drop competitors. Say "the industry standard", "most calculators", "the standard approach" — not "BeerSmith uses..." or "Unlike Brewfather..."
- Don't lead with history or attribution. That goes at the bottom.
- Don't hedge excessively. If we made a choice, own it. "We apply 20% utilization" — not "We've chosen to use what might be approximately 20%..."
- Don't use jargon without explaining it first. If a term isn't obvious, give the plain-English version in the same sentence.

---

## Page Structure

### Science Articles (`/learn/ibu`, `/learn/gravity`, etc.)

These explain a concept and how BeerApp handles it.

```
1. Title & subtitle
   - Title: short, descriptive (e.g., "IBU & Bitterness")
   - Subtitle: handwritten font, one line that frames the page
     (e.g., "What it means, how it works, and what makes our approach different")

2. What it is (1-2 paragraphs)
   - Plain language definition with real examples
   - Immediately tell the reader how it works in the app
     ("Just add your hops and IBU updates in real time")

3. UI preview mockup
   - A styled JSX component that looks like a slice of the recipe builder
   - Shows the feature in action with realistic data
   - Caption in handwritten font below
   - See HopAdditionPreview in ibu/page.tsx for the reference implementation

4. How we calculate it
   - The core formula in a FormulaCallout
   - Plain-language explanation of what each variable does
   - "This is the industry standard" where applicable

5. Variants / addition types (if applicable)
   - Each variant gets its own textured card
   - Cards use noise-gradient backgrounds with subtly different hues
   - Divergences from the norm are woven into the card text naturally
   - Use "unique to BeerApp" badge for features that go beyond standard

6. Worked example
   - Concrete numbers in a textured card
   - Step through the math, bold the final result

7. Where this comes from
   - Brief research context — 2-3 paragraphs max
   - This is where attribution, dates, and study names go
   - Keep it interesting, not encyclopedic

8. Sources
   - Bulleted list of cited works
   - Author, title, publication, year
```

### Calculator Pages (`/learn/abv-calculator`, `/learn/dilution-calculator`, etc.)

These are simpler — the embedded calculator *is* the visual.

```
1. Title & subtitle

2. What it is (1-2 paragraphs)
   - What the calculator does, when to use it
   - How it connects to the recipe builder

3. Embedded calculator component
   - The actual interactive calculator from src/components/
   - No mockup needed — the calculator is the demo

4. How we calculate it
   - The formula in a FormulaCallout
   - Brief explanation

5. Worked example
   - Concrete numbers in a textured card

6. Edge cases / limits (if applicable)
   - Textured card explaining when the formula breaks down
   - e.g., ABV formula less accurate above 1.080 OG

7. Where this comes from
   - Brief research context

8. Sources
```

---

## Design Components

### FormulaCallout
Use for any mathematical formula. Renders KaTeX in a recessed, textured card.

```tsx
<FormulaCallout
  title="Tinseth IBU"
  expression={"IBU = \\frac{W \\times \\alpha \\times U \\times 74.89}{V}"}
  description="Optional plain-language caption below the formula."
/>
```

**Important:** Use JSX expressions `expression={"..."}` not string attributes `expression="..."` — backslashes need JavaScript escaping to reach KaTeX correctly.

### UI Preview Mockup (science articles only)
A JSX component that mimics a slice of the recipe builder. Guidelines:
- Use real data from a seed recipe (West Coast IPA is a good default)
- Match the builder's color scheme for the relevant section (green for hops, gold for fermentables, etc.)
- Include a header bar with the section name and a key stat badge (e.g., "46 IBU")
- Show 3-5 rows of realistic data
- Caption in handwritten font below
- Render as a server component — no interactivity needed

### Textured Cards
Used for variant explanations, edge cases, and worked examples.

```tsx
<div
  className="rounded-xl p-5"
  style={{
    background: `
      url("data:image/svg+xml,...noise-svg...") repeat,
      linear-gradient(135deg,
        color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 HUE)),
        var(--card))
    `,
    border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
  }}
>
```

Vary the HUE per card type:
- Hops/botanical: 145 (green)
- Grain/malt: 60 (amber)
- Water/chemistry: 220 (blue)
- Temperature/heat: 30 (warm orange)
- General/neutral: 80 (sand)

### "Unique to BeerApp" Badge
Use when a feature goes beyond what's standard. Coral-tinted pill:

```tsx
<span
  className="text-xs font-medium px-1.5 py-0.5 rounded"
  style={{
    background: "color-mix(in oklch, var(--coral-500) 12%, transparent)",
    color: "var(--coral-600)",
  }}
>
  unique to BeerApp
</span>
```

### Section Headings (within articles)
Use Bitter serif font for h2 and h3 inside articles:

```tsx
<h2
  id="kebab-case-id"
  className="text-xl font-bold mt-10 mb-4"
  style={{ fontFamily: "'Bitter', serif" }}
>
```

### Related Topics
Pass `relatedLearn` to `LearnArticle` — an array of `/learn/...` hrefs. The component resolves labels and descriptions from `docsConfig.ts` automatically.

---

## SEO Checklist

Every page must have:
- [ ] `metadata` export with `title`, `description`, `keywords`, `alternates.canonical`
- [ ] JSON-LD `<script>` — `Article` schema for science pages, `SoftwareApplication` for calculator pages
- [ ] Route added to `app/sitemap.ts` (articles at 0.85 priority, calculators at 0.7)
- [ ] Entry in `src/modules/learn/docsConfig.ts` with `href`, `label`, and `description`

---

## Content Source

All formulas, constants, and scientific claims should be traceable to `docs/calculation-methods.md`. When writing a new page:
1. Find the relevant section in calculation-methods.md
2. Use the same constants and formula structures
3. Reference the same sources
4. Note any "Known Issues" from section 15 — these are honest limitations worth mentioning

---

## File Structure

```
app/learn/
  layout.tsx              # Shared layout — do not modify per page
  page.tsx                # Index page — update when adding new pages
  [topic]/page.tsx        # One file per topic

src/modules/learn/
  docsConfig.ts           # Nav structure — update when adding new pages
  LearnNav.tsx            # Sidebar — reads from docsConfig
  LearnArticle.tsx        # Article wrapper — provides heading, CTA, related topics
  MathBlock.tsx           # KaTeX rendering
  FormulaCallout.tsx      # Styled formula card
```
