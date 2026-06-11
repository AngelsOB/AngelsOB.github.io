"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";

import { hsTokens } from "../tokens";
import HSScriptNote from "./HSScriptNote";
import { useCursorFollowCard } from "./useCursorFollowCard";

interface CardLikeProps {
  className?: string;
}

interface Props {
  children: ReactNode;
  href?: string;
  ariaLabel?: string;
  ctaLabel?: string;
  ctaColor?: string;
  disabled?: boolean;
}

export default function HSCardLift({
  children,
  href,
  ariaLabel,
  ctaLabel = "open →",
  ctaColor = hsTokens.water,
  disabled = false,
}: Props) {
  const { setWrapper, ctaRef, onMouseMove, onMouseLeave } = useCursorFollowCard({ disabled });

  const decorated = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const typed = child as ReactElement<CardLikeProps>;
    const existing = typed.props.className;
    const merged = ["hs-lift-inner", existing].filter(Boolean).join(" ");
    return cloneElement(typed, { className: merged });
  });

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    display: "block",
    color: hsTokens.ink,
    textDecoration: "none",
    borderRadius: 14,
    cursor: "pointer",
  };

  const ctaWrap = !disabled ? (
    <div
      ref={ctaRef}
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 28,
        transform: "translate(0, 0)",
        transition: "opacity 140ms ease, transform 90ms ease-out",
        willChange: "transform, opacity",
      }}
    >
      <HSScriptNote color={ctaColor} size={20}>
        {ctaLabel}
      </HSScriptNote>
    </div>
  ) : null;

  if (href) {
    return (
      <Link
        ref={setWrapper}
        href={href}
        aria-label={ariaLabel}
        className="hs-lift-card"
        style={wrapperStyle}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {decorated}
        {ctaWrap}
      </Link>
    );
  }

  return (
    <div
      ref={setWrapper}
      className="hs-lift-card"
      style={wrapperStyle}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {decorated}
      {ctaWrap}
    </div>
  );
}
