"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hsTokens } from "@/modules/hopskip/tokens";
import type { CommunityRecipeCard } from "../_home/lib/communityCard";
import { useReducedMotion } from "./lib/useReducedMotion";
import { useLenis } from "./lib/scroll";
import { V4Mock, type TabKey } from "./mock/V4Mock";
import { StageIntro, StageHops, StageBrewSheet } from "./stages/TourSections";

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

  // Lenis smooth scroll (Phase 1). Also powers the auto-advance through the
  // pinned brewsheet beat so it animates itself in.
  const lenisRef = useLenis(!reducedMotion);
  const autoPlayedRef = useRef(false);
  // Which builder tab the mock is showing. React owns section visibility; the
  // tour switches it per beat, and the tab bar lets the user switch it at rest.
  const [activeTab, setActiveTab] = useState<TabKey>("hops");

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

        // ── Hops beat: radar explodes, then closes back to default ──────
        const hops = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-v4-stage="hops"]',
            start: "top 45%",
            end: "bottom 45%",
            scrub: true,
            invalidateOnRefresh: true,
            markers: DEV_MARKERS,
            onToggle: (self) => {
              if (self.isActive) setActiveTab("hops");
            },
          },
        });
        hops
          // the WHOLE mock (outline + chrome) scales down + slides left, like
          // the brew sheet beat. The radar is a child, so its own scale is
          // bumped to stay large against the receding card.
          .fromTo(
            '[data-v4="mock"]',
            { scale: 1, xPercent: 0 },
            { scale: 0.84, xPercent: -12, ease: "none" },
            0,
          )
          .fromTo(
            '[data-v4="radar"]',
            { x: () => home.x, y: () => home.y, scale: () => home.scale },
            {
              x: () => exploded.x,
              y: () => exploded.y,
              scale: () => exploded.scale,
              ease: "power2.out",
            },
            0,
          )
          // soft drop shadow via FILTER so the chunky offset boxShadow (the
          // brand backdrop) stays put — both shadows show at once, no swap.
          .fromTo(
            '[data-v4="radar"] > div',
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
            { filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.22))", ease: "none" },
            0,
          )
          // the rest of the builder also dims to emphasize the visualizer
          .fromTo(".v4-dim", { opacity: 1 }, { opacity: 0.4, ease: "none" }, 0)
          // CLOSE — offset so the mock starts returning BEFORE the radar
          // tucks back into it: mock first (0.5), contents (0.6), then the
          // radar shrinks home (0.72), shadow last (0.85).
          .to(
            '[data-v4="mock"]',
            { scale: 1, xPercent: 0, ease: "power2.out" },
            0.5,
          )
          .to(".v4-dim", { opacity: 1, ease: "none" }, 0.6)
          .to(
            '[data-v4="radar"]',
            {
              x: () => home.x,
              y: () => home.y,
              scale: () => home.scale,
              ease: "power2.in",
            },
            0.72,
          )
          .to(
            '[data-v4="radar"] > div',
            { filter: "drop-shadow(0 0 0 rgba(0,0,0,0))", ease: "none" },
            0.85,
          );

        // ── Brewsheet beat: hard-pin the text column; mock recedes, the
        //    brew-sheet panel rises and its rows stagger in ──────────────
        // Auto-advance: when the brewsheet pin is reached, Lenis smoothly
        // scrolls through the pinned range so the brew sheet animates itself
        // in (the "this feels like an anim" beat). User input interrupts it
        // (lock: false); it replays on re-entry from above.
        // autoPlay reads the timeline (self.animation) + its "shown" label —
        // the scroll point where the brew sheet is fully revealed.
        const autoPlay = (self: ScrollTrigger) => {
          const lenis = lenisRef.current;
          const tl = self.animation as gsap.core.Timeline | undefined;
          if (!lenis || autoPlayedRef.current || !tl) return;
          autoPlayedRef.current = true;
          const total = tl.totalDuration();
          const shownFrac = total ? (tl.labels.shown ?? total) / total : 1;
          const target = self.start + shownFrac * (self.end - self.start);
          lenis.scrollTo(target, {
            duration: 1.9,
            force: true,
            lock: true, // reliably land on the fully-shown brew sheet
            easing: (t) =>
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
          });
        };
        const bs = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-v4-stage="brewsheet"]',
            start: "top 16%",
            end: "+=150%",
            pin: '[data-v4-stage="brewsheet"]',
            pinSpacing: true,
            scrub: true,
            invalidateOnRefresh: true,
            markers: DEV_MARKERS,
            onToggle: (self) => {
              if (self.isActive) setActiveTab("brewsheet");
            },
            onEnter: (self) => autoPlay(self),
            onLeaveBack: () => {
              autoPlayedRef.current = false;
            },
          },
        });
        bs
          // mock chrome (header/stats/tabs/hops body) scales DOWN + slides
          // LEFT and dims as the brew sheet — now the active tab — pulls out
          .fromTo(
            '[data-v4="mock"]',
            { opacity: 1, scale: 1, xPercent: 0 },
            { opacity: 0.32, scale: 0.82, xPercent: -14, ease: "none" },
            0,
          )
          // the brew sheet (the whole active-tab section) grows OUT of its
          // body slot (home) to the big centred reveal (exploded). Opacity is
          // React-driven by the tab switch; GSAP only moves + scales it.
          .fromTo(
            '[data-v4="brewsheet"]',
            { x: () => bsHome.x, y: () => bsHome.y, scale: 1 },
            {
              x: () => bsExploded.x,
              y: () => bsExploded.y,
              scale: () => bsExploded.scale,
              ease: "power2.out",
            },
            0.05,
          )
          .fromTo(
            '[data-v4="bs-box"]',
            { height: () => bsHome.h },
            { height: () => bsExploded.h, ease: "power2.out" },
            0.05,
          )
          .fromTo(
            '[data-v4="bs-nub"]',
            { opacity: 0 },
            { opacity: 1, ease: "none" },
            0.2,
          )
          // brew sheet fully shown — the auto-advance lands here
          .addLabel("shown")
          // hold it fully shown for a beat before the pin releases
          .to({}, { duration: 0.9 });

        return () => ScrollTrigger.removeEventListener("refreshInit", measure);
      });

      // Custom fonts (Archivo Black / Space Grotesk) load late and shift
      // layout; pins computed before that land at the wrong scroll spot.
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
    },
    { scope: rootRef, dependencies: [reducedMotion] },
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
        <div className="v4-tour-left" style={{ minWidth: 0 }}>
          <StageIntro recipeCount={recipeCount} />
          <StageHops />
          <StageBrewSheet />
        </div>

        <div className="v4-tour-right" style={{ position: "relative", minWidth: 0 }}>
          <div
            className="v4-sticky-mock"
            style={{
              position: "sticky",
              top: "clamp(112px, calc(50vh - 290px), 280px)",
            }}
          >
            <V4Mock activeTab={activeTab} onSelectTab={setActiveTab} />
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
