# v4 Homepage — GSAP Scroll Tour (current build)

Pickup guide for the in-progress homepage rebuild at `/v4`. Supersedes the
v3 motion implementation. Read this + skim `app/v4/HomeV4.tsx` and
`app/v4/mock/V4Mock.tsx` and you're productive.

History: the v3 mock (framer-motion, `setTimeout` phase machine) went 26
iterations and hit architectural walls — see
[`v3-homepage-build-debrief.md`](./v3-homepage-build-debrief.md) and
[`v3-mock-ideal-architecture.md`](./v3-mock-ideal-architecture.md). v4 keeps
the validated *scene-graph discipline* from the ideal-arch doc and rebuilds
the motion on GSAP. The original v4 plan is
`~/.claude/plans/yeah-lets-get-working-cozy-bumblebee.md`.

## What it is

- New route `app/v4/` (`/v4`), built alongside `/v3` and `app/_home`. The
  production swap (point `app/page.tsx` at `HomeV4`, retire `_home` + `v3`)
  is the last step, not done yet.
- Scroll-driven product tour: narrative copy in the left column, a persistent
  **mock of the recipe builder** in the sticky right column that animates
  section-by-section as you scroll.

## The core mental model

**The mock is a simplified version of the real recipe builder.** Not an
abstract demo — a usable mini builder:

- A real tab bar (Fermentables · Hops · Mash · Water · Yeast · Fermentation,
  then **Brew sheet** on the right), consistent styling, **clickable**.
- The body is a **bordered content panel connected to the tab bar** (the tab
  bar's bottom border is the panel's top edge), showing the active tab's
  section — like the real builder's active-section box.
- The tour drives the active tab per beat and animates a piece (or a whole
  section) **out** of the mock.

### Pull-out model (the key idea)

