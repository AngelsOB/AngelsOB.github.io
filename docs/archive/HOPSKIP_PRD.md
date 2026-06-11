# Hop & Skip — Restyle PRD

A design + behavior spec for restyling Brewing.It in the **Hop & Skip** visual language. This is a full replacement of the current visuals — not a parallel theme, not toggleable. The previous styling stays in git history as a fallback only.

The dev implementing this should treat the spec as design intent and translate it to whatever fits the current Next.js architecture. Code snippets here are illustrative, not prescriptive — adapt freely.

---

## 1. Design philosophy

Four rules everything in the system obeys:

1. **Geometric, never decorative.** Illustrations are made of half-circles, quarters, triangles, squares. They *mean* things — ingredients, ratios, volumes — never ornament.
2. **Numbers in tabular widths.** Brewing is measurement. Every numeric uses `font-variant-numeric: tabular-nums` so columns align.
3. **Framed in ink.** Every visible surface is a 2px ink-bordered card with a **hard offset shadow**. No blur, ever. The frame is the brand.
4. **One handwritten note per section.** Caveat script is the friendly voice. Use it sparingly — kicker, label, aside — never for primary content. Rotated -3° default. Maximum one per visible section.

Tone of voice: warm, winking, occasionally goofy, often precise. "hello, brewer —", "free, forever ✦", "looking good!", "in range ✓".

---

## 2. Design tokens

Define these as CSS variables on the root (or on a wrapper if you want to phase in). Everything else in the system reads from them — don't hard-code.

### Color · paper & ink

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--hs-cream` | `#f4eedd` | `#1b1916` | page background |
| `--hs-cream-2` | `#fbf6ea` | `#252220` | subdued surface (rows, side rails) |
| `--hs-paper` | `#fffbef` | `#2a2622` | card surface |
| `--hs-ink` | `#1a1612` | `#f4ede0` | text, strokes, hard shadows |
| `--hs-muted` | `#5a4f42` | `#9c948a` | secondary text, captions |

### Color · ingredient accents

Each accent maps to **one ingredient**. The color is semantic — a yellow dot means malt, a blue dot means water. Don't reassign.

| Token | Hex | Ingredient | Used for |
|-------|-----|------------|----------|
| `--hs-malt` | `#f2c14e` | malt | fermentables, OG/FG, body |
| `--hs-roast` | `#d4452c` | roast | mash, heat, alerts |
| `--hs-water` | `#2b6fb8` | water | hydration, chill, volume |
| `--hs-hops` | `#4a8a3d` | hops | bitterness, success |
| `--hs-yeast` | `#ee7755` | yeast | ferment, accents |
| `--hs-honey` | `#ffd97a` | — | highlight, butter card |

**Don't** use red for "buy" buttons or blue for links — those are conventional UI meanings; here the colors mean ingredients. If you need another dimension of meaning, use shape (circle vs. square vs. triangle), not a new hue. Pick at most three accents per screen (four if one is honey/muted).

### Typography

```
--hs-font-display: "Archivo Black", "Space Grotesk", system-ui, sans-serif;
--hs-font-body:    "Space Grotesk", system-ui, sans-serif;
--hs-font-script:  "Caveat", cursive;
--hs-font-mono:    "IBM Plex Mono", ui-monospace, monospace;
```

Load via `next/font/google` — `Archivo Black`, `Space Grotesk: 400/500/600/700`, `Caveat: 400/700`, `IBM Plex Mono: 400/500/600`.

Three voices:
- **Display** (Archivo Black) — page-level statements, section headlines, the big number in stat cards. Tracking `-0.035em`, leading `0.92`.
- **Body** (Space Grotesk) — everything that reads. 400/500/600/700.
- **Script** (Caveat) — kicker, label, aside. Rotated `-3°` default. **One per section, max.**
- **Mono** (IBM Plex Mono) — technical specs, tabular numerics in tight columns, code chips.

### Type scale

```
2xs: 10px    eyebrows, micro-captions
xs:  11px
sm:  12px    meta, tabular numerics
md:  14px    body
lg:  18px    card titles, nav
xl:  22px    section subheads
2xl: 30px    page subheads
3xl: 48px
4xl: 72px
5xl: 104px   hero only
```

### Space (4-pt scale)

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`

### Radius

```
sm:   6px       chips, small swatches
md:  12px       default card
lg:  14px       tall cards
xl:  18px       hero blocks
pill: 999px
```

### Stroke & shadow

```
--hs-stroke:      2px solid ink           ← every framed surface
--hs-stroke-thin: 1.5px solid ink          ← inner dividers

