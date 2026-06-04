# PRD-008: Homepage v3

**Status:** Spec locked. Implementation pending.
**Related docs:**
- [homepage-v3-copy.md](homepage-v3-copy.md) — the locked copy spec
- [voice-and-tone.md](voice-and-tone.md) — voice rules
- [backlog.md](backlog.md) — implementation sub-items
**Supersedes:** the previous homepage-refactor.md spec (now deleted).

> **Implementation note (v4):** the homepage is being rebuilt at `app/v4/`
> (route `/v4`) with a GSAP **pinned-tour** motion model. This changes the
> §5/§6 "sticky-reactive mock" mechanics — the mock is now a simplified,
> clickable recipe builder whose sections "pull out" — but the product intent,
> copy, and section order specified here still hold. Current implementation
> reference: [`v4-homepage-build.md`](./v4-homepage-build.md).

This PRD is the build spec for the new homepage. It defines the experience
in detail. Code shape (file structure, component naming, React patterns,
state libraries) is left to the implementing dev. Everything about how the
page *feels*, *moves*, and *reads* is specified here so nothing is left to
chance.

---

## 1. Context and goals

### Why we're doing this

The current homepage sells **simplicity** as the value proposition. The new
homepage sells **the thing the simplicity is for**: not forgetting anything
on brew day. The product is rich (recipe builder + brew-day decision aid +
water chemistry optimizer + hop flavor visualizer + brew log + comparison
tool + community). A static feature list undersells the depth. A
scroll-driven product tour shows the depth in motion, told as one beer
built across the page.

### Success criteria

1. A first-time visitor knows what the app is and what pain it solves
   within five seconds of landing.
2. By the end of the first scroll past the hero, the visitor has emotionally
   recognized the pain (the "I've been there" moment).
3. By the time the visitor reaches the brew-sheet stage, they have seen at
   least three concrete differentiators (live math, hop flavor visualizer,
   water salt auto-fit) and the brew-day decision aid lands as a payoff,
   not as another feature.
4. The visitor sees the product working (a real recipe with real numbers
   updating on the right side of the page) without signing up.
5. There is one obvious next action above the fold ("Start a recipe"), and
   the same action is repeated at the bottom of the page.
6. The page reads as a homebrewer's project shown to other homebrewers,
   not as SaaS marketing.

### What this PRD does not specify

- Specific React file structure or component names.
- Whether to use Framer Motion vs Motion One vs CSS keyframes (Framer Motion
  is already in the codebase and the existing homepage uses it heavily — the
  default is to keep using it, but the dev can substitute if there's a
  reason).
- State management library (Zustand is already in use across the app).
- The exact React component split for new mock panels.

The dev chooses these. This PRD specifies what the experience must be.

---

## 2. Information architecture

### The 12 stages

| # | Stage | Above/below fold | Reading time (target) |
|---|---|---|---|
| 1 | Hero | Above the fold | 3–5 sec |
| 2 | Opening ("I made this...") | Top of scroll | 8–12 sec |
| 3 | Grains — live math | Scroll | 5–8 sec |
| 4 | Hops — dial in flavors | Scroll | 8–12 sec |
| 5 | Water — salts solve themselves | Scroll | 10–15 sec |
| 6 | Brew sheet — adjust on the fly *(breakout moment)* | Scroll | 15–25 sec |
| 7 | Brewed again | Scroll | 6–10 sec |
| 8 | Community + Compare | Scroll | 10–15 sec |
| 9 | What else it does | Scroll | 5–8 sec |
| 10 | Learn (Path B) | Scroll | 5–10 sec |
| 11 | FAQ | Scroll | Variable (skim or read) |
| 12 | Final CTA | Bottom of scroll | 2 sec |

Total target reading time for a fully engaged visitor: ~90–120 seconds.

### Flow rationale

The hero promises the pain. The opening makes the pain felt. Stages 3–5
prove the product solves the pain *before* brew day. Stage 6 is the
payoff: the product also solves the pain *during* brew day. Stages 7–8
extend the story (the recipe is a record, not just a plan; other brewers
extend it too). Stages 9–10 are the "and also" beats. Stage 11 captures
SEO + handles objections. Stage 12 closes the loop with the same action
the hero proposed.

### Page weight allocation

- Hero: ~12% of page height
- Opening + grains + hops + water: ~30%
- Brew sheet (with breakout): ~18%
- Brewed again + community/compare: ~15%
- What else + learn + FAQ + final CTA: ~25%

These are rough targets, not pixel-precise. The dev tunes based on actual
copy length and visual density.

---

## 3. The visual experience — overall direction

### The feel

Warm. Playful. Confident. Brewer-to-brewer. **Specifically not** corporate
SaaS, not gamified, not aggressive, not minimal-to-the-point-of-cold.

The existing design system ([src/modules/hopskip/tokens.ts](../src/modules/hopskip/tokens.ts))
already nails this feel. Reuse it. The new homepage should look like part
of the same family as the current homepage, just rearranged into a story.

### Motion language

Two easing curves to use throughout (already defined in the existing
homepage code):

- **SMOOTH:** `cubic-bezier(0.22, 1, 0.36, 1)` — for text reveals, value
  count-ups, opacity fades, color transitions. Calm, no bounce.
- **SPRINGY:** `cubic-bezier(0.34, 1.56, 0.64, 1)` — for spatial entries
  (cards arriving, tab swaps, the question pills flying in). Slight
  overshoot. Playful.

**Use SMOOTH 80% of the time. Use SPRINGY for moments that should feel
like a thing arriving with personality.** The breakout animation (stage 6)
is the largest SPRINGY moment on the page.

### Density and rhythm

- Generous whitespace between stages. The visitor's eye should rest
  between beats.
- Never cramped. If a stage feels dense, cut copy before reducing spacing.
- Reading rhythm: each stage is a small narrative beat. The scroll feels
  like reading a printed magazine spread, not navigating a SaaS dashboard.

### What we are not doing

- No parallax backgrounds (cheap, dates the page).
- No video backgrounds (heavy, slow, hard to control).
- No 3D scenes (overkill).
- No carousel/slider components for the tour (scroll is the navigation).
- No accordions in the tour (every stage is visible by default; FAQ is
  the only place accordions are allowed).
- No modal popups during the tour (no interruption).

---

## 4. Layout system

### Desktop (≥1024px)

Two-column grid:

- **Left column** — narrative copy, scrolls with the page. Width: ~45–50%
  of the centered container width.
- **Right column** — sticky mock. Width: ~50–55%. Stays visually anchored
  while the left column scrolls.

Centered container max-width: 1600px (matches current homepage).

Inter-stage padding: clamp(56px, 8vw, 96px) vertical. Consistent so the
scroll rhythm is predictable.

