# Copy Audit

A line-by-line copy review against the [voice guide](voice-and-tone.md). For the homepage structural rework, see [homepage-refactor.md](homepage-refactor.md) — this doc covers the copy in summary form and the by-location audit for everything else.

The Learn section is excluded — that's user-written territory.

---

## Locked-in canonical copy

These are the lines decided. Everything else should pattern off them.

| Where | Copy |
|---|---|
| **Hero headline** | A simpler place to brew. |
| **Hero subhead** | A recipe builder with live math, brew-day calculators, and the science behind them. |
| **Calculators section title** | The math you'll reach for. |
| **Calculators section body** | Did I hit my OG? What do I do now that I didn't? How long do I boil? How much priming sugar? When you have a question, it's here. |
| **Empty library headline** | No recipes yet. Let's make one. |
| **Sign-in prompt title** | Sign in to save this recipe. |
| **Free tier full** | Free tier's full. |
| **Share success toast** | Recipe published. |
| **Fork error toast** | Fork failed. Try again. |
| **Link copy toast** | Link copied. |

---

## How to use this doc

Each entry has:
- **File** — where the copy lives
- **Current** — the exact existing text
- **Proposed** — the suggested rewrite
- **Why** — one-line rationale tied to a voice principle

Some entries have no proposed change — the existing copy is already in the new voice. Those are listed so they don't get rewritten in a sweep.

---

## 1. Homepage

The homepage is being structurally reworked. See [homepage-refactor.md](homepage-refactor.md) for the new section order, layout intent, and full per-section spec.

The copy for each section, in summary:

### Hero — `src/modules/hopskip/components/HopSkipHomeContent.tsx:50–177`

- **Kicker** (handwritten script): keep "hello, brewer —"
- **Headline:** "A simpler place to brew."
- **Subhead:** "A recipe builder with live math, brew-day calculators, and the science behind them."
- **Primary CTA:** "Start a recipe"
- **Secondary CTA:** "Browse recipes"

### Stats strip — `lines 180–261`