--hs-shadow-1: 2px 2px 0 ink              ← chips, pills
--hs-shadow-2: 3px 3px 0 ink              ← buttons, stat cards
--hs-shadow-3: 4px 4px 0 ink              ← default card
--hs-shadow-4: 6px 6px 0 ink              ← hero card / modal
```

**No `blur` in any shadow.** Ever. That's the brand.

### Motion

```
--hs-tilt-script:  -3deg     ← default script note rotation
--hs-tilt-card:     0.3deg   ← grouped cards alternate ±0.3deg
--hs-ease:         cubic-bezier(0.2, 0.7, 0.3, 1)
```

---

## 3. Component primitives

Build these as small typed React components. Each reads from the tokens. Use them everywhere — don't compose ad-hoc divs when one of these fits.

| Component | Purpose |
|-----------|---------|
| `<HSEyebrow>` | Small uppercase tracked label (10px / 700 / 0.16em letter-spacing). Used above values and section titles. |
| `<HSCard>` | Every framed surface in the system. Props: `shadow` (1–4), `bg`, `tilt`, `accent` (renders a 5px colored strip on top), `radius`, `padding`. |
| `<HSButton>` | Pill button with ink border + hard offset shadow. Variants: `solid` (accent color), `ghost` (paper), `ink` (inverted). |
| `<HSPill>` | Outlined chip with optional colored dot + label + value. Used for ingredient meta (style, batch, boil time). |
| `<HSStatCard>` | Accent top-strip + display numeric + optional rotated script note (e.g. "nice!" on the in-range IBU). |
| `<HSScriptNote>` | Caveat accent. Props: color, size, rotate. **One per section.** |
| `<HSIngredientDot>` | Small geometric chip — circle / square / triangle / half-up / quarter. Use shape to differentiate when you can't use color. |
| `<HSColorBlock>` | Illustration primitive — same shape options at larger sizes. Compose these to build hero illustrations. |
| `<HSHopCone>` | Stacked half-circles, the canonical hop illustration. |
| `<HSRangeBar>` | Value-in-range indicator. Ink track, ingredient-accent fill, ink needle, tabular nums label. |
| `<HSSectionHeader>` | Big muted indexed numeral ("01") + display H2 + optional script kicker + eyebrow. |
| `<Glyph>` | Tiny SVG icons (`hop`, `water`, `malt`, `yeast`, `mug`, `drop`, `square`, `triangle`). Color via prop. |

The full primitive sources are at the end of this doc (Appendix A).

---

## 4. Layout — site shell

### Header

A single bar with:
- **Brand mark**: three overlapping shapes (red circle + yellow rounded-square + blue triangle) followed by **BREWING.IT** in display type. Optional script caption after it (`"/ recipes / tuesday pale"`).
- **Nav pill**: a paper-filled outlined pill containing `Home / Recipes / Calculators` (or the live equivalents). Active link gets the malt yellow background.

No theme toggle. No "Classic" link. This is the only style.

At ≤720px the header switches to flex-column: brand on top row, nav pill below as a full-width horizontally-scrollable pill with the scrollbar hidden.

### Footer

Inverted ink footer (cream text on ink bg). Brand mark + "made with malt & love." script + tagline + three columns of links + copyright row.

---

## 5. Page: Home / Landing

Sections, top to bottom:

### Hero

Two-column grid: text on the left, hero illustration on the right.

**Left column**:
- Caveat script kicker — "hello, brewer —" in yeast color
- Big display H1 with a **rotated yellow highlight** on a single word ("numbers") and the last line in roast red — e.g.
  > Brew with  
  > [numbers]  ← yellow highlight, rotated -1.5°  
  > **that agree.** ← in roast red
- Description paragraph
- Two CTAs side-by-side: solid-ink "Start a recipe →" with a roast offset shadow, and a paper "Open calculators" with an ink offset shadow
- "free, forever ✦" Caveat script note

**Right column**:
- Hero illustration. Original was a brewing-equipment composition (kettle, calculator, beer glass, hop, thermometer, X mark, gauges) in the HS palette — 1380×767 PNG, served from `public/images/hero.png`. The illustration should bleed to the right edge of the page (no right padding on the hero section).

**Responsive**:
- **>1100px** — two-column hero, image bleeds right edge
- **≤1100px** — image becomes a faded background overlay (opacity 0.08, position: absolute, inset 0, object-fit cover). Text stacks in a single column on top. This avoids the dead-space issue when the image's natural height is shorter than the (tall) text column.

The hero headline uses `clamp(44px, 6.5vw, 100px)` so it scales smoothly across viewports. Other display sizes also use `clamp()` — see §11.

### Stats strip

Three-column row, cream-2 bg, divided by 2px ink borders.

Each cell: colored square + big display number + uppercase label. Counts shown:
- Real saved-recipe count (read from the recipe store, e.g. `recipes.length`)
- "4 calculators wired up" (or whatever's accurate)
- "0 spreadsheets needed"

At ≤640px, stacks single-column with ink bottom dividers between rows.

### Section 01 — Recipe builder feature

`<HSSectionHeader index="01" kicker="every dial talks—" eyebrow="Recipe builder" title="Every input nudges every output." />`

Two-column body:
- **Left**: short marketing paragraph + four small feature `<HSCard>`s (Live numbers · Water chem · BJCP style guide · Equipment-aware), each with a colored square + label + one-line description. CTA "Open builder →" in hops green.
- **Right**: a decorative `<HSCard>` mocking the recipe builder UI — recipe name, 4-stat grid, grain bill with horizontal bars. Layered behind it: an honey-colored card rotated -1.5° peeking out. This is illustrative — wire it to a real recipe if you want.

### Section 02 — Calculators preview

`<HSSectionHeader index="02" kicker="pocket math —" eyebrow="Calculators" title="Brew-day numbers, ready when you are." />`

Three preview cards in a row. Each is an `<HSCard>` with:
- A 50px colored circle in the **top-right corner**, with an ingredient glyph inside
- An eyebrow ("ABV", "IBU", "Boil-off")
- A big display numeric ("5.51%", "38", "9.2%")
- A muted subtitle ("from gravity", "Tinseth", "to target OG")
- A "tap to open →" script footer that links to `/calculators`

### Section 03 — Your library

`<HSSectionHeader index="03" kicker="most recent —" eyebrow="Your library" title="Pick up where you left off." />`

Three real recipe cards from the store (sorted by most-recently-updated). Each card:
- 16px wort-color strip at the top — use the existing `srmToRgb(srm)` util
- Recipe name (display)
- Style name (italic, muted)
- "tap to open" script
- 4-stat grid (ABV / IBU / SRM / OG) in tabular nums

Cards alternate tilts: `-1.2°`, `0.8°`, `-0.6°`. Clicking links to `/recipes/<id>`.

**Empty state** (no saved recipes): a single centered card with "empty shelf —" kicker, "Build your first recipe." headline, copy, and a "Start a recipe →" ink button.

Below the grid: a "Browse all N recipes →" paper-pill link.

### Footer

The inverted ink footer (see §4).

---

## 6. Page: Calculators

Featured-calc-on-left + catalog-on-right pattern.

### Title bar

`"the brewer's pocket library"` Caveat kicker + big display headline:
> [Calculators] for brew day.
>
> *(yellow highlight rotated -1.5° on "Calculators")*

Subtitle paragraph: "Real math, in this style. Each one uses the same calculation core as the classic app — just dressed up."

### Featured calculator

A large `<HSCard>` with a header strip: ingredient glyph in a colored circle on the left, eyebrow + title, "live ✦" script on the right. Body holds the calc's inputs + result.

Wire up the **existing** pure math functions in `src/calculators/`:
- ABV — `abvFromOGFG(og, fg)`
- IBU Tinseth — `ibuTotal(additions, postBoilVolL, og)`
- Boil-off / target OG — `postBoilVolume(preBoilVol, preBoilSG, targetOG)`
- Wort dilution — `dilutionWater(currentVol, currentSG, targetSG)`

Each calc uses `<NumberField>` (an ink-bordered card with a colored side-strip indicating which ingredient role the input plays — yellow for malt/gravity inputs, blue for water/volume, red for time/heat, etc.).

The IBU calc gets a full **editable hop additions table** (text input for variety, number inputs for AA%, grams, time, select for type), a total row, and a **result gauge** showing the value vs the style range — track with style-range fill + ink needle + an "in range ✓" / "out of range" Caveat note.

### Catalog rail (right)

Four `<HSCard>` category sections — Gravity & ABV, Hops & bitterness, Mash & water, Boil & volume. Each shows its calc(s) as a clickable pill. The active calc gets the category's ingredient color fill + an "OPEN" pill.

Below the four: a small "More on the way" muted card listing future calculators.

### Responsive
- ≤1024px: catalog moves below featured (single column)
- ≤640px: even tighter — featured spans full width, inputs stack

---

## 7. Page: Recipes (browser)

### Title bar

`"your brewing —"` script kicker + big headline:
> [Recipes]
>
> *(rotated yellow highlight)*

Action row: "+ New recipe" ink-cream button + full-width search pill + sort `<select>` + "N saved" Caveat script.

### Grid

`auto-fill minmax(320px, 1fr)` grid of recipe cards. Each card has alternating tilts (-0.4° / 0.3° / -0.2°). Card content:

- 18px wort-color strip from `srmToRgb(srm)`
- Recipe name (display, truncated)
- Style name (italic, muted, truncated)
- Up to 3 tag chips
- 4-stat grid (ABV / IBU / SRM / OG) computed live via `recipeCalculationService.calculate(recipe)`
- Updated-date footer + "open →" script
- Small × delete button in the top-right of the card

### Empty / no-match states

- No recipes saved: full HS card with "no recipes yet —" kicker, "Start with a blank one." title, copy, and a CTA. Include a link to the existing import flow for BeerXML.
- Search returns no matches: smaller card explaining what was searched.

### Delete confirmation

Full-viewport fixed backdrop (rgba(26,22,18,0.5)), centered `<HSCard>` with eyebrow + title + body + Cancel/Delete buttons. Delete button uses roast red.

---

## 8. Page: Recipe builder

This is the most complex page. The layout flows top-to-bottom in distinct horizontal strips.

### A. Sub-header bar (cream-2 bg)

"← back to recipes" muted link · "Edits not saved" / "✓ Saved!" indicator (flips green for 2s after save) · "Save recipe →" hops-green pill button.

### B. Title bar

`"recipe draft —"` Caveat script + big editable H1 (the recipe name, bound to `recipe.name`) + meta pill row underneath:

- **STYLE** — clickable pill with chevron `⌄`. Click opens the existing style selector modal. Pill shows current style or "Add style…" placeholder.
- **BATCH** — pill with inline number input (L)
- **BOIL** — pill with inline number input (min)
- **EFF** — pill with inline number input (%)
- **Advanced ▼** — toggle button that reveals an expander below for the secondary equipment fields (boil-off rate, mash thickness, deadspaces, hop absorption, fermenter loss, cooling shrinkage, etc.)

The Advanced expander reuses whatever equipment-section component lives in live. **Hide its duplicate top-level Batch/Eff/Boil fields** (they're already in the pills above). If live's equipment component has its "advanced" details inside a `<details>` element, force it open programmatically — the brewer toggling the Advanced button at the top should reveal everything; they shouldn't have to click another disclosure inside.

### C. BJCP style ranges strip (only when a style is set)

✅ **Shipped — full redesign, see `BJCPStyleRail.tsx` + `BJCPRangeRow.tsx`.** The old plan (wrap legacy `StyleRangeComparison` with `style-strip-*` overrides) was scrapped. The current implementation:

- Single boxed card (paper bg, 2px ink border, 4px hard shadow) rendered **inside** the live-numbers band (collapsible via the existing `STYLE RANGES` toggle), positioned below the StatCards and above the SRM color bar.
- **5 mini range rows**: OG, FG, ABV, IBU, BU/GU. Each row is a horizontal cell with eyebrow label + current value floating above the marker, a pill-shaped track with a tinted in-range band and edge ticks, and lo/hi labels under the band edges. View range is wider than the BJCP target so out-of-range markers travel visibly to their position instead of clamping. Marker color flips ink → roast when out of range.
- **SRM color footer** merged into the same card (one card, not two): bottom-up gradient bar with **cross-hatched + 7.5%-paper-washed** regions outside the BJCP SRM range, ink vertical edge lines, a recipe-color pin marker showing the actual `srmToRgb` color of the recipe, lo/hi labels under, and a script-font color adjective on the right ("deep amber ✦", "deep red ✦", etc.).
- Header: ink/roast badge + `BJCP {code}` eyebrow + style name in muted body type + summary script ("in style!" or "N over, M in") + `SWITCH STYLE ⇄` button wired to `setIsStyleModalOpen`.
- BU/GU range derived from `spec.ibu` / `spec.og` endpoints (proven formula).

**Vital patterns kept from this slice:**
- View-range formula: `pad = max(span * 1.0, statMinPad); viewLo = lo - pad; viewHi = hi + pad`; auto-expand if value is still outside. Per-stat `statMinPad` + `viewMin` clamps so OG/FG don't go below 1.000 and IBU/ABV don't go negative.
- SRM gradient slicing trick: each segment of the SRM bar uses the same full-width gradient image but with `background-size` + `background-position` math so colors line up exactly with `srmToRgb` at the segment's edges (used when the in-range bulge is rendered taller than the surrounding hatched zones — see `srmSliceBackground`).

### D. Live numbers (cream-2 bg)

"Live numbers" eyebrow · "updates as you type ✦" script.

6-column grid of stat cards: OG, FG, ABV, IBU, pH, Cal/12oz (SRM moved to the BJCP rail's color footer; no longer a standalone card). Each card:
- 5px ingredient-accent top strip
- Eyebrow with the metric name
- Big display numeric in tabular nums

✅ **Shipped — see `HopSkipBuilder.tsx` live-numbers band.** Notes vs. original spec:
- Removed the per-card BJCP target range text (was duplicated noise; the rail below now owns all BJCP comparison).
- Removed the "nice!" script note on the IBU card (replaced by the in-range/out-of-range coloring in the rail).
- Below the StatCards, the BJCP rail (§C) renders inside the same band (collapsible). The rail's SRM color footer replaces the standalone `ColorIndicatorBar` element.

Values come from `useRecipeCalculations(recipe)` — same hook the classic builder uses.

Responsive: 6-col → 3-col at ≤900px → 2-col at ≤640px.

### E. Tabs + section body — the "binder tab" pattern

This is the most carefully-engineered part. See §10 for the full explanation. ✅ **Single-row chrome shipped + responsive tier system shipped.**

Tabs: `Fermentables · Hops · Mash · Water · Yeast · Fermentation · Brew sheet`. Each tab has a 10×10 colored square (the ingredient color), a display label, and a small count chip showing how many items are in that section.

Active tab gets a 4px ingredient-accent strip on its top edge (inset inside the ink border).

Section body renders whatever the existing classic section components are for each tab. Don't rebuild them — import and reuse:
- Fermentables section
- Hops section (incl. flavor radar)
- Mash schedule section
- Water chemistry section
- Yeast section
- Fermentation schedule section
- Brew day checklist section

The HS overrides (see §9) handle restyling the internals of these classic components automatically.

#### Responsive tier system (5 stages A → E)

The tab strip measures its own container width via a callback ref + ResizeObserver and adapts in 5 discrete stages. Critical fix during implementation: use a **callback ref** (not `useRef` + `useEffect` with empty deps) — the parent early-returns a `Loading recipe…` placeholder before `currentRecipe` is loaded, so the tablist doesn't exist on first render. With `useEffect([])` the observer would attach to a null ref and never re-attempt; callback ref handles mount/unmount transitions cleanly.

| Stage | Container width | What changes |
|---|---|---|
| A | ≥1000px | Full chrome — color swatch + label + count badge, padding 12×20 |
| B | ≥850px | Count badges hidden, padding 12×18 |
| C | ≥700px | Color swatches hidden too, padding 12×14 |
| D | ≥560px | Tight padding 10×12, label drops to 13px |
| E | <560px | **Two-row layout** — 3 + 3 swappable tabs + Brewsheet pinned far-right-bottom |

#### Stage E specifics (two-row layout)

- **3 + 3 split**: Group A = Fermentables/Hops/Mash; Group B = Water/Yeast/Fermentation. Brewsheet is rendered as its own absolutely-positioned element always at `right: 0` and `translateY(BOTTOM_TOP)` — it never participates in the swap.
- **Active group always on the bottom row**. State: `lastSwappable` ("A" or "B"), updated via `useEffect([activeTab])`. Brewsheet selection deliberately doesn't update it (so clicking Brewsheet doesn't shuffle the rows).
- **Brick offset**: top row gets `translateX(44px)` so the two rows are staggered like bricks.
- **Tuck under**: top-row tabs use padding `"8px 12px 65px"` → 90px tall box. Bottom row at `wrapper y=62` (BOTTOM_TOP), 50px tall (BOTTOM_HEIGHT_VISIBLE + extension). Top tab visible portion is its top ~30px (above bottom row); the rest is tucked behind the bottom row via z-index. Where no bottom row tab covers (e.g. Fermentation extending past Mash on the right), the top tab visibly extends down into the bottom row band.
- **Cover strip**: a 12px-tall cream2 div at the top of the tablist (`zIndex: 6`, above the row containers' `zIndex: 1/2/3`) clips the rounded tops of the top row tabs so they appear "cut off" at the section divider above.
- **Wrapper has `overflow: hidden`** at `height: WRAPPER_HEIGHT (102)` so top tab extensions can't bleed into the content frame area below.
- **Stable bottom line filler**: a 0-height absolute div at the wrapper's bottom with `borderBottom: 2px ink` and `zIndex: 2` provides the binder baseline across the entire row including gaps between bottom-row tabs and Brewsheet. It does NOT move when the rows swap (because it's outside the row containers).
- **Inactive bottom-row tabs** render an absolute `.hs-bottom-line` span at `top: 36` (= visible bottom of their 50-tall box) for the ink line; active skips it so its paper bg can merge with the content frame.

#### Hover effect (all stages)

- Inactive tabs translate `-4px` on hover (`-3` in stage E currently for fine alignment) + the accent strip fades in to `opacity: 0.4` (from `0`).
- Inner bottom line counter-translates `+4px` (or `+3` in stage E) so it stays anchored to the content frame top while the rest of the tab lifts. CSS: `.hs-builder-tab:not([aria-selected="true"]):hover .hs-bottom-line { transform: translateY(4px); }`.
- **Critical**: for the hover-rise to work in single-row stages (A–D) without exposing section bg beneath the tab, the tab box uses **padding-bottom extension** (`padTop * 2 + extension`, e.g. `12px 20px 20px` for stage A) + an **inner clipping wrapper** with `clip-path: polygon(0% -200%, 100% -200%, 100% 100%, 0% 100%)`. The polygon clips at the wrapper's bottom (so extension is hidden in normal state) but extends 200% above (so the tab top is visible when raised).

### F. Tab-change animation

When the user clicks a different tab, the section body slides in from the appropriate side:
- Tab to the right of current → slide in from the right
- Tab to the left of current → slide in from the left

Pattern: compute direction at click time (compare prev/next tab index), store on state, apply a CSS animation class to the section wrapper. Re-key the wrapper on `activeTab` so the animation re-fires on every switch.

Animation: `translateX(20px → 0)` + `opacity(0 → 1)` over 220ms, cubic-bezier(0.2, 0.7, 0.3, 1). **Suppress** the classic `brew-animate-in` fade inside the tab body so you don't get two animations competing.

✅ **Shipped + stage-E row-swap animation added.** When stage E is active and the active tab crosses group boundaries (e.g. from Mash in Group A to Yeast in Group B), both swappable row containers transition their `transform: translate(...)` simultaneously over 180ms `cubic-bezier(0.32, 0.72, 0, 1)`. Brewsheet stays put. The active tab's `aria-selected` (and therefore the paper bottom border + full accent strip opacity) updates instantly on click while the row slides into position.

### G. Init + save

```ts
useEffect(() => {
  if (id) loadRecipe(id);
  else createNewRecipe();
}, [id]);

