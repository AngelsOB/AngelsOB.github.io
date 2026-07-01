"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import { hsTokens } from "@/modules/builder/tokens";

// How far the card floats off the cursor, and how close it may get to a
// viewport edge before it flips/clamps.
const OFFSET = 14;
const MARGIN = 12;

// The floating info card itself. The text lives in the DOM (SSR'd, crawlable)
// at all times — we only move it with position:fixed + opacity, never mount it
// on demand — so the explainer prose still counts as page content.
const TIP_STYLE: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  zIndex: 60,
  width: "max-content",
  maxWidth: 260,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 10,
  boxShadow: hsTokens.sh3,
  padding: "9px 11px",
  fontFamily: hsTokens.body,
  fontSize: 12,
  lineHeight: 1.45,
  color: hsTokens.muted,
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 140ms ease",
};

/**
 * A hover "info card" that follows the cursor: it sits up and to the RIGHT of
 * the pointer, flips to the LEFT when it would run off the right edge, and
 * drops below the pointer when it would clip the top. Shared by the yeast spec
 * /trait cards and the hop acid-&-oil stat cells.
 *
 * The tip is positioned imperatively via a ref (no per-frame React state) and
 * is `position: fixed`, so it escapes any ancestor's `overflow: hidden` — but
 * the trigger must NOT be a transformed element, or `fixed` would resolve
 * against the trigger instead of the viewport.
 *
 * With no `tip`, it degrades to a plain wrapper (no handlers, no help cursor).
 */
export default function IngredientHoverCard({
  tip,
  children,
  className,
  style,
  tabIndex,
  ariaLabel,
}: {
  tip?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tabIndex?: number;
  ariaLabel?: string;
}) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);

  if (!tip) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const place = (cx: number, cy: number) => {
    const el = tipRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: up and to the right of the cursor.
    let left = cx + OFFSET;
    let top = cy - height - OFFSET;

    // Flip to the left when it would spill off the right edge.
    if (left + width > vw - MARGIN) left = cx - width - OFFSET;
    // On a very narrow viewport even the flip can clip the left — pin it.
    if (left < MARGIN) left = MARGIN;

    // Drop below the cursor when it would clip the top, then keep it on screen.
    if (top < MARGIN) top = cy + OFFSET;
    if (top + height > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - height);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  };

  const show = () => {
    if (tipRef.current) tipRef.current.style.opacity = "1";
  };
  const hide = () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (tipRef.current) tipRef.current.style.opacity = "0";
  };

  const onEnter = (e: React.MouseEvent) => {
    place(e.clientX, e.clientY);
    show();
  };
  const onMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      place(clientX, clientY);
    });
  };
  // Keyboard focus has no pointer — anchor the card to the trigger's corner.
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    place(r.right, r.top + 12);
    show();
  };

  return (
    // Hover affordance only — the explainer is mirrored in aria-label and the
    // role="tooltip" child, and onFocus/onBlur make it keyboard-reachable.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={className}
      style={{ cursor: "help", ...style }}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      <div role="tooltip" ref={tipRef} style={TIP_STYLE}>
        {tip}
      </div>
    </div>
  );
}
