"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hsTokens } from "@/modules/hopskip/tokens";
import type { CommunityRecipeCard } from "../_home/lib/communityCard";
import { useReducedMotion } from "./lib/useReducedMotion";
import { useLenis } from "./lib/scroll";
import { V4Mock, type TabKey } from "./mock/V4Mock";
import { GRAIN_STEP_LEVELS } from "./mock/TabSections";
import {
  StageIntro,
  StageOpening,
  StageGrains,
  StageHops,
  StageBrewSheet,
} from "./stages/TourSections";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface Props {
  recipes: CommunityRecipeCard[];
  recipeCount: number;
}

// Flip to true while tuning to see ScrollTrigger start/end/pin markers.
const DEV_MARKERS = false;

/**
 * v4 homepage — Phase 0 vertical-slice spike.
 *
 * Native scroll (no Lenis yet — that lands in Phase 1). Persistent mock is
 * CSS `position: sticky` in the right column. Two beats:
 *   - Hops: normal scroll, the radar explodes then closes via scrub.
 *   - Brewsheet: the LEFT text column hard-pins (GSAP pin), and during the
 *     pinned scroll the mock recedes and the brew-sheet panel rises in.
 *
 * The make-or-break question this spike answers: does the CSS-sticky mock
 * stay glued through the sibling text column's GSAP pin enter/release?
 */
