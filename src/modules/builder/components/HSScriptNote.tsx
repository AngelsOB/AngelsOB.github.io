import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../tokens";

interface Props {
  children: ReactNode;
  color?: string;
  size?: number;
  rotate?: number;
  style?: CSSProperties;
  className?: string;
}

export default function HSScriptNote({
  children,
  color = hsTokens.yeast,
  size = 18,
  rotate = -3,
  style,
  className,
}: Props) {
  return (
    <span
      className={className}
      style={{
        fontFamily: hsTokens.script,
        fontWeight: 500,
        fontSize: size,
        color,
        lineHeight: 1,
        display: "inline-block",
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "left center",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
