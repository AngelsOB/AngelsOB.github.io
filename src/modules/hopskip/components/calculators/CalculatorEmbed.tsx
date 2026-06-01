"use client";

import type { ReactNode } from "react";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import Glyph, { type GlyphKind } from "@/modules/hopskip/components/Glyph";

interface Props {
  eyebrow: string;
  title: string;
  glyph: GlyphKind;
  accent: string;
  children: ReactNode;
}

export default function CalculatorEmbed({
  eyebrow,
  title,
  glyph,
  accent,
  children,
}: Props) {
  return (
    <HSCard shadow={3} padding={0} style={{ overflow: "hidden" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          borderBottom: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            background: accent,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Glyph kind={glyph} size={20} color={hsTokens.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HSEyebrow>{eyebrow}</HSEyebrow>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 18,
              letterSpacing: "-0.03em",
              color: hsTokens.ink,
              marginTop: 2,
            }}
          >
            {title}
          </div>
        </div>
      </header>
      <div style={{ padding: 20 }}>{children}</div>
    </HSCard>
  );
}