### Mid-size (768–1023px)

Single column. Mock card sits inline above or below each stage's copy
(designer's call — recommendation: above the copy for stages 3–6, below
for stages 1, 7, 8). No sticky behavior. Stage padding reduces to
clamp(40px, 6vw, 64px) vertical.

### Mobile (<768px)

Single column. Each stage is a self-contained card with its own copy +
mock state inline. No sticky scroll. Compact mock state per stage. Stage
padding: clamp(32px, 5vw, 48px) vertical.

The hero adapts: kicker + H1 + subhead + CTA stack vertically; mock card
appears beneath the CTA cluster, not above. The brew-sheet breakout
moment becomes a single still frame on mobile (no animation), not a
breakout, because spatial animations are awkward on small screens.

---

## 5. The mock — sticky right column

### Desktop position and behavior

The mock starts in the hero as a card on the right. As the visitor
scrolls into the opening (stage 2), the mock card visually "settles" into
its sticky position (top: ~clamp(24px, 6vh, 80px)). It stays there for
the duration of stages 2 through 8.

After stage 8, the mock fades out as the page transitions into the
"what else it does" grid (stage 9) and beyond.

### State machine

The mock has these states, in scroll order:

| Stage | Mock state |
|---|---|
| 1 — Hero | **Recipe overview** (Fermentables tab active, OG/IBU/SRM visible) |
| 2 — Opening | **Same** (no change; the mock holds while the text builds emotion) |
| 3 — Grains | **Fermentables** active. OG number animates a small tick (+2 points) when scrolled into view. |
| 4 — Hops | **Hops tab** active. Flavor radar animates in. |
| 5 — Water | **Water tab** active. Salt fields animate from defaults to fitted values. Lactic acid suggestion appears as a small callout. |
| 6 — Brew sheet | **Breakout animation** (see section 6). Resolves into the Brew Sheet panel showing DME suggestion + hop warning callout. |
| 7 — Brewed again | **Brewed Versions list** — a small list of saved sessions of the same recipe with dates and OG actuals. |
| 8 — Community + Compare | Mock fades to ~40% opacity. Compare view cards appear in the left column inline. |
| 9–12 | Mock fades out. The remaining stages don't use the sticky mock. |

### Tab transitions

When the scroll position moves from one stage to the next:

- Active tab indicator slides to the new tab with SMOOTH easing.
- Outgoing panel content fades out (~150ms).
- Incoming panel content fades in (~200ms), with stagger on inner rows
  (~30ms between rows).
- Total transition: ~400ms perceived.

For the brew-sheet breakout (stage 5→6), see section 6.

### Auto-rotate behavior

On first page load, before the visitor has scrolled, the mock should auto-
rotate through Fermentables → Hops → Water with the existing 2.4s cadence
(already implemented). This signals "this thing reacts" to a visitor who
hasn't scrolled yet.

As soon as the visitor starts scrolling, auto-rotate disables and the
scroll-position-to-tab logic takes over. It does not re-enable.

### What the mock does NOT do

- It doesn't move around the page (no x or y position shift across the
  scroll outside of the initial settling).
- It doesn't change size dramatically between stages (except in the
  breakout moment).
