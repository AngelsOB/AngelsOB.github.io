# v3 Homepage Build — Session Debrief

> **Superseded by v4 (motion).** The v3 *motion* implementation described here
> was replaced by the GSAP pinned-tour rebuild — current reference is
> [`v4-homepage-build.md`](./v4-homepage-build.md). Kept as the historical
> record of why the v3 mock approach hit walls (those lessons shaped v4).

A pickup guide for the in-progress v3 homepage rebuild at `/v3`. Read this
plus the three files starred below and you should be productive within ~15
minutes.

## What `/v3` is

An orphan route (not slotted into production) where the new homepage gets
built before replacing `app/_home/Home.tsx`. Scroll-driven tour: 12 stages
in the left column, a sticky recipe-builder mock in the right column that
reacts to the scroll position. Stages 3–6 each "highlight" a piece of the
mock via animation; the marquee stage is 6 (the brew sheet).

Locked spec: [`docs/PRD-008-homepage-v3.md`](./PRD-008-homepage-v3.md).
Locked copy: [`docs/homepage-v3-copy.md`](./homepage-v3-copy.md). Voice
rules: [`docs/voice-and-tone.md`](./voice-and-tone.md).

## The vision (locked direction)

- Each tour stage discusses one piece of the recipe builder. As the visitor
  scrolls into that stage, the mock visually **breaks apart** to highlight
  the piece being discussed.
- "BMW exploded diagram" aesthetic: pieces lift forward, source body
  recedes. Each layer can step back (off to the left) when a deeper layer
  becomes the focus.
- **Three-tier layering:**
  - **Tier 1** — the whole mock card.
  - **Tier 2** — the active section (Fermentables / Hops / Water / Mash /
    Yeast / Brewsheet).
  - **Tier 3** — important sub-elements inside each section
    (HopVisualizer, salt cells + Auto-Calc + pH callout, the brewsheet's
    Pre-Boil OG recovery callout, etc.).
- Between stages: everything closes back to the default editor. So the
  visitor experiences open → focus → close → open the next.
- Per-stage choreography: **tab change first**, **then** section comes
  forward as the main frame, **then** sub-elements pop further out.

## Where we are right now (iter 26)

- Mock recedes left (`opacity 0.35, scale 0.7, x -28`) when any highlight
  is active. Like the brewsheet does.
- A "section overlay" sibling of the mock card mounts at the section
  card's slot coordinates (`top:280, left:18, right:18, height:360`) with
  full opacity, so it looks like the section stayed put while the rest of
  the mock went off to the left.
- Sub-bones inside the section overlay fire on phase 3 (~1000ms after
  highlight set) — HopVisualizer scales/translates out of HopsContent,
  SaltCells/AutoCalc/PhCallout out of WaterContent.
- `onLeave` is wired: when no stage lead is in the centered viewport band,
  the highlight clears and the mock returns to its default editor look.

**Known issues / what's NOT done:**
- The section overlay sits at the *original* slot coordinates — when the
  mock recedes (scales + translates left), the overlay stays put.
  Visually that means the overlay and the receded mock are visually
  disconnected. Either match the receded position OR accept the "BMW
  source body shrank away, focal piece stayed" look. User has not
  confirmed which.
- Sub-bones are inside the section overlay, not extracted to be siblings
  of it. So when (eventually) we want Tier 2 to recede left and Tier 3
  to become the new focal piece, sub-bones will inherit Tier 2's recede.
  Need extraction.
- Fermentables, Mash, Yeast have no sub-bones. Fermentables had BillStack
  but the user said that was the wrong element.
- The Brewsheet tab styling vs the regular tabs is "close enough" but
  user has acknowledged minor alignment issues; deferred while everything
  is being changed.
- No scroll-linked animation. Phase advancement is `setTimeout`-driven;
  user has floated `useScroll`+`useTransform` as a possible direction.

## Key files (the ★ ones are the must-reads)

### Route + composition
- ★ `app/v3/HomeV3.tsx` — owns `scrollTab` + `mockState` state. Wires each
  stage's `onEnter`/`onLeave` to set/clear the highlight. The
  conditional-clear pattern (`curr === "hops" ? "default" : curr`) is
  what handles overlapping triggers.
