"use client";

import { hsTokens } from "../../tokens";

interface Props {
  heading: string;
  color: string;
  /** Use a smaller heading clamp for long titles (e.g. "Fermentation & Conditioning."). */
  small?: boolean;
}

export default function BuilderTitleBar({
  heading,
  color,
  small,
}: Props) {
  return (
    <header
      className="hs-builder-title"
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${color}`,
        gridColumn: "1 / -1",
      }}
    >
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: small ? "clamp(28px, 4.4vw, 44px)" : "clamp(32px, 4.6vw, 44px)",
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: hsTokens.ink,
          margin: "4px 0 0",
        }}
      >
        {heading}
      </h2>
    </header>
  );
}
