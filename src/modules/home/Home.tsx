"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { hsTokens } from "@/modules/builder/tokens";
import type { CommunityRecipeCard } from "@/modules/home/lib/communityCard";
import { useReducedMotion } from "./lib/useReducedMotion";
import { useLenis } from "./lib/scroll";
import { BuilderMock, type TabKey } from "./mock/BuilderMock";
import { GRAIN_STEP_LEVELS } from "./mock/TabSections";
import {
  StageIntro,
  StageOpening,
  StageGrains,
  StageHops,
  StageWater,
  StageHonestNumbers,
  StageBrewSheet,
} from "./stages/TourSections";
import {
  StageCompare,
  StageLibraryCommunity,
  StageWhatElse,
  StageLearn,
  StageFAQ,
  StageClose,
  StageFeedback,
} from "./stages/PostTourSections";
import { useAuthStore } from "@/modules/auth/authStore";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import SignedInHero from "./SignedInHero";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

interface Props {
  recipes: CommunityRecipeCard[];
}

// Flip to true while tuning to see ScrollTrigger start/end/pin markers.
const DEV_MARKERS = false;

/**
 * The homepage — GSAP scroll tour of the recipe builder.
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
// Auth-aware entry. Signed-out users (and the SSR/first-paint state, which keeps
// the marketing tour indexable) get the hardcoded scroll tour. Signed-in users
// get a personalized page: their recipes (hero) + community + learn + faq. The
// tour itself is never data-driven — user recipes do not flow through the beats.
export default function Home({ recipes }: Props) {
  const user = useAuthStore((s) => s.user);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  useEffect(() => {
    if (user && !recipesLoaded) loadRecipes();
  }, [user, recipesLoaded, loadRecipes]);

  // Stay on the tour until auth + recipes resolve (matches SSR, avoids a hydration
  // mismatch), then swap signed-in users to their personalized page.
  if (user && recipesLoaded) {
    return <HomeSignedIn recipes={recipes} />;
  }
  return <HomeTour recipes={recipes} />;
}

// Signed-in homepage: their recipes in the builder mock + community + learn + faq.
// No marketing tour. Reveal elements render at rest (no GSAP batch here), which
// is fine — they're visible by default.
function HomeSignedIn({ recipes }: { recipes: CommunityRecipeCard[] }) {
  return (
    <div style={{ background: hsTokens.cream, overflowX: "hidden" }}>
      <SignedInHero />
      <StageLibraryCommunity recipes={recipes} />
      <StageLearn />
      <StageFAQ />
      <StageFeedback />
    </div>
  );
}

export function HomeTour({ recipes }: { recipes: CommunityRecipeCard[] }) {
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
  // Auto-cycle the mock tabs through the bar (Fermentables → Hops → Mash →
  // Water → Yeast → Fermentation → loop) while the user is in the hero/opening.
  // Mirrors the live homepage HeroBuilderCard's auto-rotate. Stops on (a) user
  // click in the mock tab bar, or (b) the first scroll-driven stage trigger
  // firing — once the tour is "engaged", scroll position is the source of truth.
  const [tourCycling, setTourCycling] = useState(true);
  // setActiveTab + stop the cycle in one call — for the tab bar's onSelectTab
  // and every scroll-trigger onToggle below. Stable identity; the useGSAP
  // callbacks captured at mount still hit it.
  const setActiveTabAndStop = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setTourCycling(false);
  }, []);
  // Grains "live math" beat: 0 = empty bill / all vitals at 0, 1 = full recipe.
  // Driven by the grains beat's play-once staircase; the stats, style gauges,
  // and grain bill all interpolate by it.
  const [grainFill, setGrainFill] = useState(1);
  // Water "solve" beat: 0 = blank RO water, 1 = solved (salts at their targets,
  // ion bars filled into their bands). Driven by the water beat's play-once solve.
  const [waterFill, setWaterFill] = useState(1);
  // Honest-numbers beat: a mash-temp sweep that moves FG + ABV in the stat strip
  // and the mash step temperature (-1 is ~148F, 0 is the 152F default, +1 is
  // ~156F). 0 at rest so no other beat is affected.
  const [fgShift, setFgShift] = useState(0);
  // Mash temp leads the honest-numbers beat; FG/ABV (+ gauges) follow it with a
  // short lag so the cause→effect reads. tempShift drives the temp, fgShift the
  // lagged followers.
  const [tempShift, setTempShift] = useState(0);
  // While the honest-numbers beat is in view, ONLY the mash-temp chip grows —
  // it's the input being turned. false everywhere else.
  const [honestActive, setHonestActive] = useState(false);

  // Auto-cycle effect — first switch ~2.1s after mount, then every ~2.65s in
  // tab-bar order (matches the live homepage HeroBuilderCard timings). Skips
  // the brewsheet tab (the climax — we don't want to spoil it by auto-rotating
  // into it). Reduced-motion users get a static mock — the effect early-returns,
  // so the timer never starts.
  useEffect(() => {
    if (reducedMotion || !tourCycling) return;
    const order: TabKey[] = [
      "fermentables",
      "hops",
      "mash",
      "water",
      "yeast",
      "fermentation",
    ];
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const advance = () =>
      setActiveTab((prev) => {
        const i = order.indexOf(prev);
        return order[(i + 1) % order.length];
      });
    const startId = setTimeout(() => {
      advance();
      intervalId = setInterval(advance, 2650);
    }, 2150);
    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [reducedMotion, tourCycling]);

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
          ".tour-scene",
        ) as HTMLElement | null;
        const radarEl = rootRef.current?.querySelector(
          '[data-tour="radar"]',
        ) as HTMLElement | null;
        const slotEl = rootRef.current?.querySelector(
          '[data-tour="radar-slot"]',
        ) as HTMLElement | null;
        const bsEl = rootRef.current?.querySelector(
          '[data-tour="brewsheet"]',
        ) as HTMLElement | null;
        const bodyEl = rootRef.current?.querySelector(
          '[data-tour="mock-body"]',
        ) as HTMLElement | null;
        const waterEl = rootRef.current?.querySelector(
          '[data-tour="water"]',
        ) as HTMLElement | null;
        const waterSlotEl = rootRef.current?.querySelector(
          '[data-tour="water-slot"]',
        ) as HTMLElement | null;
        const home = { x: 0, y: 0, scale: 1 };
        const exploded = { x: 0, y: 0, scale: 2.6 };
        const bsHome = { x: 0, y: 0, w: 0, h: 0 };
        const bsExploded = { x: 0, y: 0, scale: 1.04, h: 0 };
        const waterHome = { x: 0, y: 0, scale: 1 };
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
              '[data-tour="bs-box"]',
            ) as HTMLElement | null;
            if (bsBox) bsBox.style.width = `${bodyW}px`;
            const innerEl = bsEl.querySelector(
              '[data-tour="bs-inner"]',
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
          // Water: position the (transparent) layer over the body slot, so at
          // rest it overlays the section area framed by the body border. The
          // layer itself does NOT move on the beat — its inner pieces spread out.
          if (waterEl && waterSlotEl) {
            const wo = offsetWithin(waterSlotEl, scene);
            const sw = waterSlotEl.offsetWidth;
            // size the layer to the body slot so it overlays it 1:1 — body-width,
            // natural proportions like the other sections (NOT scaled up to fill
            // the wide column, which was making everything oversized + too tall).
            waterEl.style.width = `${sw}px`;
            waterHome.x = wo.x;
            waterHome.y = wo.y;
            waterHome.scale = 1;
            gsap.set('[data-tour="water"]', { x: wo.x, y: wo.y, scale: 1 });
          }
        };
        measure();
        gsap.set('[data-tour="radar"]', {
          x: home.x,
          y: home.y,
          scale: home.scale,
        });
        gsap.set('[data-tour="brewsheet"]', {
          x: bsHome.x,
          y: bsHome.y,
          scale: 1,
        });
        gsap.set('[data-tour="bs-box"]', { width: bsHome.w, height: bsHome.h });
        gsap.set('[data-tour="bs-nub"]', { opacity: 0 });
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
            '[data-tour="mock"]',
            { scale: 1, xPercent: 0 },
            { scale: 0.84, xPercent: -12, duration: HOPS_GROW * 0.9, ease: "power2.inOut", immediateRender: false },
            HOPS_LEAD,
          )
          .fromTo(
            '[data-tour="radar"]',
            { x: () => home.x, y: () => home.y, scale: () => home.scale },
            { x: () => exploded.x, y: () => exploded.y, scale: () => exploded.scale, duration: HOPS_GROW, ease: "power2.out", immediateRender: false },
            HOPS_LEAD,
          )
          // soft drop shadow via FILTER so the chunky offset boxShadow (the
          // brand backdrop) stays put — both shadows show at once, no swap.
          .fromTo(
            '[data-tour="radar"] > div',
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.22))", duration: HOPS_GROW, ease: "none", immediateRender: false },
            HOPS_LEAD,
          )
          // the rest of the builder dims to emphasize the visualizer
          .fromTo(
            ".tour-dim",
            { opacity: 1 },
            { opacity: 0.4, duration: HOPS_GROW * 0.85, ease: "none", immediateRender: false },
            HOPS_LEAD,
          );

        // COLLAPSE (scroll-driven): exploded → home. Offset so the mock leads
        // home and the radar tucks into its slot LAST, landing at the seam.
        const hopsCollapseTl = gsap.timeline({ paused: true });
        hopsCollapseTl
          .fromTo(
            '[data-tour="mock"]',
            { scale: 0.84, xPercent: -12 },
            { scale: 1, xPercent: 0, duration: 0.8, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            ".tour-dim",
            { opacity: 0.4 },
            { opacity: 1, duration: 0.8, ease: "none", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="radar"]',
            { x: () => exploded.x, y: () => exploded.y, scale: () => exploded.scale },
            { x: () => home.x, y: () => home.y, scale: () => home.scale, duration: 1, ease: "power2.in", immediateRender: false },
            0.18,
          )
          .fromTo(
            '[data-tour="radar"] > div',
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
          trigger: '[data-tour-stage="hops"]',
          start: "top 45%",
          end: "bottom 30%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("hops");
          },
          onEnter: () => hopsGrowTl.restart(),
          onLeaveBack: () => {
            hopsGrowTl.pause(0);
            hopsCollapseTl.pause(0);
            gsap.set('[data-tour="mock"]', { scale: 1, xPercent: 0 });
            gsap.set(".tour-dim", { opacity: 1 });
            gsap.set('[data-tour="radar"]', { x: home.x, y: home.y, scale: home.scale });
            gsap.set('[data-tour="radar"] > div', { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          },
        });

        // Collapse trigger — scrub the tuck-back over the LATER part of the hops
        // scroll (after the grow + a hold). Manual progress() on the paused
        // timeline; before this range it's untouched, so the radar stays
        // exploded where the grow left it. start/end are the hold-length knobs.
        ScrollTrigger.create({
          trigger: '[data-tour-stage="hops"]',
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
          trigger: '[data-tour-stage="grains"]',
          start: "top 60%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("fermentables");
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

        // ── Water "solve" beat — the section BREAKS OUT (spread + grow). At
        //    rest it's integrated in the mock (the [data-tour="water"] layer is
        //    transparent over the body, framed by the body border). On enter the
        //    mock recedes + dims and the three INNER pieces spread apart and grow
        //    INDIVIDUALLY — controls lift above, salts pull left, ion-viz pulls
        //    right — like the hops radar, but each component pops. The Auto-Calc
        //    button gets PRESSED, then the salts + ion bars solve (waterFill 0→1).
        //    It HOLDS spread (the big salt +/- are interactive — the "flex"); the
        //    tuck-back is scroll-driven. The piece transforms are relative
        //    constants (no measured values), so no invalidate needed here.
        const waterProxy = { fill: 1 };
        const applyWaterFill = () => setWaterFill(waterProxy.fill);
        const WATER_LEAD = 0.25; // pieces sit spread + blank before Auto-Calc fires

        // GROW (play once): mock recedes + dims; the 3 pieces spread + grow
        // (staggered); Auto-Calc press; then the solve. The piece x/y/scale below
        // are the spread "feel" knobs.
        const waterGrowTl = gsap.timeline({ paused: true });
        waterGrowTl
          .fromTo(
            '[data-tour="mock"]',
            { scale: 1, xPercent: 0 },
            { scale: 0.84, xPercent: -10, duration: 0.7, ease: "power2.inOut", immediateRender: false },
            0,
          )
          .fromTo(
            ".tour-dim",
            { opacity: 1 },
            { opacity: 0.35, duration: 0.7, ease: "none", immediateRender: false },
            0,
          )
          // the "Water." header RECEDES with the mock (fades + shrinks back), so
          // only the data pieces come to the forefront.
          .fromTo(
            '[data-tour="water-header"]',
            { x: 0, scale: 1, opacity: 1 },
            { x: -16, scale: 0.9, opacity: 0.25, duration: 0.6, ease: "power2.inOut", immediateRender: false },
            0,
          )
          // pieces come FORWARD as a cohesive group — they lift UP together
          // (uniform y, no horizontal spread) + a small scale + a drop-shadow for
          // depth, growing from their INNER edges (transformOrigin on the salts/
          // ion panels) so adjacent panels can't overlap. They stay centred, not
          // scattered. (Was pushing controls up + panels down → dispersed.)
          .fromTo(
            '[data-tour="water-controls"]',
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { y: -240, scale: 1.1, filter: "drop-shadow(0 9px 16px rgba(0,0,0,0.16))", duration: 0.5, ease: "power2.out", immediateRender: false },
            0.08,
          )
          .fromTo(
            '[data-tour="water-salts"]',
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { y: -240, scale: 1.1, filter: "drop-shadow(0 13px 22px rgba(0,0,0,0.2))", duration: 0.5, ease: "power2.out", immediateRender: false },
            0.14,
          )
          .fromTo(
            '[data-tour="water-ions"]',
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { y: -240, scale: 1.1, filter: "drop-shadow(0 13px 22px rgba(0,0,0,0.2))", duration: 0.5, ease: "power2.out", immediateRender: false },
            0.2,
          )
          // Auto-Calc "press" once the pieces are out — squash, then spring back.
          .to('[data-tour="water-autocalc"]', { scale: 0.86, duration: 0.1, ease: "power2.in" }, 0.86 + WATER_LEAD)
          .to('[data-tour="water-autocalc"]', { scale: 1, duration: 0.24, ease: "back.out(2.6)" }, 0.96 + WATER_LEAD)
          // the solve: salts count up + ion bars fill as the button springs back
          .fromTo(
            waterProxy,
            { fill: 0 },
            { fill: 1, duration: 1.1, ease: "power2.out", immediateRender: false, onUpdate: applyWaterFill },
            1.05 + WATER_LEAD,
          );

        // COLLAPSE (scroll-driven): the pieces return home, mock returns.
        const waterCollapseTl = gsap.timeline({ paused: true });
        waterCollapseTl
          .fromTo(
            '[data-tour="mock"]',
            { scale: 0.84, xPercent: -10 },
            { scale: 1, xPercent: 0, duration: 0.8, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            ".tour-dim",
            { opacity: 0.35 },
            { opacity: 1, duration: 0.8, ease: "none", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="water-header"]',
            { x: -16, scale: 0.9, opacity: 0.25 },
            { x: 0, scale: 1, opacity: 1, duration: 0.8, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="water-controls"]',
            { y: -240, scale: 1.1, filter: "drop-shadow(0 9px 16px rgba(0,0,0,0.16))" },
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))", duration: 0.8, ease: "power2.in", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="water-salts"]',
            { y: -240, scale: 1.1, filter: "drop-shadow(0 13px 22px rgba(0,0,0,0.2))" },
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))", duration: 0.8, ease: "power2.in", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="water-ions"]',
            { y: -240, scale: 1.1, filter: "drop-shadow(0 13px 22px rgba(0,0,0,0.2))" },
            { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))", duration: 0.8, ease: "power2.in", immediateRender: false },
            0,
          );

        // Grow trigger — play once on enter; blank the salts FIRST so the pieces
        // spread out empty, then press Auto-Calc + solve. Reset on a scroll-up
        // exit so a fresh downward approach replays.
        ScrollTrigger.create({
          trigger: '[data-tour-stage="water"]',
          start: "top 45%",
          end: "bottom 30%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("water");
          },
          onEnter: () => {
            waterProxy.fill = 0;
            setWaterFill(0);
            waterGrowTl.restart();
          },
          onLeaveBack: () => {
            waterGrowTl.pause(0);
            waterCollapseTl.pause(0);
            waterProxy.fill = 1;
            setWaterFill(1);
            gsap.set('[data-tour="mock"]', { scale: 1, xPercent: 0 });
            gsap.set(".tour-dim", { opacity: 1 });
            gsap.set('[data-tour="water-header"]', { x: 0, scale: 1, opacity: 1 });
            gsap.set('[data-tour="water-controls"]', { x: 0, y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
            gsap.set('[data-tour="water-salts"]', { x: 0, y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
            gsap.set('[data-tour="water-ions"]', { x: 0, y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
            gsap.set('[data-tour="water-autocalc"]', { scale: 1 });
          },
        });

        // Collapse trigger — scrub the tuck-back over the later part of the water
        // scroll. Manual progress() on the paused timeline (same reason as hops:
        // a scrub-linked tween would hold-render its spread `from` during grow).
        ScrollTrigger.create({
          trigger: '[data-tour-stage="water"]',
          start: "bottom 78%",
          end: "bottom 38%",
          markers: DEV_MARKERS,
          onUpdate: (self) => {
            if (waterGrowTl.isActive()) waterGrowTl.progress(1);
            waterCollapseTl.progress(self.progress);
          },
          onLeave: () => waterCollapseTl.progress(1),
          onLeaveBack: () => waterCollapseTl.progress(0),
        });

        // ── Honest-numbers beat — FG responds to a mash-temp sweep so the
        //    "148 vs 156" claim is visible, not just asserted. The mock sits on
        //    the mash tab; the sweep nudges the mash step temp + FG/ABV in the
        //    stat strip (152 to 156 to 148, then back). Play-once-on-enter, like
        //    the grains build. fgProxy drives a single React scalar (fgShift).
        // Mash temp LEADS the beat; FG/ABV FOLLOW with a short lag so the
        // cause→effect reads ("I move the temp, the numbers respond") instead of
        // everything changing at once. tempProxy drives the temp; fgFollow eases
        // toward it each frame and drives FG/ABV (+ the gauges). The loop
        // oscillates 152→156→148→… with HOLD-tween settles (which repeat reliably;
        // repeatRefresh flows 156↔148 with no jump), during which FG catches up.
        const tempProxy = { v: 0 };
        const fgFollow = { v: 0 };
        const applyHonest = () => {
          fgFollow.v += (tempProxy.v - fgFollow.v) * 0.12;
          setTempShift(tempProxy.v);
          setFgShift(fgFollow.v);
        };
        const honestTl = gsap.timeline({
          paused: true,
          repeat: -1,
          repeatRefresh: true,
        });
        honestTl
          .to(tempProxy, { v: 1, duration: 1.0, ease: "sine.inOut", onUpdate: applyHonest })
          .to(tempProxy, { v: 1, duration: 1.0, onUpdate: applyHonest })
          .to(tempProxy, { v: -1, duration: 1.3, ease: "sine.inOut", onUpdate: applyHonest })
          .to(tempProxy, { v: -1, duration: 1.0, onUpdate: applyHonest });

        // Switch to the mash tab on entry (onToggle below), but WAIT before the
        // temp starts growing + the loop runs — otherwise the water recede + the
        // tab cross-fade are still finishing and the chip is already big by the
        // time you land on the mash tab. The delayedCall is cancelled if you
        // scroll away before it fires.
        let honestDelay: ReturnType<typeof gsap.delayedCall> | null = null;
        const honestStart = () => {
          honestDelay?.kill();
          honestDelay = gsap.delayedCall(0.7, () => {
            setHonestActive(true);
            honestTl.restart();
          });
        };
        const honestStop = () => {
          honestDelay?.kill();
          honestTl.pause();
          tempProxy.v = 0;
          fgFollow.v = 0;
          setTempShift(0);
          setFgShift(0);
          setHonestActive(false);
        };
        ScrollTrigger.create({
          trigger: '[data-tour-stage="honest"]',
          start: "top 55%",
          end: "bottom 40%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("mash");
          },
          // Grow + loop while in view; stop + shrink + reset to 152 when it leaves
          // in either direction, so nothing keeps running on other beats.
          onEnter: honestStart,
          onEnterBack: honestStart,
          onLeave: honestStop,
          onLeaveBack: honestStop,
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
            '[data-tour="mock"]',
            { opacity: 1, scale: 1, xPercent: 0 },
            { opacity: 0.32, scale: 0.82, xPercent: -14, duration: 1.0, ease: "power2.inOut", immediateRender: false },
            0,
          )
          // the whole section grows OUT of its body slot (home) to the big
          // centred reveal (exploded). Opacity is React-driven by the tab
          // switch; GSAP only moves + scales it. Function-based measured values,
          // invalidated on refresh.
          .fromTo(
            '[data-tour="brewsheet"]',
            { x: () => bsHome.x, y: () => bsHome.y, scale: 1 },
            { x: () => bsExploded.x, y: () => bsExploded.y, scale: () => bsExploded.scale, duration: 1.2, ease: "power2.out", immediateRender: false },
            0.1,
          )
          .fromTo(
            '[data-tour="bs-box"]',
            { height: () => bsHome.h },
            { height: () => bsExploded.h, duration: 1.2, ease: "power2.out", immediateRender: false },
            0.1,
          )
          // the "Brew sheet" tab nub lifts out above the box
          .fromTo(
            '[data-tour="bs-nub"]',
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
          trigger: '[data-tour-stage="brewsheet"]',
          start: "top 50%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("brewsheet");
          },
          onEnter: () => bsGrowTl.restart(),
          onLeaveBack: () => {
            bsGrowTl.pause(0);
            gsap.set('[data-tour="mock"]', { opacity: 1, scale: 1, xPercent: 0 });
            gsap.set('[data-tour="brewsheet"]', { x: bsHome.x, y: bsHome.y, scale: 1 });
            gsap.set('[data-tour="bs-box"]', { height: bsHome.h });
            gsap.set('[data-tour="bs-nub"]', { opacity: 0 });
          },
        });

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", measure);
          ScrollTrigger.removeEventListener("refreshInit", invalidateHops);
          ScrollTrigger.removeEventListener("refreshInit", invalidateBs);
          honestDelay?.kill();
        };
      });

      // ── Mobile (≤1024px) — the mock is pinned at the top and the narrative
      //    scrolls under it. NO pull-outs: every scene-level layer (radar / water
      //    / brew sheet) sits at its rest "home" in the body slot (same approach
      //    as the signed-in hero). Scrolling each stage just switches the active
      //    tab so the mock morphs section-by-section. (Fill beats land next.)
      mm.add("(max-width: 1024px)", () => {
        const scene = rootRef.current?.querySelector(
          ".tour-scene",
        ) as HTMLElement | null;
        if (!scene) return;
        const q = (sel: string) =>
          rootRef.current?.querySelector(sel) as HTMLElement | null;
        const radar = q('[data-tour="radar"]');
        const slot = q('[data-tour="radar-slot"]');
        const bodyEl = q('[data-tour="mock-body"]');
        const bsEl = q('[data-tour="brewsheet"]');
        const waterEl = q('[data-tour="water"]');
        const waterSlot = q('[data-tour="water-slot"]');
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
        // Park the scene-level layers in their body-slot "home" AND measure the
        // "grown" targets (radar centred + scaled, brew sheet at full height) for
        // the reveal beats below.
        const radarHome = { x: 0, y: 0, scale: 1 };
        const radarExploded = { x: 0, y: 0, scale: 2.6 };
        const bsHomeH = { v: 0 };
        const bsFullH = { v: 0 };
        const bsHome = { y: 0 };
        const bsExploded = { y: -40 };
        const place = () => {
          if (radar && slot) {
            const o = offsetWithin(slot, scene);
            const rw = radar.offsetWidth || 112;
            const rh = radar.offsetHeight || 112;
            radarHome.x = o.x;
            radarHome.y = o.y;
            radarHome.scale = slot.offsetWidth / rw;
            const ES = 2.6;
            radarExploded.x = (scene.offsetWidth - rw * ES) / 2;
            radarExploded.y = Math.max(8, (scene.offsetHeight - rh * ES) / 2 - 16);
            radarExploded.scale = ES;
            gsap.set(radar, {
              x: radarHome.x,
              y: radarHome.y,
              scale: radarHome.scale,
            });
          }
          if (bsEl && bodyEl) {
            const bo = offsetWithin(bodyEl, scene);
            const bsBox = bsEl.querySelector(
              '[data-tour="bs-box"]',
            ) as HTMLElement | null;
            const inner = bsEl.querySelector(
              '[data-tour="bs-inner"]',
            ) as HTMLElement | null;
            bsHomeH.v = bodyEl.offsetHeight;
            bsFullH.v = inner ? inner.offsetHeight * 0.82 + 6 : bodyEl.offsetHeight;
            bsHome.y = bo.y;
            bsExploded.y = -40; // lifts up past the top of the scene on its beat
            if (bsBox) {
              bsBox.style.width = `${bodyEl.offsetWidth}px`;
              gsap.set(bsBox, { height: bsHomeH.v });
            }
            gsap.set(bsEl, { x: bo.x, y: bo.y, scale: 1 });
            const nub = bsEl.querySelector(
              '[data-tour="bs-nub"]',
            ) as HTMLElement | null;
            if (nub) gsap.set(nub, { opacity: 0 });
            // Publish the LIFTED sheet's on-screen bottom (scene px × the mock's
            // render scale) so the brew-sheet copy can be padded clear of it.
            if (bsBox && bsBox.offsetHeight) {
              const renderScale =
                bsBox.getBoundingClientRect().height / bsBox.offsetHeight;
              rootRef.current?.style.setProperty(
                "--tour-bs-grown-h",
                `${Math.round((bsExploded.y + bsFullH.v) * renderScale)}px`,
              );
            }
          }
          if (waterEl && waterSlot) {
            const wo = offsetWithin(waterSlot, scene);
            waterEl.style.width = `${waterSlot.offsetWidth}px`;
            gsap.set(waterEl, { x: wo.x, y: wo.y, scale: 1 });
          }
        };
        place();
        ScrollTrigger.addEventListener("refreshInit", place);

        // ── Reveal beats: the hops radar grows out of its slot to centre (the
        //    rest of the mock dims behind it), and the brew sheet box grows from
        //    the body slot to its FULL height (un-clipping it) with its tab nub.
        //    Play-once on enter; reset on leave. Function-based targets are
        //    invalidate()d on refresh.
        const radarGrowTl = gsap.timeline({ paused: true });
        radarGrowTl
          .to({}, { duration: 0.3 })
          .fromTo(
            radar,
            { x: () => radarHome.x, y: () => radarHome.y, scale: () => radarHome.scale },
            { x: () => radarExploded.x, y: () => radarExploded.y, scale: () => radarExploded.scale, duration: 0.8, ease: "power2.out", immediateRender: false },
            0.3,
          )
          .fromTo(
            '[data-tour="radar"] > div',
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.22))", duration: 0.8, ease: "none", immediateRender: false },
            0.3,
          )
          .fromTo(
            ".tour-dim",
            { opacity: 1 },
            { opacity: 0.4, duration: 0.55, ease: "none", immediateRender: false },
            0.3,
          );
        const resetRadar = () => {
          radarGrowTl.pause(0);
          gsap.set(radar, { x: radarHome.x, y: radarHome.y, scale: radarHome.scale });
          gsap.set('[data-tour="radar"] > div', { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          gsap.set(".tour-dim", { opacity: 1 });
        };

        const bsGrowTl = gsap.timeline({ paused: true });
        bsGrowTl
          // the mock fades back AND slides left as the brew sheet disconnects...
          .fromTo(
            '[data-tour="mock"]',
            { opacity: 1, xPercent: 0 },
            { opacity: 0.32, xPercent: -12, duration: 0.7, ease: "power2.inOut", immediateRender: false },
            0,
          )
          // ...and rises (y up) while growing to its full height.
          .fromTo(
            '[data-tour="brewsheet"]',
            { y: () => bsHome.y },
            { y: () => bsExploded.y, duration: 0.9, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="bs-box"]',
            { height: () => bsHomeH.v },
            { height: () => bsFullH.v, duration: 0.9, ease: "power2.out", immediateRender: false },
            0,
          )
          .fromTo(
            '[data-tour="bs-nub"]',
            { opacity: 0 },
            { opacity: 1, duration: 0.4, ease: "none", immediateRender: false },
            0.35,
          );
        const resetBs = () => {
          bsGrowTl.pause(0);
          gsap.set('[data-tour="mock"]', { opacity: 1, xPercent: 0 });
          gsap.set('[data-tour="brewsheet"]', { y: bsHome.y });
          gsap.set('[data-tour="bs-box"]', { height: bsHomeH.v });
          gsap.set('[data-tour="bs-nub"]', { opacity: 0 });
        };

        const invalidateReveals = () => {
          radarGrowTl.invalidate();
          bsGrowTl.invalidate();
        };
        ScrollTrigger.addEventListener("refreshInit", invalidateReveals);

        // ── Fill beats (play-once-on-enter, like the showy desktop builds, but
        //    WITHOUT the pull-outs — the mock stays put and animates in place).
        //    Same scalars the desktop drives.

        // Grains: the bill builds itself as a staircase (clear, then add each
        // grain so the vitals jump one contribution at a time).
        const grainProxy = { fill: 1 };
        const applyGrain = () => setGrainFill(grainProxy.fill);
        const grainFrom = [0, ...GRAIN_STEP_LEVELS];
        const grainsTl = gsap.timeline({ paused: true });
        grainsTl
          .fromTo(
            grainProxy,
            { fill: 1 },
            { fill: 0, duration: 0.45, ease: "power2.in", immediateRender: false, onUpdate: applyGrain },
          )
          .to({}, { duration: 0.25 });
        GRAIN_STEP_LEVELS.forEach((level, i) => {
          grainsTl.fromTo(
            grainProxy,
            { fill: grainFrom[i] },
            { fill: level, duration: 0.4, ease: "power2.out", immediateRender: false, onUpdate: applyGrain },
          );
          if (i < GRAIN_STEP_LEVELS.length - 1) grainsTl.to({}, { duration: 0.55 });
        });

        // Water: the section "grows out" like desktop — the header recedes and
        // the data pieces (controls / salts / ion bars) lift FORWARD as a group
        // (up + scale + drop-shadow) while the rest of the mock dims; then
        // Auto-Calc is "pressed" and the salts + ion bars solve (0→1). The clip
        // is lifted on enter (so the pieces can rise out) and restored on reset.
        const waterProxy = { fill: 1 };
        const applyWater = () => setWaterFill(waterProxy.fill);
        const WLIFT = -40;
        const waterTl = gsap.timeline({ paused: true });
        waterTl
          .fromTo(".tour-dim", { opacity: 1 }, { opacity: 0.4, duration: 0.5, ease: "none", immediateRender: false }, 0)
          .fromTo('[data-tour="water-header"]', { x: 0, scale: 1, opacity: 1 }, { x: -8, scale: 0.92, opacity: 0.3, duration: 0.5, ease: "power2.inOut", immediateRender: false }, 0)
          .fromTo('[data-tour="water-controls"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" }, { y: WLIFT, scale: 1.13, filter: "drop-shadow(0 8px 15px rgba(0,0,0,0.16))", duration: 0.5, ease: "power2.out", immediateRender: false }, 0.06)
          .fromTo('[data-tour="water-salts"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" }, { y: WLIFT, scale: 1.13, filter: "drop-shadow(0 11px 19px rgba(0,0,0,0.2))", duration: 0.5, ease: "power2.out", immediateRender: false }, 0.12)
          .fromTo('[data-tour="water-ions"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" }, { y: WLIFT, scale: 1.13, filter: "drop-shadow(0 11px 19px rgba(0,0,0,0.2))", duration: 0.5, ease: "power2.out", immediateRender: false }, 0.18)
          .to('[data-tour="water-autocalc"]', { scale: 0.86, duration: 0.1, ease: "power2.in" }, 0.66)
          .to('[data-tour="water-autocalc"]', { scale: 1, duration: 0.24, ease: "back.out(2.6)" }, 0.76)
          .fromTo(
            waterProxy,
            { fill: 0 },
            { fill: 1, duration: 1.1, ease: "power2.out", immediateRender: false, onUpdate: applyWater },
            0.88,
          );
        const resetWater = () => {
          waterTl.pause(0);
          waterProxy.fill = 1;
          setWaterFill(1);
          if (waterEl) gsap.set(waterEl, { overflow: "hidden" });
          gsap.set('[data-tour="water-header"]', { x: 0, scale: 1, opacity: 1 });
          gsap.set('[data-tour="water-controls"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          gsap.set('[data-tour="water-salts"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          gsap.set('[data-tour="water-ions"]', { y: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" });
          gsap.set('[data-tour="water-autocalc"]', { scale: 1 });
          gsap.set(".tour-dim", { opacity: 1 });
        };

        // Honest numbers: mash temp sweeps, FG/ABV lag it, the temp chip grows.
        // Loops while in view; a short delay lets the tab cross-fade land first.
        const tempProxy = { v: 0 };
        const fgFollow = { v: 0 };
        const applyHonest = () => {
          fgFollow.v += (tempProxy.v - fgFollow.v) * 0.12;
          setTempShift(tempProxy.v);
          setFgShift(fgFollow.v);
        };
        const honestTl = gsap.timeline({ paused: true, repeat: -1, repeatRefresh: true });
        honestTl
          .to(tempProxy, { v: 1, duration: 1.0, ease: "sine.inOut", onUpdate: applyHonest })
          .to(tempProxy, { v: 1, duration: 1.0, onUpdate: applyHonest })
          .to(tempProxy, { v: -1, duration: 1.3, ease: "sine.inOut", onUpdate: applyHonest })
          .to(tempProxy, { v: -1, duration: 1.0, onUpdate: applyHonest });
        let honestDelay: ReturnType<typeof gsap.delayedCall> | null = null;
        const honestStart = () => {
          honestDelay?.kill();
          honestDelay = gsap.delayedCall(0.35, () => {
            setHonestActive(true);
            honestTl.restart();
          });
        };
        const honestStop = () => {
          honestDelay?.kill();
          honestTl.pause();
          tempProxy.v = 0;
          fgFollow.v = 0;
          setTempShift(0);
          setFgShift(0);
          setHonestActive(false);
        };

        // Per-stage triggers: switch the tab + drive that section's beat.
        ScrollTrigger.create({
          trigger: '[data-tour-stage="grains"]',
          start: "top 60%",
          end: "bottom 40%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("fermentables");
          },
          onEnter: () => grainsTl.restart(),
          onLeaveBack: () => {
            grainsTl.pause(0);
            grainProxy.fill = 1;
            setGrainFill(1);
          },
        });
        ScrollTrigger.create({
          trigger: '[data-tour-stage="hops"]',
          start: "top 55%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("hops");
          },
          onEnter: () => radarGrowTl.restart(),
          onEnterBack: () => radarGrowTl.restart(),
          onLeave: resetRadar,
          onLeaveBack: resetRadar,
        });
        ScrollTrigger.create({
          trigger: '[data-tour-stage="water"]',
          start: "top 55%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("water");
          },
          onEnter: () => {
            if (waterEl) gsap.set(waterEl, { overflow: "visible" });
            waterProxy.fill = 0;
            setWaterFill(0);
            waterTl.restart();
          },
          onEnterBack: () => {
            if (waterEl) gsap.set(waterEl, { overflow: "visible" });
            waterProxy.fill = 0;
            setWaterFill(0);
            waterTl.restart();
          },
          onLeave: resetWater,
          onLeaveBack: resetWater,
        });
        ScrollTrigger.create({
          trigger: '[data-tour-stage="honest"]',
          start: "top 55%",
          end: "bottom 40%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("mash");
          },
          onEnter: honestStart,
          onEnterBack: honestStart,
          onLeave: honestStop,
          onLeaveBack: honestStop,
        });
        ScrollTrigger.create({
          trigger: '[data-tour-stage="brewsheet"]',
          start: "top 55%",
          end: "bottom 35%",
          markers: DEV_MARKERS,
          onToggle: (self) => {
            if (self.isActive) setActiveTabAndStop("brewsheet");
          },
          onEnter: () => bsGrowTl.restart(),
          onEnterBack: () => bsGrowTl.restart(),
          onLeave: resetBs,
          onLeaveBack: resetBs,
        });

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", place);
          ScrollTrigger.removeEventListener("refreshInit", invalidateReveals);
          honestDelay?.kill();
        };
      });

      // Post-tour stages — single play-once fade-up on enter for any
      // `[data-tour-reveal]` block. Light: no scrub, no scroll-jack. Fires on every
      // viewport (the post-tour grid is full-width on mobile + desktop), so it
      // lives OUTSIDE the desktop `mm.add` above. Reduced-motion users skip this
      // path entirely via the early-return above, so elements stay at their
      // natural CSS opacity 1 (no invisibility trap).
      const reveals = gsap.utils.toArray<HTMLElement>("[data-tour-reveal]");
      if (reveals.length) {
        gsap.set(reveals, { opacity: 0, y: 16 });
        ScrollTrigger.batch(reveals, {
          start: "top 88%",
          onEnter: (els) =>
            gsap.to(els, {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              stagger: 0.06,
              overwrite: true,
            }),
        });
      }

      // ── Per-section SplitText reveals on the tour copy — words for short
      //    heads (hero h1, stage leads), lines for paragraphs (subhead,
      //    opening sentences, stage bodies). "Introduce → show off": the
      //    copy rises into place as the reader enters each stage, play-once
      //    so scrolling back doesn't re-trigger it. The post-tour batch
      //    above stays a coarse block fade-up — this is just the tour copy.
      //    mask: "lines" wraps each line in overflow:hidden so words/lines
      //    rise from below the line baseline with no clip artifacts.
      //    autoSplit re-splits on resize / when the display font settles
      //    (line wrapping shifts); the per-element `revealed` flag holds
      //    the final state on re-splits so a resize past the section never
      //    re-fires the animation.
      const splitTargets = gsap.utils.toArray<HTMLElement>(
        "[data-tour-split-reveal]",
      );
      const splitInstances: SplitText[] = [];
      splitTargets.forEach((el) => {
        const mode = el.dataset.tourSplitMode === "words" ? "words" : "lines";
        let revealed = false;
        const instance = SplitText.create(el, {
          type: mode === "words" ? "words,lines" : "lines",
          mask: "lines",
          linesClass: "tour-split-line",
          wordsClass: "tour-split-word",
          autoSplit: true,
          onSplit: (self) => {
            const tgs = mode === "words" ? self.words : self.lines;
            if (revealed) {
              gsap.set(tgs, { yPercent: 0, opacity: 1 });
              return undefined;
            }
            gsap.set(tgs, { yPercent: 110, opacity: 0 });
            return gsap.to(tgs, {
              yPercent: 0,
              opacity: 1,
              duration: 0.7,
              ease: "power2.out",
              stagger: mode === "words" ? 0.025 : 0.07,
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                once: true,
                onEnter: () => {
                  revealed = true;
                },
              },
            });
          },
        });
        splitInstances.push(instance);
      });

      // Scroll cue (hero) fades out over the first ~200px of scroll, then is gone.
      const cueEl = rootRef.current?.querySelector('[data-tour="scrollcue"]');
      if (cueEl) {
        gsap.to(cueEl, {
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: rootRef.current, start: "top top", end: "+=200", scrub: true },
        });
      }

      // Custom fonts (Archivo Black / Space Grotesk) load late and shift layout;
      // measured positions (radar/brewsheet home + exploded) computed before
      // that settle land wrong, so refresh once fonts are ready.
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }

      // SplitText DOM mutations aren't tracked by gsap.context (which
      // useGSAP scopes everything through), so they need an explicit revert
      // on dependency change / unmount — otherwise the wrapper spans would
      // leak across remounts.
      return () => {
        splitInstances.forEach((s) => s.revert());
      };
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  // Mobile mock scale: publish the mock's natural (unscaled) height so the CSS
  // can reclaim exactly the space `transform: scale` frees (see .tour-mock-scale).
  // offsetHeight ignores the transform, so it's the true layout height; a
  // ResizeObserver keeps it fresh as the active tab's content changes.
  useEffect(() => {
    const el = rootRef.current?.querySelector(
      ".tour-mock-scale",
    ) as HTMLElement | null;
    if (!el) return;
    const publish = () =>
      rootRef.current?.style.setProperty(
        "--tour-mock-natural-h",
        `${el.offsetHeight}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The left column (tour text) is memoized so it does NOT re-render when
  // `activeTab` / `grainFill` change — it's a heavy text column and nothing in
  // it depends on those. (Historically this was REQUIRED to dodge the pin+React
  // removeChild crash when the brewsheet stage was GSAP-pinned; no beat pins
  // anymore, so it's now purely a perf win — but still worth keeping.)
  // Split into hero + the rest so mobile can place the mock BETWEEN them: the
  // hero stays full-width on top (row 1), then the mock and the remaining
  // narrative share row 2 (overlapping) so the mock can stick to the top of the
  // viewport while the narrative scrolls underneath it (see the mobile CSS).
  // On desktop both live in column 1 (hero row 1, narrative row 2) and the mock
  // spans column 2 — i.e. the original two-column tour, unchanged. Memoized so
  // it does NOT re-render on activeTab / grainFill / … changes.
  const tourText = useMemo(
    () => (
      <>
        <div
          className="tour-hero-col"
          style={{ minWidth: 0, gridColumn: 1, gridRow: 1 }}
        >
          <StageIntro />
        </div>
        {/* Opening (the chaos) sits ABOVE the mock — full-width, no mock yet. */}
        <div
          className="tour-intro-col"
          style={{ minWidth: 0, gridColumn: 1, gridRow: 2 }}
        >
          <StageOpening />
        </div>
        {/* The mock joins HERE (grains onward) and goes sticky. On mobile it
            overlaps this block (row 3); on desktop the mock column spans every
            row, so it's present from the top as before. */}
        <div
          className="tour-narr-col"
          style={{ minWidth: 0, gridColumn: 1, gridRow: 3 }}
        >
          <StageGrains />
          <StageHops />
          <StageWater />
          <StageHonestNumbers />
          <StageBrewSheet />
        </div>
      </>
    ),
    [],
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
      <ScrollCue reduced={reducedMotion} />

      <div
        className="tour-layout"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding:
            "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          // column gap only — hero (row 1) and narrative (row 2) sit in column 1
          // and must stay flush vertically (no row gap) so desktop is unchanged.
          columnGap: 48,
          rowGap: 0,
          position: "relative",
          zIndex: 2,
          // alignItems left at default `stretch` so the right column grows
          // to the full tour height — required for position:sticky to track
          // across the whole tour (and across the injected pin spacing).
        }}
      >
        {tourText}

        <div
          className="tour-right tour-mock-col"
          style={{
            position: "relative",
            minWidth: 0,
            gridColumn: 2,
            gridRow: "1 / span 3",
          }}
        >
          <div
            className="tour-sticky-mock"
            style={{
              position: "sticky",
              top: "clamp(112px, calc(50vh - 290px), 280px)",
            }}
          >
            {/* Mobile only (CSS): a full-width page-colored band behind the mock
                so the narrative scrolls cleanly UNDER it (no text spilling beside
                the card), with a soft fade at its bottom edge so text fades out
                rather than hard-cutting. */}
            <div className="tour-mock-band" aria-hidden />
            {/* Scale wrapper — a no-op on desktop (scale 1); mobile shrinks the
                whole mock to fit a phone (see CSS). transform:scale keeps the
                offsetLeft/Top measurements transform-independent. */}
            <div className="tour-mock-scale">
              <BuilderMock
                activeTab={activeTab}
                onSelectTab={setActiveTabAndStop}
                grainFill={grainFill}
                waterFill={waterFill}
                fgShift={fgShift}
                tempShift={tempShift}
                honestActive={honestActive}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Below the tour — full-width stages, no sticky mock. The brewsheet beat
          plays-once-on-enter (no pin anymore), so the page can end right after
          these without leaving a pin mid-release. (BrewedAgain folded into the
          brew sheet stage — version-history belongs with the brew sheet that
          produces each version.) */}
      <StageCompare />
      <StageLibraryCommunity recipes={recipes} />
      <StageWhatElse />
      <StageLearn />
      <StageFAQ />
      <StageClose />
      <StageFeedback />

      <style>{`
        /* Lenis smooth-scroll recommended baseline */
        html.lenis, html.lenis body { height: auto; }
        .lenis.lenis-smooth { scroll-behavior: auto !important; }
        .lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
        .lenis.lenis-stopped { overflow: clip; }

        @keyframes tour-scrollcue {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }

        /* SplitText "lines" wrappers (mask: lines) get a touch of bottom
           padding so descenders ('g', 'y', 'p') don't get clipped on the
           tight-leading display heads (lineHeight: 0.96 on the hero h1).
           Negative margin neutralizes it so the visual layout is unchanged. */
        .tour-split-line {
          padding-bottom: 0.18em;
          margin-bottom: -0.18em;
        }

        /* The mock band is mobile-only (the desktop tour has the radar/water beats). */
        .tour-mock-band { display: none; }

        @media (max-width: 1024px) {
          .tour-layout {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
            gap: 0 !important;
            max-width: 620px !important;
            /* Tighter side padding so the left-pinned mock hugs the screen edge. */
            padding-left: 12px !important;
            padding-right: 12px !important;
            /* Mock sizing knobs. The mock RENDERS at design-w (wide enough that
               the 7-tab bar fits properly), then scales down by scale. Both feed
               the mock AND the narrative's left offset so they stay aligned.
               Smaller scale = smaller mock + wider text. */
            --tour-mock-design-w: 520px;
            --tour-mock-scale: 0.37;
          }
          /* Mobile single column: the mock and narrative share row 2 (overlapping)
             so the mock can stick at the top while the FULL-WIDTH narrative scrolls
             up behind it (covered only where the mock card sits — no mask). Row 2's
             height = the narrative height (the tall block the sticky mock tracks
             across). pointer-events:none on the (full-width, mostly-transparent)
             column so touches reach the scrolling narrative; only the mock card
             re-enables them, over its visual area. */
          .tour-mock-col {
            grid-column: 1 !important;
            /* Row 3 = grains onward, so the mock only appears + sticks once the
               reader passes the hero (row 1) and the opening (row 2). */
            grid-row: 3 !important;
            z-index: 3;
            pointer-events: none;
          }
          /* Soft frosted halo behind the mock (mobile only). Sized to the mock's
             visual box + a feather, centred on it, with a radial mask so the blur
             fades out at the edges — text scrolling under blurs/fades near the
             card rather than hard-cutting. Sits behind the mock card (DOM order). */
          .tour-mock-band {
            display: block;
            position: absolute;
            left: 50%;
            /* Extend well ABOVE the mock too (behind the header) so text scrolling
               up stays masked instead of re-revealing above the card; plus a short
               tail below it. Full page width so nothing spills beside the card. */
            top: -200px;
            width: 100vw;
            height: calc(var(--tour-mock-natural-h, 600px) * var(--tour-mock-scale) + 260px);
            transform: translateX(-50%);
            pointer-events: none;
            background: ${hsTokens.cream};
            /* One simple opacity gradient: fully opaque (1.0) up toward the top of
               the page, then slowly fading to transparent on the way down — so
               text dissolves out gently as it scrolls up toward the top. */
            -webkit-mask-image: linear-gradient(
              to bottom,
              #000 0%,
              #000 32%,
              transparent 100%
            );
            mask-image: linear-gradient(
              to bottom,
              #000 0%,
              #000 32%,
              transparent 100%
            );
          }
          .tour-mock-col [data-tour="mock"] {
            pointer-events: auto;
          }
          /* Pin the body to a constant height so the mock (and therefore the
             masking band, which is sized from the mock's height) doesn't jump as
             the active tab — and its content height — changes on scroll. Sized to
             fit the tallest section (water) so nothing bleeds past it. */
          .tour-mock-col [data-tour="mock-body"] {
            height: 200px !important;
            min-height: 0 !important;
          }
          /* The water section is a SCENE-LEVEL layer (not inside the body's
             overflow), so on mobile — where there's no break-out — clip it to
             itself so it can't bleed below the mock card. */
          .tour-mock-col [data-tour="water"] {
            overflow: hidden;
          }
          .tour-narr-col {
            z-index: 1;
          }
          /* Opening sits ABOVE the mock band (which extends upward), so the band
             never covers the opening copy as the mock spawns past it. */
          .tour-intro-col {
            z-index: 5;
          }
          .tour-sticky-mock {
            position: sticky !important;
            /* Stick a little below the top (padding from the page edge), just
               under the (collapsing) header — when it hides on scroll,
               --hs-header-peek goes 0 and the mock rises to this offset. */
            top: 40px !important;
            transform: translateY(var(--hs-header-peek, 0px));
            transition: transform 0.28s ease;
            /* No mask/background: only the mock CARD (its own opaque fill) covers
               the text directly behind it; the rest of the narrative scrolls past
               in the open column. */
          }
          /* Shrink the whole mock. The negative margin reclaims the layout space
             the scale frees (natural height × (scale − 1)), derived from the
             JS-measured natural height so the sticky element hugs the visual mock
             exactly (no tall empty gap) at any scale. */
          .tour-mock-scale {
            /* Render at a FIXED design width (wide enough for the 7-tab bar to
               sit properly), THEN scale down — rather than rendering at the narrow
               column width, where the tabs overflowed the card. */
            width: var(--tour-mock-design-w, 520px);
            transform: scale(var(--tour-mock-scale));
            transform-origin: top center;
            /* Centre the (wider-than-column) box so the scaled mock sits centred
               in the single column; the overflow past the column is clipped by
               the root. */
            position: relative;
            left: calc((100% - var(--tour-mock-design-w, 520px)) / 2);
            /* Reclaim the vertical space the scale frees so the footprint equals
               the visual height. */
            margin-bottom: calc(
              var(--tour-mock-natural-h, 600px) * (var(--tour-mock-scale) - 1)
            );
          }
          /* Single column: full-width narrative that scrolls UP and passes behind
             the top-stuck mock (covered only where the mock card sits).
             (Trigger timing keys off these section heights in the mobile GSAP
             branch.) */
          .tour-narr-col section {
            padding-left: 0 !important;
            padding-right: 0 !important;
            min-height: 72vh !important;
            justify-content: center !important;
            padding-top: 4vh !important;
            padding-bottom: 4vh !important;
          }
          /* First narrative block (grains): clear the mock's height + a gap so the
             mock spawns in the space between the opening and the grains copy
             instead of landing on top of it. */
          .tour-narr-col section:first-child {
            padding-top: calc(
              var(--tour-mock-natural-h, 600px) * var(--tour-mock-scale) + 80px
            ) !important;
          }
          /* Last narrative block (brew sheet): the sheet grows tall on its beat,
             so push its copy clear of the grown sheet (measured height + a gap)
             so they don't overlap. */
          .tour-narr-col section:last-child {
            justify-content: flex-start !important;
            padding-top: calc(var(--tour-bs-grown-h, 480px) + 56px) !important;
            min-height: 124vh !important;
          }
          /* The narrative is full-width now, but keep the big tour type a notch
             down on mobile so headlines stay tidy. */
          .tour-narr-col section h2 {
            font-size: clamp(19px, 5.6vw, 25px) !important;
            line-height: 1.12 !important;
          }
        }
      `}</style>
    </div>
  );
}

// Minimal scroll affordance. A gently bouncing chevron at the bottom-center of
// the first viewport. No text; scrolls away with the page (absolute, not fixed).
function ScrollCue({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <div
      data-tour="scrollcue"
      aria-hidden
      style={{
        position: "fixed",
        bottom: 24,
        // Viewport-center lands on the mock's left edge (two-column tour), so sit
        // it under the text column instead — a bit left of center.
        left: "45%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "none",
        color: hsTokens.ink,
        opacity: 0.6,
      }}
    >
      {/* Inner element bounces (translateY); the outer keeps the centering
          transform + the GSAP-driven fade, so the two never fight. */}
      <div style={{ animation: "tour-scrollcue 1.7s ease-in-out infinite" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
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
