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
import FloatingCalculator, {
  FLOATING_CALC_META,
  widthFor,
  type FloatingCalcId,
} from "./FloatingCalculator";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useUnsavedChangesStore } from "@/modules/recipe/stores/unsavedChangesStore";

interface NavChild {
  /** Used as the menu-item key + accessibility target.
   *  When `kind: "calc"`, the value is the FloatingCalcId, not a route. */
  href: string;
  label: string;
  /** Optional accent dot to render before the label. */
  accent?: string;
  /** "link" (default) navigates to href. "calc" opens a floating PIP.
   *  "create" navigates but renders with a "+" badge in place of the dot to
   *  signal a primary new-item action. */
  kind?: "link" | "calc" | "create";
}

interface NavLink {
  href: string;
  label: string;
  /** When present the link becomes a dropdown trigger.
   *  - `triggerNavigates: true` (Recipes, Calculators): on desktop the trigger
   *    is a Link — hover opens the menu, click navigates to `href`. On mobile
   *    it falls back to a button-toggle (no hover) UNLESS `noMobileDropdown`
   *    is set, in which case it renders as a plain Link with no dropdown.
   *  - `triggerNavigates` unset: the trigger is a button that toggles the
   *    menu on click on every viewport. */
  children?: NavChild[];
  triggerNavigates?: boolean;
  /** When true, the dropdown is suppressed on small viewports and the trigger
   *  renders as a plain Link to `href`. Used for the floating-calculator
   *  dropdown which has no place on mobile. */
  noMobileDropdown?: boolean;
}

const CALC_ORDER: FloatingCalcId[] = [
  "abv",
  "ibu",
  "boil-off",
  "dilution",
  "carbonation",
  "hydrometer",
  "strike-temp",
];

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  {
    href: "/recipes/all",
    label: "Recipes",
    triggerNavigates: true,
    children: [
      { href: "/recipes", label: "My Recipes" },
      { href: "/browse", label: "Browse All" },
      { href: "/recipes/new", label: "New recipe", kind: "create" },
    ],
  },
  {
    href: "/calculators",
    label: "Calculators",
    triggerNavigates: true,
    noMobileDropdown: true,
    children: CALC_ORDER.map((id) => ({
      href: id,
      label: FLOATING_CALC_META[id].title,
      accent: FLOATING_CALC_META[id].accent,
      kind: "calc" as const,
    })),
  },
  { href: "/learn", label: "Learn" },
];

/** Compact (≤720px) nav: the link row can't fit a phone, so the whole nav
 *  collapses into one "Menu" trigger reusing the same dropdown panel. Home is
 *  omitted — the brand mark already links there. Calculators is a plain link
 *  (PIPs are pointless on a phone, same call as `noMobileDropdown`). */
