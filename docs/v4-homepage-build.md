# v4 Homepage — GSAP Pinned Tour (current build)

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
scene-level **explode layer** and grows/explodes while the mock recedes —
**without reparenting any DOM** (that's what crashed v3 with pins). The radar
(hops) pulls out one piece; the brew sheet pulls out the whole section.

Each pulled-out element has a measured **home** (its slot in the mock body)
and **exploded** (big/centred) state. Measured via `offsetLeft/Top` chains
(transform-independent), recomputed on `ScrollTrigger.refresh()`
(`invalidateOnRefresh: true` + `document.fonts.ready`).

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

- `gsap` (ScrollTrigger: `pin` + `scrub`), `@gsap/react` `useGSAP`, `lenis`.
  GSAP is fully free (3.13+). Lenis ↔ ScrollTrigger wiring in `lib/scroll.ts`
  (drive `ScrollTrigger.update` off lenis scroll, run lenis off `gsap.ticker`,
  `lagSmoothing(0)`).

## Built so far

**Tour structure (left column):** Intro (hero) → Opening ("I made this…") →
Grains (live-math beat) → Hops → Brew sheet. Stages live in
`stages/TourSections.tsx`. The left column is **memoized** in `HomeV4`
(`useMemo`) so it does NOT re-render on `activeTab`/`grainFill` changes —
critical because the brew-sheet stage is GSAP-pinned (see Gotchas: the pin+React
removeChild crash). The mock defaults to the **Grain** tab (recipe overview);
each beat's `onToggle` drives `activeTab`.

**The mock sections are all real now** (no placeholders). They mirror the LIVE
homepage mock (`app/_home/components/HeroBuilderCard.tsx`) and the real builder
(`src/modules/hopskip/components/builder/*`) — section-title headers + real
visualizers, NOT invented abstractions (the user rejected two from-scratch
rounds; see memory `feedback-mock-match-real-builder`). In `mock/TabSections.tsx`:
- **Grain** — bill stack + ledger rows (SRM swatch w/ °L, category pill, weight, % bill).
- **Water** — Source→Target pills + **interactive** salts (+/- recompute the ion
  profile) | ion-bar visualizer (per-ion target band + fill + value).
- **Mash** — numbered step + temp/time chips + pH gauge (NO temp graph — user didn't want one).
- **Yeast** — strain card (badge + lab + ATTEN/TEMP/FLOCC chips) + a **starter**
  card (liquid strain = 100 B/vial so a starter is shown).
- **Fermentation** — a compact `JourneyTimeline`: date pills + day-proportional
  segmented bar (labels inside, carb stripe on the keg segment) + per-step tiles.
  Step colors = real `stepTypeColor` (primary=honey, diacetyl-rest=roast,
  cold-crash=`#7faec9`), **solid not tinted**.

**Mock chrome** (above the tabs, matches the live builder): title + PaperPill
(STYLE/BATCH) + GhostPill (Profile/Advanced) meta; a compact stat strip
(OG/FG/ABV/IBU/CAL with colored accent top-bars + a **beer-glass SRM** cell);
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

**Tried and REVERTED — do not re-tread:** a 3-tier hops explosion (mock recedes
→ hop SECTION grows out as a scene-level panel → radar grows out of the panel,
nested + transform-composed so its final scene position matched the 2-tier).
Worked technically but read as a card-within-a-card at rest and wasn't worth the
polish. Reverted to the 2-tier hops beat.

## Make-or-break, validated

- CSS-`sticky` mock holds across the whole tour. **No beat PINS anymore** — the
  brew sheet was the last pin and is now play-once-on-enter — so the pin+React
  `removeChild` crash class is moot. (The validated learning that a sticky mock +
  a GSAP-pinned sibling text column CAN coexist is kept here in case a pin ever
  returns.)
- Driver: per-section ScrollTriggers + `onToggle` for `activeTab`. Mix of modes:
  grains + hops-grow + brewsheet are play-once paused timelines (`onEnter`
  `.restart()`); hops-collapse is a paused timeline scrubbed manually (`onUpdate`
  → `progress()`). Nothing scrubs a *linked* timeline or pins now. (A single
  master scrubbed timeline remains an option if continuity gets fiddly.)

## Key files (`app/v4/`)

- `HomeV4.tsx` — client shell + ALL GSAP setup: `measure()` (home/exploded per
  element), the hops + grains + brewsheet triggers, Lenis, `activeTab` +
  `grainFill` state, the **memoized left column**, layout (overflow:clip, sticky
  grid). The file you tune.
- `mock/V4Mock.tsx` — the scene: mock card + chrome (`MockHeader` w/
  PaperPill/GhostPill, `MockStats` w/ accent bars + `BeerGlass`, `StyleGuidelines`,
  `MockTabBar`), bordered body, `section-hops`, the `TabSection` layer for the
  other tabs, the scene-level explode layer (radar), the brew sheet group. Takes
  `grainFill` and threads it to MockStats / StyleGuidelines / TabSection.
- `mock/TabSections.tsx` — real at-rest content for Grain / Mash / Water / Yeast /
  Fermentation (mirrors the live mock + real builder). `FermentablesSection`
  takes `grainFill` (grain reveal); Water salts are interactive.
- `mock/StyleGuidelines.tsx` — compact mock of `BJCPStyleRail`: OG/FG/ABV/IBU
  gauges + SRM gradient visualizer. Takes `grainFill` (gauges/pin interpolate).
- `mock/BrewSheetPanelV4.tsx` — framer-stripped brew sheet content (`framed` prop).
- `mock/HopFlavorRadar.tsx` — pure SVG radar, lifted from v3.
- `lib/scroll.ts` — `useLenis` (Lenis + ScrollTrigger wiring + teardown).
- `lib/useReducedMotion.ts`, `stages/TourSections.tsx` (left-column stages:
  Intro / Opening / Grains / Hops / BrewSheet).
- `page.tsx` / `data.ts` — server fetch + copy, ported from v3.

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
- Tabs were shrunk to fit the mock width (7 tabs overflowed the right edge).
- Screenshots of programmatic/scripted scroll are unreliable in the preview
  harness (blank frames); verify by measuring the live DOM.
- **GSAP/ScrollTrigger changes need a HARD RELOAD to test** — HMR/Fast-Refresh
  leaves stale ScrollTrigger state. Edit a timeline/trigger/`measure()` → reload,
  don't trust HMR.
- **GSAP trims a LEADING empty gap** from a timeline's duration. To reserve real
  scroll time before the first tween (e.g. the hops "intro"), add an explicit
  empty spacer tween: `.to({}, { duration: INTRO }, 0)`.
- **Pins need the `document.fonts.ready` `ScrollTrigger.refresh()` to settle.**
  On a freshly *restarted* dev server, scripted scrolling right after a cold load
  can race the settle — symptoms: `pinSpacerCount === 0`, scrub not applying. A
  resize (or a human waiting a beat) triggers the refresh and fixes it; normal
  page loads are fine. When automating, resize once to force a refresh first.
- **Pin + React removeChild crash.** Re-rendering React siblings of a
  GSAP-pinned node throws `removeChild`/`insertBefore` (the pin-spacer is a DOM
  node React doesn't know about). Fix: keep the pinned column structurally static
  — `useMemo` the left column so `activeTab`/`grainFill` changes don't reconcile
  it. Same class of bug that killed v3.
- **The brew-sheet group is `pointer-events: none`.** Its invisible (opacity 0)
  box + tab nub otherwise overlay the tab bar + body and intercept real clicks
  (the "Grain tab has a tiny clickable area / water +/- don't register" bug).
  `element.click()` bypasses hit-testing, so verify clickability with
  `document.elementFromPoint`, not programmatic clicks.
- **Dev console buffer keeps HMR-transient errors across reloads** ("GhostPill
  is not defined", "leftColumn is not defined", removeChild) — usually from the
  broken instant between two sequential edits. For a clean read, RESTART the
  server (fresh buffer) and check on a cold load; zero errors there = code is fine.

## Remaining / trajectory

Recent work: real content for all 5 tab sections (matching the live mock + real
builder), the colorized stat strip + STYLE GUIDELINES panel + SRM visualizer,
the Opening + Grains tour stages (default Grain tab), and a sweep that moved the
showy beats onto the play-once-on-enter pattern (no more scroll-scrubbing or
scroll-jacking): the **grains** build is now a STEPPED staircase (grain drops in
→ vitals jump → hesitate → repeat), the **hops** beat is a HYBRID (grow plays in
on enter, collapse stays scroll-driven), and the **brew sheet** plays in on enter
(pin + Lenis auto-advance removed — there are now ZERO pins on the page). See the
Beats notes above. Open items:

- **Remaining tour sections** below the main tour (Brewed-again,
  Community/Compare, What-else, Learn, FAQ + JSON-LD, Final CTA): port from v3
  with simpler in-view reveals.
- **Water beat** (cinematic pin) + the **interactive "flex"** at its settled pin.
  (The water salts are already interactive at rest; the pinned beat is the rest.)
- **SplitText** text reveals per section ("introduce → show off", play-once).
- **Responsive** (`gsap.matchMedia()` mobile stacked fork) + **reduced-motion**
  fork (skeleton present: desktop gated to `min-width:1025px`, reduced-motion
  early-returns).
- **Optional polish:** a hero/opening trigger so the mock resets to the Grain tab
  at the very top (it currently holds the last tab if you jump straight up past
  grains; a normal scroll-up resets via the grains trigger).
- **Production swap:** `app/page.tsx` → `HomeV4`; retire `app/_home` + `app/v3`.
