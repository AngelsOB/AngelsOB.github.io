import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../tokens";

type Tag = "div" | "section" | "article" | "li";

interface Props {
  children: ReactNode;
  shadow?: 1 | 2 | 3 | 4;
  bg?: string;
  tilt?: number;
  accent?: string;
  radius?: number;
  padding?: number | string;
  style?: CSSProperties;
  className?: string;
  as?: Tag;
  href?: string;
  onClick?: () => void;
}

const SHADOWS = {
  1: hsTokens.sh1,
  2: hsTokens.sh2,
  3: hsTokens.sh3,
  4: hsTokens.sh4,
} as const;

export default function HSCard({
  children,
  shadow = 3,
  bg = hsTokens.paper,
  tilt = 0,
  accent,
  radius = 14,
  padding = 16,
  style,
  className,
  as = "div",
  href,
  onClick,
}: Props) {
  // The accent strip is an absolute child positioned at the top of the
  // card's padding-box (already inside the 2px ink border). For the strip's
  // corners to sit cleanly INSIDE the border, the strip's top-corner radii
  // must match the parent's INNER curve, not the outer. Inner radius =
  // outer radius − border width (2px). Belt-and-suspenders: parent has
  // `overflow: hidden` so anything bleeding past the inner curve is clipped.
  const innerRadius = Math.max(0, radius - 2);
  const accentStripStyle: CSSProperties | undefined = accent
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        background: accent,
        borderTopLeftRadius: innerRadius,
        borderTopRightRadius: innerRadius,
        pointerEvents: "none",
      }
    : undefined;

  const mergedStyle: CSSProperties = {
    position: "relative",
    background: bg,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: radius,
    boxShadow: SHADOWS[shadow],
    padding,
    color: hsTokens.ink,
    transform: tilt ? `rotate(${tilt}deg)` : undefined,
    display: "block",
    textDecoration: "none",
    overflow: "hidden",
    ...style,
  };

  const inner = (
    <>
      {accent ? <span aria-hidden style={accentStripStyle} /> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={mergedStyle} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  const Tag = as;
  return (
    <Tag className={className} style={mergedStyle} onClick={onClick}>
      {inner}
    </Tag>
  );
}