const handleSave = () => {
  saveCurrentRecipe();
  setSavedRecently(true);
  setTimeout(() => setSavedRecently(false), 2000);
};
```

All data flows through the existing recipe store. No HS-specific state.

---

## 9. Restyling the existing classic component internals

The HS recipe builder reuses the existing classic section components (FermentableSection, HopSection, etc.). Those components ship with their own visual styling — Tailwind utility classes, named `brew-*` classes, inline styles. To make them look HS without forking the components, write a single override stylesheet that retargets the classic classes.

### The three-tier contrast rule

- **Section** (top surface) sits on **paper**
- **Rows / inner cards** inside sit on **cream-2**
- **Inputs** inside rows sit on **paper** (back to the lightest)

This way three levels of nesting are visually distinct without using outlines. Only top-level surfaces (sections, buttons, modals) get the 2px ink frame. Everything else uses a fill change.

### Specific overrides to write

(All scoped to whatever wrapper class the HS theme uses — if you don't have a parallel-theme wrapper, target classes directly.)

- **`.brew-section`** — paper bg, 2px ink border, hard offset shadow, radius `--hs-radius-lg`. Map each `data-accent="grain|hops|mash|water|yeast|fermentation|equipment|targets"` to a `--hs-section-accent` CSS var (malt/hops/roast/water/yeast/honey/muted/ink).
- **`.brew-section-title`** — Archivo Black, -0.035em tracking, no underline.
- **Inputs** (`.brew-input`, plus all `input[type="text|number|search|email|tel"]`, `select`, `textarea` inside `.brew-theme`) — paper bg, 1px transparent-ink border (`color-mix(in oklch, var(--hs-ink) 12%, transparent)`), 8px radius. Focus: ink border + 1px ink halo. **Don't** override the `background-image` on `<select>` — that's where the chevron icon lives.
- **Buttons**:
  - `.brew-btn-primary` — ink solid pill, 3px offset shadow in the section's ingredient accent color
  - `.brew-btn-ghost` — thin 1.5px transparent-ink outline
- **Tags** (`.brew-tag`) — solid fill chip tinted by the section accent, no outline
- **Chips** (`.brew-chip`, `.brew-chip-active`) — 1.5px outline; active state inverts to ink fill + cream text
- **Gauges** (`.brew-gauge` + label + value) — cream-2 fill, 4px ingredient-accent border-top, no card outline. Display font for the value, body for the label.
- **Ingredient rows** (`.brew-ingredient-row`) — cream-2 fill, no outline, subtle hover bg shift
- **Modals** (`.brew-modal`) — paper bg, 2px ink border, **7px malt-yellow `border-top`** (not a `::before` pseudo — see §10 on why this matters), HS shadow-4
- **Hop addition row wrapper** (the inline-styled dark accent-900 div inside `.brew-row-hover`) — override the inline background via attribute selector: `[style*="background"]` → cream-2 fill with thin ink border
- **Water / Yeast inline-styled callouts** (`.rounded-lg[style*="brew-accent-900"]`) — same treatment: cream-2 fill, soft ink border
- **Hop flavor radar** — `recharts-polar-grid line` softened to 12% ink. The wrapper around the radar (which has `backdrop-filter` and `brew-card-inset` in classic) → cream-2 fill
- **Equipment expander internals** — hide the redundant top hero readouts (the brewer is editing those via the title-bar pills). Force the inner `<details class="equip-advanced">` open via a ref callback. Restyle `.equip-group` cards with cream-2 fill, mono labels.

### What NOT to override
- The `.brew-theme` container — leave its layout alone. Just set `background: transparent` and `color: ink`.
- Modal backdrop positioning — that's a `position: fixed` overlay that needs to escape stacking contexts (see §10).
- `<select>` background-image — that's the dropdown chevron.

### Style-strip overrides for the BJCP visualizer (full)

⚠️ **Deprecated for the HS recipe builder** — the HS builder no longer wraps the legacy `StyleRangeComparison`; it uses the native `BJCPStyleRail` component instead (see §8.C). These CSS overrides are still present in `overrides.css` because the **classic beta builder at `/betabuilder/*`** still uses `StyleRangeComparison`, but they're no longer reachable from any HS route. Can be removed when Phase 5 (classic deletion) lands.

These specifically retarget the existing style-strip CSS classes the BJCP visualizer uses:

```css
.style-strip-panel { background: transparent; border: none; padding: 0; box-shadow: none; }
.style-strip { gap: 4px; }
.style-strip-label { font: 700 10px/1 var(--hs-font-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--hs-muted); }
.style-strip-value { font: 600 12px/1 var(--hs-font-mono); color: var(--hs-ink); font-variant-numeric: tabular-nums; }
.style-strip-value.is-out { color: var(--hs-roast); }
.style-strip-track { height: 8px; background: var(--hs-cream); border: 1.5px solid color-mix(in oklch, var(--hs-ink) 20%, transparent); border-radius: 999px; box-shadow: none; }
.style-strip-range:not(.is-srm) { background: var(--hs-hops); opacity: 0.4; border-radius: 999px; top: 0; bottom: 0; box-shadow: none; }
.style-strip-range.is-srm { opacity: 1; border-radius: 999px; top: 0; bottom: 0; box-shadow: none; /* preserve the inline beer-color gradient */ }
.style-strip-needle { width: 3px; height: 14px; background: var(--hs-ink); border-radius: 1px; box-shadow: none; }
.style-strip-needle.is-out { background: var(--hs-roast); }
```

The 2-column grid for the strip stack: `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)` with `gap: 14px 32px`. Falls back to 1-column at ≤640px.

---

## 10. The binder-tab section pattern (important gotcha)

When implementing the tabbed section in the recipe builder, the active tab should visually pop up out of the section card like a manilla folder tab — the section's top border interrupts at the active tab, the tab "merges into" the section.

### The trap

The natural implementation is: tab bar with `marginBottom: -2` to overlap the section's top border by 2px, active tab has a paper-colored bottom border to "punch through" the ink line. Then bump the active tab's z-index above the section.

This breaks. Reason: the existing `.brew-section` carries an animation class with `transform: translateY(0)` (an end-state of a fade-up keyframe). Any non-`none` `transform` value creates a new stacking context, which means the section's content paints **independent** of the rest of the page's stacking. No matter how high you bump the tab's z-index, the section's ink top border keeps drawing on top of it.

### The fix

Don't fight the stacking context. **Remove the section's top border entirely** when it's in a tabbed surface. The top edge of the section comes from elsewhere:

- **Inactive tabs** contribute their 2px ink `border-bottom`s — those bottoms collectively form the visible top edge of the section
- After the last tab, render a flex-1 spacer `<div aria-hidden style={{ borderBottom: "2px solid ink" }} />` to extend the line all the way to the section's right edge
- The active tab has a **paper-colored** `border-bottom` (matching the section background) so its slice of the top edge is intentionally absent — creating the seamless binder-tab connection

### Tab styling specifics

- Inactive tab: cream-2 bg, muted text, 2px ink border (top + sides), rounded top corners (10px), 1px hairlines between adjacent tabs (2px at the leftmost/rightmost edge)
- Active tab: paper bg (matches section), ink text, slight `translateY(-2px)` lift, an inner 4px **ingredient-accent strip** positioned with `top:0; left:0; right:0` and `border-radius: 8px` (= outer 10px − 2px ink border = 8px inner) so it sits *inside* the ink frame cleanly — never overflows past it
- All tabs: `marginBottom: -2` so they overlap the section start by 2px

### Apply the same lesson to modals

The classic modal uses a `::before` pseudo-element for its top accent strip. That requires `position: relative` on the modal box, which can create the same stacking-context fights with fixed-positioned backdrops. Use `border-top: 7px solid <accent>` instead — same visual, no positioning needed.

---

## 11. Responsive behavior

### Fluid type

Everything that displays large numerics or display text uses `clamp()` so it scales smoothly without breakpoint jumps:

```
Hero headline:        clamp(44px, 6.5vw, 100px)
Section number:       clamp(40px, 6vw,   72px)
Section title:        clamp(28px, 4.4vw, 46px)
Page title (1 word):  ~88px display
Recipe builder name:  clamp(32px, 7vw,   72px)
```

Section paddings on the landing hero use clamp too:
```
padding: clamp(36px, 4.5vw, 64px) 0 clamp(28px, 4vw, 56px) clamp(20px, 4vw, 56px);
```

(Zero right padding lets the hero image bleed to the right edge of the viewport.)

### Breakpoints

- **>1100px** — full desktop layout: 2-column hero, 3-column stats, 3-column calc preview, 3-column library, 7-column live-stats bar
- **≤1100px** — hero image becomes a faded background (opacity 0.08, position: absolute, inset 0, object-fit cover). Hero text overlays in a single column. *Why 1100px?* Below this, the image's natural rendered height is shorter than the (tall) text column, leaving dead space below the image. The background-overlay treatment avoids that.
- **≤1024px** — recipe-builder feature stacks; calc preview goes 3 → 2 cols; library 3 → 2 cols. Stats stays 3-col.
- **≤900px** — live-stats bar in builder collapses 7 → 4 cols. Recipe name input shrinks.
- **≤720px** — header switches to flex-column (brand on top, nav pill below as scrollable full-width pill, scrollbar hidden). Section paddings tighten.
- **≤640px** — everything stacks to single column. Stats gets bottom dividers between rows instead of right borders. BJCP grid → 1-col. Live-stats → 3-col. Builder section paddings shrink 48px → 16px.

---

## 12. Animations

Use sparingly. The HS look is hand-stamped, not slick.

- **Tab content slide** — when switching tabs in the recipe builder, the section body slides in from the appropriate side (left or right based on tab order). 220ms, cubic-bezier(0.2, 0.7, 0.3, 1). See §8.F.
- **Button press** — solid pills do a `translate(2px, 2px)` on `:active` with the offset shadow shrinking from 3px → 1px, creating a "press" effect
- **Hover lift** — buttons/cards lift `translate(-1px, -1px)` with the shadow growing from 3px → 4px on hover
- Otherwise: no fancy transitions. The classic `brew-animate-in` fade-up on sections should be suppressed when inside an HS tab body (we only want the directional slide there).

---

## 13. Integration with existing app

The recipe builder, calculators, and recipe list **reuse the existing data and computation layer**. Don't duplicate logic.

### What to keep from the existing codebase

- The recipe store (Zustand, with `recipes`, `currentRecipe`, `loadRecipes`, `loadRecipe`, `createNewRecipe`, `updateRecipe`, `saveCurrentRecipe`, `deleteRecipe`, plus all the `addFermentable`/`updateFermentable`/`removeFermentable` actions and the equivalents for hops/yeast/etc.)
- The `useRecipeCalculations(recipe)` hook returning `{ og, fg, abv, ibu, srm, calories, carbsG, preBoilVolumeL, mashWaterL, spargeWaterL, totalWaterL, estimatedMashPh, mashPhAdjustment, strikeTempC, preBoilGravity }`
- The pure calc functions in `src/calculators/` — `abvFromOGFG`, `ibuTotal`, `postBoilVolume`, `dilutionWater`
- The `srmToRgb(srm)` util for wort colors
- All the classic section components (FermentableSection, HopSection, MashScheduleSection, WaterSection, YeastSection, FermentationSection, BrewDayChecklistSection, EquipmentSection) — these get **rendered inside the HS shell** and restyled via the override stylesheet
- StyleSelectorModal and StyleRangeComparison — render inside HS chrome, restyled via overrides
- The recipe model + Recipe type

### What's new

- The design tokens (CSS vars)
- The 12 HS primitive components
- The HS header + footer
- The four HS-styled page components (Home, Recipes list, Recipe builder, Calculators)
- The override stylesheet that retargets the existing `brew-*` classes
- The hero illustration asset

### Routing

The HS pages replace the existing top-level routes:
- `/` → home (HS landing)
- `/recipes` → recipe list (HS browser)
- `/recipes/new` and `/recipes/[id]` → recipe builder (HS)
- `/calculators` → calculators page (HS)

(In the current Vite worktree we used a `/hopskip/*` prefix during development to keep the old style accessible side-by-side. When porting to live, drop that prefix.)

### Asset

`public/images/hero.png` — 1380×767 PNG illustration. Brewing equipment in the HS palette (red circle, yellow square, blue triangle, beer glass, calculator with "B33R" display, hop, hydrometer, ruler, X mark). Reference image is in the worktree if needed.

---

## 14. Acceptance criteria

- [ ] Visual: every framed surface uses the 2px ink border + hard offset shadow rule. No blurred shadows anywhere.
- [ ] Visual: every display headline uses Archivo Black with -0.035em tracking. Every number that goes in a column uses tabular-nums.
- [ ] Visual: each section in the recipe builder shows its ingredient accent color in the appropriate active tab strip.
- [ ] Visual: at most one Caveat script note per visible section.
- [ ] Behavior: home page library section shows real saved recipes (top 3 by `updatedAt`) with computed stats.
- [ ] Behavior: recipe browser shows all saved recipes with per-card live stats, search, sort, and delete-with-confirm.
- [ ] Behavior: recipe builder loads existing recipe by id, creates a fresh one if none, persists edits to the store, all 7 tabs render their section component.
- [ ] Behavior: clicking the STYLE chip in the builder opens the existing style picker modal.
- [ ] Behavior: clicking "Advanced ▼" reveals the secondary equipment fields below the title bar (with the duplicate Batch/Eff/Boil hidden).
- [ ] Behavior: BJCP style range strip renders when a style is set, 2-column at desktop, 1-column at mobile, SRM strip shows the real beer-color gradient.
- [ ] Behavior: live-stats bar updates as the user edits any field.
- [ ] Behavior: tab switch animation slides from left/right based on tab order. Only one animation per switch, not stacked.
- [ ] Behavior: all four calculators (ABV, IBU Tinseth, Boil-off, Dilution) use the existing pure math functions and update live.
- [ ] Responsive: works clean at 1500 / 1024 / 768 / 640 / 375 px viewports.
- [ ] Responsive: hero image becomes a faded background overlay at ≤1100px.
- [ ] Responsive: header switches to column layout with scrollable nav pill at ≤720px.
- [ ] Responsive: section grids reflow as specified at each breakpoint.

---

## Appendix A — Reference: design tokens and primitives

This appendix has the actual code I wrote for the design tokens and primitive components. Use as a starting point; adapt to the live codebase's conventions.

### `tokens.css`

```css
/* Design tokens — define on whatever wrapper class the HS theme uses
   (or :root if it's the only theme). */
