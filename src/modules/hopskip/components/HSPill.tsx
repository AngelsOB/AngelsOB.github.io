import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../tokens";

interface Props {
  dot?: string;
  label: ReactNode;
  value?: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export default function HSPill({
  dot,
  label,
  value,
  style,
  className,
  onClick,
}: Props) {
  const mergedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px",
    background: hsTokens.paper,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 999,
    fontFamily: hsTokens.body,
    fontSize: 12,
    color: hsTokens.ink,
    cursor: onClick ? "pointer" : "default",
    textAlign: "left",
    ...style,
  };

  const inner = (
    <>
      {dot ? (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: dot,
            border: `1px solid ${hsTokens.ink}`,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      ) : null}
      <span
        style={{
          fontWeight: 700,
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </span>
      {value !== undefined && value !== null ? (
        <span style={{ fontWeight: 600, fontSize: 12 }}>{value}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={["hs-pill", className].filter(Boolean).join(" ")}
        style={mergedStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={["hs-pill", className].filter(Boolean).join(" ")}
      style={mergedStyle}
    >
      {inner}
    </div>
  );
}
