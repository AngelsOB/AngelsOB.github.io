/**
 * AnimatedValue — Smoothly interpolates between number values.
 *
 * Fast rAF counting (250ms ease-out) with a subtle color highlight
 * that fades back. No scale/size changes — just clean, snappy numbers.
 *
 * Zero external dependencies — pure React + rAF.
 */

import { useRef, useEffect, useState } from "react";

interface AnimatedValueProps {
  /** The target numeric value to animate toward */
  value: number;
  /** Decimal places in the formatted output (default 1) */
  decimals?: number;
  /** Text appended after the number, e.g. "%" or "g" */
  suffix?: string;
  /** Text prepended before the number */
  prefix?: string;
  /** Animation duration in ms (default 250) */
  duration?: number;
  /** Extra class names forwarded to the wrapping <span> */
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedValue({
  value,
  decimals = 1,
  suffix = "",
  prefix = "",
  duration = 175,
  className = "",
}: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on initial mount — just show the value
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousValue.current = value;
      setDisplayValue(value);
      return;
    }

    const from = previousValue.current;
    const to = value;
    previousValue.current = value;

    // Nothing to animate
    if (from === to) return;

    // Cancel any running animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (highlightTimeout.current) {
      clearTimeout(highlightTimeout.current);
    }

    // Brief color highlight — accent color fades back to normal via CSS transition
    setIsHighlighted(true);
    highlightTimeout.current = setTimeout(() => setIsHighlighted(false), 300);

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const current = from + (to - from) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (highlightTimeout.current) {
        clearTimeout(highlightTimeout.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span
      className={`brew-gauge-animated ${isHighlighted ? "is-changed" : ""} ${className}`.trim()}
      style={{ display: "inline-block" }}
    >
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}
