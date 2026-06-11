import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../tokens";

interface Props {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export default function HSEyebrow({ children, color, style, className }: Props) {
  return (
    <span
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
        ...style,
      }}
    >
      {children}
    </span>
  );
}
