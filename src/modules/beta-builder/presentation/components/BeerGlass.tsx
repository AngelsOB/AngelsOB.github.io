'use client';

/**
 * BeerGlass — SVG pint glass visualization colored by SRM value.
 *
 * Replaces the simple color circle with a tactile beer glass silhouette:
 * liquid fill with smooth color transitions, foam head, glass shine,
 * and rising carbonation bubbles. Empty state when SRM ≤ 0.
 *
 * All animations respect prefers-reduced-motion via index.css.
 */

import { useId, useMemo } from 'react';
import { srmToRgb } from '../../utils/srmColorUtils';

interface BeerGlassProps {
  /** SRM color value (1–40) */
  srm: number;
  /** Additional CSS classes (use for sizing, e.g. "w-6 h-8") */
  className?: string;
  /** Inline styles for fine-tuning dimensions */
  style?: React.CSSProperties;
}

export default function BeerGlass({ srm, className = '', style }: BeerGlassProps) {
  // Unique IDs so multiple instances don't clash
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const clipId = `gc${uid}`;
  const gradId = `lg${uid}`;
  const shineId = `gs${uid}`;
  const foamGradId = `fg${uid}`;

  const liquidColor = useMemo(() => srmToRgb(Math.max(1, srm)), [srm]);
  const liquidColorDark = useMemo(
    () => srmToRgb(Math.min(40, Math.max(1, srm) + 5)),
    [srm],
  );

  const isEmpty = srm <= 0;

  // Dark stouts have thinner, tanned foam
  const foamOpacity = srm > 30 ? 0.6 : srm > 20 ? 0.8 : 1;

  return (
    <svg
      viewBox="0 0 24 34"
      fill="none"
      className={`beer-glass ${className}`}
      style={style}
      aria-label={`Beer color: ${srm.toFixed(1)} SRM`}
      role="img"
    >
      <defs>
        {/* Interior clip — the glass cavity */}
        <clipPath id={clipId}>
          <path d="M3.8 3 L5.2 27.5 Q5.2 30.5 7.8 30.5 L16.2 30.5 Q18.8 30.5 18.8 27.5 L20.2 3 Z" />
        </clipPath>

        {/* Liquid depth gradient */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidColor} />
          <stop offset="100%" stopColor={liquidColorDark} />
        </linearGradient>

        {/* Left-side glass shine */}
        <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="30%" stopColor="white" stopOpacity="0.2" />
          <stop offset="55%" stopColor="white" stopOpacity="0.05" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Foam gradient — warm cream */}
        <linearGradient id={foamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#faf5eb" />
          <stop offset="100%" stopColor="#f0e6d2" />
        </linearGradient>
      </defs>

      {/* ─── Liquid + Foam + Bubbles (clipped to glass interior) ─── */}
      {!isEmpty && (
        <g clipPath={`url(#${clipId})`}>
          {/* Liquid body — filled high, nearly to the rim */}
          <rect
            x="2"
            y="6"
            width="20"
            height="26"
            fill={`url(#${gradId})`}
            className="beer-glass-liquid"
          />

          {/* Foam head — two organic bumps, cresting at the rim */}
          <path
            d="M3 5.5 Q7 2 12 5.5 Q17 2 21 5.5 L21 8 L3 8 Z"
            fill={`url(#${foamGradId})`}
            opacity={foamOpacity}
            className="beer-glass-foam"
          />
          {/* Foam highlight — brighter top edge */}
          <path
            d="M3 5.5 Q7 2.5 12 5.5 Q17 2.5 21 5.5 L21 7 L3 7 Z"
            fill="white"
            opacity={0.25 * foamOpacity}
          />

          {/* Carbonation bubbles */}
          <circle cx="9" cy="24" r="0.6" fill="white" opacity="0.3" className="beer-bubble beer-bubble-1" />
          <circle cx="15" cy="22" r="0.45" fill="white" opacity="0.25" className="beer-bubble beer-bubble-2" />
          <circle cx="11.5" cy="26" r="0.5" fill="white" opacity="0.2" className="beer-bubble beer-bubble-3" />
        </g>
      )}

      {/* ─── Glass outline ─── */}
      <path
        d="M3.8 3 L5.2 27.5 Q5.2 30.5 7.8 30.5 L16.2 30.5 Q18.8 30.5 18.8 27.5 L20.2 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.22"
      />

      {/* Rim — slightly wider, catches light */}
      <line
        x1="3.2"
        y1="3"
        x2="20.8"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.18"
      />

      {/* ─── Glass shine overlay ─── */}
      <rect
        x="5"
        y="3"
        width="6"
        height="28"
        fill={`url(#${shineId})`}
        clipPath={`url(#${clipId})`}
        rx="1"
      />
    </svg>
  );
}