- It doesn't have its own background music or sound.
- It doesn't pause for clickable interactions during the scroll tour
  (clicks during the scroll behave the same as clicks on the current
  homepage's HeroBuilderCard — open the relevant page).

---

## 6. The breakout animation — stage 6 only

This is the single biggest visual moment on the page. It earns its
position because stage 6 is the strongest differentiator (the brew-day
decision aid). It happens **once** on the page, by design. Using it
twice would dilute the meaning. Using it once makes it land.

### What it represents

The recipe is a connected system. To show the brew sheet — the piece of
the system that runs *during* brew day — we visually disassemble the
recipe builder card to reveal that piece in focus. Like an exploded
diagram of a mechanical assembly that resolves on one component.

### Sequence (target ~1.4 seconds total)

**Phase 1 — pause and settle (~150ms).** As the visitor enters stage 6,
the mock's current state (Water tab, from stage 5) holds for a beat. No
tab swap. The card appears to "take a breath."

**Phase 2 — disassembly (~400ms, SPRINGY).** The mock card's internal
panels lift outward in a 3D-ish parallax. Specifically:

- The card's tab strip (Fermentables / Hops / Water / etc.) detaches
  upward and slightly rotates back (rotateX ~12°), drifting up and away
  with a slight blur.
- The card's stats row (OG / FG / ABV / IBU) detaches downward, mirror
  treatment.
- The four side panels (Fermentables panel, Hops panel, Water panel,
  Yeast panel) lift outward to the four corners. Each panel rotates
  slightly (rotate ~8° in alternating directions) and translates ~120px
  along a vector from the card's center.
- Opacity on these elements drops to ~25%.

The disassembly should feel like watching pages of a notebook drift apart
with intent. Springy. Light. **Not chaotic.** Every piece moves with
purpose.

**Phase 3 — focus reveal (~500ms, SPRINGY then SMOOTH).** The Brew Sheet
panel materializes from below the original card position, rising upward
with scale (from 0.85 to 1.0) and opacity (0 to 1). It settles into the
center of the mock area, slightly larger than the original recipe card
to emphasize it (~108% of the original card size).

**Phase 4 — content reveal (~350ms, SMOOTH).** Inside the brew sheet
panel, content reveals in sequence:

- Header ("Brew sheet") fades in first.
- The "Pre-boil OG: predicted 1.040 / target 1.044" line fades in.
- The two recovery option cards (Add DME / Boil longer) fade in
  side-by-side with a slight ~60ms stagger.
- The hop-character warning callout slides in from the right and
  attaches to the "Boil longer" card with a small connecting line. This
  is the moment to emphasize most: the warning should feel like a small
  "oh wow it caught that" beat.

**Phase 5 — settled state.** The brew sheet panel is now the only thing
in the mock area. Disassembled fragments are fully faded. The visitor
reads the stage copy on the left while the brew sheet stays prominent.

### Easing details

| Phase | Easing | Reason |
|---|---|---|
| Disassembly | SPRINGY | Pieces have personality, slight overshoot at the apex. |
| Focus reveal (scale) | SPRINGY into SMOOTH | Lands without a hard stop. |
| Focus reveal (opacity) | SMOOTH | Avoid a flicker. |
| Content reveal | SMOOTH | Calm reading rhythm. |
| Warning callout slide | SPRINGY | This is the "personality" beat — let it pop. |

### Reduced motion fallback

For `prefers-reduced-motion: reduce`:

- No disassembly. The recipe card cross-fades into the brew sheet panel
  over ~400ms.
- No spatial movement of disassembled pieces.
- Content reveals still happen but as a single simultaneous fade-in
  rather than staggered.

### Reverse / re-enter

If the visitor scrolls back up out of stage 6 and then scrolls down into
it again, the breakout should replay. It's a feature of stage 6, not a
one-time-ever cinematic. The replay should still feel intentional, not
mechanical — visitors who scroll back to "see it again" are engaged
and we reward them.

### Mobile fallback

On mobile, no breakout. Stage 6 shows the brew sheet panel as a still
card with the content already revealed (no disassembly, no staggered
content reveal beyond a simple fade-in).

---

## 7. Stage-by-stage specifications

For each stage: layout, mock state, copy reference, animations, transition
to next, mobile notes.

Copy text is in [homepage-v3-copy.md](homepage-v3-copy.md) "Stage-by-stage
copy drafts." Do not duplicate it here. This section specifies *how each
stage feels and moves*.

### Stage 1 — Hero

**Layout:** Two-column grid. Left: kicker (Caveat script, ~26px, ~-4°
rotation, yeast color), then H1 (Bitter display, clamp(44px, 6.5vw, 100px)),
then subhead (Space Grotesk, 17px, muted color, max-width 480px), then CTA
cluster, then trust line, then stat pills.

Right: HeroBuilderCard (existing component). No changes to the card itself.

**Mock state:** Auto-rotating through Fermentables → Hops → Water at 2.4s
cadence until the visitor scrolls.

**Animations:**

- Kicker fades in (opacity 0→1, ~500ms SMOOTH, delay 0).
- H1 words animate one at a time. Each word fades in with `opacity 0→1`,
  `y 20→0`, `filter blur(10px)→blur(0px)`. ~550ms per word, SMOOTH, with
  staggered delays per word (0.15s, 0.25s, 0.35s, 0.43s, 0.51s).
- The word "thinks ahead" should NOT have the highlighter treatment that
  the current "simpler" word has — too much visual weight on the new H1.
  Instead, give "thinks ahead" a subtle color shift toward `hsTokens.roast`
  (the same shift the current `place to brew` words have).
- Subhead fades in (opacity 0→1, y 16→0, ~600ms SMOOTH, delay 0.7s).
- CTA cluster fades in (opacity 0→1, y 12→0, ~550ms SMOOTH, delay 0.95s).
- Stat pills fade in (opacity 0→1, y 8→0, ~600ms SMOOTH, delay 1.2s).
- Mock card animates per the existing HeroBuilderCard pattern.

**Transition to stage 2:** The mock card visually settles into its sticky
position as the visitor scrolls. No transition on the left column — the
opening text appears as normal scroll content.

**Mobile:** Single column. Kicker / H1 / subhead / CTA / trust line stack.
Mock card appears below the trust line, not above. No auto-rotate on
mobile (battery; respect user attention).

### Stage 2 — Opening ("I made this...")

**Layout:** Two-column grid continues. Left: just the opening paragraph,
larger than body text (~22–24px Bitter italic), generous line-height
(1.5), max-width ~560px. Right: sticky mock card (still showing whatever
it was at end of hero rotation).

**Mock state:** No tab change. The mock holds whatever state it was in
when the visitor stopped scrolling. (If they paused on Hops, Hops stays.
If they scrolled fast, the mock is on Water.)

**Animations:**

- The opening paragraph's first sentence fades in with a slow `opacity 0→1`
  and `y 12→0` (~700ms SMOOTH).
- The remaining sentences appear one at a time with ~200ms stagger between
  them. SMOOTH easing. Slight `y 8→0` per sentence.
- The final "I made this so I'd never forget things and find myself there
  again." sentence has a slightly longer animation (~900ms) and lands as
  a beat. There's intentional pause before the next stage starts.

**Visual tone:** Atmospheric. No card chrome on the left column. The text
sits on the cream background with no border or frame. The mock card on
the right is still there but feels "paused" — the auto-rotate has long
since stopped.

**Transition to stage 3:** Soft. As the visitor scrolls past the opening,
the mock cross-fades from its held state to the Fermentables tab if it
isn't already there. The next sentence ("So I made the math run as you
build...") starts the next stage with no header divider.

**Mobile:** Single column. Opening paragraph appears with the same
sentence-by-sentence reveal. Mock state below.

### Stage 3 — Grains — live math

**Layout:** Two-column. Left: stage copy in body type (Space Grotesk 17px,
muted, max-width 480px), with the lead sentence slightly emphasized
(Bitter, ~20px). Right: sticky mock with Fermentables tab active.

**Mock state:** Fermentables. The OG/FG/ABV/IBU/SRM stats row at the
top of the mock should animate slight value ticks when the stage enters
view. Specifically:

- OG ticks up ~+2 points (e.g. 1.052 → 1.054) over ~800ms, SMOOTH.
- ABV recalculates to match (~+0.2%).
- IBU stays still (no hop change).
- The grain bill rows in the panel get a subtle highlight (background
  flash on one row, 200ms hold, fade out 300ms).

This signals "the math is moving in response to a thought." Subtle, not
loud.

**Animations:**

- Stage lead sentence fades in (opacity 0→1, y 18→0, 600ms SMOOTH).
- Following sentences appear with 150ms stagger.
- Mock value ticks happen ~300ms after the stage enters view.

**Transition to stage 4:** The mock's tab indicator slides from
Fermentables to Hops with SMOOTH easing (~400ms). The Fermentables
panel fades out (~150ms), then the Hops panel fades in (~200ms) with
staggered rows.

**Mobile:** Same content. Mock card inline above the copy. Value ticks
still play.

### Stage 4 — Hops — dial in flavors

**Layout:** Two-column. Left: stage copy. Right: sticky mock with Hops
tab active.

**Mock state:** Hops. The flavor radar should light up segment by segment
as the stage enters view.

The flavor radar is a small chart (already exists in the codebase —
`HopFlavorRadar` or similar) showing flavor categories: citrus, tropical,
stone fruit, dank, pine, herbal, floral, spicy. Each axis is a percentage
0–100.

**Specific animation for the radar:**

- On enter, the radar starts blank (all axes at 0).
- Each axis animates outward to its value in sequence with ~80ms stagger
  between axes (so the radar "fills in" over ~640ms).
- Each axis uses SPRINGY easing for the outward expansion — slight
  overshoot at the apex. Playful, like a balloon inflating.
- When all axes have landed, a thin connecting polygon (the radar shape)
  draws around them with ~250ms SMOOTH stroke animation.

This is one of the stages that gets a slightly elevated "wow" treatment
because the hop visualizer is a genuine differentiator.

**Animations on copy:**

- Stage lead fades in (600ms SMOOTH).
- Sub-sentences stagger 150ms.

**Transition to stage 5:** Tab indicator slides to Water. Panel cross-fade
as in stage 3→4.

**Mobile:** Radar animation simplified. All axes appear simultaneously
with a single ~400ms SMOOTH fade. The connecting polygon still draws.

### Stage 5 — Water — salts solve themselves

**Layout:** Two-column. Left: stage copy. Right: sticky mock with Water
tab active.

**Mock state:** Water tab. The mock shows source water profile (top),
target water profile (middle, loaded from BJCP style), and salt addition
fields (bottom).

**Specific animation for the auto-fit:**

When the stage enters view:

1. The salt fields are visible with default zero values.
2. After a ~300ms beat, each salt field's value animates from 0 to its
   fitted value with SMOOTH easing over ~600ms. Numbers count up; this
   should look like a slow rotary counter, not an instant jump.
3. After the salt fields have settled, the achieved water profile (above
   the salts row) animates each ion's value from source value to achieved
   value with the same count-up motion (~500ms).
4. Finally, a small callout slides in from the right (similar treatment
   to the brew sheet's hop warning at stage 6, but smaller): "+ 2.3 mL
   lactic acid to hit pH 5.4." The callout uses SPRINGY easing and has
   a small connecting line pointing to the mash pH row.

This is the stage's hero moment. The salt count-up is the visual that
should land. Get it right.

**Animations on copy:**

- Same pattern as stages 3 and 4.

**Transition to stage 6:** This is the entry into the breakout moment. The
mock's water tab holds its final state for ~150ms after the stage 6 copy
starts appearing, then the breakout begins. See section 6.

**Mobile:** Salt count-up still plays but with shorter duration (~400ms).
Lactic acid callout appears as a small inline note below the salts row,
not as a sliding callout.

### Stage 6 — Brew sheet — adjust on the fly *(breakout moment)*

**Layout:** Two-column. Left: stage copy (this stage has the longest copy
by design — it's the payoff). Right: sticky mock undergoing the breakout
animation.

**Mock state:** Triggers the breakout animation (see section 6 for full
spec). Resolves into the Brew Sheet panel showing:

- A "Pre-boil OG" predicted-vs-target row (e.g. predicted 1.040, target
  1.044).
- Two recovery option cards side-by-side:
  - "Add ~60g DME at flameout" with a small explanation
  - "Or boil ~8 min longer" with a small explanation
- A hop-character warning callout attached to the "Boil longer" card:
  "your whirlpool hops will over-extract — pull them with a filter first"

This is the most content-dense state of the mock on the page. It earns
the density because it's the payoff stage.

**Animations:**

- Breakout sequence per section 6.
- Copy on the left appears with the same pattern as previous stages.
- After the brew sheet panel has settled, the copy paragraphs appear in
  sequence with the standard sentence-stagger pattern.

**Transition to stage 7:** The brew sheet panel cross-fades to a Brewed
Versions list panel. The brew sheet content fades out (~250ms SMOOTH).
The brewed versions list rises into place from below (~350ms SPRINGY)
with its rows staggered (~60ms between rows).

**Mobile:** No breakout. Brew sheet panel renders as a still card with
all content already visible. Hop warning callout sits inline as a small
"⚠ note" beneath the boil-longer option, not as a connected callout.

### Stage 7 — Brewed again

**Layout:** Two-column. Left: stage copy. Right: sticky mock with Brewed
Versions list panel.

**Mock state:** Brewed Versions list. Shows ~3 saved versions of the same
Citra Mosaic IPA recipe with different brew dates and OG actuals. Each
row has the brew date, recorded OG, recorded FG, ABV, and a small note
field showing what changed (e.g. "different water profile", "yeast pack
was older").

**Animations:**

- List rows fade in with staggered (80ms) opacity + y entries.
- The "different water profile" note on one row has a small underline
  animation when it appears.
- Copy animations follow the standard pattern.

**Transition to stage 8:** The mock fades to ~40% opacity as the
community + compare content takes over the left column space (the
community/compare stage uses the full width, not the two-column grid).

**Mobile:** Brewed Versions list renders inline. No special animations
beyond the row fade-in.

### Stage 8 — Community + Compare

**Layout:** Full-width on desktop (breaks the two-column pattern). The
mock fades to ~40% in the background; community recipe cards appear in a
2- or 3-column grid in front of it. Then, as the visitor scrolls further
into the stage, a compare-view treatment appears showing 3 recipe cards
side-by-side with their differences highlighted.

**Mock state:** Faded to ~40%. Not interactive at this stage.

**Animations:**

- Community recipe cards (existing `SectionCommunity` component) animate
  in with the existing tilt + y + scale pattern. Keep this; it works.
- The compare view is a new element. It appears with a "snap together"
  animation: three cards slide in from the left, center, and right of
  the viewport and settle side-by-side. SPRINGY easing on the entry.
- Differences between the cards (e.g. one card's water profile field is
  highlighted in `hsTokens.water`, another's hop schedule is highlighted
  in `hsTokens.hops`) animate in with subtle background-color transitions
  (~600ms SMOOTH) after the cards have settled.

**Copy:** Stage copy appears as a section header before the cards, with
the standard pattern. The compare view has its own small intro sentence
above it.

**Transition to stage 9:** The mock fully fades out. The compare view
slides up and off-screen as the "what else it does" grid takes its place.

**Mobile:** Mock disappears entirely (no faded background). Community
cards stack vertically. Compare view becomes a horizontal scroll of three
small cards if absolutely necessary, or simplified to a single
side-by-side pair with a "compare more" link.

### Stage 9 — What else it does

**Layout:** Centered grid, 2 columns × 2 rows of small tiles. Max width
~960px. No sticky mock.

**Tile content:** Per [homepage-v3-copy.md](homepage-v3-copy.md) — BeerXML,
Equipment profiles, Mash schedule, Fermentation steps.

**Animations:**

- Tiles fade in with staggered (100ms) opacity + scale (0.96→1) entries.
- SMOOTH easing.
- On hover, each tile lifts slightly (translateY -3px, +shadow) — match
  the existing HSCard pattern.

**Transition to stage 10:** Standard scroll.

**Mobile:** 1-column grid. Same fade-in pattern.

### Stage 10 — Learn (Path B)

**Layout:** Centered. Section eyebrow (Caveat script kicker) → section H2
("Learn brewing. And Brewing.It.") → two CTA buttons side-by-side ("New
to homebrewing? Start here. →" and "Browse all articles →") → featured
article cards below.

The CTA buttons use the existing `HSButton` patterns. They are equal
weight visually (neither is primary).

**Mock:** No mock at this stage (already faded out).

**Animations:**

- Section header pattern: kicker + title + button cluster fade in with
  short stagger.
- Featured article cards use the existing `SectionLearn` animations
  (tilt + scale + opacity).

**Transition to stage 11:** Standard scroll.

**Mobile:** Single column. CTA buttons stack vertically.

### Stage 11 — FAQ

**Layout:** Centered, max-width ~720px. Section eyebrow → H2 ("Frequently
asked questions") → accordion list of Q&A items.

**Accordion behavior:**

- Default state: all items collapsed. Question visible, answer hidden.
- On click: smooth expand of the answer (~300ms SMOOTH height + opacity
  animation). The question's chevron rotates 90°.
- Only one item open at a time? **No** — allow multiple. Visitors who are
  skimming want to leave answers open for reference.

**Schema markup:** This section must include `schema.org/FAQPage` JSON-LD
in the document head or inline. Each Q&A pair becomes a `Question` and
`Answer` entity. The implementation must follow the [Google FAQPage
guidelines](https://developers.google.com/search/docs/appearance/structured-data/faqpage).

**Animations on enter:** FAQ items fade in with short stagger (~50ms
between items). SMOOTH easing.

**Mobile:** Same layout. Accordion behavior identical.

### Stage 12 — Final CTA

**Layout:** Centered. A short closing line ("Start a recipe.") as the
visual title, then the same CTA cluster from the hero (primary "Start a
recipe", secondary "Sign in to your library →" and "Browse recipes →"),
then the same trust line.

**Animations:**

- The closing line ("Start a recipe.") has a small breath of motion when
  it enters view — subtle scale pulse from 1.0 → 1.02 → 1.0 over ~600ms
  SMOOTH. Once, on enter. Not repeating.
- CTA cluster fades in.

**Transition out:** Standard footer.

**Mobile:** Identical to desktop pattern, just stacked.

---

## 8. Motion language details

### Existing curves to reuse

Defined in current homepage code:

```
SMOOTH  = [0.22, 1, 0.36, 1]
SPRINGY = [0.34, 1.56, 0.64, 1]
```

Use these. Don't define new curves unless absolutely necessary. Adding a
third curve adds visual noise.

### Text reveals

- **Words:** Fade in with `opacity 0→1`, `y 20→0`, `filter blur(10px)→blur(0px)`.
  Duration ~550ms. Easing SMOOTH. Stagger words by ~80–100ms.
- **Sentences:** Fade in with `opacity 0→1`, `y 12→0`. Duration ~600ms.
  Easing SMOOTH. Stagger sentences by ~150–200ms.
- **Paragraphs:** Single fade in for the whole block. Duration ~700ms.
  Easing SMOOTH.

### Card / chip entries

- Fade in with `opacity 0→1`, `y 24→0`, `scale 0.96→1`. Duration ~600ms.
  Easing SMOOTH for calm entries, SPRINGY for personality entries.

### Value count-ups

- Numbers animate from a starting value to a target value with a slight
  easing. SMOOTH curve, duration proportional to the magnitude (small
  changes ~300ms, large ones up to ~800ms).
- Use `tabular-nums` font feature on the element so the digit widths
  don't shift during the count.

### Hover states

- Cards lift `translateY(-3px)` with a slight `box-shadow` deepening.
  Duration ~150ms with default ease-out CSS.
- Don't add rotation to hover (too playful, reads as gimmick).

### Reduced motion

For `prefers-reduced-motion: reduce`:

- All spatial animations become opacity-only fades. No y, scale, rotate,
  blur, or filter transitions.
- Value count-ups become instant value changes.
- The breakout animation becomes a simple cross-fade (see section 6).
- Tab swaps still happen but without the slide indicator animation.

The page must remain fully usable and visually coherent in reduced-motion
mode. Test it.

---

## 9. Typography

### Tokens (existing)

- **Display:** Bitter (serif, weights 400/600/700/800; italic 400).
- **Body:** Space Grotesk (sans, weights 400/500/600/700).
- **Script:** Caveat (handwriting, weights 400/500/600/700).
- **Mono:** IBM Plex Mono (weights 400/500/600).

### Per-stage hierarchy

| Element | Font | Weight | Size | Letter-spacing |
|---|---|---|---|---|
| H1 (hero) | Bitter | 800 | clamp(44px, 6.5vw, 100px) | -0.04em |
| Stage lead | Bitter | 700 | clamp(28px, 3.5vw, 44px) | -0.03em |
| Body paragraph | Space Grotesk | 400 | 17px | normal |
| Subhead | Space Grotesk | 400 | 17px | normal |
| Eyebrow | Space Grotesk | 700 | 11px | 0.16em uppercase |
| Script kicker | Caveat | 600 | 24–28px | normal, ~-4° rotation |
| Stats value | Bitter | 800 | varies (40–48px in mock) | -0.04em |
| Stats label | Space Grotesk | 700 | 9–11px | 0.14em uppercase |
| Numbers in mock | tabular-nums everywhere | | | |

### Script kicker rule (extended from voice doc)

Script kickers stay **all lowercase**. The one allowed em-dash on the
page lives here — at the end of a script kicker as the visual closer
("built by a brewer tired of forgetting things on brew day —"). This is
the only em-dash anywhere on the homepage. Body text uses periods.

### Reading rhythm

- Body line-height: 1.55–1.6.
- Display line-height: 0.92–1.05 depending on size (tighter for larger
  text).
- Max body width per stage: 480–560px (depending on layout).
- Generous paragraph spacing: ~1em between paragraphs.

---

## 10. SEO implementation requirements

These are non-negotiable. The dev must implement all of these.

### Semantic headings

- The page has exactly **one** `<h1>` element: "A recipe builder that
  thinks ahead." (the hero H1).
- The hero subhead ("Recipes, water chemistry, mash pH, priming sugar,
  starter calcs, keg PSI. Everything where you need it.") is wrapped in
  `<h2>`, styled to look identical to a paragraph subhead.
- Each tour stage's eyebrow (or its absence — see below) becomes an
  `<h2>`. Style: existing eyebrow CSS. New text per section 3 of
  [homepage-v3-copy.md](homepage-v3-copy.md):
  - Stage 3: `<h2>` "Homebrew recipe builder" (styled as eyebrow)
  - Stage 4: `<h2>` "Hop flavor visualizer"
  - Stage 5: `<h2>` "Water chemistry and mash pH"
  - Stage 6: `<h2>` "Brew-day adjustments"
  - Stage 8: `<h2>` "Community recipes"
  - Stage 9: `<h2>` "Also in the recipe builder"
  - Stage 10: `<h2>` "Brewing science articles"
  - Stage 11: `<h2>` "Frequently asked questions"
- Stage leads (e.g. "So I made the math run as you build.") are `<h3>`
  or smaller heading elements. Not `<h2>`.

### FAQ schema

`schema.org/FAQPage` JSON-LD must be present in the page's `<head>`. Each
Q&A pair is a `Question` with an `acceptedAnswer`. Implementation must
match the [Google guidelines](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
exactly so the page becomes eligible for FAQ rich results.

### Meta tags

Verify the existing tags in `app/layout.tsx` remain accurate:
- `<title>`: keep current.
- `<meta name="description">`: keep current.
- `<meta property="og:*">`: keep current.

If any of these reference "simpler" or the old hero copy, update them.

### Internal linking

The page must include links to:

- `/recipes/new` (primary CTA, multiple instances)
- `/recipes` (sign-in / library)
- `/browse` (browse recipes)
- `/calculators` (referenced in copy)
- `/learn` (Learn section CTAs)
- `/learn/getting-started` (or the actual slug for the new-to-homebrewing
  article, when written)
- `/r/[slug]` (community recipe cards, existing pattern)
- Each FAQ answer that references a calculator or article should link to
  that page.

### Page weight / Core Web Vitals targets

- **LCP** (Largest Contentful Paint): under 2.5s on mobile 4G.
- **CLS** (Cumulative Layout Shift): under 0.1.
- **INP** (Interaction to Next Paint): under 200ms.
- All animations must use `transform` and `opacity` only (no animating
  layout-affecting properties).
- Above-the-fold content must not be blocked by below-the-fold
  animations.

---

## 11. Performance budget

### Asset budget

- Total page weight target: under 600KB compressed (excluding fonts).
- Fonts: already loaded by `app/layout.tsx`. No new font weights.
- Images: any hero / showcase imagery must be served as WebP with
  appropriate sizing. No PNG hero assets.
- Mock card and panels: pure DOM/SVG, no images.

### JavaScript budget

- The scroll-tour logic should not add more than ~30KB gzipped beyond
  what the current homepage uses.
- Framer Motion is already a dependency; no new motion library.
- No additional state management library.

### Runtime performance

- Animations must run at 60fps on a 2019-era mid-range phone (iPhone XR
  or equivalent Android).
- The breakout animation should not cause main-thread jank on scroll
  during the disassembly phase.
- Mock state transitions should not cause layout reflow of the page.

### Loading strategy

- Hero loads eagerly (above the fold).
- Stages 2–6 components load eagerly (likely visited during typical
  read).
- Stages 7–12 components can lazy-load with `next/dynamic` if it helps
  initial LCP. But test — Next.js's automatic code-splitting may
  already handle this.

---

## 12. Accessibility

### Required

- All headings are semantically correct (H1 / H2 / H3 hierarchy).
- All interactive elements are keyboard-accessible. The scroll tour does
  not trap focus.
- Mock card panels have appropriate ARIA roles (existing patterns in
  `HeroBuilderCard` should be preserved).
- `prefers-reduced-motion: reduce` is fully honored (see section 8).
- Color contrast meets WCAG AA. Existing `hsTokens` are designed for this;
  no new color combinations are introduced that fail contrast.
- Focus indicators visible on all CTAs and links. Use the existing
  HSButton focus state.
- Skip-to-content link in the header (existing pattern).

### Mock card specifics

- The mock card is decorative content for marketing. Screen reader users
  should be able to bypass the mock entirely and read the narrative copy
  on the left side. Wrap the mock in `aria-hidden="true"` if it doesn't
  add semantic value to the page narrative for assistive tech users.
- Alternatively: provide a brief textual description of what the mock
  shows for each stage as visually hidden text (`sr-only`) immediately
  adjacent to the relevant stage copy.

### What to verify before shipping

- Tab through the page with a keyboard. Every CTA and link is reachable.
- Use VoiceOver / NVDA. The page reads as a coherent narrative without
  the mock confusing the flow.
- Test with reduced motion enabled in OS settings. The page is still
  fully usable and understandable.

---

## 13. Mobile experience (recap)

- Single column throughout.
- Stage padding reduces to clamp(32px, 5vw, 48px).
- Mock card is inline per stage, not sticky.
- No breakout animation (still frame instead).
- No salt count-up complexity (single fade-in).
- Flavor radar simplified (all axes fade in simultaneously).
- Compare view simplified (two cards side by side max, or horizontal
  scroll).
- Hero CTA cluster stacks vertically.
- FAQ accordions identical to desktop.

The mobile experience tells the same story. It just shows fewer
spatial animations.

---

## 14. Implementation approach

### Build alongside, not in place

Per the user's preference:

- Create new copy file (e.g. `app/_home/copy-v3.ts` or
  `app/_home/landing-v3-copy.ts`) with the locked stage drafts.
- Build new stage components in a new directory (e.g.
  `app/_home/v3-components/` or similar).
- Add new mock panel states to `HeroBuilderCard` (Brew Sheet, Brewed
  Versions) — these can be added as new `TabKey` values or as a separate
  `MockState` enum.
- Add a new route or feature flag to render the v3 homepage alongside the
  current homepage during iteration. Suggested: a `?v3=1` query param or
  a `.env.local` flag.
- When the v3 homepage is ready: swap the import in `app/page.tsx` and
  delete the old `_home` components.

This lets the dev work without breaking the current production homepage.

### Working alongside the user

The dev is working alongside the user, not handing off to them. So during
build:

- Get the user's eye on each stage as it's built (don't wait until the
  whole page is done).
- The breakout animation in stage 6 is the highest-risk, highest-reward
  piece. Build a prototype of just that early to make sure the feel
  lands. Iterate on it before building the surrounding stages.
- Mobile alternate layout is its own design pass. Don't try to make
  desktop and mobile from the same component tree if it forces
  compromises. Two trees is fine if it serves the experience.

### File reuse

Reuse from the current homepage:

- `hsTokens` (design tokens) — fully reused.
- `HSButton`, `HSCard`, `HSCardLift`, `HSEyebrow`, `HSScriptNote`,
  `HSIngredientDot`, `Glyph` — fully reused.
- `HeroBuilderCard`'s existing tab state machine — extended with new
  states, not replaced.
- Existing `SectionCommunity` and `SectionLearn` — adapt for new stages
  rather than rebuild.
- Voice-and-tone rules — strictly applied throughout.

---

## 15. Definition of done

The v3 homepage is ready to replace the current homepage when:

- [ ] All 12 stages are implemented with the locked copy.
- [ ] The mock is sticky on desktop, inline on mobile, with state
      transitions per stage.
- [ ] The breakout animation lands in stage 6 with the feel described in
      section 6.
- [ ] All other stage animations match the motion language in section 8.
- [ ] The new "Brew Sheet" mock panel and "Brewed Versions" mock panel
      are built and visually consistent with the existing mock panels.
- [ ] The compare view in stage 8 is built (snap-together cards with
      difference highlighting).
- [ ] FAQ JSON-LD schema is implemented and validates against Google's
      Structured Data Testing Tool.
- [ ] Semantic H1/H2/H3 hierarchy is correct.
- [ ] No em-dashes anywhere on the page except in the lowercase script
      kickers.
- [ ] LCP, CLS, INP targets met on desktop and mobile.
- [ ] Reduced motion fully honored on every animation.
- [ ] Keyboard navigation works for all CTAs.
- [ ] Tested on iOS Safari, Android Chrome, Desktop Chrome, Desktop
      Firefox, Desktop Safari.
- [ ] "New to homebrewing? Start here." article exists at the linked
      URL, or the link is conditionally rendered.
- [ ] The voice doc's locked canonical copy section is updated to
      reflect the v3 hero (already done in this PR).
- [ ] The user has reviewed each stage and approved the word-level copy.

---

## 16. Open questions / decisions during build

These are non-blockers, can be decided during build:

- The exact pixel-level treatment of the breakout animation. Get a
  prototype in front of the user; iterate from there.
- Whether the brewed-again stage shows 3 or 4 versions in the list.
- The exact wording of the lactic acid callout in stage 5.
- The exact 8 FAQ questions and their answers (the user will draft
  during build).
- Whether the compare view in stage 8 shows 2 or 3 recipes side-by-side
  by default.
- Whether to add a small "↑ back to top" affordance at stages 11–12.
- Mobile-specific copy trims (sometimes a sentence cuts naturally on
  small screens).

---

## 17. Out of scope for this PRD

- The "new to homebrewing" Learn article content. (Backlog.)
- The comparison-pages SEO play (`/compare/brewfather`). (Backlog,
  post-launch.)
- Email capture / newsletter signup. (Declined.)
- A/B testing infrastructure. (Declined.)
- Service worker for full PWA install. (Backlog, separate from homepage.)
- Sign-in flow polish. (Separate audit.)
- Onboarding flow for first recipe creation. (Separate audit.)
- Brand Twitter / Bluesky account. (Declined.)
- Hardware integration. (Declined.)
- Mash temp recovery in brew sheet (backlog).
- Inventory MVP (backlog).

---

## 18. References

- Voice rules: [voice-and-tone.md](voice-and-tone.md)
- Copy spec: [homepage-v3-copy.md](homepage-v3-copy.md)
- Backlog and "not doing" list: [backlog.md](backlog.md)
- Design tokens: `src/modules/hopskip/tokens.ts`
- Current mock components (to extend): `app/_home/components/HeroBuilderCard.tsx`, `RecipeBuilderMock.tsx`
- Brew sheet feature (to mock): `src/modules/hopskip/components/builder/HSBrewSheetSection.tsx`
- Brewed version feature (to mock): `src/modules/beta-builder/presentation/components/BrewSessionPage.tsx`
- Water salt optimizer (referenced in copy): `src/modules/beta-builder/domain/services/WaterSaltOptimizer.ts`
- Mash pH service (referenced in copy): `src/modules/beta-builder/domain/services/MashPhCalculationService.ts`
- Compare module (referenced in stage 8): `src/modules/compare/`

---

## 19. Implementation log

Build progress against this spec. Updated as work lands.

### Architecture choices

- **Orphan route at `/v3`** during build (not a feature flag). The live
  homepage at `app/page.tsx` is untouched. When v3 is ready, the contents
  of `app/v3/` move into `app/_home/` and `app/page.tsx` imports the new
  `HomeV3`. `/v3` is then deleted.
- **All v3 code lives under `app/v3/`**: `page.tsx` (server entry, fetches
  community recipes), `HomeV3.tsx` (client layout shell), `data.ts`
  (locked copy + EASE curves), `components/` (12 stage components + mock
  panels + TourMock wrapper), `lib/` (sentence splitter + useStageInView
  hook).
- **`HeroBuilderCard` is reused, not rebuilt.** Two new optional props
  (`controlledTab`, `onTabChange`) enable scroll-driven tab control while
  preserving the existing auto-rotate behavior for all other surfaces.

### Completed (2026-06-02)

- **Layout shell:** two-column grid for stages 1-8 with a sticky right
  column; full-width sections for 9-12. Mobile collapses to single column
  via CSS media queries (the polished mobile pass is queued separately).
- **Stage 1 hero** with the full word-by-word reveal cascade (kicker →
  6 H1 words with blur+y+opacity stagger → subhead `<h2>` → CTA cluster
  → trust line → stat pills). Hero subhead is wrapped in `<h2>` per
  section 10 SEO requirement.
- **Stage 2 opening** with in-view-triggered sentence-by-sentence reveal.
  Final sentence gets the longer 900ms beat.
- **Stages 3-6 left-column reveals** sentence-by-sentence at 300ms stagger
  / 700ms each. Paragraph-aware spacing: extra margin on the first
  sentence of each source paragraph keeps the prose grouped.
- **Scroll-to-tab plumbing.** `HeroBuilderCard` accepts `controlledTab` +
  `onTabChange`. `HomeV3` owns the scroll-driven tab state. Each tour
  stage's `useStageInView` fires `onEnter` on view transition.
- **BrewSheetPanel** (`app/v3/components/BrewSheetPanel.tsx`): predicted-
  vs-target row + two recovery option cards side-by-side + hop-warning
  callout sliding SPRINGY from the right.
- **Breakout transition** (rhythm-faithful, simplified visual):
  150ms pause → HeroBuilderCard exits with scale 1→0.92 + rotate -1.5° +
  opacity (400ms) → BrewSheetPanel rises scale 0.85→1 opacity 0→1
  (500ms SPRINGY) → content reveals inside (~600ms more). Reduced-motion
  uses cross-fade. Scrolling back to stage ≤5 resets state so breakout
  replays on re-entry per PRD section 6.
- **HopFlavorRadar bouncy entry** in the mock card. Ported the production
  `HopFlavorRadarSvg` pattern: rings/axes fade in first (SMOOTH), then
  polygon scales from 0.3→1 with SPRINGY overshoot, then vertices pop in
  one by one. Replaces the previous flat SMOOTH scale.
- **Eager view trigger** via `useStageInView` (default margin
  `"0px 0px -33% 0px"`, stage 6 uses `"0px 0px -45% 0px"`) so reveals and
  the breakout start as the section enters the bottom third of the
  viewport rather than after the section center hits viewport center.

### Deferred (split into separate tracking tasks)

- **Stages 9-12 polish.** Stubs render their locked copy. Outstanding:
  what-else tile hover lift + staggered fade-in entry; learn cards using
  the existing `SectionLearn` pattern; FAQ accordion height-based smooth
  expand; FAQ JSON-LD schema (section 10 requirement); final-CTA breath
  pulse on the closing line.
- **Stage 7 BrewedVersions panel + Stage 8 community/compare.** Stage 7
  currently shows the brew-sheet panel left over from stage 6's mockState
  (because no stage 7 trigger overrides it yet). Needs a third `MockState`
  value ("brewedVersions") plus the panel component. Stage 8 needs the
  community cards in a 2/3-col grid in front of a 40%-opacity faded mock,
  plus the snap-together compare view.
- **Stage 3-5 mock-internal animations** (separate task):
  - Stage 3: OG ticks +2 points + grain row highlight on Fermentables
    enter.
  - Stage 4: per-axis radar fill animation (currently the radar plays a
    unified bouncy entry on tab mount — close to the PRD spec but not
    identical to the per-axis stagger).
  - Stage 5: salt fields count up 0→fitted, achieved water profile
    count-up after, lactic acid callout slides in SPRINGY with a
    connecting line to the mash pH row.
- **Breakout per-panel disassembly fidelity** (separate task). The
  current implementation captures the rhythm but treats `HeroBuilderCard`
  as a single exiting unit. PRD section 6 specifies tab strip lifting up
  with rotateX, stats row down, four side panels translating to four
  corners. That requires `HeroBuilderCard` internal wrappers.
- **Mobile alternate layout** (separate task). Below 1024px collapses to
  single column today; the mobile-specific tweaks per PRD section 13
  (no breakout, simpler radar fade, inline lactic acid note, horizontal-
  scroll compare cards) are queued.
- **A11y / em-dash sweep** (separate task). Reduced-motion path is wired
  in TourMock and HopFlavorRadar respects motion preferences via the
  natural reveal pattern. Still pending: keyboard tab order audit, FAQ
  ARIA, em-dash grep after final copy lands.

### Gotchas discovered during build

1. **`useInView`'s "centered" margin is too tight for tall stages.** The
   initial `"-25% 0px -25% 0px"` (middle 50% of viewport) means a tall
   stage doesn't trigger until the visitor has scrolled well into it.
   Stage 6 (5 paragraphs + brew-sheet copy) was the worst case — the
   breakout was firing too late to be visible during the user's natural
   read pace. Solution: `"0px 0px -33% 0px"` baseline (eager top, fires
   when section top enters bottom third of viewport), with stage 6 even
   more eager at `"0px 0px -45% 0px"` so the breakout starts before the
   visitor is deep in the section.

2. **Inline `onEnter` callbacks cascade.** Arrow functions in the parent
   create a new identity every render. Putting that directly in a
   `useEffect` dep array causes the effect to re-fire on every parent
   render, triggering `setState` cascades. The `useStageInView` hook
   stores the callback in a ref and depends only on `inView`; effect
   fires once on transition to true.

3. **`position:absolute; inset:0` on overlapping panels crops content.**
   Initial TourMock used absolute layers with `inset:0` and a `minHeight:
   660` on the parent. HeroBuilderCard renders taller than 660px on some
   tabs (Hops with the flavor radar especially) — the bottom of the card
   was being clipped. Switched to CSS grid with both panels at
   `gridRow:1/gridColumn:1`; the cell grows to fit the largest child so
   nothing is cropped and the sticky position stays stable.

4. **`controlledTab` needed three internal adjustments to `HeroBuilderCard`**,
   all backward-compatible:
   (a) introduce `internalTab` state and derive `activeTab = controlledTab
       ?? internalTab` so both modes coexist;
   (b) gate the auto-rotate `useEffect` on `controlledTab === undefined`
       so internal state doesn't tick in the background while controlled
       mode is active;
   (c) `handleTabClick` calls both `setActiveTab` (internal fallback) and
       `onTabChange` (notify parent), so click-to-jump works in either
       mode.
   All existing call sites (`SignedOutHero`, `SignedInHero`,
   `SignedInEmptyHero`) work unchanged because both new props are
   optional.

5. **Sentence-by-sentence reveals don't work inline.** Initial attempt
   used `motion.span` with `display:inline-block` for each sentence —
   long sentences in narrow paragraphs broke text-wrap behavior (each
   sentence became a single rectangular box that couldn't share a line
   with its neighbors gracefully). Solution: render each sentence as its
   own `motion.p` block. Slightly more vertical space, but the
   storytelling beats land and the wrap is natural. Paragraph-aware
   spacing (extra top margin on first-in-paragraph sentences) preserves
   visual grouping.

6. **The mock's `HopFlavorRadar` already had the right shape; it just
   needed bouncier easing.** The original mock used SMOOTH for the
   polygon scale, which felt flat. Production's `HopFlavorRadarSvg` uses
   `cubic-bezier(0.34, 1.56, 0.64, 1)` — same curve as `SPRINGY` already
   defined in `HeroBuilderCard.tsx`. Swapping the polygon's transition
   from SMOOTH to SPRINGY (plus adding ring/axis fade-in) gave the
   "fun" entry without needing keyframes.

7. **Auto-rotate timing of the mock card competes with scroll-driven tab
   selection.** While the visitor is in the hero, the mock auto-rotates
   through Fermentables → Hops → Water at 2.65s intervals. As soon as
   the visitor scrolls into the tour and `controlledTab` becomes
   non-`undefined`, auto-rotate disables (per the new gate). This is the
   intended one-way transition from showcase mode to scroll-controlled
   mode.

### Files touched

```
app/v3/
  page.tsx                              created
  HomeV3.tsx                            created
  data.ts                               created
  lib/
    sentences.ts                        created
    useStageInView.ts                   created
  components/
    StageHero.tsx                       created
    StageOpening.tsx                    created
    StageGrains.tsx                     created
    StageHops.tsx                       created
    StageWater.tsx                      created
    StageBrewSheet.tsx                  created
    StageBrewedAgain.tsx                created
    StageCommunityCompare.tsx           created
    StageWhatElse.tsx                   created
    StageLearn.tsx                      created
    StageFAQ.tsx                        created
    StageFinalCTA.tsx                   created
    StageEyebrow.tsx                    created
    BrewSheetPanel.tsx                  created
    TourMock.tsx                        created

app/_home/components/HeroBuilderCard.tsx  modified
  + Props: controlledTab, onTabChange
  + Internal: dual-source activeTab, gated auto-rotate
  + HopFlavorRadar: SPRINGY polygon, ring/axis fade-in
```
