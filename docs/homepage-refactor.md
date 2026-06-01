# Homepage Refactor

A buildable spec for the new homepage, designed for conversion. The plan is to ship this as a test variant alongside the current homepage, then promote it to the default once it's proven (or refined).

Related: [voice-and-tone.md](voice-and-tone.md), [copy-audit.md](copy-audit.md).

---

## Context

### Why we're doing this

The current homepage is a list of features dressed up in nice typography. It doesn't convert as well as it could because:

1. **The hero doesn't say what the app is.** "Brew with numbers that agree" is clever but doesn't tell a first-time visitor whether they're in the right place.
2. **No "what is this" moment.** A stranger lands on the page and gets immediately fed feature deep-dives without context.
3. **Community recipes are at the bottom.** Social proof is the single most persuasive thing for utility apps. It should be early, not last.
4. **No visible product in the hero.** The current illustration is pretty but doesn't sell the app. A real screenshot or interactive preview is the single biggest conversion lever available.
5. **"Your library" section is dead weight for signed-out visitors.** A logged-out user sees an empty-state version of a section meant for returning users. It should be conditional.
6. **Two CTAs above the fold split attention.** "Start a recipe" and "Open calculators" compete. Focus on one primary action.

### Goals (in priority order)

1. **A first-time visitor knows what the app is within 2 seconds of landing.** Headline + visible product.
2. **A first-time visitor sees that real brewers use this** before they scroll past the second section. Social proof early.
3. **A first-time visitor can act in one click.** Single primary CTA above the fold.
4. **A first-time visitor sees the math in motion** without needing to sign up. Live preview or screenshot.
5. **A returning visitor sees their library where expected.** Conditional library section for signed-in users.

### Constraints

- Indie product, solo dev. No A/B testing infrastructure. "Ship and live with it" comparison is fine.
- SEO matters. The new homepage shouldn't lose existing keyword targeting (homebrewing recipe builder, brewing calculator, ABV/IBU/SRM, water chemistry).
- The current homepage uses a distinctive design system (HopSkip / `hsTokens`). The new homepage should use the same design language, just rearranged.
- No new dependencies. Use what's already in the codebase.

---

## The new flow

| # | Section | Job |
|---|---|---|
| 1 | **Hero** | Tell the visitor what the app is. Show the product. Give them one thing to click. |
| 2 | **Community recipes** | Prove the app is alive and used. Make a stranger want to fork something. |
| 3 | **How brew day goes** | Show the recipe builder doing its thing. The walkthrough. |
| 4 | **The math you'll reach for** | The calculators. Make the use cases concrete with the questions. |
| 5 | **Your library** *(conditional)* | Only render for signed-in users with recipes. |
| 6 | **The research behind the numbers** | Brewing science articles. SEO content footprint. |

Compared to the current page:
- **Hero** keeps its position but gets a real product visual and one CTA
- **Stats strip** folds into the hero
- **Community** promotes from §6 to §2 (biggest structural change)
- **Recipe builder** becomes the "How brew day goes" walkthrough at §3
- **Calculators** stays at §4 (was §3) with new title and body
- **Your library** drops to §5 and becomes conditional
- **Learn preview** stays at §6 (was §5)

---

## Section-by-section spec

### Section 1 — Hero

**Position:** Above the fold.

**Layout intent:** Two-column on desktop, stacked on mobile.

- **Left column:** Kicker, headline, subhead, primary CTA, social-proof line.
- **Right column:** Product visual (see below).

**Copy:**

| Element | Text |
|---|---|
| Kicker (handwritten script) | hello, brewer — |
| Headline | **A simpler place to brew.** (visual emphasis on "simpler" — highlighted yellow box, rotated; layout splits across three lines as "A" / "simpler" / "place to brew.") |
| Subhead | A recipe builder with live math, brew-day calculators, and the science behind them. |
| Primary CTA | Start a recipe |
| Social-proof line (under CTA) | `{totalCommunityRecipes}` recipes in our collection · 20+ live calculations · 0 spreadsheets needed |

**Why one CTA, not two:** A first-time visitor presented with two equal options often picks neither. The primary CTA channels traffic into the highest-intent action (building a recipe). A secondary "Browse recipes" link can live as a text link beside or under the primary, or appear via the social-proof line.

**Visual recommendation:** This is the single biggest conversion lever on the page.

**Current:** An illustrated hero image (`/images/hero.png`).

**Recommended:** Replace with a real-looking product screenshot or interactive preview of the recipe builder. The visitor should see live math, an actual recipe in progress, OG/FG/ABV/IBU numbers, and a hop schedule with a working slider or animated update. The illustration is pretty but doesn't sell the app. A real screenshot does.

**Tier 1 (low effort):** Static screenshot of an actual recipe in the builder, exported as PNG/WebP. Shows what the brewer will see if they click the CTA.