:root {
  --hs-cream: #f4eedd;
  --hs-cream-2: #fbf6ea;
  --hs-paper: #fffbef;
  --hs-ink: #1a1612;
  --hs-muted: #5a4f42;

  --hs-malt: #f2c14e;
  --hs-roast: #d4452c;
  --hs-water: #2b6fb8;
  --hs-hops: #4a8a3d;
  --hs-yeast: #ee7755;
  --hs-honey: #ffd97a;

  --hs-font-display: "Archivo Black", "Space Grotesk", system-ui, sans-serif;
  --hs-font-body: "Space Grotesk", system-ui, sans-serif;
  --hs-font-script: "Caveat", "Comic Sans MS", cursive;
  --hs-font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", monospace;

  --hs-radius-sm: 6px;
  --hs-radius-md: 12px;
  --hs-radius-lg: 14px;
  --hs-radius-xl: 18px;
  --hs-radius-pill: 999px;

  --hs-stroke: 2px solid var(--hs-ink);
  --hs-stroke-thin: 1.5px solid var(--hs-ink);

  --hs-shadow-1: 2px 2px 0 var(--hs-ink);
  --hs-shadow-2: 3px 3px 0 var(--hs-ink);
  --hs-shadow-3: 4px 4px 0 var(--hs-ink);
  --hs-shadow-4: 6px 6px 0 var(--hs-ink);

  --hs-ease: cubic-bezier(0.2, 0.7, 0.3, 1);

  background: var(--hs-cream);
  color: var(--hs-ink);
  font-family: var(--hs-font-body);
  -webkit-font-smoothing: antialiased;
}

