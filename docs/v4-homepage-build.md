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

## Beats built so far

- **Hops (scrub, no pin):** the whole mock card recedes (scale ~0.84, slide
  left) + dims; the radar (HopVisualizer) pulls out of its body slot and grows
  toward centre (its scale is bumped to stay large against the receding card),
  with a lingering soft drop-shadow via `filter` *over* the constant offset
  `boxShadow` (both shadows, no swap). The close is **offset** — the mock
  returns before the radar tucks back in.
- **Brew sheet (hard-pin):** the text column GSAP-pins; the mock is CSS-sticky
  (no fighting pins). On enter the tab switches to **Brew sheet** (hops + radar
  hidden, the mock body drops its border) and the mock chrome recedes. The brew
  sheet is a **self-contained bordered box that GROWS** (NOT a clip-unmask): at
  rest it's the body-sized box showing "what fits" — its own border (incl the
  bottom) is always on, `overflow:hidden` clips the content. The beat animates
  the **box's height** up to the full content (a real box getting bigger),
  lifts + scales-to-fit-the-viewport, and a **"Brew sheet" tab nub** fades in
  and lifts out above it (reads as pulling the tab + section out). The content
  is in a scaled-down (0.82) inner wrapper so more fits collapsed and the full
  sheet fits the viewport at full width. Lenis **auto-advances** through the
  pin (`scrollTo` with `lock`) to land on the fully-shown sheet, then holds.
  Structure: `[data-v4="brewsheet"]` (wrapper — transform/lift) › `bs-nub` +
  `bs-box` (border + `overflow:hidden`, height animated) › `bs-inner` (0.82) ›
  `BrewSheetPanelV4`.

## Make-or-break, validated

- CSS-`sticky` mock + GSAP-`pin`ned sibling text column coexist (pin spacer
  doesn't unstick the mock); no DOM reparenting near pins.
- Driver: per-section ScrollTriggers (hops scrub + brewsheet pin) + `onToggle`
  for `activeTab`. (A single master scrubbed timeline remains an option if
  continuity across many beats gets fiddly.)

## Key files (`app/v4/`)

- `HomeV4.tsx` — the client shell + ALL GSAP setup: measure home/exploded per
  element, the hops + brewsheet timelines, Lenis, `activeTab` state, the
  layout (overflow:clip, sticky grid). The file you tune.
- `mock/V4Mock.tsx` — the scene: mock card, bordered content panel, clickable
  tab bar, `section-hops`, placeholder for other tabs, the scene-level explode
  layer (radar), and the brew sheet group (`bs-nub` lifting tab + `bs-box`
  bordered/`overflow:hidden`/height-animated + `bs-inner` 0.82 scale).
- `mock/BrewSheetPanelV4.tsx` — framer-stripped brew sheet content. `framed`
  prop (mock passes `framed={false}` so the body panel is the only outline).
- `mock/HopFlavorRadar.tsx` — pure SVG radar, lifted from v3.
- `lib/scroll.ts` — `useLenis` (Lenis + ScrollTrigger wiring + teardown).
- `lib/useReducedMotion.ts`, `stages/TourSections.tsx` (left-column text).
- `page.tsx` / `data.ts` — server fetch + copy, ported from v3.

## Gotchas / patterns

- Root uses `overflow: clip` on BOTH axes (NOT `hidden`, which breaks `sticky`
  on descendants).
- Measure with `offsetLeft/Top` (ignores transforms), not
  `getBoundingClientRect`; recompute on refresh.
- React `opacity` (visibility) vs GSAP `transform` (motion): never both on the
  same property of the same node.
- Lenis auto-advance `lock: true` reliably lands but ignores manual scroll for
  ~1.9s; can wedge if interrupted programmatically (fine in normal use —
  `lenis.start()` unwedges).
- Tabs were shrunk to fit the mock width (7 tabs overflowed the right edge).
- Screenshots of programmatic/scripted scroll are unreliable in the preview
  harness (blank frames); verify by measuring the live DOM.

## Remaining / trajectory

Stopping point: the Hops + Brew sheet beats are done and the user signed off
("we killed this"). The brew sheet went through several rounds — final model is
the grow-the-box + lifting tab nub above (see the Brew sheet beat). Open items:

- **Polish — Hops beat timing:** when the radar starts growing / closes is the
  main remaining rough edge (flagged by the user at the stopping point). Knobs
  are in `HomeV4.tsx`'s hops timeline (trigger `start`/`end`, the close offsets).
- **Other tab sections** (Fermentables / Mash / Water / Yeast / Fermentation):
  currently a placeholder — only Hops + Brew sheet have full content + beats.
- **Remaining tour sections** below the pinned tour (Brewed-again,
  Community/Compare, What-else, Learn, FAQ + JSON-LD, Final CTA): port from v3
  with simpler in-view reveals.
- **SplitText** text reveals per section ("introduce → show off").
- **Water interactive "flex"** beat (adjust salts → solve re-runs) at its pin.
- **Responsive** (`gsap.matchMedia()` mobile stacked fork) + **reduced-motion**
  fork (skeleton present: desktop gated to `min-width:1025px`, reduced-motion
  early-returns).
- **Production swap:** `app/page.tsx` → `HomeV4`; retire `app/_home` + `app/v3`.
