"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";

import { hsTokens } from "../tokens";
import { easeStandard, springSoft } from "../motion";
import HSBrandMark from "./HSBrandMark";
import HSAuthButton from "./HSAuthButton";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { useUnsavedChangesStore } from "@/modules/beta-builder/presentation/stores/unsavedChangesStore";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/calculators", label: "Calculators" },
  { href: "/learn", label: "Learn" },
];

export default function HSHeader() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);

  /**
   * Click handler for the primary nav Links — routes through the unsaved-
   * changes guard when an editor is registered (HopSkipBuilder or
   * BetaBuilderPage). Pass-through for modifier-clicks ("open in new tab").
   */
  const handleNavLinkClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    const { isActive, guardNavigation } = useUnsavedChangesStore.getState();
    if (isActive) {
      e.preventDefault();
      guardNavigation(() => router.push(href));
    }
  };
  // When the OS-level "reduce motion" preference is on, collapse the slide
  // to an instant teleport so we don't override the user's accessibility
  // setting. Reactive — if they toggle it mid-session, the hook updates.
  const reduceMotion = useReducedMotion();
  // Which nav link is the cursor over right now (null = not over any). Drives
  // the magnetic-pull lean of the pill toward inactive links on hover.
  // Stored at nav level (mouseLeave on the nav container clears it) so moving
  // from link A to link B doesn't flicker through a brief null state.
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  // Indices of the active link and the hovered link inside LINKS. We use
  // ordering (left vs right) to decide the sign of the magnetic offset —
  // hovering a link to the right of the active link pulls the pill right;
  // a link to the left pulls left.
  const activeIdx = LINKS.findIndex((l) =>
    l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)
  );
  const hoveredIdx = hoveredHref ? LINKS.findIndex((l) => l.href === hoveredHref) : -1;
  // Direction of the magnetic pull, or "none" if there's nothing to pull
  // toward. The skin element's `transform-origin` keys off this so the
  // BACK edge of the pill stays anchored while the FRONT stretches toward
  // the cursor — that anchored-back stretch is the whole point of the
  // gooey feel from the old SegmentedToggle.
  const stretchDir: "left" | "right" | "none" =
    reduceMotion || activeIdx < 0 || hoveredIdx < 0 || hoveredIdx === activeIdx
      ? "none"
      : hoveredIdx > activeIdx
        ? "right"
        : "left";
  // Stretch magnitude grows with how many links away the hover target is.
  // 4% scaleX per step of distance: adjacent link → 1.04, two away → 1.08,
  // three away (cross-nav reach) → 1.12. With pill widths ~70-110px, that
  // works out to a 3px → 13px visible reach — subtle for close hovers,
  // dramatic for far ones, matching the "the further you are the more it
  // strains toward you" feeling the user asked for.
  const distance = stretchDir === "none" ? 0 : Math.abs(hoveredIdx - activeIdx);
  const stretchScale = 1 + 0.04 * distance;

  // Elastic-edge bulge on the WIDE nav frame: when the active link changes,
  // the frame's edge in the direction of the slide is briefly pushed
  // outward by the arriving pill, then springs back. Two phases:
  //   1. DELAY (~100ms): the pill is still traveling toward the frame
  //      edge — frame is at rest, no bulge yet. This is the "stretch only
  //      when the pill is hitting it" the user asked for.
  //   2. PUSH (rapid ease-out, ~120ms): pill is now in its overshoot
  //      phase, frame's near edge gets shoved out to peakScale.
  //   3. SPRING-BACK (springSoft, ~400ms): the frame springs back to 1
  //      with the SAME spring config as the pill, so the frame's
  //      settling oscillation echoes the pill's. They wind down together.
  // Magnitude scales with slide distance — the pill's overshoot is
  // bigger for longer travels, so the frame should strain more too.
  const navControls = useAnimation();
  const prevActiveIdxRef = useRef(activeIdx);
  useEffect(() => {
    const prev = prevActiveIdxRef.current;
    prevActiveIdxRef.current = activeIdx;
    if (prev === activeIdx || activeIdx < 0 || prev < 0 || reduceMotion) return;
    // Only bulge when the destination is one of the END links (Home or
    // Learn) — those are the only slides where the pill actually pushes
    // against the frame's edge. For middle destinations (Recipes,
    // Calculators) the pill lands inside the frame with comfortable
    // room on both sides; no edge strain to echo.
    const isEndDestination =
      activeIdx === 0 || activeIdx === LINKS.length - 1;
    if (!isEndDestination) return;
    const dir = activeIdx > prev ? "right" : "left";
    // Anchor the FAR edge so the NEAR edge (toward the slide direction)
    // is the one that stretches out. Same off-center origin trick the
    // magnetic hover stretch uses.
    const origin = dir === "right" ? "0% 50%" : "100% 50%";
    // Fixed peak — the bulge is now a consistent "the pill bonked the
    // edge" cue, not a distance-scaled effect.
    const peakScale = 1.035;
    let cancelled = false;
    const sequence = async () => {
      // Phase 1+2: delay, then rapid push out to peak. The pill is
      // sampled to reach the frame edge around t≈140ms and peak overshoot
      // around t≈180ms, so we delay 100ms and rise over 120ms to land
      // peak around t=220ms — just behind the pill's peak, which reads
      // as the pill "shoving" the frame.
      await navControls.start({
        scaleX: peakScale,
        transformOrigin: origin,
        transition: {
          scaleX: { delay: 0.1, duration: 0.12, ease: easeStandard },
          transformOrigin: { duration: 0 },
        },
      });
      if (cancelled) return;
      // Phase 3: spring back to rest with springSoft — the SAME spring
      // the pill uses, so the small secondary oscillation as the frame
      // settles mirrors the pill's settling. That's the "echo".
      void navControls.start({
        scaleX: 1,
        transition: { scaleX: springSoft },
      });
    };
    void sequence();
    return () => {
      cancelled = true;
    };
  }, [activeIdx, reduceMotion, navControls]);

  // ── Persistent pill positioning ───────────────────────────────────
  //
  // The pill is a single motion.div that lives across the lifetime of
  // the header. On each active-link change we MEASURE the active link's
  // bounding rect relative to the nav and animate the pill's
  // (x, y, width, height) to match. This deliberately avoids
  // framer-motion's `layoutId` cross-mount bridging, which captures
  // viewport-relative snapshots and breaks when navigation resets the
  // page scroll position — the captured "old position" then refers to a
  // scrolled-down viewport and the new mount measures at scroll=0, so
  // the pill animates from far below where it actually was. By keeping
  // a single persistent element and measuring nav-relative coordinates,
  // the page scroll position never enters the equation.
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>(
    Array(LINKS.length).fill(null)
  );
  const [pillTarget, setPillTarget] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (activeIdx < 0) {
      setPillTarget(null);
      return;
    }
    const link = linkRefs.current[activeIdx];
    const nav = navRef.current;
    if (!link || !nav) return;
    const linkRect = link.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    // -2 / +4 mirrors the old `inset: -2` on the layoutId pill, so the
    // pill's visible ink border lands at the link's outer edge (the
    // link carries a 2px transparent border for size parity).
    setPillTarget({
      x: linkRect.left - navRect.left - 2,
      y: linkRect.top - navRect.top - 2,
      w: linkRect.width + 4,
      h: linkRect.height + 4,
    });
  }, [activeIdx, pathname]);

  // Re-measure on window resize and any layout shift that resizes the
  // nav itself (e.g., font load shrinking/widening labels).
  useEffect(() => {
    const remeasure = () => {
      if (activeIdx < 0) return;
      const link = linkRefs.current[activeIdx];
      const nav = navRef.current;
      if (!link || !nav) return;
      const linkRect = link.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setPillTarget({
        x: linkRect.left - navRect.left - 2,
        y: linkRect.top - navRect.top - 2,
        w: linkRect.width + 4,
        h: linkRect.height + 4,
      });
    };
    window.addEventListener("resize", remeasure);
    let observer: ResizeObserver | null = null;
    if (navRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(remeasure);
      observer.observe(navRef.current);
    }
    return () => {
      window.removeEventListener("resize", remeasure);
      observer?.disconnect();
    };
  }, [activeIdx]);

  // ── Mobile collapse-on-scroll ─────────────────────────────────────────
  // On small screens the sticky header eats scarce vertical space, so hide it
  // on scroll-down and reveal it on scroll-up (a standard mobile pattern).
  // Also publishes its occupied height to --hs-header-peek (0 while hidden) so
  // sticky page content — e.g. the v4 tour mock — can sit just below it and
  // rise into the freed space when it collapses. No-op above 1024px (the
  // header stays put on desktop, where there's room).
  const headerRef = useRef<HTMLElement | null>(null);
  const hiddenRef = useRef(false);
  const [hidden, setHidden] = useState(false);
  // The homepage tour pins a mock just under the header, so a mid-page scroll-up
  // that reveals the header would shove it around. There the header shows ONLY
  // near the top; everywhere else keeps the standard reveal-on-scroll-up feel.
  const tourHeader = pathname === "/v4";
  useEffect(() => {
    const COLLAPSE_MAX = 1024;
    let lastY = window.scrollY;
    let ticking = false;
    const publishPeek = () => {
      const h = hiddenRef.current ? 0 : headerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--hs-header-peek", `${h}px`);
    };
    const setHiddenSafe = (v: boolean) => {
      if (hiddenRef.current === v) return;
      hiddenRef.current = v;
      setHidden(v);
      publishPeek();
    };
    const update = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      if (window.innerWidth > COLLAPSE_MAX) {
        setHiddenSafe(false);
        lastY = y;
        return;
      }
      if (tourHeader) {
        // Pinned-mock pages: show only near the top so a scroll-up doesn't reveal
        // the header mid-page and shove the mock around.
        setHiddenSafe(y > 80);
        lastY = y;
        return;
      }
      // Everywhere else: hide once past the header, reveal on any upward scroll.
      const dy = y - lastY;
      if (Math.abs(dy) < 4) return;
      if (dy > 0 && y > 72) setHiddenSafe(true);
      else if (dy < 0) setHiddenSafe(false);
      lastY = y;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    const onResize = () => {
      publishPeek();
      onScroll();
    };
    publishPeek();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [tourHeader]);

  const caption = useMemo(() => {
    if (pathname === "/") return undefined;
    if (pathname.startsWith("/recipes/new")) return "/ recipes / new";
    if (pathname.match(/^\/recipes\/[^/]+$/)) {
      const name = currentRecipe?.name?.trim();
      return `/ recipes${name ? ` / ${name.toLowerCase()}` : ""}`;
    }
    if (pathname.startsWith("/recipes")) return "/ recipes";
    if (pathname.startsWith("/calculators")) return "/ calculators";
    if (pathname.startsWith("/learn")) return "/ learn";
    if (pathname.startsWith("/browse")) return "/ browse";
    if (pathname.startsWith("/r/")) return "/ shared recipe";
    return undefined;
  }, [pathname, currentRecipe?.name]);

  return (
    <header
      ref={headerRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px clamp(20px, 4vw, 56px)",
        borderBottom: `2px solid ${hsTokens.ink}`,
        gap: 16,
        flexWrap: "wrap",
        background: hsTokens.cream,
        position: "sticky",
        top: 0,
        zIndex: 30,
        // Mobile collapse-on-scroll (see effect above); a no-op on desktop where
        // `hidden` never flips true.
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.28s ease",
        willChange: "transform",
      }}
      className="hs-header"
    >
      <HSBrandMark caption={caption} />

      <div
        className="hs-header-right"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          className="hs-nav-shell"
          style={{
            // Shell wraps both the visible frame OVERLAY and the actual
            // flex container of links, so the frame can scaleX
            // independently of the layout without distorting the link
            // text inside.
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <motion.div
            aria-hidden
            animate={navControls}
            initial={{ scaleX: 1, transformOrigin: "50% 50%" }}
            style={{
              position: "absolute",
              inset: 0,
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 999,
              boxShadow: hsTokens.sh2,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        <nav
          ref={navRef}
          className="hs-no-scrollbar"
          aria-label="Primary"
          onMouseLeave={() => setHoveredHref(null)}
          style={{
            position: "relative",
            display: "flex",
            gap: 4,
            alignItems: "center",
            padding: 6,
            zIndex: 1,
          }}
        >
          {/* Persistent pill — animates between active-link rects. The
              pill never unmounts on route change, so framer-motion never
              has to bridge old/new snapshots, which is what was causing
              the pill to occasionally fly in from off-screen. */}
          {pillTarget && (
            <motion.div
              aria-hidden
              initial={false}
              animate={{
                x: pillTarget.x,
                y: pillTarget.y,
                width: pillTarget.w,
                height: pillTarget.h,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      x: springSoft,
                      y: springSoft,
                      width: springSoft,
                      height: springSoft,
                    }
              }
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
                // Negative z-index keeps the pill behind the link text
                // without escaping the nav's stacking context (the nav
                // has zIndex: 1, creating an isolated context).
                zIndex: -1,
              }}
            >
              {/* Squish wrapper — key={activeIdx} forces a remount on
                  each slide so the CSS keyframe re-fires. The
                  visible-skin child is a static sibling. */}
              <div
                key={activeIdx}
                className="hs-nav-pill"
                style={{ position: "absolute", inset: 0 }}
              >
                <span
                  className="hs-nav-pill-skin"
                  data-stretch={stretchDir}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: hsTokens.malt,
                    border: `2px solid ${hsTokens.ink}`,
                    borderRadius: 999,
                    // Distance-dependent magnetic stretch; CSS rule
                    // owns transform-origin (via data-stretch) and the
                    // springy transition.
                    scale: `${stretchScale} 1`,
                  }}
                />
              </div>
            </motion.div>
          )}
          {LINKS.map((l, i) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                key={l.href}
                href={l.href}
                onClick={handleNavLinkClick(l.href)}
                onMouseEnter={() => setHoveredHref(l.href)}
                style={{
                  // Link is a flex item, no positioning needed — the pill
                  // is now a sibling (not a descendant), so we don't need
                  // position:relative + zIndex on the link to make text
                  // paint above it. Z-index ordering is handled by the
                  // pill's zIndex: -1 inside the nav's stacking context.
                  padding: "6px 14px",
                  // 2px transparent border preserves per-link outer size
                  // so the pill measures correctly — the pill positions
                  // itself based on linkRect, then adds +4px to span the
                  // border, so visible pill border lands at link edges.
                  border: "2px solid transparent",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: active ? hsTokens.ink : hsTokens.muted,
                  textDecoration: "none",
                  fontFamily: hsTokens.body,
                  // Sync the ink↔muted text color swap with the pill slide
                  // so both transitions resolve together.
                  transition: reduceMotion ? "none" : "color 180ms ease",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        </div>
        <HSAuthButton />
      </div>
      <style>{`
        @media (max-width: 720px) {
          /* Compact single row instead of the two-row stack: tighter padding,
             logo-only brand (drop the wordmark to save width), and a nav that
             scrolls horizontally if the links don't fit. Pairs with the
             collapse-on-scroll above to keep the header off the small screen. */
          .hs-header {
            padding: 8px 16px !important;
            gap: 10px !important;
            flex-wrap: nowrap !important;
          }
          .hs-brandmark-word {
            display: none;
          }
          /* Keep brand · nav · auth all on ONE row — the nav shrinks (and
             scrolls) so the Sign-in button never wraps to a second line. */
          .hs-header-right {
            flex: 1 1 auto;
            min-width: 0;
            gap: 8px;
            justify-content: flex-end;
            flex-wrap: nowrap;
          }
          .hs-nav-shell {
            min-width: 0;
            flex-shrink: 1;
          }
          .hs-header-right > :last-child {
            flex-shrink: 0;
          }
          .hs-nav-shell nav {
            overflow-x: auto;
            scrollbar-width: none;
          }
          .hs-nav-shell nav::-webkit-scrollbar {
            display: none;
          }
        }
        /* Gooey vertical squash on each route change — ported from the old
           SegmentedToggle's pill-vert keyframes (src/index.css:6907-6940).
           The pill remounts on every active-link change because it's only
           rendered for the active link, so this CSS animation re-fires on
           every navigation without any JS coordination.

           Uses the standalone "scale" property (not the transform shorthand)
           so it composes with framer-motion's layoutId transform — they live
           on different CSS properties and don't fight. Per CSS spec, scale
           applies before transform, so the pill is squashed first, then
           translated to its layout target. */
        @keyframes hs-nav-pill-squish {
          0%   { scale: 1 1; }
          20%  { scale: 1 0.88; }
          55%  { scale: 1 1.06; }
          75%  { scale: 1 0.97; }
          100% { scale: 1 1; }
        }
        .hs-nav-pill {
          animation: hs-nav-pill-squish 412ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        /* Magnetic hover stretch: only the FRONT edge of the pill moves
           toward the cursor — the back edge stays anchored, like the pill
           is stretching reluctantly toward what you're hovering. Achieved
           with scaleX + off-center transform-origin (origin set to the
           opposite edge so it stays fixed under the scale). The cubic
           bezier with y2=1.56 adds a small overshoot for a springy pull. */
        .hs-nav-pill-skin {
          transition:
            scale 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
            transform-origin 0s;
          transform-origin: 50% 50%;
        }
        /* transform-origin is the only thing data-stretch controls — the
           scale magnitude is set inline because it varies with how far the
           hover target is from the active link. */
        .hs-nav-pill-skin[data-stretch="right"] {
          transform-origin: 0% 50%;
        }
        .hs-nav-pill-skin[data-stretch="left"] {
          transform-origin: 100% 50%;
        }
        @media (prefers-reduced-motion: reduce) {
          .hs-nav-pill {
            animation: none;
          }
          .hs-nav-pill-skin {
            transition: none;
          }
        }
      `}</style>
    </header>
  );
}