[data-theme="dark"] {
  --hs-cream: #1b1916;
  --hs-cream-2: #252220;
  --hs-paper: #2a2622;
  --hs-ink: #f4ede0;
  --hs-muted: #9c948a;
}
```

### `tokens.ts` — JS mirror for inline styles

```ts
export const hsTokens = {
  cream: "#f4eedd", cream2: "#fbf6ea", paper: "#fffbef",
  ink: "#1a1612", muted: "#5a4f42",
  malt: "#f2c14e", roast: "#d4452c", water: "#2b6fb8",
  hops: "#4a8a3d", yeast: "#ee7755", honey: "#ffd97a",
  display: '"Archivo Black", "Space Grotesk", system-ui, sans-serif',
  body: '"Space Grotesk", system-ui, sans-serif',
  script: '"Caveat", cursive',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  sh1: "2px 2px 0 #1a1612", sh2: "3px 3px 0 #1a1612",
  sh3: "4px 4px 0 #1a1612", sh4: "6px 6px 0 #1a1612",
} as const;
```

### Primitive sketches

The shapes — write whatever fits your component conventions. Signatures only:

```ts
function HSEyebrow({ children, color?, style? }): JSX.Element
// 10px, 700 weight, 0.16em letter-spacing, uppercase, muted color

function HSCard({ children, shadow=3, bg?, tilt=0, accent?, radius=14, padding=16, style? }): JSX.Element
// paper bg, 2px ink border, hard offset shadow
// optional accent prop renders a 5px colored strip at top