- `app/v3/page.tsx` — server entry, fetches community recipes.
- `app/v3/data.ts` — locked stage copy, plus `STAGES.brewSheet.panel`
  contents (brew data, targets, ingredients, water, mash, Pre-Boil OG
  recovery options).

### Stage components (left column scroll content)
- `app/v3/components/Stage{Hero,Opening,Grains,Hops,Water,BrewSheet,BrewedAgain,CommunityCompare,WhatElse,Learn,FAQ,FinalCTA}.tsx`
- `app/v3/components/ParagraphReveal.tsx` — character-level reveal that
  preserves paragraph wrap. Word-by-word stagger with sentence pauses.
- `app/v3/lib/useStageInView.ts` — eager content-reveal trigger
  (`-25% -25%`); fires onEnter when section enters the bottom of viewport.
- `app/v3/lib/useStageTabTrigger.ts` — late tab-change trigger
  (`-30% -50%` — narrower band centered higher in viewport). Supports
  both `onEnter` AND `onLeave`. **The leave callback is what enables the
  between-stage reset.**

### Mock builder — the sticky right column
- `app/v3/components/TourMock.tsx` — thin adapter, ~80 lines. Translates
  `MockState` → `Highlight`. The only thing here besides the mapping is
  the `useReducedMotion` hook (currently unused by MockBuilder but
  exported for stages).
- `app/v3/components/mock/MockBuilderShell.tsx` — composes `MockBuilder`
  with the persistent `BrewsheetBone` overlay.
- ★ `app/v3/components/mock/MockBuilder.tsx` — **THE core file** (~180
  lines). Phase state machine, mock recede animation, section overlay
  positioning, inline-vs-overlay section rendering. Read this top to
  bottom before touching anything else.

### Mock building blocks
- `app/v3/components/mock/MockHeader.tsx` — "BACK TO RECIPES" + "Save
  recipe" + "Citra Mosaic IPA" + style/batch/profile pills.
- `app/v3/components/mock/MockStats.tsx` — OG/FG/ABV/IBU/CAL/SRM strip
  with SRM color swatch.
- `app/v3/components/mock/MockTabBar.tsx` — tab bar (Fermentables, Hops,
  Water, Mash, Yeast, Boil). Each tab is its own little bone that lifts
  3px when its highlight is active.
- `app/v3/components/mock/types.ts` — `TabKey`, `Highlight`, `TABS`
  array, `highlightToTab` helper.
- `app/v3/components/mock/Bone.tsx` — generic abstraction (motion.div
  wrapper that takes a state map + current state and lerps). Used by
  BrewsheetBone. Could be used elsewhere but currently isn't.
- `app/v3/components/mock/BrewsheetBone.tsx` — the brewsheet tab/panel
  morph. Two states (`tab`, `panel`), absolute positioning, lerps
  between them via the `Bone` wrapper.

### Section content (one file per tab)
- ★ `app/v3/components/mock/sections/HopsContent.tsx` — read this for
  the canonical "section content with an inline sub-bone" pattern.
  Contains the hop bill table + the HopVisualizer motion.div (the
  sub-bone). Sub-bone wrapped in `motion.div` with `animate` driven by
  `highlight === "hops"`.
- `app/v3/components/mock/sections/WaterContent.tsx` — three sub-bones
  (SaltCells, AutoCalc, PhCallout), each with different translate/scale
  vectors so they fly off in different directions when stage 5 fires.
- `app/v3/components/mock/sections/FermentablesContent.tsx` — bill
  stack bar + grain rows. NO sub-bone right now (user flagged BillStack
  as the wrong element to highlight; better candidate TBD).
- `app/v3/components/mock/sections/MashContent.tsx`, `YeastContent.tsx`
  — placeholder content, no sub-bones.
- `app/v3/components/mock/sections/HopFlavorRadar.tsx` — reusable SVG.
  Inline mini variant for the hop bill table rows; full variant for the
  HopVisualizer sub-bone.

### Brewsheet stage 6 — pre-existing big component
- `app/v3/components/BrewSheetPanel.tsx` — the full brew sheet visual
  (title, 3-col stats strip, 01 Ingredients / 02 Water / 03 Mash / 04
  Boil with the Pre-Boil OG recovery callout). Has a `compact` prop
  that skips sections 02–04 for the in-section view (where it has to
  fit a 360px slot).

## How a section highlight flows end-to-end

