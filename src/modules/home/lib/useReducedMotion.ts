"use client";

import { useEffect, useReducer } from "react";

// prefers-reduced-motion hook (originally ported from the v3 homepage mock).
// In v4 this gates the GSAP pin/scrub forks: when true, the tour renders
// static states with no ScrollTrigger.
export function useReducedMotion(): boolean {
  const [enabled, set] = useReducer((_: boolean, v: boolean) => v, false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => set(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return enabled;
}
