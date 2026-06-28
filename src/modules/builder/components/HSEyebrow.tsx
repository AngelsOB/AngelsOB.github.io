import type { CSSProperties, ElementType, ReactNode } from "react";

import { hsTokens } from "../tokens";

interface Props {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
  className?: string;
  /** Render as a heading (e.g. "h2") for semantic section labels; the eyebrow
   *  look is preserved. Defaults to a presentational span. */
  as?: ElementType;
}

export default function HSEyebrow({
  children,
  color,
  style,
  className,
  as: Tag = "span",
}: Props) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: color ?? hsTokens.muted,
        display: "inline-block",
        lineHeight: 1,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