- `{totalCommunityRecipes}` recipes in our collection *(was "{recipeCount} recipes in your library" — switched from the logged-in user's count to the total site-wide community count, since a marketing stat means more as social proof than as personal status)*
- `20+` live calculations *(was "5 calculators wired up" — undersells; the recipe builder runs 20+ calculations live in addition to the standalone calculators)*
- `0` spreadsheets needed

The refactor doc proposes folding these into the hero. Total count is fetched server-side via Firestore `count()` aggregation in `app/page.tsx` and passed to `HopSkipHomeContent` as a prop.

### Recipe builder section → "How brew day goes" — `lines 263–457`

- **Kicker:** "how brew day goes —" (replaces "every dial talks —")
- **Eyebrow:** "Recipe builder"
- **Title:** "Pick a style. Drop in grains and hops. Watch the math work." (replaces "Every input nudges every output.")
- **Body:** "Build the recipe the way you'd build it in a notebook, but the math runs as you go. Adjust grain weights and OG updates. Add a late hop and IBU shifts. Change your equipment profile and boil-off recalculates. Everything is connected."
- **Feature grid:**
  - Live math — "OG, FG, ABV, IBU, SRM update on every edit."
  - Water chem — "Mineral additions, salt targets, mash pH."
  - Style targets — "BJCP in-range gauges per metric." (was "BJCP style guide" / "In-range gauges per metric, by style.")
  - Equipment-aware — "Boil-off, deadspace, absorption built in." (was "baked in")
- **CTA:** "Open the recipe builder"

### Calculators section — `lines 459–548`

- **Kicker:** "brew-day math without the spreadsheet —" (keep)
- **Eyebrow:** "Calculators"
- **Title:** "The math you'll reach for."
- **Body:** "Did I hit my OG? What do I do now that I didn't? How long do I boil? How much priming sugar? When you have a question, it's here."
- **Preview cards (ABV, IBU, Boil-off):** keep current copy
- **CTA:** "See all 7 calculators →" (new — link to /calculators)

### Library section (conditional render) — `lines 550–764`

- **Kicker:** "most recent —" (keep)
- **Eyebrow:** "Your library"
- **Title:** "Pick up where you left off." (keep — already perfect)
- **Conditional:** only render this section if the user is signed in AND `recipes.length > 0`. See homepage-refactor.md for rationale.

### Community section — `src/modules/hopskip/components/HopSkipCommunitySection.tsx`

The refactor doc moves this section higher up the page (from §6 to §3). Copy stays mostly the same:

- **Kicker:** "fresh from the community —" (keep)
- **Title:** "Recipes other brewers are pouring." (was "What other brewers are pouring." — drop "What", flip to declarative)
- **End link:** "Browse all →" (keep)

### Brewing science section — `src/modules/hopskip/components/HopSkipLearnSection.tsx`

- **Kicker:** "behind the numbers —" (keep)
- **Title:** "The research behind the numbers." (keep — honest, doesn't oversell as a library)
- **End link:** "All articles →" (keep)
- **"read more →"** script: keep

---

## 2. Calculators landing page

**File:** [app/calculators/page.tsx](../app/calculators/page.tsx)

### 2.1 Page kicker (line 123)
**Current:** "the brewer's pocket library —"
**Proposed:** Keep as-is.

### 2.2 Page headline (line 144–147)
**Current:** "Calculators for brew day."
**Proposed:** Keep as-is. (Plain, says what they are.)

### 2.3 Page subhead (line 159–160)
**Current:** "Quick gravity and volume math — no spreadsheet required. Pick a calculator on the right; the inputs update live as you type."
**Proposed:** "Quick gravity and volume math, no spreadsheet required. Pick one on the right. Inputs update live as you type."
**Why:** Splits into three plain sentences. Drops the em-dash.

### 2.4 Calc blurbs (lines 44–92)
**Current:**
- ABV: "From original and final gravity."
- Hydrometer: "Adjust a warm reading to calibrated temp."
- IBU: "Sum of hop additions with isomerization."
- Boil-off: "Volume to boil down to the OG you want."
- Dilution: "Water to add to drop into spec."
- Strike temp: "Hit your target mash temp first try."
- Carbonation: "Regulator PSI for a target CO₂ volume."

**Proposed:** Keep all as-is. Exemplars.

### 2.5 "More on the way" sidebar (line 338, 348)
**Current eyebrow:** "More on the way"
**Current body:** "Mash pH, yeast pitch rate, and starter sizing — coming next."
**Proposed eyebrow:** "Coming next"
**Proposed body:** "Mash pH, pitch rate, starters. Coming next."

---

## 3. Recipes list page

**File:** [src/modules/beta-builder/presentation/components/RecipeListPage.tsx](../src/modules/beta-builder/presentation/components/RecipeListPage.tsx)

### 3.1 Page title (line 197)
**Current:** "My Recipes"
**Proposed:** Keep as-is.

### 3.2 At-limit recipe count tooltip (line 216)
**Current:** "Free tier limit reached. Upgrade to Premium to save unlimited recipes."
**Proposed:** "Free tier's full. Upgrade for unlimited recipes."

### 3.3 Anonymous sign-in banner (line 243–245)
**Current:** "Sign in with Google to save recipes to the cloud, share with others, and access them from any device."
**Proposed:** "Sign in with Google to save recipes, share with other brewers, and use them across devices."

### 3.4 Sign-in banner button (line 251)
**Current:** "Sign in"
**Proposed:** Keep as-is.

### 3.5 Search placeholder (line 264)
**Current:** "Search recipes by name, style, or tags..."
**Proposed:** Keep as-is.

### 3.6 Import success toast (line 367, 391)
**Current:** `Imported "${imported.name}"`
**Proposed:** Keep as-is.

### 3.7 Import error toast (line 369, 392)
**Current:** "Failed to import BeerXML file" / "Failed to import JSON file"
**Proposed:** "Couldn't read that BeerXML. Try a different file." / "Couldn't read that JSON. Try a different file."

### 3.8 Empty-search state (line 422–425)
**Current:** `No matches for "${searchQuery}"` / "Try a different name, style, or tag"
**Proposed:** Keep both.

### 3.9 Empty library — headline (line 494)
**Current:** "Your brew log is empty"
**Proposed:** "No recipes yet."
**Why:** Plain, direct. The CTA below carries the invitation.

### 3.10 Empty library — body (line 496–498)
**Current:** "Start by building your first recipe — add grains, hops, yeast, and dial in your numbers."
**Proposed:** "Pick a style, add grains, hops, yeast, and dial in your numbers. Let's make your first recipe."

### 3.11 Empty library — CTA (line 503)
**Current:** "Create Your First Recipe"
**Proposed:** "Start a recipe"
**Why:** Matches the homepage CTA. Plain.

### 3.12 Delete dialog title (line 546)
**Current:** "Delete Recipe?"
**Proposed:** "Delete this recipe?"

### 3.13 Delete dialog body (line 547–549)
**Current:** "Are you sure you want to delete this recipe? This action cannot be undone."
**Proposed:** "This removes the recipe and its version history. Saved brew sessions stay."

### 3.14 New Version dialog title (line 952)
**Current:** "Create New Version"
**Proposed:** "Save as new version"

### 3.15 New Version dialog body (line 954–957)
**Current:** `This will save the current state of "${recipe.name}" as version ${recipe.currentVersion} and increment to version ${recipe.currentVersion + 1}.`
**Proposed:** `Saves "${recipe.name}" as v${recipe.currentVersion}. The next version becomes v${recipe.currentVersion + 1}.`

### 3.16 New Version dialog CTA (line 976)
**Current:** "Create Version"
**Proposed:** "Save version"

### 3.17 Create Variation dialog title (line 1005)
**Current:** "Create Variation"
**Proposed:** "Start a variation"

### 3.18 Create Variation dialog body (line 1007–1010)
**Current:** `This will create a new recipe based on "${recipe.name}" (v${recipe.currentVersion}).`
**Proposed:** `Makes a new recipe from "${recipe.name}" (v${recipe.currentVersion}). Tweak it freely without changing the original.`

### 3.19 Card menu items (lines 736–820)
**Current:** "New version", "New variation", "View history", "Export Markdown", "Copy Markdown", "Export JSON", "Export BeerXML", "Copy Share Link", "Delete"
**Proposed:** Keep all as-is.

### 3.20 Card share-link toast — private recipe (line 634)
**Current:** "Recipe is private — open it and make it public to share"
**Proposed:** "That recipe is private. Open it and make it public to share."

### 3.21 Card share-link toast — success (line 632)
**Current:** "Share link copied to clipboard"
**Proposed:** "Link copied."

### 3.22 Upgrade reason (line 573)
**Current:** "Export is a Premium feature."
**Proposed:** "Exporting is a Premium feature."

### 3.23 "Brew this beer" tooltip (line 691)
**Current:** "Brew this beer"
**Proposed:** Keep as-is.

---

## 4. Sharing flow

**Files:** [ShareModal.tsx](../src/modules/sharing/ShareModal.tsx), [ForkButton.tsx](../src/modules/sharing/ForkButton.tsx), [BrowseCard.tsx](../src/modules/sharing/BrowseCard.tsx)

### 4.1 Share modal title (ShareModal.tsx:91–92)
**Current:** "Share Recipe"
**Proposed:** "Share this recipe"

### 4.2 Share modal — public state body (line 98–100)
**Current:** "**{recipeName}** is public. Anyone with the link can view it."
**Proposed:** Keep as-is.

### 4.3 Share modal — private state body (line 137–139)
**Current:** "**{recipeName}** is private. Make it public to get a shareable link."
**Proposed:** Keep as-is.

### 4.4 Share modal — Make Private (line 127)
**Current:** "Make Private"
**Proposed:** "Make private"

### 4.5 Share modal — Make Public (line 151)
**Current:** "Make Public"
**Proposed:** "Make public"

### 4.6 Share modal — Copy button (line 115)
**Current:** "Copy" / "Copied!"
**Proposed:** "Copy" / "Copied"

### 4.7 Share toast — now public (line 59)
**Current:** "Recipe is now public!"
**Proposed:** "Recipe published."

### 4.8 Share toast — now private (line 72)
**Current:** "Recipe is now private"
**Proposed:** "Recipe is private."

### 4.9 Share toast — link copied (line 84)
**Current:** "Link copied to clipboard"
**Proposed:** "Link copied."

### 4.10 Share toast — publish error (line 61)
**Current:** "Failed to publish recipe"
**Proposed:** "Couldn't publish. Try again."

### 4.11 Share toast — unpublish error (line 75)
**Current:** "Failed to make recipe private"
**Proposed:** "Couldn't make it private. Try again."

### 4.12 Fork button — signed out (ForkButton.tsx:118)
**Current:** "Sign in to save this recipe"
**Proposed:** Keep as-is.

### 4.13 Fork button — signed in (line 125)
**Current:** "Fork to My Recipes"
**Proposed:** "Fork to my recipes"

### 4.14 Fork limit toast (line 34)
**Current:** `You've reached the ${RECIPE_LIMIT}-recipe limit. Upgrade to Premium for unlimited recipes.`
**Proposed:** `Free tier's full. Upgrade for unlimited recipes, or delete one to make room.`

### 4.15 Fork success toast (line 106, BrowseCard.tsx:133)
**Current:** `Forked "${recipeName}" to your recipes`
**Proposed:** Keep as-is.

### 4.16 Fork error toast (line 109)
**Current:** "Failed to fork recipe"
**Proposed:** "Fork failed. Try again."

### 4.17 BrowseCard fork (signed out) (BrowseCard.tsx:297)
**Current:** "Sign in to Fork"
**Proposed:** "Sign in to fork"

### 4.18 BrowseCard fork (signed in) (line 297)
**Current:** "Fork to My Recipes"
**Proposed:** "Fork to my recipes"

### 4.19 BrowseCard menu — Copy Share Link (line 300)
**Current:** "Copy Share Link"
**Proposed:** Keep as-is.

### 4.20 BrowseCard share-copy toast (line 151)
**Current:** "Share link copied"
**Proposed:** "Link copied."

### 4.21 BrowseCard markdown-copy toast (line 177)
**Current:** "Markdown copied to clipboard"
**Proposed:** "Markdown copied."

### 4.22 BrowseCard export error (line 187)
**Current:** "Export failed"
**Proposed:** "Export failed. Try again."

### 4.23 BrowseCard load error (line 98, 166)
**Current:** "Could not load recipe" / "Could not load recipe data"
**Proposed:** "Couldn't load that recipe."

### 4.24 BrowseCard fork generic error (line 136)
**Current:** "Fork failed"
**Proposed:** "Fork failed. Try again."

### 4.25 Example Recipe badge (line 342)
**Current:** "Example Recipe"
**Proposed:** "Example"

### 4.26 Empty rating text (line 426)
**Current:** "No ratings"
**Proposed:** "Not rated yet"

---

## 5. Sign-in & upgrade flow

**Files:** [SignInPrompt.tsx](../src/modules/auth/components/SignInPrompt.tsx), [RecipeLimitModal.tsx](../src/modules/auth/components/RecipeLimitModal.tsx), [UpgradeModal.tsx](../src/modules/auth/components/UpgradeModal.tsx)

### 5.1 Sign-in prompt — title (SignInPrompt.tsx:19)
**Current:** "Sign in to save your recipe"
**Proposed:** "Sign in to save this recipe."
**Why:** "This recipe" beats "your recipe" when it's a specific recipe action. Add the period.

### 5.2 Sign-in prompt — body (line 20–21)
**Current:** "It's free and takes one click. Your recipe will be saved automatically."
**Proposed:** "Free, one click. Your recipe saves automatically."

### 5.3 Sign-in prompt — "Not Now" (line 25)
**Current:** "Not Now"
**Proposed:** "Not now"

### 5.4 Recipe Limit Modal — title (RecipeLimitModal.tsx:27)
**Current:** "Recipe Limit Reached"
**Proposed:** "Free tier's full."

### 5.5 Recipe Limit Modal — body (line 28–31)
**Current:** "You've saved {RECIPE_LIMIT} recipes — that's the free tier limit. Upgrade to Premium for unlimited recipes and more."
**Proposed:** "You've saved {RECIPE_LIMIT} recipes, which is the free tier max. Upgrade to Premium for unlimited recipes and a few other things."

### 5.6 Recipe Limit Modal — benefits list (line 32–38)
**Current:**
- ✓ Unlimited cloud recipes
- ✓ BeerXML & Markdown export
- ✓ Buy a solo dev a pint — 🍺 Cheers!

**Proposed:**
- ✓ Unlimited recipes
- ✓ Export to BeerXML and Markdown
- ✓ Keep a solo dev in pints 🍺

### 5.7 Recipe Limit Modal — primary CTA (line 44)
**Current:** "Upgrade — $1.99/mo"
**Proposed:** "Upgrade for $1.99/mo"

### 5.8 Recipe Limit Modal — "Not Now" (line 41)
**Current:** "Not Now"
**Proposed:** "Not now"

### 5.9 Recipe Limit Modal — annual / footer (line 48–55)
**Current:** "Or $19.99/year (save ~$4) · You can also delete a recipe to free up a slot."
**Proposed:** "Or $19.99/year (save ~$4). Or delete a recipe to free up a slot."

### 5.10 Upgrade Modal — title (UpgradeModal.tsx:30)
**Current:** "Upgrade to Premium"
**Proposed:** Keep as-is.

### 5.11 Upgrade Modal — reason override (line 573 in RecipeListPage, line 519 in BrowseCard)
**Current:** "Export is a Premium feature."
**Proposed:** "Exporting is a Premium feature."

### 5.12 Upgrade Modal — benefits list (line 36–42)
**Current:** Same as RecipeLimitModal.
**Proposed:** Same as 5.6.

### 5.13 Upgrade Modal — "Not Now" (line 69)
**Current:** "Not Now"
**Proposed:** "Not now"

### 5.14 Upgrade Modal — primary CTA (line 72)
**Current:** "Upgrade"
**Proposed:** Keep as-is.

---

## 6. Browse page

**File:** [app/browse/page.tsx](../app/browse/page.tsx)

### 6.1 Meta title (line 13)
**Current:** "Browse Recipes"
**Proposed:** Keep as-is.

### 6.2 Meta description (line 15–16)
**Current:** "Discover homebrewing recipes shared by the community. Find inspiration for your next brew."
**Proposed:** "Homebrewing recipes shared by other brewers. Search, sort, fork, and find your next batch."

### 6.3 OG and Twitter description (lines 20, 26)
**Current:** Same as meta description.
**Proposed:** Mirror 6.2.

---

## 7. Navigation

**File:** [src/components/NavBar.tsx:14–17](../src/components/NavBar.tsx)

**Current:** "My Recipes", "Browse", "Calculators", "Learn"
**Proposed:** Keep as-is.

---

## 8. SEO & metadata (root)

**File:** [app/layout.tsx](../app/layout.tsx)

### 8.1 Root title default (line 13)
**Current:** "Brewing.It - Homebrewing Recipe Builder & Calculator"
**Proposed:** "Brewing.It — Homebrewing recipe builder and brew-day calculators"

### 8.2 Root description (line 16–17)
**Current:** "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more. Free brewing calculator for all-grain and extract brewers."
**Proposed:** "A homebrewing recipe builder with live math, brew-day calculators, and the science behind them. Build recipes, calculate ABV, IBU, SRM, water chemistry, and mash pH. Free, all-grain and extract."

### 8.3 OG and Twitter (lines 33, 34–35, 40–43)
**Current:** Variants of the above.
**Proposed:** Mirror 8.1 and 8.2.

---

## 9. Builder modals

### 9.1 Custom equipment name validation
**File:** `src/modules/hopskip/components/modals/CustomEquipmentModal.tsx`
**Current:** "Please enter a profile name"
**Proposed:** "Give the profile a name."

### 9.2 Fermentation step duration validation
**File:** `src/modules/hopskip/components/modals/FermentationStepModal.tsx`
**Current:** "Duration must be greater than 0 days"
**Proposed:** "Set a duration of at least one day."

### 9.3 Preset picker — empty search states
**Files:** `src/modules/beta-builder/presentation/components/PresetPickerModal.tsx`
**Current:** "No yeasts found", "No hops found", "No fermentables found"
**Proposed:** Keep all as-is.

### 9.4 Water salts saving/saved
**File:** `src/components/WaterSaltsCalc.tsx:996, 1012`
**Current:** "Saving" / "Saved"
**Proposed:** Keep as-is.

---

## Cross-cutting patterns

Apply these wherever they appear, in addition to the location-specific notes above.

### "Failed to X" → "X failed. Try again." or "Couldn't X. Try again."

- "Failed to import BeerXML file" → "Couldn't read that BeerXML. Try a different file."
- "Failed to fork recipe" → "Fork failed. Try again."
- "Failed to publish recipe" → "Couldn't publish. Try again."
- "Failed to make recipe private" → "Couldn't make it private. Try again."
- "Fork failed" → "Fork failed. Try again."
- "Export failed" → "Export failed. Try again."

### "X copied to clipboard" → "X copied."

- "Link copied to clipboard" → "Link copied."
- "Share link copied" → "Link copied."
- "Markdown copied to clipboard" → "Markdown copied."

### Capitalization

Title Case in mid-sentence button labels reads corporate. Switch to sentence case for inline buttons within modal flows.

- "Make Public" → "Make public"
- "Make Private" → "Make private"
- "Fork to My Recipes" → "Fork to my recipes"
- "Sign in to Fork" → "Sign in to fork"
- "Not Now" → "Not now"

Keep Title Case for primary nav, page titles, and standalone buttons where the label is the only text in context.

### Exclamation marks

Default: remove. Audit every `!` in user-facing copy. Earn the survivors.

### Em-dashes in marketing copy

Replace ` — ` with ` ` (period + sentence break) wherever the dash is doing comma-work. Keep em-dashes only in:
- Handwritten script kickers (visual element, low text)
- Single dashes where the line genuinely needs the pause

A rough rule: no more than one em-dash per visible screen.

---

## Things not to change

Already in the voice. Leaving them on the record so they don't get rewritten in a sweep.

- **"0 spreadsheets needed"** — exemplar
- **"the brewer's pocket library —"** (calculators kicker) — keep, kicker
- **"What other brewers are pouring."** — (becomes "Recipes other brewers are pouring." in the refactor)
- **"tap to open →"** (calculator preview script) — exemplar
- **"Pick up where you left off."** (library title) — exemplar
- **"Sign in to save this recipe"** (sign-in prompt) — confirmed
- **Nav labels** — exemplars

---

## How to ship this

The audit groups into three sensible PRs:

1. **Homepage rework** — Part 1, full structural and copy change. See [homepage-refactor.md](homepage-refactor.md). Biggest visible change; ship first.
2. **Voice sweep** — Parts 2 through 9. Mostly mechanical string swaps grouped by file. Several PRs is fine.
3. **SEO** — Section 8 only. Small focused PR, low risk.

The Learn section stays as-is.