function HSButton({ children, variant="solid"|"ghost"|"ink", color?, size="sm"|"md"|"lg", arrow? }): JSX.Element
// pill button, ink border, sh2 offset shadow

function HSPill({ dot?, label, value?, style? }): JSX.Element
// outlined chip, optional dot color, eyebrow label, regular value

function HSStatCard({ label, value, unit?, range?, accent?, note? }): JSX.Element
// accent top strip, big display value, range below, optional rotated note

function HSScriptNote({ children, color?=yeast, size?=18, rotate?=-3 }): JSX.Element
// Caveat font, rotated inline-block

function HSIngredientDot({ color, size=14, shape="circle"|"square"|"triangle"|"half-up"|"quarter" })

function HSColorBlock({ shape, color, size=64 })
// Same shapes plus "half-circle-up", "half-circle-down", "pill", "arch"

function HSHopCone({ size=120, color?=hops, rows=5 })
// Stacked half-circles forming a hop cone

function HSRangeBar({ value, lo, hi, suffix? })
// Ink track + ingredient-accent fill + ink needle + tabular nums label

function HSSectionHeader({ index, title, kicker?, eyebrow? })
// Big muted number + script kicker + eyebrow + display H2

function Glyph({ kind: "hop"|"water"|"malt"|"yeast"|"mug"|"drop"|"square"|"triangle", size=28, color="currentColor" })
// Inline SVG icons
```

The full source for every primitive is available if needed — but the signatures + the visual rules in §1–§3 are enough for the dev to reimplement cleanly.

---

## Appendix B — Reference: override stylesheet

The minimum override CSS that retargets the existing `brew-*` classes to HS visuals. The classic-side classes referenced here are the ones that exist in the current codebase — verify they still exist in live before starting, and update selectors if anything has been renamed.

```css
/* Section surfaces */
.brew-section {
  background: var(--hs-paper);
  border: 2px solid var(--hs-ink);
  border-radius: var(--hs-radius-lg);
  box-shadow: var(--hs-shadow-3);
  padding: 26px 26px 28px;
  background-image: none;
}
.brew-section[data-accent="grain"]        { --hs-section-accent: var(--hs-malt); }
.brew-section[data-accent="hops"]         { --hs-section-accent: var(--hs-hops); }
.brew-section[data-accent="mash"]         { --hs-section-accent: var(--hs-roast); }
.brew-section[data-accent="water"]        { --hs-section-accent: var(--hs-water); }
.brew-section[data-accent="yeast"]        { --hs-section-accent: var(--hs-yeast); }
.brew-section[data-accent="fermentation"] { --hs-section-accent: var(--hs-honey); }
.brew-section[data-accent="equipment"]    { --hs-section-accent: var(--hs-muted); }
.brew-section[data-accent="targets"]      { --hs-section-accent: var(--hs-ink); }
.brew-section-title {
  font-family: var(--hs-font-display);
  font-weight: 800;
  letter-spacing: -0.035em;
  border-bottom: none;
  font-size: 28px;
}

