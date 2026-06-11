# v3 Mock — Ideal Architecture (Rebuild Recommendation)

> **Largely realized in v4 (different library).** The scene-graph discipline
> recommended here is what the v4 build follows — though v4 uses **GSAP**, not
> framer-motion. Current reference: [`v4-homepage-build.md`](./v4-homepage-build.md).
> Kept for the rationale.

Companion to [`v3-homepage-build-debrief.md`](./v3-homepage-build-debrief.md).
The debrief explains what we built and why. This explains what I'd build
instead and why.

## Honest assessment of where we pinned ourselves

Looking at the current code in `app/v3/components/mock/`, the choices that
made every subsequent iteration harder:

1. **Sub-bones live INSIDE their parent section's render.** `HopVisualizer`
   is a `motion.div` inside `HopsContent.tsx`. CSS opacity composes
   multiplicatively with parents. So when the mock recedes to 0.35
   opacity, anything inside it can never be brighter than 0.35. The only
   way out is rendering as a sibling — but then you have to duplicate
   the rendering ("inline version" + "overlay version") which we already
   regret.

2. **`setTimeout`-driven phase state machine.** Pose changes are
   time-locked: 0ms → 400ms → 1000ms. The user's scroll has nothing to
   do with when the animation progresses. Scroll fast through stage 4
   and the explosion still takes 1 second — feels disconnected. Scroll
   slowly and you wait through dead air for the timer.

3. **State distributed across many components.** `mockState` in HomeV3,
   `Highlight` in TourMock, `phase` and `effectiveHighlight` derived in
   MockBuilder, sub-bone state derived inside each section component.
   Reasoning about "what does the mock look like at scroll position Y"
   requires tracing through 4 files.

4. **Two rendering paths for section content.** Same `HopsContent` is
   rendered TWICE in MockBuilder — once inline in the section card slot,
   once as the focal sibling overlay. When you change HopsContent, you
   need to check both render paths still work.

5. **Magic-number coordinates.** `SLOT_TOP = 280, SLOT_LEFT = 18`
   etc. are eyeballed approximations of where the section card sits in
   the mock layout. Change the header height by 4px and the overlay
   floats free.

6. **Lots of indirection.** `TourMock` → `MockBuilderShell` → `MockBuilder`
   → section components → sub-bones. Each layer translates the previous
   layer's vocabulary into the next. Pure overhead at this point.

The vision (scroll-driven exploded diagram) is great. The implementation
is fighting the vision.

## What I'd build instead

### Mental model: one scene, named elements, scroll-driven poses

Think of the mock as a **stage** (single absolutely-positioned coordinate
space) with **named elements** (header, stats strip, each tab, each
section content, each sub-element). Every element is rendered exactly
once, in one place, throughout the visitor's session.

The mock has **poses**. A pose is a snapshot: for every named element,
where it is, how big, how transparent, etc. The "default" pose is the
mock at rest. Each scroll stage has its own pose. The visitor's scroll
position interpolates between adjacent poses.

This is how Apple, Stripe, Linear build their scroll-driven product
pages. It's the standard professional approach for this kind of work.

### File structure

```
app/v3/mock/
  Mock.tsx              # composition root — renders every element once
  poses.ts              # pose definitions per stage. Pure data.
  useStagePoses.ts      # hook: scroll progress → interpolated pose
  elements/
    MockFrame.tsx       # the cream card outline + ink border + shadow
    Header.tsx          # title + back link + save button
    PillsRow.tsx        # STYLE / BATCH / Profile pills
    StatsStrip.tsx
    Tab.tsx             # generic, one instance per tab key
    SectionCard.tsx     # the paper-bg slot the section content sits in
    BrewsheetTabButton.tsx
    BrewSheetPanel.tsx
    contents/
      FermentablesBillStack.tsx
      FermentablesGrainRows.tsx
      HopBillTable.tsx
      HopVisualizer.tsx
      WaterPillsRow.tsx
      SaltCells.tsx
      AutoCalcButton.tsx
      PhCallout.tsx
      MashRow.tsx
      YeastCard.tsx
```

Note: section CONTENTS are decomposed into separately-renderable elements.
`HopBillTable` and `HopVisualizer` are sibling elements, not nested.
Same for `SaltCells` / `AutoCalcButton` / `PhCallout`. Each has its own
position in the default pose.

### `poses.ts` — pure data, the heart of the system