const COMPACT_MENU: NavLink = {
  href: "#menu",
  label: "Menu",
  children: [
    { href: "/recipes", label: "My Recipes" },
    { href: "/browse", label: "Browse All" },
    { href: "/recipes/new", label: "New recipe", kind: "create" },
    { href: "/calculators", label: "Calculators" },
    { href: "/learn", label: "Learn" },
  ],
};

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

  // Small-viewport flags — same 1024px breakpoint as the collapse-on-scroll
  // effect; isCompact (≤720px, the logo-only CSS breakpoint) swaps the whole
  // link row for the single "Menu" trigger. Declared early because the pill
  // measurement effects below depend on isCompact.
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsCompact(window.innerWidth <= 720);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Which nav link is the cursor over right now (null = not over any). Drives
  // the magnetic-pull lean of the pill toward inactive links on hover.
  // Stored at nav level (mouseLeave on the nav container clears it) so moving
  // from link A to link B doesn't flicker through a brief null state.
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  // Indices of the active link and the hovered link inside LINKS. We use
  // ordering (left vs right) to decide the sign of the magnetic offset —
  // hovering a link to the right of the active link pulls the pill right;
  // a link to the left pulls left.
  // A link is "active" when the route matches it OR (for dropdown links) any
  // of its children — so "Recipes" stays lit on /browse too.
  const isLinkActive = (l: NavLink) =>
    l.href === "/"
      ? pathname === "/"
      : pathname.startsWith(l.href) ||
        (l.children?.some((c) => pathname.startsWith(c.href)) ?? false);
  const activeIdx = LINKS.findIndex(isLinkActive);
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
  const linkRefs = useRef<Array<HTMLElement | null>>(
    Array(LINKS.length).fill(null)
  );
  const [pillTarget, setPillTarget] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useLayoutEffect(() => {
    // Compact mode renders a single Menu trigger instead of the link row —
    // there's no active link to measure, so no pill.
    if (activeIdx < 0 || isCompact) {
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
  }, [activeIdx, pathname, isCompact]);

  // Re-measure on window resize and any layout shift that resizes the
  // nav itself (e.g., font load shrinking/widening labels).
  useEffect(() => {
    const remeasure = () => {
      if (activeIdx < 0 || isCompact) return;
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
  }, [activeIdx, isCompact]);

  // ── Recipes dropdown menu ─────────────────────────────────────────────
  // A nav link may carry `children`; its trigger opens a small menu of
  // sub-destinations. The panel renders at the nav-SHELL level (a sibling of
  // <nav>, NOT inside it) so the mobile nav's `overflow-x: auto` — which the
  // CSS spec also makes clip overflow-y — can't cut it off; we measure the
  // trigger's x to position it. Mouse: hover opens, a short close-delay lets
  // the cursor cross the gap into the panel without dismissing. Touch: tap
  // toggles. Escape / outside-press / scroll / resize / route-change close it.
  const navShellRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const openTriggerRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  // Width fits the longest calculator title with a leading accent dot.
  const MENU_W = 260;

  // Small-viewport flag — drives per-link trigger behavior swaps:
  //   • Calculators (noMobileDropdown): becomes a plain Link → /calculators.
  //     PIPs are pointless on a phone-sized screen.
  //   • Recipes (triggerNavigates without noMobileDropdown): falls back to a
  //     button-toggle dropdown because hover-to-open doesn't exist on touch.
  // (isMobile / isCompact state lives near the top of the component — the
  // pill-measurement effects depend on isCompact, so it must be declared
  // before them.)

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const closeMenu = () => {
    cancelClose();
    setOpenHref(null);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenHref(null), 140);
  };
  const openMenu = (href: string, el: HTMLElement | null) => {
    cancelClose();
    const shell = navShellRef.current;
    if (el && shell) {
      const r = el.getBoundingClientRect();
      const s = shell.getBoundingClientRect();
      // Clamp so a near-right-edge trigger (mobile) doesn't push the panel
      // off-screen; otherwise left-align the panel under the trigger.
      let left = r.left;
      const maxLeft = window.innerWidth - 12 - MENU_W;
      if (left > maxLeft) left = Math.max(12, maxLeft);
      setMenuLeft(left - s.left);
    }
    openTriggerRef.current = el;
    setOpenHref(href);
  };
  const toggleMenu = (href: string, el: HTMLElement | null) => {
    if (openHref === href) closeMenu();
    else openMenu(href, el);
  };

  // Close on route change.
  useEffect(() => {
    setOpenHref(null);
  }, [pathname]);

  // ── Floating calculator PIPs ──────────────────────────────────────────
  // PIPs close on navigation per product decision. State lives here (local)
  // since no other surface opens them yet.
  type OpenCalc = {
    id: FloatingCalcId;
    position: { x: number; y: number };
    z: number;
  };
  const [openCalcs, setOpenCalcs] = useState<OpenCalc[]>([]);
  const zCounter = useRef(50);

  useEffect(() => {
    setOpenCalcs([]);
  }, [pathname]);

  const openFloatingCalc = (id: FloatingCalcId) => {
    setOpenCalcs((prev) => {
      // Already open → just bring to top.
      if (prev.some((c) => c.id === id)) {
        const nextZ = ++zCounter.current;
        return prev.map((c) => (c.id === id ? { ...c, z: nextZ } : c));
      }
      // Stagger spawn from the upper-right of the viewport. Anchor by the
      // PIP's own width so wider calcs (IBU) still land on-screen.
      const w = widthFor(id);
      const idx = prev.length;
      const baseX =
        typeof window !== "undefined"
          ? Math.max(24, window.innerWidth - w - 24)
          : 320;
      const baseY = 96;
      const nextZ = ++zCounter.current;
      return [
        ...prev,
        {
          id,
          position: { x: baseX + idx * 28, y: baseY + idx * 28 },
          z: nextZ,
        },
      ];
    });
  };

  const closeFloatingCalc = (id: FloatingCalcId) => {
    setOpenCalcs((prev) => prev.filter((c) => c.id !== id));
  };

  const moveFloatingCalc = (id: FloatingCalcId, position: { x: number; y: number }) => {
    setOpenCalcs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, position } : c))
    );
  };

  const focusFloatingCalc = (id: FloatingCalcId) => {
    setOpenCalcs((prev) => {
      const top = prev.find((c) => c.id === id);
      if (!top || top.z === zCounter.current) return prev;
      const nextZ = ++zCounter.current;
      return prev.map((c) => (c.id === id ? { ...c, z: nextZ } : c));
    });
  };

  // While open: dismiss on Escape, an outside press, or any scroll/resize.
  useEffect(() => {
    if (!openHref) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenHref(null);
        openTriggerRef.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (
        openTriggerRef.current?.contains(t) ||
        menuPanelRef.current?.contains(t)
      )
        return;
      setOpenHref(null);
    };
    const onMove = () => setOpenHref(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [openHref]);

  // Clear a pending close timer on unmount.
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    []
  );

  // ── Mobile collapse-on-scroll ─────────────────────────────────────────
  // On small screens the sticky header eats scarce vertical space, so hide it
  // on scroll-down and reveal it on scroll-up (a standard mobile pattern).
  // Also publishes its occupied height to --hs-header-peek (0 while hidden) so
  // sticky page content — e.g. the homepage tour mock — can sit just below it and
  // rise into the freed space when it collapses. No-op above 1024px (the
  // header stays put on desktop, where there's room).
  const headerRef = useRef<HTMLElement | null>(null);
  const hiddenRef = useRef(false);
  const [hidden, setHidden] = useState(false);
  // The homepage tour pins a mock just under the header, so a mid-page scroll-up
  // that reveals the header would shove it around. There the header shows ONLY
  // near the top; everywhere else keeps the standard reveal-on-scroll-up feel.
  const tourHeader = pathname === "/";
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
          ref={navShellRef}
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
          {isCompact ? (
            // Phone widths: the four-link row physically can't fit next to the
            // brand and auth button, so the whole nav becomes one Menu trigger
            // that opens the same dropdown panel the other triggers use.
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openHref === COMPACT_MENU.href}
              onClick={(e) => toggleMenu(COMPACT_MENU.href, e.currentTarget)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                appearance: "none",
                WebkitAppearance: "none",
                margin: 0,
                padding: "6px 14px",
                background: "transparent",
                border: "2px solid transparent",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: hsTokens.ink,
                fontFamily: hsTokens.body,
                cursor: "pointer",
              }}
            >
              Menu
              <svg
                aria-hidden
                width="9"
                height="9"
                viewBox="0 0 10 10"
                style={{
                  transition: reduceMotion ? "none" : "transform 180ms ease",
                  transform:
                    openHref === COMPACT_MENU.href
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                }}
              >
                <path
                  d="M2 3.5 L5 6.5 L8 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
          LINKS.map((l, i) => {
            const active = isLinkActive(l);
            // Suppress the dropdown entirely on small viewports for items
            // flagged noMobileDropdown — they fall through to the plain Link
            // render below.
            const hasDropdown =
              !!l.children && !(isMobile && l.noMobileDropdown);
            if (hasDropdown) {
              const open = openHref === l.href;
              // On desktop, triggerNavigates uses the Link-with-hover-dropdown
              // pattern. On mobile (no hover available), fall back to the
              // button-toggle pattern so the dropdown is still reachable.
              const useNavigatingTrigger = l.triggerNavigates && !isMobile;
              const triggerStyle = {
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                appearance: "none" as const,
                WebkitAppearance: "none" as const,
                margin: 0,
                padding: "6px 14px",
                background: "transparent",
                border: "2px solid transparent",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: active || open ? hsTokens.ink : hsTokens.muted,
                textDecoration: "none",
                fontFamily: hsTokens.body,
                cursor: "pointer",
                transition: reduceMotion ? "none" : ("color 180ms ease" as const),
              };
              const chevron = (
                <svg
                  aria-hidden
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  style={{
                    transition: reduceMotion ? "none" : "transform 180ms ease",
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path
                    d="M2 3.5 L5 6.5 L8 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              );
              if (useNavigatingTrigger) {
                // Desktop pattern (Calculators, Recipes): trigger is a Link.
                // Click navigates to the index/hub page; hover opens the menu.
                return (
                  <Link
                    ref={(el) => {
                      linkRefs.current[i] = el;
                    }}
                    key={l.href}
                    href={l.href}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onClick={(e) => {
                      handleNavLinkClick(l.href)(e);
                      closeMenu();
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse")
                        openMenu(l.href, e.currentTarget);
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === "mouse") scheduleClose();
                    }}
                    onMouseEnter={() => setHoveredHref(l.href)}
                    style={triggerStyle}
                  >
                    {l.label}
                    {chevron}
                  </Link>
                );
              }
              return (
                <button
                  type="button"
                  ref={(el) => {
                    linkRefs.current[i] = el;
                  }}
                  key={l.href}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={(e) => toggleMenu(l.href, e.currentTarget)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") openMenu(l.href, e.currentTarget);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") scheduleClose();
                  }}
                  onMouseEnter={() => setHoveredHref(l.href)}
                  style={triggerStyle}
                >
                  {l.label}
                  {chevron}
                </button>
              );
            }
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
          })
          )}
        </nav>
        {openHref &&
          (() => {
            const openLink =
              openHref === COMPACT_MENU.href
                ? COMPACT_MENU
                : LINKS.find((l) => l.href === openHref);
            if (!openLink?.children) return null;
            return (
              <div
                ref={menuPanelRef}
                role="menu"
                aria-label={openLink.label}
                className="hs-nav-menu"
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") cancelClose();
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") scheduleClose();
                }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: menuLeft,
                  width: MENU_W,
                  background: hsTokens.paper,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 12,
                  boxShadow: hsTokens.sh3,
                  zIndex: 40,
                  overflow: "hidden",
                  fontFamily: hsTokens.body,
                }}
              >
                {openLink.children.map((c, ci) => {
                  const isCalc = c.kind === "calc";
                  // When sitting on the parent's exact hub path (e.g.
                  // /recipes/all), no child should highlight as active —
                  // they're alternative destinations from the hub. This also
                  // sidesteps the otherwise-incorrect prefix match where
                  // "/recipes" would catch "/recipes/all".
                  const childActive =
                    !isCalc &&
                    pathname !== openLink.href &&
                    (pathname === c.href || pathname.startsWith(c.href + "/"));
                  const itemStyle = {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 16px",
                    fontFamily: hsTokens.body,
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: hsTokens.ink,
                    textDecoration: "none",
                    background: childActive ? hsTokens.cream2 : "transparent",
                    boxShadow: childActive
                      ? `inset 3px 0 0 ${hsTokens.malt}`
                      : "none",
                    borderTop:
                      ci > 0 ? `1px solid ${hsTokens.cream2}` : "none",
                    border: "none",
                    width: "100%",
                    textAlign: "left" as const,
                    cursor: "pointer",
                  };
                  // For "create" items, render a tiny "+" badge instead of
                  // the accent dot — same footprint, but reads as a primary
                  // new-item action rather than a category swatch.
                  const leading =
                    c.kind === "create" ? (
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          background: hsTokens.malt,
                          border: `1.5px solid ${hsTokens.ink}`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: hsTokens.ink,
                          fontFamily: hsTokens.body,
                          fontWeight: 800,
                          fontSize: 13,
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        +
                      </span>
                    ) : c.accent ? (
                      <span
                        aria-hidden
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          background: c.accent,
                          border: `1px solid ${hsTokens.ink}`,
                          flexShrink: 0,
                        }}
                      />
                    ) : null;
                  if (isCalc) {
                    return (
                      <button
                        type="button"
                        key={c.href}
                        role="menuitem"
                        onClick={() => {
                          openFloatingCalc(c.href as FloatingCalcId);
                          closeMenu();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = hsTokens.cream2;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        style={itemStyle}
                      >
                        {leading}
                        <span style={{ flex: 1, minWidth: 0 }}>{c.label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      role="menuitem"
                      onClick={(e) => {
                        handleNavLinkClick(c.href)(e);
                        closeMenu();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hsTokens.cream2;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = childActive
                          ? hsTokens.cream2
                          : "transparent";
                      }}
                      style={itemStyle}
                    >
                      {leading}
                      <span style={{ flex: 1, minWidth: 0 }}>{c.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <HSAuthButton />
      </div>
      {openCalcs.map((c) => (
        <FloatingCalculator
          key={c.id}
          id={c.id}
          position={c.position}
          zIndex={c.z}
          onClose={() => closeFloatingCalc(c.id)}
          onMove={(p) => moveFloatingCalc(c.id, p)}
          onFocus={() => focusFloatingCalc(c.id)}
        />
      ))}
      <style>{`
        @media (max-width: 720px) {
          /* Compact single row instead of the two-row stack: tighter padding,
             logo-only brand (drop the wordmark to save width), and the nav
             collapsed to the single Menu trigger (isCompact). Pairs with the
             collapse-on-scroll above to keep the header off the small screen. */
          .hs-header {
            padding: 8px 16px !important;
            gap: 10px !important;
            flex-wrap: nowrap !important;
          }
          .hs-brandmark-word {
            display: none;
          }
          /* Keep brand · nav · auth all on ONE row — the Sign-in button never
             wraps to a second line. */
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
        /* Recipes dropdown panel — a quick rise+fade on open. */
        .hs-nav-menu {
          transform-origin: top left;
          animation: hs-nav-menu-in 150ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes hs-nav-menu-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hs-nav-menu { animation: none; }
        }
      `}</style>
    </header>
  );
}