/* When this section is in a tabbed surface, drop the top border so the
   active tab can interrupt the top edge (see §10) */
.hs-section-frame .brew-section {
  border-top: none;
  border-radius: 0 0 var(--hs-radius-lg) var(--hs-radius-lg);
}

/* Inputs */
.brew-input,
input[type="text"], input[type="number"], input[type="search"],
input[type="email"], input[type="tel"], textarea {
  background: var(--hs-paper);
  border: 1px solid color-mix(in oklch, var(--hs-ink) 12%, transparent);
  border-radius: 8px;
  box-shadow: none;
  font-family: var(--hs-font-body);
  font-size: 14px;
  padding: 8px 12px;
}
select {
  /* keep the inline chevron background-image working — only override color */
  background-color: var(--hs-paper);
  border: 1px solid color-mix(in oklch, var(--hs-ink) 12%, transparent);
  border-radius: 8px;
  font-family: var(--hs-font-body);
}

/* Buttons */
.brew-btn-primary {
  background: var(--hs-ink);
  color: var(--hs-cream);
  border: 2px solid var(--hs-ink);
  border-radius: var(--hs-radius-pill);
  font-family: var(--hs-font-body);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 9px 18px;
  box-shadow: 3px 3px 0 var(--hs-section-accent, var(--hs-roast));
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.brew-btn-primary:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--hs-section-accent, var(--hs-roast)); }
.brew-btn-primary:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--hs-section-accent, var(--hs-roast)); }