```ts
type ElementState = {
  top?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  zIndex?: number;
};

type Pose = Partial<Record<ElementId, ElementState>>;

const DEFAULT_POSE: Pose = {
  mockFrame:    { top: 0,   left: 0,   right: 0,   opacity: 1, scale: 1 },
  header:       { top: 16,  left: 18,  right: 18,  opacity: 1 },
  pillsRow:     { top: 76,  left: 18,            opacity: 1 },
  statsStrip:   { top: 130, left: 18,  right: 18,  opacity: 1 },
  tabFerm:      { top: 248, left: 22,  width: 110, opacity: 1 },
  tabHops:      { top: 248, left: 135, width: 60,  opacity: 1 },
  tabWater:     { top: 248, left: 198, width: 70,  opacity: 1 },
  tabMash:      { top: 248, left: 270, width: 70,  opacity: 1 },
  tabYeast:     { top: 248, left: 342, width: 65,  opacity: 1 },
  tabBoil:      { top: 248, left: 410, width: 55,  opacity: 0.5 },
  brewsheetTab: { top: 248, right: 18, width: 95,  opacity: 1 },
  sectionCard:  { top: 282, left: 18,  right: 18,  height: 360, opacity: 1 },
  hopBillTable: { top: 310, left: 30,  right: 30,  opacity: 0 }, // hidden, only on hops
  hopVisualizer:{ top: 330, right: 40,             scale: 0.6, opacity: 0 },
  saltCells:    { top: 360, left: 30,             scale: 0.5, opacity: 0 },
  autoCalcBtn:  { top: 320, right: 30,            scale: 0.5, opacity: 0 },
  // ... every element listed once with default geometry
};

const STAGE_POSES: Record<StageKey, Pose> = {
  default: {}, // inherits DEFAULT_POSE
  fermentables: {
    mockFrame:           { x: -28, scale: 0.7, opacity: 0.35 },
    sectionCard:         { /* unchanged from default — stays at top:282 */ },
    fermBillStack:       { top: 320, left: 36, right: 36, scale: 1.4, opacity: 1 },
    fermGrainRows:       { /* dimmer than billStack */ scale: 0.9, opacity: 0.6 },
  },
  hops: {
    mockFrame:           { x: -28, scale: 0.7, opacity: 0.35 },
    hopVisualizer:       { top: 100, right: 80, scale: 2.4, opacity: 1, zIndex: 30 },
    hopBillTable:        { top: 350, left: 30, right: 30, opacity: 0.4 },
  },
  water: {
    mockFrame:           { x: -28, scale: 0.7, opacity: 0.35 },
    saltCells:           { top: 200, left: 60,   scale: 1.4, opacity: 1, zIndex: 25 },
    autoCalcBtn:         { top: 150, right: 60,  scale: 1.6, opacity: 1, zIndex: 30 },
    phCallout:           { top: 280, left: 200,  scale: 1.3, opacity: 1, zIndex: 25 },
  },
  brewsheet: {
    mockFrame:           { x: -28, scale: 0.65, opacity: 0.3 },
    brewsheetTab:        { top: 30, left: 0, right: 0, width: undefined, height: 600,
                           opacity: 1, zIndex: 50, /* the BrewSheetPanel grows here */ },
  },
};
```

Every element knows where it lives in every pose. No magic
coordinates spread across components.

### `useStagePoses.ts` — scroll → interpolated pose

```ts
import { useScroll, useTransform, type MotionValue } from "framer-motion";

export function useStagePoses(stageRefs: StageRefs): InterpolatedPose {
  // For each stage section ref, get a 0..1 scroll progress.
  // The "active" stage is whichever has progress closest to 0.5
  // (centered in viewport).
  
  // For each element id, return a MotionValue<ElementState> that
  // interpolates between the previous stage's pose for that element
  // and the next stage's pose, based on scroll progress.
  
  // motion.div elements then consume these motion values directly:
  //   <motion.div style={{ x: pose.mockFrame.x, y: pose.mockFrame.y, ... }} />
}
```

framer-motion's `MotionValue` API handles the interpolation for free.
No setState, no setTimeout. Scroll-linked end to end.

### `Mock.tsx` — composition

```tsx
function Mock() {
  const pose = useStagePoses();
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MockFrame pose={pose.mockFrame}>
        <Header pose={pose.header} />
        <PillsRow pose={pose.pillsRow} />
        <StatsStrip pose={pose.statsStrip} />
        <Tab pose={pose.tabFerm} label="Fermentables" />
        <Tab pose={pose.tabHops} label="Hops" />
        {/* every tab listed */}
        <BrewsheetTabButton pose={pose.brewsheetTab} />
        <SectionCard pose={pose.sectionCard} />
      </MockFrame>
      
      {/* Section content elements — siblings, not nested. */}
      <FermentablesBillStack pose={pose.fermBillStack} />
      <FermentablesGrainRows pose={pose.fermGrainRows} />
      <HopBillTable pose={pose.hopBillTable} />
      <HopVisualizer pose={pose.hopVisualizer} />
      <WaterPillsRow pose={pose.waterPills} />
      <SaltCells pose={pose.saltCells} />
      <AutoCalcButton pose={pose.autoCalcBtn} />
      <PhCallout pose={pose.phCallout} />
      <MashRow pose={pose.mashRow} />
      <YeastCard pose={pose.yeastCard} />
      <BrewSheetPanel pose={pose.brewsheetTab} /> {/* yes, the tab IS the brewsheet element */}
    </div>
  );
}
```

