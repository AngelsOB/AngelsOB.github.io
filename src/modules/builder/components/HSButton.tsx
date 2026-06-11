import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../tokens";

type Variant = "solid" | "ghost" | "ink";
type Size = "sm" | "md" | "lg";

interface Props {
  children: ReactNode;
  variant?: Variant;
  color?: string; // ingredient accent for solid/ink offset shadow
  size?: Size;
  arrow?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  fullWidth?: boolean;
  title?: string;
}

const PADDING: Record<Size, string> = {
  sm: "8px 14px",
  md: "10px 18px",
  lg: "13px 24px",
};

const FONT_SIZE: Record<Size, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

function baseStyle(variant: Variant, color: string): CSSProperties {
  if (variant === "solid") {
    return {
      background: color,
      color: hsTokens.ink,
      border: `2px solid ${hsTokens.ink}`,
      boxShadow: hsTokens.sh2,
    };
  }
  if (variant === "ink") {
    return {
      background: hsTokens.ink,
      color: hsTokens.cream,
      border: `2px solid ${hsTokens.ink}`,
      boxShadow: `3px 3px 0 ${color}`,
    };
  }
  return {
    background: hsTokens.paper,
    color: hsTokens.ink,
    border: `2px solid ${hsTokens.ink}`,
    boxShadow: hsTokens.sh2,
  };
}

export default function HSButton({
  children,
  variant = "solid",
  color = hsTokens.malt,
  size = "md",
  arrow,
  href,
  onClick,
  type = "button",
  disabled,
  className,
  style,
  fullWidth,
  title,
}: Props) {
  const fontSize = FONT_SIZE[size];
  const padding = PADDING[size];
  const variantStyle = baseStyle(variant, color);

  const mergedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: fullWidth ? "100%" : undefined,
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    borderRadius: 999,
    padding,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "transform 120ms var(--hs-ease, ease), box-shadow 120ms var(--hs-ease, ease)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...variantStyle,
    ...style,
  };

  const content = (
    <>
      <span>{children}</span>
      {arrow ? <span aria-hidden>→</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={["hs-btn", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        onClick={onClick}
        title={title}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={["hs-btn", className].filter(Boolean).join(" ")}
      style={mergedStyle}
      title={title}
    >
      {content}
    </button>
  );
}
