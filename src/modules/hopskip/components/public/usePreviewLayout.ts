"use client";

import { useEffect, useState } from "react";

/** Subscribe to a CSS media query. Returns false on first render (SSR) and
 *  during hydration on mismatched widths — caller should treat the post-mount
 *  value as the source of truth. */
export function useMediaQuery(queryStr: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(queryStr);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [queryStr]);
  return matches;
}

/** Width of the slide-in preview column. Defaults to ~40% of the viewport,
 *  clamped to [440, 720] so it stays readable on narrow desktops and doesn't
 *  swallow the whole page on big monitors. Updates on resize. */
export function usePreviewWidth(): number {
  const [width, setWidth] = useState(560);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const target = window.innerWidth * 0.4;
      setWidth(Math.min(720, Math.max(440, target)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

/** Whether the viewport is wide enough for the side-by-side preview. Below
 *  this threshold, card clicks should navigate directly instead. Matches the
 *  existing /browse 2-col grid breakpoint so the responsive story is
 *  consistent across pages. */
export function useCanPreview(): boolean {
  return useMediaQuery("(min-width: 1025px)");
}