`Mock.tsx` is ~50 lines. Each element file is ~30 lines (just the render
+ a `motion.div` consuming the pose). `poses.ts` is the main data file
where you tune the animation.

### What an element looks like

```tsx
// elements/HopVisualizer.tsx
import { motion, type MotionValue } from "framer-motion";

interface Props {
  pose: {
    top: MotionValue<number>;
    right: MotionValue<number>;
    scale: MotionValue<number>;
    opacity: MotionValue<number>;
    zIndex: MotionValue<number>;
  };
}

export function HopVisualizer({ pose }: Props) {
  return (
    <motion.div
      style={{
        position: "absolute",
        top: pose.top,
        right: pose.right,
        scale: pose.scale,
        opacity: pose.opacity,
        zIndex: pose.zIndex,
      }}
    >
      <HopFlavorRadarSVG />
    </motion.div>
  );
}
```

That's the whole element. No state, no logic, no `useEffect`, no
animation timing. Just consume the pose. Tweak the animation by editing
`poses.ts`.

## Why this is better

| Pain point in current code | Resolved by this architecture |
|---|---|
| Sub-bones can't be brighter than receded parent | Every element is a top-level sibling — no parent opacity to compose with |
| `setTimeout` phase machine drifts from scroll | Scroll progress drives interpolation directly. Scroll fast = animate fast. Scroll backward = animate backward. |
| State spread across 4 files | All pose data in `poses.ts`. All scroll math in `useStagePoses.ts`. |
| Two rendering paths (inline + overlay) | Each element renders once. Period. |
| Magic coordinates | All coordinates explicit in `poses.ts` next to each other; easy to keep aligned |
| `MockBuilder.tsx` is 180 lines of choreography logic | `Mock.tsx` is 50 lines of composition. Choreography is pure data. |
| Adding a new sub-element means modifying section content | Adding a new element = new file + new entries in `poses.ts`. Local change. |
| Adding a new stage means new MockState + new case | Adding a new stage = new pose in `poses.ts`. One file. |
| Tuning animation requires re-running mental simulation of phase timing | Tuning = edit a number in `poses.ts`. Hot reload. See result. |

## Trade-offs (honest)

- **More verbose pose definitions.** Every element listed in every pose.
  Mitigate with a `mergeWithDefault` helper that fills in unspecified
  values from the default pose, so each stage pose only lists what it
  changes.

- **Hardcoded coordinates** are still hardcoded. They're just centralized
  now. If the design changes (e.g., header height grows), several pose
  values need updating. Could mitigate with named offsets at the top of
  `poses.ts` (`const HEADER_HEIGHT = 60` etc.) that everything else
  computes from.

- **Element decomposition takes upfront work.** `HopsContent` becomes
  `HopBillTable` + `HopVisualizer`. Currently they're nested; you'd
  rebuild them as independent absolutely-positioned components. Trade
  one rebuild now for not having this fight again.

- **`useScroll` requires a scroll container.** The page already has one
  (the document scrolls), so this isn't really a problem. You'd use
  `useScroll({ target: stageRef, offset: ["start end", "end start"] })`
  per stage.

## How to migrate from current code

Don't try to evolve `app/v3/components/mock/` in place — it's been
massaged through 26 iterations and carries assumptions everywhere. Build
fresh:

1. Create `app/v3/mock/` (new directory).
2. Build `elements/` — start with `MockFrame`, `Header`, `StatsStrip`,
   `Tab`, `SectionCard`. These have static-ish content.
3. Build `poses.ts` with the `DEFAULT_POSE` filled in. Verify the
   default pose renders identically to the current default mock visual.
4. Add one stage pose (e.g., `hops`) and verify the explosion looks
   right when scrolled to stage 4.
5. Add the remaining stage poses iteratively.
6. Once `app/v3/mock/` looks right, swap `TourMock.tsx` to render `Mock`
   instead of `MockBuilderShell`.
7. Delete `app/v3/components/mock/` (the old directory).

About 1–2 days of focused work to ship a complete rebuild given the
architecture is decided. Less if you skip elements that aren't in
play yet (Mash, Yeast).

## Reusable insight: this pattern fits a lot of UI work

Any time you have:
- A scene that the visitor experiences as a single continuous thing
- Multiple "states" or "moments" the scene cycles through
- Pieces of the scene that need to move, scale, fade, swap independently

…the scene-graph-with-poses pattern is the right one. Framer Motion
supports it natively. Apple's product pages, Stripe's marketing pages,
Linear's landing — all built this way. It's the right tool for
scroll-driven product demos specifically.

What we built is closer to "stateful React components with imperative
animation triggers." That's fine for transient UI (a modal opening, a
dropdown), wrong for scroll-driven scenes where the visitor IS the
animation timeline.