**Tier 2 (medium effort):** Static screenshot with a layered annotation (e.g., a small floating callout pointing to "live IBU update").

**Tier 3 (higher effort):** An actual interactive miniature builder embedded in the hero. User can move a slider and see ABV/IBU change. Highest conversion impact, highest build cost.

Start with Tier 1. The lift is moving away from the illustration.

**Files affected:**
- `src/modules/hopskip/components/HopSkipHomeContent.tsx` (hero section)
- `public/images/` (new hero screenshot asset)

---

### Section 2 — Community recipes

**Position:** Immediately under the hero. This is the biggest structural change.

**Why move it here:** Social proof is the most persuasive thing on a utility-app homepage. Showing real recipes from real brewers proves the app is alive and worth committing time to. The current page hides this at the bottom, which is the worst place for social proof. A first-time visitor sees an empty grid (the library section), then a list of features, and finally — after all of that — sees the community evidence that this is a real product.

**Layout intent:** Section header + grid of 6 community recipe cards. Same component used today (`HopSkipCommunitySection.tsx`), just moved up.

**Copy:**

| Element | Text |
|---|---|
| Kicker | fresh from the community — |
| Eyebrow | Community |
| Title | **Recipes other brewers are pouring.** |
| End link | Browse all → |

**Conditional rendering:** Only show this section if `recipes.length > 0` (there's at least one community recipe to show). If zero, hide the section entirely. Right now this is unlikely to ever be zero, but the safety net matters.

**Visual:** 6 community recipe cards. Keep current card design. Display recipe name, style, ABV/IBU/OG/FG, brewer name, fork count. Consider adding a "Fork" button directly on the card for one-click conversion.

**Files affected:**
- `app/page.tsx` (reorder — pull `HopSkipCommunitySection` higher)
- `src/modules/hopskip/components/HopSkipCommunitySection.tsx` (copy update only)

---

### Section 3 — How brew day goes

**Position:** Third.

**Why this section:** A walkthrough makes the recipe builder concrete. The current "Recipe builder" section is a feature grid with a clever-cold title ("Every input nudges every output"). Reframing it as a step-by-step "this is what brew day looks like" makes the app's value tangible.

**Layout intent:** Two-column on desktop. Left column has the section header, body paragraph, and feature pills. Right column has the mock builder card (already exists in current section).

**Copy:**

| Element | Text |
|---|---|
| Kicker | how brew day goes — |
| Eyebrow | Recipe builder |
| Title | **Pick a style. Drop in grains and hops. Watch the math work.** |
| Body | Build the recipe the way you'd build it in a notebook, but the math runs as you go. Adjust grain weights and OG updates. Add a late hop and IBU shifts. Change your equipment profile and boil-off recalculates. Everything is connected. |
| Feature pill 1 | **Live math** — OG, FG, ABV, IBU, SRM update on every edit. |
| Feature pill 2 | **Water chem** — Mineral additions, salt targets, mash pH. |
| Feature pill 3 | **Style targets** — BJCP in-range gauges per metric. |
| Feature pill 4 | **Equipment-aware** — Boil-off, deadspace, absorption built in. |
| CTA | Open the recipe builder |

**Visual:** Keep the mock builder card on the right. It's already a strong proof-of-concept visual. Optionally, replace it with the same Tier 1 screenshot used in the hero (or a different angle of the same recipe).

**Files affected:**
- `src/modules/hopskip/components/HopSkipHomeContent.tsx` (section 1 in the file, becomes section 3 on the page)

---

### Section 4 — The math you'll reach for

**Position:** Fourth.

**Why this title:** The current title ("The numbers you'll need, ready when you are.") is too waitstaff. "The math you'll reach for" frames the calculators as something a brewer instinctively grabs when a question comes up, not something served to them.

**Layout intent:** Section header, then a grid of 3 preview calculator cards (ABV, IBU, Boil-off), then a "see all" link. Keep current design.

**Copy:**

| Element | Text |
|---|---|
| Kicker | brew-day math without the spreadsheet — |
| Eyebrow | Calculators |
| Title | **The math you'll reach for.** |
| Body (new) | Did I hit my OG? What do I do now that I didn't? How long do I boil? How much priming sugar? When you have a question, it's here. |
| Preview card 1 — ABV | 5.51% / from gravity |
| Preview card 2 — IBU | 38 / Tinseth |
| Preview card 3 — Boil-off | 9.2% / to target OG |
| End link | See all 7 calculators → |

**Why the questions body:** The questions immediately make the calculators concrete. Every brewer has asked at least one of them. The "what do I do now that I didn't" question is the strongest of the four — it speaks to the moment a brewer's gravity reading misses target and they need a tool to figure out the next move. That's the moment this app earns its keep.

**Files affected:**
- `src/modules/hopskip/components/HopSkipHomeContent.tsx` (section 2 in the file)

---

### Section 5 — Your library (conditional)

**Position:** Fifth. **Only renders if signed in AND `recipes.length > 0`.**

**Why conditional:** A signed-out visitor on a marketing page doesn't benefit from seeing a "Your library" section. At best it's confusing ("why would I have a library — I just got here?"). At worst it's an empty-state pitch ("Build your first recipe") that competes with the hero CTA. Removing it for non-signed-in users tightens the page and removes a dead-weight section from the conversion funnel.

For signed-in users with recipes, the section is genuinely useful — it's a shortcut back into their work.

**Copy:** Keep current.

| Element | Text |
|---|---|
| Kicker | most recent — |
| Eyebrow | Your library |
| Title | **Pick up where you left off.** |
| End link (if >3 recipes) | Browse all {count} → |

**Conditional logic (in `HopSkipHomeContent.tsx`):**

```tsx
{user && recipes.length > 0 && (
  <LibrarySection recipes={recentRecipes} />
)}
```

Use the existing `useAuthStore` and `useRecipeStore` to read user and recipe state.

**Files affected:**
- `src/modules/hopskip/components/HopSkipHomeContent.tsx` (section 3 in the file)

---

### Section 6 — The research behind the numbers

**Position:** Sixth (bottom).

**Why keep at the bottom:** SEO benefits from having Learn content linked from the homepage. Visitors who scroll this far are engaged. Brewers who care about the science will see that the app takes the work seriously.

**Honesty:** The Learn section is articles, not a full library. The current title ("The research behind the numbers.") is honest. Don't oversell it.

**Copy:** Keep current.

| Element | Text |
|---|---|
| Kicker | behind the numbers — |
| Eyebrow | Brewing science |
| Title | **The research behind the numbers.** |
| End link | All articles → |

**Layout:** 2-column grid of 4 featured Learn cards (currently rendered from `learnNav` config). Keep current design.

**Files affected:**
- `src/modules/hopskip/components/HopSkipLearnSection.tsx` (no changes needed)

---

## What gets removed

- **Stats strip as its own section.** Stats fold into the hero.
- **Empty-library state on the homepage.** Signed-out visitors don't see the library section at all. The empty-library copy belongs on `/recipes`, not on the homepage.
- **The current illustrated hero image.** Replaced with a real product visual.
- **The secondary "Open calculators" CTA in the hero.** A single primary CTA above the fold converts better.

---

## Implementation guidance

### Recommended approach: replace, don't fork

The cleanest path is to refactor `HopSkipHomeContent.tsx` and `app/page.tsx` in place on a feature branch, then merge when ready. The app is small enough that a parallel `/v2` route adds maintenance burden for little benefit.

### Alternative: build at `/v2`

If a side-by-side comparison is wanted before committing:

1. Copy `src/modules/hopskip/components/HopSkipHomeContent.tsx` → `HopSkipHomeContentV2.tsx`
2. Create `app/v2/page.tsx` that renders the V2 components
3. Share the link with a few brewers to gather reactions before promoting
4. When ready, swap `app/page.tsx` to render V2, then delete the V1 file and the `/v2` route

This is heavier but reversible.

### File-by-file change list

#### `app/page.tsx`

Reorder the sections rendered:

```tsx
return (
  <>
    <HopSkipHomeContent />              // hero + walkthrough + calculators + library
    {community.length > 0 ? <HopSkipCommunitySection recipes={community} /> : null}
    <HopSkipLearnSection />
  </>
);
```

Becomes:

```tsx
return (
  <>
    <HopSkipHero />
    {community.length > 0 ? <HopSkipCommunitySection recipes={community} /> : null}
    <HopSkipWalkthrough />
    <HopSkipCalculatorsPreview />
    <HopSkipLibrary />     // internally conditional on signed-in
    <HopSkipLearnSection />
  </>
);
```

Each section becomes its own component for clarity. Move them out of `HopSkipHomeContent.tsx` and into separate files in `src/modules/hopskip/components/home/`.

#### `src/modules/hopskip/components/HopSkipHomeContent.tsx`

This file gets split into:
- `home/HopSkipHero.tsx` — section 1 of the new flow
- `home/HopSkipWalkthrough.tsx` — section 3 (was the "Recipe builder" section in the old file)
- `home/HopSkipCalculatorsPreview.tsx` — section 4 (was the "Calculators" section)
- `home/HopSkipLibrary.tsx` — section 5, internally conditional on `user && recipes.length > 0`

`HopSkipHomeContent.tsx` itself can be deleted once the split is done.

#### `src/modules/hopskip/components/HopSkipCommunitySection.tsx`

Copy update only (see Section 2 above).

#### `src/modules/hopskip/components/HopSkipLearnSection.tsx`

No changes.

#### `public/images/`

Add a new hero screenshot asset. Suggested filename: `hero-builder.png` (and a webp variant). The current `hero.png` can stay around until the new homepage ships, then be retired.

### Design tokens and styling

Use existing `hsTokens` from `src/modules/hopskip/tokens.ts`. The new sections should look like part of the same family as the existing ones. No new design language needed.

### SEO preservation

The current root metadata (`app/layout.tsx`) is being updated per the copy audit (Section 8). Apply those changes at the same time as the homepage refactor to keep SEO copy consistent with the homepage voice.

H1 of the page should be the hero headline: "A simpler place to brew."

Ensure the hero copy includes the primary SEO terms within easy crawl distance:
- "homebrewing recipe builder" (hero subhead picks up "recipe builder")
- "brewing calculator" (subhead picks up "calculators")
- "ABV", "IBU", "SRM", "water chemistry", "mash pH" (feature pills in §3 cover these)
- "BJCP styles" (feature pills in §3)
- "all-grain", "extract" (mention in root description, not necessarily on-page)

### Mobile

All current section layouts collapse to single-column on mobile. The new flow doesn't change that. The hero's two-column layout becomes single-column on mobile, with the product visual sitting below the copy. Verify this on the screenshot variant.

---

## Measuring success

No A/B framework is needed. Watch:

1. **Time on page** (analytics) — should go up. Visitors who land and learn what the app is faster will stay to read the rest.
2. **CTA click-through** on "Start a recipe" — should go up.
3. **Bounce rate** — should go down.
4. **Sign-ups in the week after launch** — leading indicator.
5. **Subjective:** ask 5 brewers to look at the new homepage cold and describe what the app does. If 4 of 5 get it within 5 seconds, the hero is working.

If conversions don't improve, the most likely cause is the hero visual (the screenshot quality matters a lot). Iterate on that first before iterating on copy.

---

## Out of scope for this iteration

- **Animated streaming questions in the hero.** Cool idea, but lower-priority than getting a real product visual in place. Could be a Phase 2 enhancement to the walkthrough section once the core refactor ships.
- **A/B testing infrastructure.** Overkill for a solo-dev app with current traffic. Ship and watch.
- **New onboarding flow for first-time signups.** Separate effort.
- **About page** (where the founder story could live). Separate effort.
- **Marketing landing pages for SEO** (e.g., `/abv-calculator-online` for keyword targeting). Separate effort.

---

## Phasing

### Phase 1 — Copy + structure (low effort, ship this first)

- Reorder sections in `app/page.tsx`
- Apply locked copy from `voice-and-tone.md` and `copy-audit.md` to each section
- Make the library section conditional
- Fold the stats strip into the hero
- Remove the secondary "Open calculators" CTA

**Estimate:** Half a day to a day of focused work.

### Phase 2 — Hero visual

- Capture a real product screenshot of the recipe builder with a realistic recipe
- Replace `hero.png` with the screenshot
- Test on mobile to ensure the layout still works

**Estimate:** A few hours, depending on how polished the screenshot needs to be.

### Phase 3 — Polish

- Interactive miniature builder in the hero (optional)
- Streaming-questions ambient texture on the walkthrough section (optional)
- More community recipe variety (curate the featured 6)
- Improved feature pill icons / visual treatments

**Estimate:** Variable. Treat as ongoing iteration.

---

## Open questions

These are TBD and might surface during build:

- **Recipe count for the social-proof line.** Should it be total recipes in the system (community + private), or only community-shared? Probably community-shared, since that's the social proof.
- **Whether "Browse recipes" survives as a secondary text link** in the hero, or gets dropped entirely. Lean toward dropping it for cleanest hero, but a small text link "or browse community recipes →" under the CTA is defensible.
- **What to do with the current illustrated hero asset.** Probably move to the About page if/when one is built.
- **Whether to surface a small live counter** like "247 recipes shared this month" as a stronger signal than total count. Requires aggregation queries; might not be worth it for v1.

---

## Reference

- Voice and copy rules: [voice-and-tone.md](voice-and-tone.md)
- Per-section copy and by-location audit: [copy-audit.md](copy-audit.md)
- Current homepage file: [src/modules/hopskip/components/HopSkipHomeContent.tsx](../src/modules/hopskip/components/HopSkipHomeContent.tsx)
- Community section: [src/modules/hopskip/components/HopSkipCommunitySection.tsx](../src/modules/hopskip/components/HopSkipCommunitySection.tsx)
- Learn preview: [src/modules/hopskip/components/HopSkipLearnSection.tsx](../src/modules/hopskip/components/HopSkipLearnSection.tsx)
- Design tokens: [src/modules/hopskip/tokens.ts](../src/modules/hopskip/tokens.ts)