Focal content lives in the mock; for a beat it is "pulled out" to a
scene-level layer and grows/lifts while the mock recedes — **without reparenting
any DOM** (that's what crashed v3 with pins). Three flavors now: the radar
(hops) pulls out ONE piece; the brew sheet grows the WHOLE section as a box; the
water section breaks out **per-component** (header recedes, the controls / salts
/ profile lift forward together).

Pulled-out pieces have a measured **home** (their slot in the mock body) and a
target state. Measured via `offsetLeft/Top` chains (transform-independent),
recomputed on `ScrollTrigger.refresh()` + `document.fonts.ready`. Two patterns:
hops/brewsheet animate to a *measured* exploded transform (function-based
values, `invalidate()`d on refresh); water positions a transparent layer over
the body slot (sized 1:1, scale 1) and animates its inner pieces by *relative*
constants (no measured exploded → no invalidate).

### GSAP + React ownership split (avoids the fights)

- **React** owns *which* section/element is visible — `opacity`, keyed on
  `activeTab` (a `useState` in `HomeV4`). With a CSS opacity transition.
- **GSAP** owns the *pull-out motion* — `x/y/scale` + the box's `width/height`.
- They touch different CSS properties on the same node, so they never clobber
  each other, and there's no reparenting. `activeTab` is **not** a `useGSAP`
  dependency (so the timelines don't rebuild on tab change).
- The tour keeps `activeTab` in sync with `onToggle` on each beat's trigger
  (`if (self.isActive) setActiveTab(...)`) — robust to scroll direction.

## The stack

- `gsap` (ScrollTrigger: `pin` + `scrub`; `SplitText` for the tour-copy reveals,
  `mask: "lines"` + `autoSplit: true`), `@gsap/react` `useGSAP`, `lenis`. GSAP is
  fully free (3.13+). Lenis ↔ ScrollTrigger wiring in `lib/scroll.ts` (drive
  `ScrollTrigger.update` off lenis scroll, run lenis off `gsap.ticker`,
  `lagSmoothing(0)`).

## Built so far

**Tour structure (left column):** Intro (hero) → Opening (the chaos) →
Grains (live-builder "watch" beat) → Hops (flavor) → Water (lead exhibit) →
Honest numbers (animated: mash temp leads, FG/ABV follow it with a lag — see
Beats) → Brew sheet. Stages live in `stages/TourSections.tsx`. Below the sticky-mock tour the page
continues full-width with the **post-tour stages** (`stages/PostTourSections.tsx`):
Compare → Library+Community → What-else (trimmed to a framed table-stakes line)
→ Learn → FAQ → Close (price + data ownership). They
fade-up on enter via a single `ScrollTrigger.batch` on `[data-v4-reveal]`
elements (no scrub, no scroll-jack). The left column is **memoized** in `HomeV4`
(`useMemo`) so it does NOT re-render on `activeTab` / `grainFill` / `waterFill` /
`fgShift` / `tempShift` / `honestActive` changes — a perf win (and it historically dodged the pin+React removeChild crash
back when the brew sheet pinned; no beat pins now). The mock defaults to the
**Grain** tab (recipe overview); each beat's `onToggle` drives `activeTab`.

**Mock-tab auto-cycle (hero / opening only):** before the first scroll-driven
trigger fires, the mock cycles `activeTab` through the tab-bar order
(`fermentables → hops → mash → water → yeast → fermentation`, loops, skips
`brewsheet` to not spoil the climax). First switch ~2.1s after mount, then
every ~2.65s — same timings as the live homepage `HeroBuilderCard` auto-rotate.
A single `tourCycling` state gates a `useEffect` (cleanup clears the timer);
the cycle stops when EITHER (a) the user clicks a tab in the mock — every
`onSelectTab` route through `setActiveTabAndStop` which calls `setTourCycling
(false)` — or (b) any stage `ScrollTrigger`'s `onToggle` fires `setActiveTab
AndStop("…")` (same wrapper). So once the reader is actively scrolling, scroll
position is the source of truth and the cycle is done. Reduced-motion users
get a static mock: the effect early-returns on `reducedMotion`, same as the
GSAP work. The cycle uses raw `setActiveTab` internally (functional update
form) so its own ticks don't self-stop.

**The mock sections are all real now** (no placeholders). They mirror the LIVE
homepage mock (`app/_home/components/HeroBuilderCard.tsx`) and the real builder
(`src/modules/hopskip/components/builder/*`) — section-title headers + real
visualizers, NOT invented abstractions (the user rejected two from-scratch
rounds; see memory `feedback-mock-match-real-builder`). In `mock/TabSections.tsx`:
- **Grain** — bill stack + ledger rows (SRM swatch w/ °L, category pill, weight, % bill).
- **Water** — Source→Target pills + an **Auto-Calc** button + **interactive**
  salts (+/- recompute the ion profile) | ion-bar visualizer (per-ion target band
  + fill + value). On its beat the whole section breaks out per-component (see
  Beats); it's rendered scene-level (a transparent breakout layer), NOT in the
  in-body `TabSection`.
- **Mash** — numbered step + temp/time chips + pH gauge (NO temp graph — user didn't want one).
- **Yeast** — strain card (badge + lab + ATTEN/TEMP/FLOCC chips) + a **starter**
  card (liquid strain = 100 B/vial so a starter is shown).
- **Fermentation** — a compact `JourneyTimeline`: date pills + day-proportional
  segmented bar (labels inside, carb stripe on the keg segment) + per-step tiles.
  Step colors = real `stepTypeColor` (primary=honey, diacetyl-rest=roast,
  cold-crash=`#7faec9`), **solid not tinted**.

**Mock chrome** (above the tabs, matches the live builder): title + PaperPill
(STYLE/BATCH) + GhostPill (Profile/Advanced) meta; a compact stat strip
(OG/FG/ABV/IBU/CAL with colored accent top-bars — **SRM is NOT a stat cell**; its
color lives in the Style Guidelines bar below);
and a **STYLE GUIDELINES** panel (`mock/StyleGuidelines.tsx`, a compact mock of
the real `BJCPStyleRail`): OG/FG/ABV/IBU range gauges (marker goes roast when
out of range) + an **SRM color visualizer** (sampled gradient bar, style range
boxed + out-of-range hatched, colored pin).

### Beats

- **Hops (HYBRID — grow plays-once-on-enter, collapse scroll-driven):** the
  radar pull-out is now a showcase that plays ONCE when the beat enters (like the
  grains build); the tuck-back stays SCROLL-driven so it tracks the reader
  leaving toward the brew sheet. Two paused timelines + two triggers:
  - `hopsGrowTl` — a *grow* trigger's `onEnter` `.restart()`s it: a 0.35s LEAD
    (read the bill in the mock), then mock recedes (scale 0.84, slide left) +
    dims while the radar pulls out of its slot to centre (scale 2.6) with a
    lingering filter drop-shadow over the constant offset boxShadow (~0.85s).
  - `hopsCollapseTl` — exploded → home, **offset** (mock leads home, radar tucks
    LAST). Scrubbed **MANUALLY** via `progress(self.progress)` from a SECOND
    (*collapse*) trigger's `onUpdate`. Why manual: a normal scrub tween
    hold-renders its `from` (exploded) whenever scroll is *before* its start,
    which would stomp the grow every frame — a paused timeline driven only inside
    its active range doesn't.

  The grow trigger spans the whole beat (`top 45%`→`bottom 30%`) so `activeTab`
  stays "hops" across the collapse; the collapse trigger is the late window
  (`bottom 78%`→`bottom 38%`). `onLeaveBack` on the grow trigger snaps everything
  back to rest (so a fresh downward approach replays it); the collapse `onUpdate`
  also snaps an in-flight grow done first to avoid a fast-scroll fight. Both
  timelines use `immediateRender:false` (no mount flash) and are `invalidate()`d
  on refresh (they use function-based measured home/exploded). Feel knobs:
  `HOPS_LEAD`/`HOPS_GROW` durations + eases, and the collapse trigger start/end
  (hold length). (Was a single scrubbed timeline, total=1, intro/grow/hold/close
  phases — the user wanted the grow to play once, collapse to stay scroll.)
- **Grains "live math" (animation-driven, play-once-on-enter):** the recipe
  builds ITSELF when the beat enters view. A grains `ScrollTrigger`'s `onEnter`
  `.restart()`s a *paused* timeline that animates a single `grainFill` 0→1
  scalar as a STAIRCASE: quick CLEAR (1→0) → a beat → then the grains are added
  ONE AT A TIME (each a quick `GRAIN_RISE`, then a `GRAIN_HOLD` hesitation). The
  rise targets are `GRAIN_STEP_LEVELS` (exported from TabSections = cumulative
  weight fraction of the bill, e.g. ~0.87 / 0.97 / 1.0), so the base malt makes a
  BIG jump and the specialty malts small bumps — each grain moves the vitals by
  its OWN contribution, not a uniform tick. The stats, BJCP gauges, SRM pin, and
  the grain bill all still interpolate `base→target` off that one scalar; the
  grain `reveal` in FermentablesSection keys off the SAME `GRAIN_STEP_LEVELS`, so
  each grain row appears in lockstep with its number jump. (Was a single linear
  ramp — the user wanted discrete "grain added, numbers update, hesitate,
  repeat".) Plays at a deliberate pace regardless of scroll speed and never
  stalls if the reader pauses (the showcase-beat rule). `onLeaveBack` resets
  `grainFill`→1 + pauses, so a fresh approach from above replays it; scrolling up
  INTO it from hops doesn't (the bill's already full there). All `fromTo`s use
  `immediateRender:false` (no mount flash). Feel knobs: `GRAIN_RISE` /
  `GRAIN_HOLD` + eases, and `start: "top 60%"`. NOTE: the preview harness can't
  script-fire ScrollTriggers (true
  of every beat, not just this one — verified against the hops control), so the
  build motion must be checked by scrolling `/v4` by hand.
- **Brew sheet (play-once-on-enter — NO pin, NO scroll-jack):** on enter the tab
  switches to **Brew sheet** (hops + radar hidden, the mock body drops its
  border), the mock chrome recedes, and a *paused* `bsGrowTl` `.restart()`s. The
  brew sheet is a **self-contained bordered box that GROWS** (NOT a clip-unmask):
  at rest it's the body-sized box showing "what fits" — its own border (incl the
  bottom) is always on, `overflow:hidden` clips the content. The beat animates
  the **box's height** up to the full content, lifts + scales-to-fit-the-viewport,
  and a **"Brew sheet" tab nub** fades in and lifts out above it. The content is
  in a scaled-down (0.82) inner wrapper. The mock is **CSS-sticky**, so the grown
  sheet holds in view while the (now tall, 120vh) brewsheet stage scrolls past —
  no pin needed, and dwell = the stage height (a knob). `onLeaveBack` resets it
  to home. (Was a hard pin + Lenis `scrollTo`/`lock` auto-advance that scrubbed +
  hijacked the scroll for ~2s — replaced per the user's "use the play-in pattern
  here too, instead of scroll-jacking".) Structure: `[data-v4="brewsheet"]`
  (wrapper, `pointer-events:none`) › `bs-nub` + `bs-box` (border +
  `overflow:hidden`, height animated) › `bs-inner` (0.82) › `BrewSheetPanelV4`.
- **Water "solve" (per-component breakout — grow play-once, collapse scroll):**
  the one beat where the section stays INTEGRATED in the mock. The
  `[data-v4="water"]` layer is **transparent** and sized 1:1 over the body slot
  (`measure()` sets its width = slot width, scale 1), so the body's own border
  frames it — NOT a floating card. On enter the mock recedes + dims, the
  **"Water." header recedes** with it, and the three data pieces (`water-controls`
  / `water-salts` / `water-ions`, tagged in `WaterSection`) lift FORWARD together
  (up + a small scale + a drop-shadow for depth) as a cohesive group — they come
  to the forefront; they do NOT blow up huge (not the radar's 2.6×) or scatter /
  spread / drift down (the user tuned this hard). Then the **Auto-Calc button
  "gets pressed"** (squash + spring) and the salts/ion bars SOLVE — `waterFill`
  animates 0→1 (salts count up from blank RO, ion bars climb into their BJCP
  bands, out-of-range roast → in-range ink). It HOLDS broken-out (the big salt +/-
  are **interactive** — the "flex"); the tuck-back is a SCROLL-driven collapse
  like hops (a 2nd trigger scrubs a paused `waterCollapseTl` via `progress()`).
  Pieces animate by **relative constants** (no measured exploded) → no invalidate.
  Feel knobs: per-piece lift `y` / `scale` / `transformOrigin`, `WATER_LEAD`, the
  collapse window. Salts stay solved-to-`SALT_DEFAULTS` during the beat regardless
  of tinkering; Auto-Calc at rest re-solves.

- **Honest numbers (cause→effect demo — loops while in view):** the section copy
  is static, but the mock plays a live mash-temp/FG demo. On enter the tab
  switches to **Mash** (`onToggle`), then a `gsap.delayedCall(0.7)` waits for the
  water recede + tab cross-fade to settle before the demo starts — otherwise the
  chip is already grown on arrival (the bug that motivated the delay). TWO scalars
  so the cause leads the effect: `tempProxy` (→ `tempShift`) sweeps the mash step
  temp; `fgFollow` eases toward it each frame (→ `fgShift`) so **FG + ABV + the
  BJCP gauges LAG the temp** (reads as "turn the temp, the numbers respond", not
  everything-at-once). The timeline loops (`repeat:-1`, `repeatRefresh:true`) with
  HOLD-tween settles, oscillating 152→156→148→… — `repeatRefresh` re-reads each
  tween's start so it flows 156↔148 with no jump and never snaps back to centre;
  FG catches up during each settle. **Only the mash-temp chip grows** (sustained,
  via `honestActive` + a CSS transition) — it's the input being turned; FG/ABV
  stay regular size. (A scale-pop on FG and a cream-scrim dim of the rest were
  both tried and REVERTED as too much — the lead/lag + chip grow carries it.)
  `honestStop` (onLeave/onLeaveBack) kills the delayedCall, pauses the loop, and
  resets temp/FG to centre. Feel knobs: the `0.7` delay, the `* 0.12` lag rate,
  the hold-tween/ramp durations, the chip `scale(1.6)`.

**Tour copy SplitText reveals (parallel to the beats, per-stage play-once):**
the headings + paragraphs in the left column are tagged
`data-v4-split-reveal` with a mode (`words` for short heads — hero `<h1>`, stage
`<h2>` leads; `lines` for paragraphs — subhead, opening sentences, stage
bodies). A single block at the bottom of `HomeV4Tour`'s `useGSAP` (after the
post-tour `[data-v4-reveal]` batch) walks the matched elements and calls
`SplitText.create(el, { type, mask: "lines", autoSplit: true, onSplit })` per
element. `onSplit` is the play-once: words/lines start `yPercent: 110 / opacity:
0` and rise to rest on a `ScrollTrigger { start: "top 88%", once: true }`
(stagger 0.025 words / 0.07 lines, dur 0.7, `power2.out`). A per-element
`revealed` closure flag flips `true` on the trigger's `onEnter`; on a re-split
(font settle / resize) `onSplit` SHORT-CIRCUITS to `gsap.set(tgs, { yPercent: 0,
opacity: 1 })` so a resize past an already-seen section does NOT replay the
rise. Cleanup at the top-level `useGSAP` return calls `s.revert()` on every
instance (SplitText DOM mutations aren't tracked by `gsap.context`). Eyebrows
+ the hero CTA are deliberately NOT split — they're small "labels" that read
naturally without a reveal. CSS: `.v4-split-line { padding-bottom: 0.18em;
margin-bottom: -0.18em }` so descenders ('g', 'y', 'p') clear the line mask on
the tight-leading display heads (lineHeight 0.96 on the hero). Reduced-motion
users skip everything via the existing early-return — copy stays at natural
opacity 1. Signed-in `HomeV4SignedIn` doesn't render the tour, so no targets,
no work. Mobile: works as-is — the reveal trigger fires on copy that's clear
of the pinned mock band, so words rise in the readable area, then scroll up
into the mock zone and get masked normally.

**Tried and REVERTED — do not re-tread:** a 3-tier hops explosion (mock recedes
→ hop SECTION grows out as a scene-level panel → radar grows out of the panel,
nested + transform-composed so its final scene position matched the 2-tier).
Worked technically but read as a card-within-a-card at rest and wasn't worth the
polish. Reverted to the 2-tier hops beat.

## Mobile tour (≤1024px) — the separate fork

The desktop two-column tour is gated to `min-width:1025px`. Everything below is a
**second `mm.add("(max-width:1024px)")` branch** in `HomeV4Tour` (+ a big block of
mobile CSS in HomeV4's `<style>`). On mobile the mock is NOT side-by-side — it's
**pinned near the top of the viewport and the narrative scrolls UNDER it**,
dissolving out through a masking band. The user iterated on this HARD; the notes
below are the landed design (knobs called out).

### Layout

- `tourText` (memoized) is split into THREE column blocks: `.v4-hero-col` (hero),
  `.v4-intro-col` (the opening/"chaos"), `.v4-narr-col` (grains → brew sheet).
  Desktop: hero row 1 / opening row 2 / narrative row 3, all in column 1; the mock
  column spans all three rows (the original two-column tour, unchanged). **Mobile:
  single column; the mock shares ROW 3 (grains onward) with the narrative,
  overlapping it** — so the mock spawns + sticks only AFTER the hero + opening,
  not from the very top (a deliberate "read the problem, then the builder appears"
  reveal). `.v4-narr-col section:first-child` (grains) gets a big top pad so the
  mock spawns in the gap between the opening and grains, not on top of the copy.
- **Render-wide-then-scale:** the mock renders at a FIXED design width
  (`--v4-mock-design-w: 520px`, wide enough that the 7-tab bar fits) and is scaled
  down by `--v4-mock-scale` (~0.37, the size knob) via `transform` on
  `.v4-mock-scale`, centered (`left: calc((100% − design-w)/2)`,
  `transform-origin: top center`). The negative `margin-bottom`
  (`natural-h × (scale − 1)`, with `natural-h` JS-measured into
  `--v4-mock-natural-h` by a ResizeObserver) reclaims the freed layout height.
  Rendering at the narrow column width instead made the tabs overflow — that was
  the bug. The body is pinned to a **constant height**
  (`[data-v4="mock-body"] { height: 200px }`) so the mock — and the band sized
  from it — doesn't jump as the active tab's content height changes.
- **The masking band** (`.v4-mock-band`, a div before `.v4-mock-scale` in
  `.v4-sticky-mock`): a full-PAGE-width (`100vw`), page-colored (`cream`) chunk
  behind the mock card whose `mask-image` is a SINGLE vertical opacity gradient
  (`linear-gradient(to bottom, #000 0%, #000 32%, transparent 100%)`) — solid at
  the top, slowly fading to nothing on the way down. So narrative scrolling UP
  dissolves gently as it nears the top; it is NOT a feathered card edge (the user
  rejected several feather/blur takes — it's one opacity-gradient chunk). The mock
  card's own opaque fill masks directly behind it; the band covers the full width
  + above. `.v4-intro-col { z-index: 5 }` keeps the opening ABOVE the band (which
  extends upward) so the band never paints over it on spawn.
- The **water layer is clipped** on mobile (`[data-v4="water"] { overflow:
  hidden }`) — it's scene-level so the body's own overflow doesn't catch it, and
  it would otherwise bleed below the card.
- The mock sticks at `top: 40px` (a little gap from the top). It clears the header
  on its own (centered/high enough), so the header-peek offset that desktop-mobile
  used was dropped — see Chrome below.

### Beats (the `mm.add("(max-width:1024px)")` branch)

- `place()` parks every scene-level layer (radar / water / brew sheet) at its
  body-slot "home" (same technique as `SignedInHeroV4`) AND measures the "grown"
  targets: radar centred (scale 2.6), brew-sheet full height (`bsFullH`) + lift
  (`bsExploded.y`, **negative** so it rises past the scene top), and publishes the
  lifted on-screen bottom to `--v4-bs-grown-h` (so the brew-sheet copy can clear
  it). Re-runs on `refreshInit`.
- **Tab-switch on scroll:** per-stage `ScrollTrigger`s, `onToggle → setActiveTab`,
  so the mock morphs grain bill → hops → water → mash → brew sheet.
- **Fill beats** (reused from desktop, no pull-outs, drive the same scalars):
  grains STAIRCASE build, water SOLVE, honest-numbers loop.
- **Reveal beats** (the "grows" — adapted, since the mock can't recede sideways
  like desktop except on the brew sheet):
  - **Hops radar** grows out of its slot to centre (scale 2.6) + drop-shadow while
    the rest of the mock dims (`.v4-dim → 0.4`). Play-once on enter, reset on leave.
  - **Water** grows out PER-COMPONENT like desktop: the "Water." header recedes,
    the controls/salts/ions lift forward as a group (`y` up + `scale 1.13` +
    drop-shadow), `.v4-dim` dims, then Auto-Calc "press" + the solve. The water
    clip is **lifted on enter** (`overflow: visible`, so the pieces can rise out)
    and restored on reset. Knob: `WLIFT` (how far they rise — they go UP over the
    chrome since the mock can't recede).
  - **Brew sheet** DISCONNECTS + rises: the mock fades (`opacity 0.32`) AND slides
    left (`xPercent: -12`), the brew-sheet layer lifts up (`y → bsExploded.y`,
    above the scene top) + the box grows to full height + the tab nub fades in.
    Its copy (`.v4-narr-col section:last-child`) is padded clear via
    `--v4-bs-grown-h`. Knobs: `bsExploded.y` (lift height), the fade depth, the
    copy gap.
- All reveal timelines use `immediateRender:false` + are `invalidate()`d on
  refresh (function-based measured targets), same as desktop.

### Chrome changes (global, `HSHeader` / `HSFooter` / `index.css`)

- **`HSHeader`** — compact single row on ≤720px (logo-only brand via
  `.hs-brandmark-word { display:none }`, nav scrolls horizontally, no two-row
  stack; `.hs-header-right { flex-wrap: nowrap }` so the Sign-in button can't wrap
  to a second line). **Collapse-on-scroll** ≤1024px: publishes its height to
  `--hs-header-peek` (0 when hidden). On the homepage only (`tourHeader =
  pathname === "/v4"` — UPDATE THIS to include `/` after the production swap) it
  shows ONLY near the top, because a mid-page scroll-up reveal was shoving the
  pinned mock around; **every other page keeps hide-on-down / reveal-on-up**.
- **`HSFooter`** — was the cause of the site-wide horizontal scroll: its
  `grid-template-columns` (`minmax(260px, …)`) was set INLINE, so the responsive
  media queries (lower specificity than inline) never collapsed it on narrow
  screens. Fix: moved the base columns into the footer's `<style>` block so the
  queries win.
- **`src/index.css`** — `html, body { overflow-x: clip }` as a belt-and-suspenders
  site-wide horizontal-scroll guard (`clip`, NOT `hidden`, to keep `sticky`
  working on descendants).

### Mobile gotchas

- Mock height MUST stay constant across tabs (fixed body height) or the band —
  sized from `--v4-mock-natural-h` — jumps on every tab change.
- Scene-level layers (radar/water/brew sheet) don't sit in the body's overflow, so
  on mobile they each need explicit containment (water clip; brew sheet box height).
- The beats only fire on REAL scroll — the preview harness can't script-fire
  ScrollTriggers, so the mobile tour must be verified by scrolling a phone by hand.

## Make-or-break, validated

- CSS-`sticky` mock holds across the whole tour. **No beat PINS anymore** — the
  brew sheet was the last pin and is now play-once-on-enter — so the pin+React
  `removeChild` crash class is moot. (The validated learning that a sticky mock +
  a GSAP-pinned sibling text column CAN coexist is kept here in case a pin ever
  returns.)
- Driver: per-section ScrollTriggers + `onToggle` for `activeTab`. Mix of modes:
  grains + hops-grow + water-grow + brewsheet are play-once paused timelines
  (`onEnter` `.restart()`); hops-collapse + water-collapse are paused timelines
  scrubbed manually (`onUpdate` → `progress()`). Nothing scrubs a *linked*
  timeline or pins now. (A single master scrubbed timeline remains an option if
  continuity gets fiddly.)

## Key files (`app/v4/`)

- `HomeV4.tsx` — the auth brancher (`HomeV4` → `HomeV4Tour` | `HomeV4SignedIn`)
  PLUS the tour's client shell + ALL GSAP setup (in `HomeV4Tour`): `measure()`
  (home/exploded per element + sizes the water layer to the body slot), the hops +
  grains + water + **honest** + brewsheet triggers, Lenis, `activeTab` +
  `grainFill` + `waterFill` + `fgShift` + `tempShift` + `honestActive` state, the
  `ScrollCue` (fixed bouncing chevron, bottom of viewport, GSAP-faded over the
  first scroll; null for reduced-motion), the **memoized left column**, layout
  (overflow:clip, sticky grid). ALSO holds the **mobile `mm.add("(max-width:
  1024px)")` branch** (`place()` + tab-switch + fill + reveal beats) and the big
  mobile `<style>` block — see "Mobile tour (≤1024px)". The file you tune.
- `mock/V4Mock.tsx` — the scene: mock card + chrome (`MockHeader`, `MockStats`
  w/ accent bars [OG/FG/ABV/IBU/CAL — no SRM cell], `StyleGuidelines`,
  `MockTabBar`), bordered body, `section-hops` + radar-slot, `section-water` +
  `water-slot`, the `TabSection` layer for the other tabs, the scene-level explode
  layer (radar), the **transparent `[data-v4="water"]` breakout layer**
  (pointer-events auto when active, holds `WaterSection`), and the brew sheet
  group. Takes `grainFill` + `waterFill` + `fgShift`/`tempShift`/`honestActive`
  (honest beat) + optional `data?: V4MockData` (the signed-in mock — renders a real
  recipe instead of the sample) + optional `openHref` (chrome's right pill
  becomes a Next `<Link>` "Open recipe →" + the back-link becomes a real link
  to `/recipes`; tour leaves it undefined → decorative "Save recipe →" stays);
  `waterActive`/`brewsheetActive` drop the body border so the breakout/box
  frames itself. **Body has a fixed `height: 240`** (was `minHeight: 176` — see
  the gotcha below for why the fix), so every tab renders into a consistent
  area regardless of which recipe is loaded; the mobile branch's
  `height: 200px !important` rule still wins on small screens. Every section
  (`section-hops` / `section-water` / `section-other`) is `position: absolute,
  inset: 0` so the body's height is the source of truth, not the in-flow
  content of any one section. **Section internals scroll on overflow:**
  `section-hops` is a flex column with a flex:1 row holding a scrollable
  bill (overflowY:auto + minHeight:0) on the left and the fixed 112×112
  radar slot on the right — so recipes with many hops scroll the bill
  without the slot moving (the scene-level radar overlays the slot).
  `FermentablesSection`'s ledger rows container has the same
  overflowY:auto + minHeight:0 pair so long grain bills scroll while the
  SectionHead + bill-stack stay pinned at the top of the section. Mash /
  Yeast / Fermentation are fixed-layout (single step / strain / timeline
  bar) and don't need a scroll.
- `mock/TabSections.tsx` — real at-rest content for Grain / Mash / Yeast /
  Fermentation in the in-body `TabSection`; **`WaterSection` is exported** and
  rendered by V4Mock's breakout layer (NOT in `TabSection`), with its pieces
  tagged `water-header` / `water-controls` / `water-salts` / `water-ions` + a
  `water-autocalc` button. Also exports `GRAIN_STEP_LEVELS` (grains staircase).
  Every section takes an optional `data` (real recipe; defaults to the hardcoded
  sample so the tour is unchanged). `FermentablesSection` takes `grainFill`;
  `MashSection` takes `tempShift` (honest sweep) + `honestActive` (chip grow);
  `WaterSection` takes `waterFill` (the solve) and stays interactive (salts +/-).
- `mock/StyleGuidelines.tsx` — compact mock of `BJCPStyleRail`: OG/FG/ABV/IBU
  gauges + SRM gradient visualizer. Takes `grainFill` (gauges/pin interpolate),
  `fgShift` (FG/ABV gauges follow the honest beat), + optional `data` (real ranges
  via `getBjcpStyleSpec`).
- `mock/BrewSheetPanelV4.tsx` — brew sheet content (`framed` prop; optional `data`
  for a real recipe, which drops the scripted pre-boil-miss section).
- `mock/HopFlavorRadar.tsx` — pure SVG radar, lifted from v3.
- `lib/scroll.ts` — `useLenis` (Lenis + ScrollTrigger wiring + teardown).
- `lib/mapRecipeToV4Mock.ts` — maps a real `Recipe` → `V4MockData` for the
  signed-in mock (reuses `recipeCalculationService`, `waterChemistryService`,
  `getBjcpStyleSpec`).
- `SignedInHeroV4.tsx` — the signed-in hero: recent-recipes list + a STATIC v4
  mock of the selected recipe. Runs a small `useGSAP` that positions the
  scene-level layers (radar / water / brew sheet) at their rest "home" (the
  rest half of the tour's `measure()`) so every tab renders right without the tour.
- `lib/useReducedMotion.ts`, `stages/TourSections.tsx` (left-column stages:
  Intro / Opening / Grains / Hops / Water / HonestNumbers / BrewSheet).
- `stages/PostTourSections.tsx` — below-tour stages (Compare / LibraryCommunity /
  WhatElse / Learn / FAQ / Close), full-width, no mock. Reveal-tagged with
  `[data-v4-reveal]` — the HomeV4 batch picks them up. (Used by both the signed-out
  tour and `HomeV4SignedIn`.)
- `page.tsx` / `data.ts` — server fetch + copy. `page.tsx` ALSO emits a
  schema.org FAQPage JSON-LD `<script>` generated from `STAGES.faq.items`
  (inlined into initial HTML for SEO).

**Reference for the section/chrome look** (read these when touching the mock):
`app/_home/components/HeroBuilderCard.tsx` (live mock) and the real builder
`src/modules/hopskip/components/{HSStatCard,BJCPRangeRow,BJCPStyleRail}.tsx` +
`.../components/builder/{WaterSection,FermentationSection,…}.tsx`.

## Gotchas / patterns

- Root uses `overflow: clip` on BOTH axes (NOT `hidden`, which breaks `sticky`
  on descendants).
- Measure with `offsetLeft/Top` (ignores transforms), not
  `getBoundingClientRect`; recompute on refresh.
- React `opacity` (visibility) vs GSAP `transform` (motion): never both on the
  same property of the same node.
- Paused timelines that target measured (function-based) values must
  `immediateRender:false` on every `fromTo` (else they apply a `from` on mount —
  a flash) and be `invalidate()`d on `refreshInit` (else they reuse stale
  measurements after a resize). This is the play-once pattern used by every beat.
  (Water is the exception: its piece transforms are *relative constants*, so no
  invalidate — but it still needs `immediateRender:false`.)
- **Scene-level layer sized to a slot imperatively:** the water breakout layer
  must match the (dynamic) body width. Set `el.style.width` in `measure()` and do
  NOT put `width` in the React `style` prop — else React resets it on every
  re-render (e.g. each `waterFill` tick). `useGSAP` runs in a layout effect, so
  `measure()` sizes it before first paint (no flash).
- Tabs were shrunk to fit the mock width (7 tabs overflowed the right edge).
- Screenshots of programmatic/scripted scroll are unreliable in the preview
  harness (blank frames); verify by measuring the live DOM.
- **GSAP/ScrollTrigger changes need a HARD RELOAD to test** — HMR/Fast-Refresh
  leaves stale ScrollTrigger state. Edit a timeline/trigger/`measure()` → reload,
  don't trust HMR.
- **GSAP trims a LEADING empty gap** from a timeline's duration. To reserve real
  scroll time before the first tween (e.g. the hops "intro"), add an explicit
  empty spacer tween: `.to({}, { duration: INTRO }, 0)`.
- **Measured positions need the `document.fonts.ready` `ScrollTrigger.refresh()`
  to settle** (custom fonts shift layout after first paint). On a freshly
  *restarted* dev server, scripted scrolling right after a cold load can race the
  settle — a resize (or a human waiting a beat) triggers the refresh and fixes it;
  normal page loads are fine. When automating, resize once to force a refresh first.
- **Pin + React removeChild crash.** Re-rendering React siblings of a
  GSAP-pinned node throws `removeChild`/`insertBefore` (the pin-spacer is a DOM
  node React doesn't know about). Fix: keep the pinned column structurally static
  — `useMemo` the left column so `activeTab`/`grainFill` changes don't reconcile
  it. Same class of bug that killed v3.
- **The brew-sheet group is `pointer-events: none`.** Its invisible (opacity 0)
  box + tab nub otherwise overlay the tab bar + body and intercept real clicks
  (the "Grain tab has a tiny clickable area / water +/- don't register" bug).
  `element.click()` bypasses hit-testing, so verify clickability with
  `document.elementFromPoint`, not programmatic clicks. (The water breakout layer
  is the opposite — pointer-events AUTO so the big salt +/- work — but only when
  `waterActive`; otherwise opacity 0 + pointer-events none so it doesn't intercept
  the other tabs.)
- **Dev console buffer keeps HMR-transient errors across reloads** ("GhostPill
  is not defined", "leftColumn is not defined", removeChild) — usually from the
  broken instant between two sequential edits. For a clean read, RESTART the
  server (fresh buffer) and check on a cold load; zero errors there = code is fine.
- **Mock body needs a FIXED height, not minHeight.** The `TabSections` are
  designed for a ~228px-tall body slot. Earlier the body used `minHeight: 176`
  + `section-hops` was the only in-flow section, so the body's height was
  driven by the hop bill's row count. The tour didn't notice because the
  sample data is fixed; but the signed-in mock (a per-recipe `data` prop)
  showed it loud: pick a recipe with fewer hops → the table is shorter →
  the body shrinks → every other section (which sizes to the body via
  `inset: 0`) appears smaller too. Fix: `mock-body` is now `height: 240`
  (fixed), and `section-hops` is `position: absolute, inset: 0` like the
  other sections — the body is the source of truth, no section drives it.
  Mobile's `height: 200px !important` already worked this way; this brings
  desktop in line. Long content (many hops / grains in the signed-in mock)
  scrolls inside the section — see the V4Mock entry in "Key files" for the
  per-section overflow setup (flex:1 row + minHeight:0 + overflowY:auto on
  just the list area, keeping the SectionHead pinned).
- **SplitText + autoSplit needs a `revealed` flag to survive scroll-past
  resizes.** `autoSplit: true` re-splits on resize / font load. The naïve
  `onSplit → return gsap.from(...)` pattern then re-fires the rise every
  re-split — so a user who scrolls past the hero, resizes the window, sees the
  hero "rise" again. Fix: a per-element `let revealed = false` closure outside
  `onSplit`, flipped on the trigger's `onEnter`; on subsequent splits when
  `revealed === true`, short-circuit to `gsap.set(tgs, { yPercent: 0, opacity:
  1 })` instead of returning an animation. Also: SplitText's DOM mutations
  aren't tracked by `useGSAP`'s `gsap.context`, so collect instances and
  `s.revert()` them in a top-level `useGSAP` cleanup return — otherwise the
  wrapper spans leak on dependency change / unmount.

## Remaining / trajectory

**2026-06 repositioning + copy overhaul:** the page was rewritten around the
"one connected recipe, not a pile of calculators" spine. New hero (idea → glass),
a new Honest-numbers beat, flavor reframed to a timing-aware estimate (no BJCP
flavor overlay), water as the lead exhibit, and the post-tour split into Compare +
Library+Community + a trimmed What-else + a price/data Close. It also added the
animated **Honest-numbers beat** (mash temp leads, FG/ABV follow with a lag — see
Beats), a fixed bottom-of-viewport **scroll-cue chevron** (`ScrollCue` in
`HomeV4`, GSAP-faded over the first ~200px), and **removed the live SRM stat
cell** (its color is in the Style Guidelines bar). Other beat mechanics are
unchanged. Blueprint: `~/.claude/plans/yeah-i-mean-check-async-lamport.md`;
positioning + copy voice rules in memory (`project-homepage-v4-positioning`,
`feedback-copy-authenticity`).

**Auth-aware page + data-driven mock (2026-06):** `HomeV4` now branches on auth.
Signed-out (and SSR/first paint, for SEO) get the hardcoded marketing tour
(`HomeV4Tour`). Signed-in users get `HomeV4SignedIn`: a personalized hero
(`SignedInHeroV4` — their recent recipes list + the v4 mock showing the selected
recipe) + Library/Community + Learn + FAQ (no tour). The **mock is now
data-driven**: `V4Mock` (+ every section, `StyleGuidelines`, `BrewSheetPanelV4`)
takes an optional `data?: V4MockData`; when absent it renders the hardcoded sample
(so the TOUR is byte-for-byte unchanged), when present it renders the recipe.
Mapper: `app/v4/lib/mapRecipeToV4Mock.ts` (reuses `recipeCalculationService`,
`waterChemistryService.calculateFinalProfileFromTotalSalts`, and
`getBjcpStyleSpec` for gauge ranges; brew sheet drops the scripted pre-boil miss).
The signed-in mock is STATIC (no beats); `SignedInHeroV4` runs a small `useGSAP`
that positions the scene-level layers (radar / water / brew sheet) at their rest
"home" (the rest-state half of the tour's `measure()`) so every tab renders right
without the tour. User recipes never flow through the tour beats (they stay
hardcoded). The old `_home` `HeroBuilderCard` + `mapRecipeToMock` are no longer
used by v4.

**Signed-in recipe-open (mirrors the live homepage):** the `SignedInHeroV4`
recent-recipes list is a two-stage affordance — a non-active row click just
*selects* (drives the right-side mock); the **already-active** row click is the
"Open" — `router.push("/recipes/{id}")`. The active row carries an "Open →"
hops-color pill so the action is visible, plus an `aria-label` that swaps
between "Select …" and "Open … in the builder". And the **mock chrome itself**
gets a real link: `V4Mock` accepts an optional `openHref` that turns the
decorative "Save recipe →" pill into a Next `<Link>` "Open recipe →" + makes
"← Back to recipes" a real link to `/recipes`. The tour passes no `openHref`,
so the chrome stays decorative there. Same pattern as `_home/SectionHero`'s
`RecipeListCard` + `HeroBuilderCard`.

Recent work: real content for all tab sections (matching the live mock + real
builder), the colorized stat strip + STYLE GUIDELINES panel + SRM visualizer, and
a sweep that moved the showy beats onto the **play-once-on-enter** pattern (no
more scroll-scrubbing or scroll-jacking): **grains** = STEPPED staircase (grain
drops in → vitals jump → hesitate → repeat), **hops** = HYBRID (grow once +
scroll-collapse), **brew sheet** = grow in on enter (pin + Lenis auto-advance
removed), and a new **Water** stage + beat — the section breaks out
**per-component** (header recedes; controls/salts/profile lift forward together)
with an **Auto-Calc press → solve**, staying interactive (the "flex"). There are
now ZERO pins on the page.

Then the **post-tour sections** were ported from v3 (`stages/PostTourSections.tsx`):
Community/Compare (with a 3-col grid of up to 6 recent recipe cards from the
publicRecipeIndex — SRM stripe + name + style + by/forks + tags + ABV/IBU/OG/FG
mini-stats, each linking to `/r/{shareSlug}`; reuses HSCard + HSCardLift),
What-else (categorized 3-column feature roster — Recipe / Brew day / Calculators
with ~5-7 items each, accent rails per category mirroring the builder palette),
Learn (HSScriptNote kicker + 2 CTAs), FAQ (accordion, 8 items) + **FAQPage
JSON-LD** in `page.tsx` (server-rendered), Final CTA (HSButton + secondary links).
The **BrewedAgain** stage was folded into the brew sheet stage — the brew sheet
is what produces each saved version, so the "every brew saves as a version"
beat lives there as the closer. Brew sheet copy was heavily condensed
(5 paragraphs → 3) at the same time. Reveal motion is a single
`ScrollTrigger.batch` over `[data-v4-reveal]` blocks — opacity 0→1, y 16→0,
~0.7s, stagger 0.06, play-once-on-enter (no scrub). Reduced-motion users skip the
batch entirely (the `useGSAP` block early-returns), so elements stay at natural
opacity 1.

Most recent (2026-06): the **mobile fork** (≤1024px) — pinned-mock + masking-band
single-column tour with tab-switch + all fill + reveal beats, a compact collapsing
site header, and the footer horizontal-scroll fix. Full writeup in "Mobile tour
(≤1024px)" above.

**SplitText tour-copy reveals (2026-06):** every tour stage's lead `<h2>` and
body `<p>` (plus the hero `<h1>` + subhead + opening sentences) now rises into
place on scroll-enter — words for heads (stagger 0.025), lines for paragraphs
(stagger 0.07), play-once. Full mechanics + the autoSplit `revealed`-flag
pattern in "Tour copy SplitText reveals" above + the gotcha note.

See the Beats notes above. Open items:

- **Responsive — DONE** (see "Mobile tour (≤1024px)" above): the full mobile fork
  is built — pinned mock + masking band, single-column tab-switch tour, all fill
  beats + the radar/water/brew-sheet reveals, compact collapsing header, footer
  horizontal-scroll fix. Still open underneath it:
  - **Reduced-motion** fork — currently the whole `useGSAP` early-returns on
    reduced motion, so a reduced-motion phone gets the mock STATIC on the Grain
    tab (no beats). Verify that reads acceptably / give it a sensible static state.
  - Small-phone / tablet (721–1024px) edge passes — the mobile knobs
    (`--v4-mock-scale`, body height, band gradient, lift amounts) were tuned on a
    normal phone.
- **Optional polish:** a hero/opening trigger so the mock resets to the Grain tab
  at the very top (it currently holds the last tab if you jump straight up past
  grains; a normal scroll-up resets via the grains trigger).
- **Production swap:** `app/page.tsx` → `HomeV4`; retire `app/_home` + `app/v3`.
  Also update `HSHeader`'s `tourHeader` check (currently `=== "/v4"`) to include
  `/`, and the header collapse + mobile band assume the homepage route.
