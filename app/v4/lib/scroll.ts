"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Lenis <-> ScrollTrigger wiring (the verified recipe). Added in Phase 1
// per the plan, after the native-scroll Phase 0 baseline. Lenis smooths the
// scroll so the scrub feels premium, and exposes `scrollTo` for the
// auto-advance-through-a-pin effect.
//
// Returns a ref to the Lenis instance so callers can drive `lenis.scrollTo`
// (e.g. auto-scrolling through the pinned brewsheet beat so it plays itself
// in like an animation).
export function useLenis(enabled: boolean): MutableRefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Dev-only handle for debugging scroll from the console.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    // Drive ScrollTrigger from Lenis's scroll event...
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    // ...and run Lenis's RAF off GSAP's single ticker, with lag smoothing
    // disabled so the scrub never drifts from the scroll position.
    const raf = (time: number) => lenis.raf(time * 1000); // gsap time is seconds
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore GSAP default
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled]);

  return lenisRef;
}
