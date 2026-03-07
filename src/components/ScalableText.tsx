'use client';

import { useRef, useLayoutEffect, useCallback } from 'react';

interface ScalableTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Minimum scale factor (0–1). Text won't shrink below this. Default 0.65 */
  minScale?: number;
  /** Max lines before clamping. When > 1, text wraps instead of scaling past minScale. Default 1 */
  maxLines?: number;
}

/**
 * Text that shrinks to fit its container (like iOS minimumScaleFactor).
 * Wraps children in an inline-block span that scales down uniformly
 * when the natural text width exceeds the available container width.
 *
 * When maxLines > 1: if scaling would go below minScale, the text
 * switches to normal wrapping (up to maxLines) instead of shrinking further.
 */
export default function ScalableText({
  children,
  className = '',
  style,
  minScale = 0.65,
  maxLines = 1,
}: ScalableTextProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Reset to single-line to measure natural width
    inner.style.transform = 'none';
    inner.style.whiteSpace = 'nowrap';
    inner.style.display = 'inline-block';
    inner.style.overflow = '';
    inner.style.webkitLineClamp = '';
    inner.style.webkitBoxOrient = '';

    const available = outer.clientWidth;
    const natural = inner.scrollWidth;

    if (natural > available && available > 0) {
      const scale = available / natural;

      if (scale < minScale && maxLines > 1) {
        // Too long even at minScale — allow wrapping instead
        inner.style.transform = 'none';
        inner.style.whiteSpace = 'normal';
        inner.style.display = '-webkit-box';
        inner.style.webkitLineClamp = String(maxLines);
        inner.style.webkitBoxOrient = 'vertical';
        inner.style.overflow = 'hidden';
      } else {
        inner.style.transform = `scale(${Math.max(minScale, scale)})`;
      }
    }
  }, [minScale, maxLines]);

  useLayoutEffect(() => {
    fit();

    const outer = outerRef.current;
    if (!outer) return;

    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <span ref={outerRef} className={className} style={{ display: 'block', overflow: 'hidden', ...style }}>
      <span ref={innerRef} style={{ display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'left center' }}>
        {children}
      </span>
    </span>
  );
}
