"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";

// Wraps useInView with three quality-of-life improvements over inlining it:
//
// 1. Stable onEnter callbacks. The inline `onEnter={() => ...}` form in the
//    parent creates a new function every render. Putting that directly in a
//    useEffect dep array would fire the effect on every parent re-render,
//    triggering state updates that cascade. We hold the latest callback in
//    a ref and depend only on `inView`.
//
// 2. Eager-but-not-jumpy default margin. The default `"0px 0px -33% 0px"`
//    fires the trigger as the section's top crosses into the bottom third
//    of the viewport — early enough that reveals/tab-swaps happen as the
//    visitor *approaches* the stage, not after they've scrolled past most
//    of it.
//
// 3. A single returned `inView` flag for both the section's onEnter side
//    effect AND for gating the in-section reveal animations.
//
// Usage:
//   const { ref, inView } = useStageInView({ onEnter: () => setTab("Hops") });
//   return <section ref={ref}>{ inView && <motion.div ... /> }</section>;
export function useStageInView<T extends HTMLElement = HTMLElement>(opts: {
  margin?: string;
  onEnter?: () => void;
} = {}) {
  const { margin = "0px 0px -33% 0px", onEnter } = opts;

  const ref = useRef<T | null>(null);
  const inView = useInView(ref, { margin });

  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  useEffect(() => {
    if (inView) onEnterRef.current?.();
  }, [inView]);

  return { ref, inView };
}
