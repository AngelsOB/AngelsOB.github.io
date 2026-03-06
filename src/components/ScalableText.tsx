'use client';

import { useRef, useLayoutEffect, useCallback } from 'react';

interface ScalableTextProps {
  children: React.ReactNode;
  className?: string;
  /** Minimum scale factor (0–1). Text won't shrink below this. Default 0.65 */
  minScale?: number;
}

/**
 * Text that shrinks to fit its container (like iOS minimumScaleFactor).
 * Wraps children in an inline-block span that scales down uniformly
 * when the natural text width exceeds the available container width.
 */
export default function ScalableText({ children, className = '', minScale = 0.65 }: ScalableTextProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Reset to measure natural width
    inner.style.transform = 'none';
    const available = outer.clientWidth;
    const natural = inner.scrollWidth;

    if (natural > available && available > 0) {
      const scale = Math.max(minScale, available / natural);
      inner.style.transform = `scale(${scale})`;
    } else {
      inner.style.transform = 'none';
    }
  }, [minScale]);

  useLayoutEffect(() => {
    fit();

    const outer = outerRef.current;
    if (!outer) return;

    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <span ref={outerRef} className={className} style={{ display: 'block', overflow: 'hidden' }}>
      <span ref={innerRef} style={{ display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'left center' }}>
        {children}
      </span>
    </span>
  );
}