```
[user scrolls] → StageHops.onEnter fires
              → HomeV3.setMockState("hops")
              → TourMock translates "hops" → highlight="hops"
              → MockBuilder receives highlight="hops"
                  → activeTab derives to "hops"               (Phase 1, 0ms)
                  → MockTabBar swaps active tab visual
                  → setPhase(1), then setTimeout setPhase(2,400), setPhase(3,1000)
                  → at phase 2: mock card animates recede     (Phase 2, ~400ms)
                              + section overlay mounts at slot coords, full opacity
                  → at phase 3: effectiveHighlight = "hops"  (Phase 3, ~1000ms)
                              + HopsContent receives "hops" prop
                              + HopVisualizer sub-bone fires its animate prop
[user scrolls past] → StageHops.onLeave fires
                    → HomeV3 setMockState(curr => curr==="hops" ? "default" : curr)
                    → highlight → "none", phase → 0
                    → mock returns, overlay unmounts, sub-bones reset
```

The conditional clear is key — if `StageHops.onLeave` fires AFTER
`StageWater.onEnter` (overlap during scroll), it won't clobber Water's
state because at that point `curr === "water"`, not `"hops"`.

## Iteration history (so you don't re-tread the same paths)

| Iter | Tried | Why it didn't land |
|------|-------|-------------------|
| 8 | `layoutId` morph between Brewsheet tab and BrewSheetPanel | User: "feels like magic, not literal" |
| 11 | Single DOM element morphs from tab to panel | Works for Brewsheet alone, doesn't extend to sections |
| 12 | Brewsheet as a real tab+section in HeroBuilderCard | Stuck inside `HeroBuilderCard`'s render tree; couldn't escape opacity recede |
| 13–15 | Section content lifts out of section card slot | "Doesn't feel like the section coming forward" |
| 17 | One BrewsheetElement, two states lerped via animate prop | **User: "this looks the best"** — locked as the brewsheet pattern |
| 18–19 | Refactor mock to bone architecture (each tab + section + sub-element as its own component) | Established the directory `app/v3/components/mock/*` |
| 23 | Section content rendered as sibling overlay, sliding from slot → panel position | "Sliding up and expanding doesn't feel like brewsheet recede" |
| 24 | Whole mock card scales up | "No, just the section, not the whole mock" |
| 25 | Chrome fades, section grows in place inside mock | "No, want brewsheet-style recede pattern" |
| **26 (current)** | Mock recedes left, section overlay at slot coords (sibling, full opacity) | User feedback pending — known: overlay doesn't track receded mock |

## Pick-up guide

1. **Look at the page.** `npm run dev` and open `localhost:3000/v3`. Scroll
   slowly through stages 3 → 6. The brew sheet stage 6 morph (BrewsheetBone)
   is the one the user has approved. Stages 3, 4, 5 are the ones being
   tuned.
2. **Read these three files in order:**
   - `app/v3/components/mock/MockBuilder.tsx` (the choreography)
   - `app/v3/components/mock/sections/HopsContent.tsx` (sub-bone pattern)
   - `app/v3/HomeV3.tsx` (stage triggers + onLeave reset)
3. **Decide the next move.** Most likely one of:
   - **Lock current visual** — confirm with user that "mock goes off to
     the left, section stays put, sub-bones explode" is the right
     feel. If yes: add sub-bones for Fermentables (pick a candidate
     other than BillStack), Mash, Yeast.
   - **Add tier-3 sibling extraction** — when phase 3 hits, the section
     overlay also recedes left and the sub-bone becomes the new focal
     frame. Requires moving sub-bones out of section content components
     into siblings.
   - **Switch to scroll-linked animation** — replace `setTimeout` phase
     advancement with `useScroll` + `useTransform`. Smoother but a real
     refactor.
4. **Don't touch `HeroBuilderCard.tsx`** anymore. It's only used by the
   live homepage (`app/_home/Home.tsx`); v3 no longer references it.
   Several earlier iterations modified it; those changes are committed
   but not active in v3.

## Production wiring (when v3 is ready to ship)

`app/page.tsx` currently imports `app/_home/Home`. When v3 is locked, the
swap is roughly:
- Move `app/v3/*` contents into `app/_home/*` (or replace).
- Update `app/page.tsx` to import the new component.
- Delete the orphan `app/v3/` directory.
- Delete the old `_home` components that aren't reused (notably
  `HeroBuilderCard.tsx`).
