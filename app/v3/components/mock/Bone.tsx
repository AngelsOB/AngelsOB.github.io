"use client";

import { motion, type Transition, type TargetAndTransition } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

// A Bone is a self-contained piece of the mock builder that can be
// positioned and animated independently. Each tab, each section, each
// important sub-component (hop visualizer, salt cells, auto-calc button,
// recovery callout, etc.) is its own bone.
//
// Each bone declares a set of named STATES (e.g. "default", "raised",
// "panel", "recessed"). The composition root passes in which state the
// bone should currently be in; framer-motion interpolates style values
// between states.
//
// This is the foundation for the exploded-diagram tour: as the visitor
// scrolls, different bones change state — pieces lift forward, others
// recede — and the visual is the mock builder being taken apart and
// reassembled at each stage.

export type BoneStyle = CSSProperties & {
  // motion-only fields (parsed from style for the animate prop)
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
};

// Default transition — SPRINGY (cubic-bezier 0.34 1.56 0.64 1) over 700ms.
// Matches the overall tour feel: pieces have personality, slight overshoot,
// land with intent.
const DEFAULT_TRANSITION: Transition = {
  duration: 0.7,
  ease: [0.34, 1.56, 0.64, 1],
};

export interface BoneProps<StateName extends string> {
  /** Identifier used for debugging and aria. */
  id: string;
  /** Named states this bone can be in. */
  states: Record<StateName, BoneStyle>;
  /** Which state to animate to. */
  state: StateName;
  /** Override the default SPRINGY 700ms transition. */
  transition?: Transition;
  /** Z-stack order. Higher = more forward. Useful for "raised" bones. */
  zIndex?: number;
  /** Initial style (rendered before any animation). Defaults to the value
   *  of `states[state]` so the bone starts in the right place. */
  initial?: BoneStyle | false;
  /** Children render inside the bone. Can themselves contain nested bones. */
  children?: ReactNode;
}

export function Bone<StateName extends string>({
  id,
  states,
  state,
  transition = DEFAULT_TRANSITION,
  zIndex,
  initial = false,
  children,
}: BoneProps<StateName>) {
  const target = states[state];
  return (
    <motion.div
      data-bone={id}
      initial={initial === false ? false : (initial as unknown as TargetAndTransition)}
      animate={target as unknown as TargetAndTransition}
      transition={transition}
      style={{
        position: "absolute",
        zIndex,
      }}
    >
      {children}
    </motion.div>
  );
}