export default function HomeV4({ recipeCount }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Lenis smooth scroll — smooth wheel for the whole tour + the scrub feel on
  // the hops collapse. No longer drives an auto-advance: every beat now plays on
  // enter or follows scroll, so nothing hijacks the scroll position.
  useLenis(!reducedMotion);
  // Which builder tab the mock is showing. React owns section visibility; the
  // tour switches it per beat, and the tab bar lets the user switch it at rest.
  // Starts on the grain bill — the hero/opening/grains stages are all the
  // recipe overview, before the Hops beat switches it.
  const [activeTab, setActiveTab] = useState<TabKey>("fermentables");
  // Grains "live math" beat: 0 = empty bill / all vitals at 0, 1 = full recipe.
  // Driven by the grains scroll (clear then build); the stats, style gauges,
  // and grain bill all interpolate by it.
  const [grainFill, setGrainFill] = useState(1);

  useGSAP(
    () => {
      // Reduced-motion fork: no pin/scrub. Mock renders at its assembled
      // default; the brewsheet overlay stays hidden (CSS opacity 0).
      if (reducedMotion) return;

      const mm = gsap.matchMedia();

      // Desktop only — the pinned tour. Mobile (<=1024px) gets the stacked,
      // non-pinned layout via CSS; full mobile fork is Phase 6.
      mm.add("(min-width: 1025px)", () => {
        // Measure the radar's "home" (its slot in the mock) and "exploded"
        // (centred, big) transforms in scene coords. Uses offsetLeft/Top —
        // NOT getBoundingClientRect — so it's independent of the mock's
        // recede transform. Recomputed on every ScrollTrigger refresh.
        const scene = rootRef.current?.querySelector(
          ".v4-scene",
        ) as HTMLElement | null;
        const radarEl = rootRef.current?.querySelector(
          '[data-v4="radar"]',
        ) as HTMLElement | null;
        const slotEl = rootRef.current?.querySelector(
          '[data-v4="radar-slot"]',
        ) as HTMLElement | null;
        const bsEl = rootRef.current?.querySelector(
          '[data-v4="brewsheet"]',
        ) as HTMLElement | null;
        const bodyEl = rootRef.current?.querySelector(
          '[data-v4="mock-body"]',
        ) as HTMLElement | null;
        const home = { x: 0, y: 0, scale: 1 };
        const exploded = { x: 0, y: 0, scale: 2.6 };
        const bsHome = { x: 0, y: 0, w: 0, h: 0 };
        const bsExploded = { x: 0, y: 0, scale: 1.04, h: 0 };
        const offsetWithin = (el: HTMLElement, anc: HTMLElement) => {
          let x = 0;
          let y = 0;
          let n: HTMLElement | null = el;
          while (n && n !== anc) {
            x += n.offsetLeft;
            y += n.offsetTop;
            n = n.offsetParent as HTMLElement | null;
          }
          return { x, y };
        };
        const measure = () => {
          if (!scene || !radarEl || !slotEl) return;
          const o = offsetWithin(slotEl, scene);
          const rw = radarEl.offsetWidth || 112;
          const rh = radarEl.offsetHeight || 112;
          home.x = o.x;
          home.y = o.y;
          home.scale = slotEl.offsetWidth / rw;
          const ES = 2.6;
          exploded.x = (scene.offsetWidth - rw * ES) / 2;
          exploded.y = Math.max(8, (scene.offsetHeight - rh * ES) / 2 - 16);
          exploded.scale = ES;
          // Brew sheet: home = the body box ("what fits"). exploded = lift the
          // box up + grow its HEIGHT to the full content + nudge a bit bigger,
          // so it reads as the box growing/lifting out, not an unmask.
          if (bsEl && bodyEl) {
            const bo = offsetWithin(bodyEl, scene);
            const bodyW = bodyEl.offsetWidth; // full body box width
            const restH = bodyEl.offsetHeight; // body height = what fits
            const bsBox = bsEl.querySelector(
              '[data-v4="bs-box"]',
            ) as HTMLElement | null;
            if (bsBox) bsBox.style.width = `${bodyW}px`;
            const innerEl = bsEl.querySelector(
              '[data-v4="bs-inner"]',
            ) as HTMLElement | null;
            // visual height of the scaled-down (0.82) content
            const fullH = innerEl ? innerEl.offsetHeight * 0.82 : restH;
            bsHome.x = bo.x;
            bsHome.y = bo.y;
            bsHome.w = bodyW;
            bsHome.h = restH;
            // the freshened content is tall — grow the box to the full content
            // height but scale it to fit the viewport so ALL of it shows.
            const availH = window.innerHeight * 0.8;
            const fitScale = Math.min(1, availH / (fullH + 6));
            bsExploded.scale = fitScale;
            bsExploded.x = (scene.offsetWidth - bodyW * fitScale) / 2;
            bsExploded.y = 12;
            bsExploded.h = fullH + 6; // border-box buffer so all content + bottom border show
          }
        };
        measure();
        gsap.set('[data-v4="radar"]', {
          x: home.x,
          y: home.y,
          scale: home.scale,
        });
        gsap.set('[data-v4="brewsheet"]', {
          x: bsHome.x,
          y: bsHome.y,
          scale: 1,
        });
        gsap.set('[data-v4="bs-box"]', { width: bsHome.w, height: bsHome.h });
        gsap.set('[data-v4="bs-nub"]', { opacity: 0 });
        ScrollTrigger.addEventListener("refreshInit", measure);

        // ── Hops beat — HYBRID: grow plays once on enter, collapse follows
        //    scroll. The radar pull-out is a showcase (play-once-on-enter, like
        //    the grains build); the tuck-back stays SCROLL-driven so it tracks
        //    the reader leaving toward the brew sheet. Two paused timelines +
        //    two triggers. Why two: the grow can't be a scrub-linked tween (it
        //    would fight the collapse), and the collapse can't be a normal scrub
        //    tween either — a scrub tween hold-renders its `from` (exploded)
        //    whenever scroll is before its start, stomping the grow every frame.
        //    So the collapse is a PAUSED timeline scrubbed MANUALLY via
        //    progress() inside its trigger's active range, untouched before it.
        const HOPS_LEAD = 0.35; // beat to read the hop bill before it pulls out
        const HOPS_GROW = 0.85; // radar pull-out duration

        // GROW (play once on enter): mock recedes + dims, radar pulls out + grows.
        // immediateRender:false so the paused timeline doesn't apply its `from`
        // (or flash) on mount — inert until restart().
        const hopsGrowTl = gsap.timeline({ paused: true });
        hopsGrowTl
          .to({}, { duration: HOPS_LEAD }, 0)
          .fromTo(
            '[data-v4="mock"]',
            { scale: 1, xPercent: 0 },
            { scale: 0.84, xPercent: -12, duration: HOPS_GROW * 0.9, ease: "power2.inOut", immediateRender: false },
            HOPS_LEAD,
          )
          .fromTo(
            '[data-v4="radar"]',
            { x: () => home.x, y: () => home.y, scale: () => home.scale },
            { x: () => exploded.x, y: () => exploded.y, scale: () => exploded.scale, duration: HOPS_GROW, ease: "power2.out", immediateRender: false },
            HOPS_LEAD,
          )
          // soft drop shadow via FILTER so the chunky offset boxShadow (the
          // brand backdrop) stays put — both shadows show at once, no swap.
          .fromTo(
            '[data-v4="radar"] > div',
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.22))", duration: HOPS_GROW, ease: "none", immediateRender: false },
            HOPS_LEAD,
          )
          // the rest of the builder dims to emphasize the visualizer
          .fromTo(
            ".v4-dim",
            { opacity: 1 },
            { opacity: 0.4, duration: HOPS_GROW * 0.85, ease: "none", immediateRender: false },
            HOPS_LEAD,
          );

        // COLLAPSE (scroll-driven): exploded → home. Offset so the mock leads
        // home and the radar tucks into its slot LAST, landing at the seam.
        const hopsCollapseTl = gsap.timeline({ paused: true });
        hopsCollapseTl
          .fromTo(
            '[data-v4="mock"]',
            { scale: 0.84, xPercent: -12 },
            { scale: 1, xPercent: 0, duration: 0.8, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            ".v4-dim",
            { opacity: 0.4 },
            { opacity: 1, duration: 0.8, ease: "none", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-v4="radar"]',
            { x: () => exploded.x, y: () => exploded.y, scale: () => exploded.scale },
            { x: () => home.x, y: () => home.y, scale: () => home.scale, duration: 1, ease: "power2.in", immediateRender: false },
            0.18,
          )
          .fromTo(
            '[data-v4="radar"] > div',
            { filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.22))" },
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))", duration: 0.85, ease: "none", immediateRender: false },
            0.18,
          );

        // Re-read measured home/exploded after a refresh (resize / font settle);
        // the timelines use function-based values, which GSAP caches until
        // invalidated. (Replaces the old scrub's invalidateOnRefresh.)
        const invalidateHops = () => {
          hopsGrowTl.invalidate();
          hopsCollapseTl.invalidate();
        };
        ScrollTrigger.addEventListener("refreshInit", invalidateHops);

        // Grow trigger — play once on a downward enter; reset on a scroll-up
        // exit so a fresh downward approach replays it. Its active range spans
        // the whole beat so activeTab stays "hops" across the collapse too.
        ScrollTrigger.create({
          trigger: '[data-v4-stage="hops"]',
          start: "top 45%",
          end: "bottom 30%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTab("hops");
          },
          onEnter: () => hopsGrowTl.restart(),
          onLeaveBack: () => {
            hopsGrowTl.pause(0);
            hopsCollapseTl.pause(0);
            gsap.set('[data-v4="mock"]', { scale: 1, xPercent: 0 });
            gsap.set(".v4-dim", { opacity: 1 });
            gsap.set('[data-v4="radar"]', { x: home.x, y: home.y, scale: home.scale });
            gsap.set('[data-v4="radar"] > div', { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          },
        });

        // Collapse trigger — scrub the tuck-back over the LATER part of the hops
        // scroll (after the grow + a hold). Manual progress() on the paused
        // timeline; before this range it's untouched, so the radar stays
        // exploded where the grow left it. start/end are the hold-length knobs.
        ScrollTrigger.create({
          trigger: '[data-v4-stage="hops"]',
          start: "bottom 78%",
          end: "bottom 38%",
          markers: DEV_MARKERS,
          onUpdate: (self) => {
            // If a very fast scroll opens the collapse range while the grow is
            // still playing, snap the grow done first so they don't fight over
            // the radar (collapse then scrubs cleanly from the exploded state).
            if (hopsGrowTl.isActive()) hopsGrowTl.progress(1);
            hopsCollapseTl.progress(self.progress);
          },
          onLeave: () => hopsCollapseTl.progress(1),
          onLeaveBack: () => hopsCollapseTl.progress(0),
        });

        // ── Grains "live math" beat — animation-driven (plays once on enter).
        //    The recipe builds ITSELF: on enter the bill quick-CLEARS to 0, then
        //    grains are added one at a time as a STAIRCASE (each drops in, the
        //    vitals jump, then a hesitation) on GSAP's own clock. NOT scrub-
        //    driven: it plays at a deliberate pace no matter the scroll speed and
        //    never stalls if the reader pauses (the play-once-on-enter spirit of
        //    the SplitText reveals). grainFill still drives the same plumbing
        //    (stats / BJCP gauges / SRM / grain reveal interpolate off it) — only
        //    the shape of its motion changed (linear ramp → stepped).
        const grainProxy = { fill: 1 };
        const applyGrainFill = () => setGrainFill(grainProxy.fill);
        // STEPPED build (a staircase, NOT a linear ramp): clear the bill, then
        // add the grains ONE AT A TIME — each grain drops in and the vitals jump
        // by ITS contribution, then a HESITATION before the next. The rise
        // targets are GRAIN_STEP_LEVELS (cumulative weight fraction), so the base
        // malt makes a big jump and the specialty malts small bumps; the reveal
        // in FermentablesSection keys off the same levels, so the grain and its
        // numbers step together. immediateRender:false so the paused timeline
        // doesn't apply a `from` (or flash an empty bill) on mount — inert until
        // restart().
        const GRAIN_RISE = 0.4; // a grain drops in + its numbers jump
        const GRAIN_HOLD = 0.55; // hesitation before the next grain
        const grainFromLevels = [0, ...GRAIN_STEP_LEVELS]; // [0, L0, L1, …]
        const grainsTl = gsap.timeline({ paused: true });
        grainsTl
          // clear the bill to a blank canvas, then a beat before building
          .fromTo(
            grainProxy,
            { fill: 1 },
            { fill: 0, duration: 0.45, ease: "power2.in", immediateRender: false, onUpdate: applyGrainFill },
          )
          .to({}, { duration: 0.25 });
        GRAIN_STEP_LEVELS.forEach((level, i) => {
          grainsTl.fromTo(
            grainProxy,
            { fill: grainFromLevels[i] },
            { fill: level, duration: GRAIN_RISE, ease: "power2.out", immediateRender: false, onUpdate: applyGrainFill },
          );
          // hesitate before the next grain — but not after the LAST one (the
          // beat just holds on the finished bill).
          if (i < GRAIN_STEP_LEVELS.length - 1) grainsTl.to({}, { duration: GRAIN_HOLD });
        });

        ScrollTrigger.create({
          trigger: '[data-v4-stage="grains"]',
          start: "top 60%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTab("fermentables");
          },
          // Play once when the beat scrolls into view; replay on a fresh
          // approach from above (scroll up past it, then back down). Scrolling
          // up INTO it from below (from hops) doesn't replay — the bill is
          // already full there.
          onEnter: () => grainsTl.restart(),
          onLeaveBack: () => {
            grainsTl.pause(0);
            grainProxy.fill = 1;
            setGrainFill(1);
          },
        });

        // ── Brewsheet beat — play-once-on-enter (NO pin, NO scroll-jack). On
        //    enter the mock recedes and the brew sheet (the active-tab section)
        //    GROWS out of its body slot to a big centred reveal — its box height
        //    expands to the full content while it lifts + scales to fit the
        //    viewport, and the "Brew sheet" tab nub lifts out above it. The mock
        //    is CSS-sticky, so the grown sheet holds in view while the stage
        //    scrolls past. (Was a hard pin + Lenis auto-advance that scrubbed and
        //    hijacked the scroll for ~2s; the user wanted it to just play in,
        //    like the hops grow + grains build.)
        const bsGrowTl = gsap.timeline({ paused: true });
        bsGrowTl
          // mock chrome scales DOWN + slides LEFT and dims as the sheet pulls out
          .fromTo(
            '[data-v4="mock"]',
            { opacity: 1, scale: 1, xPercent: 0 },
            { opacity: 0.32, scale: 0.82, xPercent: -14, duration: 1.0, ease: "power2.inOut", immediateRender: false },
            0,
          )
          // the whole section grows OUT of its body slot (home) to the big
          // centred reveal (exploded). Opacity is React-driven by the tab
          // switch; GSAP only moves + scales it. Function-based measured values,
          // invalidated on refresh.
          .fromTo(
            '[data-v4="brewsheet"]',
            { x: () => bsHome.x, y: () => bsHome.y, scale: 1 },
            { x: () => bsExploded.x, y: () => bsExploded.y, scale: () => bsExploded.scale, duration: 1.2, ease: "power2.out", immediateRender: false },
            0.1,
          )
          .fromTo(
            '[data-v4="bs-box"]',
            { height: () => bsHome.h },
            { height: () => bsExploded.h, duration: 1.2, ease: "power2.out", immediateRender: false },
            0.1,
          )
          // the "Brew sheet" tab nub lifts out above the box
          .fromTo(
            '[data-v4="bs-nub"]',
            { opacity: 0 },
            { opacity: 1, duration: 0.5, ease: "none", immediateRender: false },
            0.5,
          );

        // Re-read measured bsHome/bsExploded after a refresh (resize/font settle);
        // the timeline uses function-based values, cached until invalidated.
        const invalidateBs = () => bsGrowTl.invalidate();
        ScrollTrigger.addEventListener("refreshInit", invalidateBs);

        // Play once on a downward enter; reset on a scroll-up exit so a fresh
        // approach replays it. Dwell on the big sheet = the brewsheet stage
        // height (no pin now), so make that stage tall.
        ScrollTrigger.create({
          trigger: '[data-v4-stage="brewsheet"]',
          start: "top 50%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTab("brewsheet");
          },
          onEnter: () => bsGrowTl.restart(),
          onLeaveBack: () => {
            bsGrowTl.pause(0);
            gsap.set('[data-v4="mock"]', { opacity: 1, scale: 1, xPercent: 0 });
            gsap.set('[data-v4="brewsheet"]', { x: bsHome.x, y: bsHome.y, scale: 1 });
            gsap.set('[data-v4="bs-box"]', { height: bsHome.h });
            gsap.set('[data-v4="bs-nub"]', { opacity: 0 });
          },
        });

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", measure);
          ScrollTrigger.removeEventListener("refreshInit", invalidateHops);
          ScrollTrigger.removeEventListener("refreshInit", invalidateBs);
        };
      });

      // Custom fonts (Archivo Black / Space Grotesk) load late and shift layout;
      // measured positions (radar/brewsheet home + exploded) computed before
      // that settle land wrong, so refresh once fonts are ready.
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  // The left column (tour text) is memoized so it does NOT re-render when
  // `activeTab` / `grainFill` change — it's a heavy text column and nothing in
  // it depends on those. (Historically this was REQUIRED to dodge the pin+React
  // removeChild crash when the brewsheet stage was GSAP-pinned; no beat pins
  // anymore, so it's now purely a perf win — but still worth keeping.)
  const leftColumn = useMemo(
    () => (
      <div className="v4-tour-left" style={{ minWidth: 0 }}>
        <StageIntro recipeCount={recipeCount} />
        <StageOpening />
        <StageGrains />
        <StageHops />
        <StageBrewSheet />
      </div>
    ),
    [recipeCount],
  );

  return (
    <div
      ref={rootRef}
      style={{
        background: hsTokens.cream,
        // `overflow: clip` on BOTH axes. `hidden` (or even overflow-x:hidden,
        // which computes overflow-y to auto) creates a scroll context that
        // breaks `position: sticky` on every descendant. clip both axes:
        // the page still scrolls via html/body, sticky uses the document as
        // its scroll context, and horizontal overflow stays clipped.
        overflow: "clip",
        position: "relative",
      }}
    >
      <AmbientBlobs />

      <div
        className="v4-tour"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding:
            "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          gap: 48,
          position: "relative",
          zIndex: 2,
          // alignItems left at default `stretch` so the right column grows
          // to the full tour height — required for position:sticky to track
          // across the whole tour (and across the injected pin spacing).
        }}
      >
        {leftColumn}

        <div className="v4-tour-right" style={{ position: "relative", minWidth: 0 }}>
          <div
            className="v4-sticky-mock"
            style={{
              position: "sticky",
              top: "clamp(112px, calc(50vh - 290px), 280px)",
            }}
          >
            <V4Mock
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              grainFill={grainFill}
            />
          </div>
        </div>
      </div>

      {/* Tail spacer so the brewsheet pin has room to release into and the
          page doesn't end mid-pin. */}
      <div
        style={{
          height: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            opacity: 0.6,
          }}
        >
          end of phase 0 slice
        </span>
      </div>

      <style>{`
        /* Lenis smooth-scroll recommended baseline */
        html.lenis, html.lenis body { height: auto; }
        .lenis.lenis-smooth { scroll-behavior: auto !important; }
        .lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
        .lenis.lenis-stopped { overflow: clip; }

        @media (max-width: 1024px) {
          .v4-tour {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .v4-sticky-mock {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// Soft cream/water blobs behind the tour. Ambient, no parallax.
function AmbientBlobs() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "5%",
          width: 320,
          height: 320,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.malt} 18%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "8%",
          width: 280,
          height: 280,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.water} 14%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
    </div>
  );
}
