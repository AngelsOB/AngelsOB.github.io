"use client";

import { hsTokens } from "@/modules/hopskip/tokens";

// Per PRD section 10: each tour stage's eyebrow text becomes an <h2>, styled
// as eyebrow (700, 11px, 0.16em uppercase). Per-stage tags below; this is the
// shared visual treatment.
export default function StageEyebrow({
  children,
  as = "h2",
}: {
  children: React.ReactNode;
  as?: "h2" | "h3";
}) {
  const Tag = as;
  return (
    <Tag
      style={{
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        margin: 0,
      }}
    >
      {children}
    </Tag>
  );
}
