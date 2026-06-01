// Hop & Skip motion tokens — a curated palette of springs, eases, and
// durations used across the app so interactions read as one product
// instead of a patchwork of locally-tuned timings.
//
// Sibling to `tokens.ts` (colors, fonts, shadows). The visual tokens
// answer "what does it look like?"; these answer "how does it move?"
//
// Philosophy:
//   - Pick a token by USE CASE, not by aesthetic preference. "Is this
//     an entrance? An exit? A continuous follow?" then use the matching
//     spring/tween rather than inventing a new one.
//   - Local overrides are fine when a specific surface needs them — but
//     the *default* answer to any motion question should be a token here.
//   - Keep the palette small. Three or four springs and three durations
//     cover almost everything. If you find yourself reaching for a
//     fifth, ask whether one of the existing four would do.
//
// Compatible with framer-motion's `transition` prop. Each spring is a
// plain object; spread it or pass it directly:
//   <m.div transition={springEnter}>           // pass whole token
//   <m.div transition={{ ...springEnter, delay: 0.1 }}>  // extend it
//   <m.div transition={{ x: springTrack, opacity: tweenStandard }}>

// ─── Easing curves ─────────────────────────────────────────────────

/**
 * The HopSkip easeOut — fast accel, gentle deceleration. Used in
 * MainSectionMorph/HelperCardMorph, and as the baseline calm curve
 * for any non-spring transition. Tuple form because framer-motion
 * accepts `ease: [x1, y1, x2, y2]` cubic-bezier.
 */
export const easeStandard = [0.22, 1, 0.36, 1] as const;

// ─── Durations (seconds) ───────────────────────────────────────────

/**
 * Duration palette. Numbers are in seconds (framer-motion's unit).
 * Use these as the `duration` arg to a tween transition.
 *
 *   - `fast` — micro-feedback: a hover tint, a tilt-rest snap-back.
 *   - `standard` — the workhorse: exits, state shifts, color swatches.
 *   - `slow` — heavier moves: modal entrance, page transitions, the
 *     occasional signature moment that earns its visibility.
 */
export const dur = {
  fast: 0.12,
  standard: 0.18,
  slow: 0.32,
} as const;

// ─── Springs ───────────────────────────────────────────────────────

/**
 * Primary entrance spring. Fast initial reach, gentle settle with a
 * touch of overshoot. Use for elements arriving on screen — new
 * ingredient rows, list items, modal cards. The "house" spring of the
 * app; if you're not sure which one to use, this is probably it.
 *
 * Damping ratio ζ ≈ 0.50 (visible overshoot, clean wind-down).
 */
export const springEnter = {
  type: "spring" as const,
  stiffness: 920,
  damping: 18,
  mass: 0.34,
} as const;

/**
 * Tracking spring. Use for continuous follow-the-cursor or
 * follow-the-value motion (tooltip x position, slider thumb,
 * indicator dots on a range bar). Tighter and less bouncy than
 * `springEnter` because the spring animates many times per second
 * and any bounce would compound into chaotic motion.
 */
export const springTrack = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.5,
} as const;

/**
 * Tilt / nudge spring. For small reactive rotations, scale wiggles,
 * subtle pulses. Tighter than `springTrack`, lower mass — responds
 * quickly to frequent updates without rocking.
 */
export const springTilt = {
  type: "spring" as const,
  stiffness: 520,
  damping: 28,
  mass: 0.4,
} as const;

/**
 * Pop spring. Bouncier than `springEnter` — uses the bounce/duration
 * shorthand for a more obvious overshoot. Reserve for moments that
 * benefit from celebratory energy: tooltip pop-ins, save-success
 * confirmations, signature moments. Don't use everywhere — bounce
 * loses meaning when it's universal.
 */
export const springPop = {
  type: "spring" as const,
  bounce: 0.42,
  duration: 0.42,
} as const;

/**
 * Soft spring. Slower settle than `springEnter`, gentler overshoot.
 * Use for delicate surfaces where the snappy entrance spring reads as
 * aggressive — bar-graph segments resizing as values shift, color
 * swatch interpolation, hover-expand on tiny elements. The motion is
 * still alive (springy, not flat) but lower-energy.
 */
export const springSoft = {
  type: "spring" as const,
  bounce: 0.34,
  duration: 0.42,
} as const;

// ─── Tweens ────────────────────────────────────────────────────────

/**
 * Standard easeOut tween — `easeStandard` + `dur.standard`. The calm
 * fallback when a spring would be too playful (exits, fades,
 * disabled-state transitions). Removing a row uses this.
 */
export const tweenStandard = {
  duration: dur.standard,
  ease: easeStandard,
} as const;

/**
 * Fast tween — for micro-feedback that needs to feel instant.
 */
export const tweenFast = {
  duration: dur.fast,
  ease: easeStandard,
} as const;
