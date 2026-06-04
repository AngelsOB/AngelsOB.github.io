"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";

// Fires `onEnter` when its target (the lead h3) sits in a narrow centered
// band of the viewport, and `onLeave` when it exits that band. Pair with
// `useStageInView` on the section itself.
//
// The band: rootMargin "-30% 0px -50% 0px" → a 20% slice in the upper-
// middle of the viewport. Wide enough to feel deliberate, narrow enough
// to mark "I am clearly reading this stage."
//
// onLeave is what enables the between-stage reset: when the lead h3
// scrolls out of the centered band (either up or down), the stage's
// highlight clears so the mock returns to its default state until the
// next stage's lead enters the band.
export function useStageTabTrigger<T extends HTMLElement = HTMLHeadingElement>(
  onEnter?: () => void,
  onLeave?: () => void,
) {
  const ref = useRef<T | null>(null);
  const inView = useInView(ref, { margin: "-30% 0px -50% 0px" });

  // Latest-callback ref pattern so we don't re-run the effect on every
  // parent re-render — only on the inView transition.
  const onEnterRef = useRef(onEnter);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onEnterRef.current = onEnter;
    onLeaveRef.current = onLeave;
  }, [onEnter, onLeave]);

  // Track previous state so we can distinguish enter vs leave transitions.
  const wasInViewRef = useRef(false);
  useEffect(() => {
    if (inView && !wasInViewRef.current) {
      onEnterRef.current?.();
    } else if (!inView && wasInViewRef.current) {
      onLeaveRef.current?.();
    }
    wasInViewRef.current = inView;
  }, [inView]);

  return ref;
}