.brew-btn-ghost {
  background: transparent;
  color: var(--hs-ink);
  border: 1.5px solid color-mix(in oklch, var(--hs-ink) 30%, transparent);
  border-radius: var(--hs-radius-pill);
  font-family: var(--hs-font-body);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 16px;
}

/* Tags & chips */
.brew-tag {
  background: color-mix(in oklch, var(--hs-section-accent, var(--hs-malt)) 25%, var(--hs-cream-2));
  color: var(--hs-ink);
  border: none;
  border-radius: var(--hs-radius-pill);
  font: 700 10px var(--hs-font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 10px;
}
.brew-chip {
  background: var(--hs-cream-2);
  color: var(--hs-ink);
  border: 1.5px solid color-mix(in oklch, var(--hs-ink) 25%, transparent);
  border-radius: var(--hs-radius-pill);
  font: 600 12px var(--hs-font-body);
  padding: 5px 12px;
}
.brew-chip-active {
  background: var(--hs-ink);
  color: var(--hs-cream);
  border-color: var(--hs-ink);
}

/* Gauges */
.brew-gauge {
  background: var(--hs-cream-2);
  border: none;
  border-top: 4px solid var(--hs-section-accent, var(--hs-malt));
  border-radius: var(--hs-radius-md);
  box-shadow: none;
  padding: 12px 14px;
  background-image: none;
}
.brew-gauge-label {
  font: 700 10px var(--hs-font-body);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hs-muted);
}
.brew-gauge-value {
  font-family: var(--hs-font-display);
  font-weight: 800;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

/* Ingredient rows */
.brew-ingredient-row {
  background: var(--hs-cream-2);
  border: none;
  border-radius: var(--hs-radius-sm);
  box-shadow: none;
  padding: 14px 16px;
  background-image: none;
}
.brew-ingredient-row:hover { background: var(--hs-cream); }

/* Modals — use border-top instead of ::before to avoid position:relative
   that breaks the modal's fixed positioning */
.brew-modal {
  background: var(--hs-paper);
  border: 2px solid var(--hs-ink);
  border-top: 7px solid var(--hs-malt);
  border-radius: var(--hs-radius-lg);
  box-shadow: var(--hs-shadow-4);
  background-image: none;
}

/* Hop addition row inline-styled dark wrapper — override the inline bg */
.brew-row-hover > div[class*="rounded-lg"][style*="background"] {
  background: var(--hs-cream-2) !important;
  border: 1px solid color-mix(in oklch, var(--hs-ink) 12%, transparent) !important;
  box-shadow: none !important;
}

/* Water/Yeast inline-styled callouts */
.rounded-lg[style*="brew-accent-900"],
.rounded-xl[style*="brew-accent-900"] {
  background: var(--hs-cream-2) !important;
  border: 1px solid color-mix(in oklch, var(--hs-ink) 12%, transparent) !important;
  box-shadow: none !important;
}

/* Hop flavor radar */
.recharts-polar-grid line { stroke: color-mix(in oklch, var(--hs-ink) 12%, transparent); }

/* Equipment expander — hide redundant top fields, force advanced open */
.equip-hero-grid { display: none; }
details.equip-advanced > summary { display: none; }
details.equip-advanced { display: block; }
.equip-group {
  background: var(--hs-cream-2);
  border: none;
  border-radius: var(--hs-radius-md);
  padding: 14px 16px;
  margin-bottom: 12px;
}

/* Animation suppress for tabbed sections (see §12) */
.hs-section-frame .brew-section.brew-animate-in,
.hs-section-frame .brew-animate-in {
  animation: none;
}

/* Tab content slide */
.hs-tab-slide { animation-duration: 220ms; animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); animation-fill-mode: backwards; }
.hs-tab-slide-right { animation-name: hs-slide-from-right; }
.hs-tab-slide-left  { animation-name: hs-slide-from-left; }
@keyframes hs-slide-from-right { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes hs-slide-from-left  { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
```

The full override file from this worktree has additional rules for: the BJCP `style-strip-*` classes (covered in §9), responsive breakpoints (covered in §11), and the header column-wrap behavior at ≤720px. Reference [src/modules/hopskip/hopskip-overrides.css](src/modules/hopskip/hopskip-overrides.css) if you want the exact selectors.

---

*End of PRD.*
