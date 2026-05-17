import type { ReactNode } from "react";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";

interface Props {
  index?: string | number;
  title: ReactNode;
  kicker?: ReactNode;
  eyebrow?: ReactNode;
  kickerColor?: string;
  alignEnd?: ReactNode;
}

export default function HSSectionHeader({
  index,
  title,
  kicker,
  eyebrow,
  kickerColor = hsTokens.yeast,
  alignEnd,
}: Props) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", minWidth: 0 }}>
        {index !== undefined ? (
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: "clamp(40px, 6vw, 72px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.85,
              color: hsTokens.muted,
              opacity: 0.5,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {typeof index === "number" ? String(index).padStart(2, "0") : index}
          </span>
        ) : null}
        <div style={{ minWidth: 0, paddingBottom: 4 }}>
          {kicker ? (
            <HSScriptNote color={kickerColor} size={22} rotate={-3} style={{ marginBottom: 4 }}>
              {kicker}
            </HSScriptNote>
          ) : null}
          {eyebrow ? (
            <div style={{ marginBottom: 6 }}>
              <HSEyebrow>{eyebrow}</HSEyebrow>
            </div>
          ) : null}
          <h2
            style={{
              fontFamily: hsTokens.display,
              fontSize: "clamp(28px, 4.4vw, 46px)",
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              color: hsTokens.ink,
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
      </div>
      {alignEnd ? <div style={{ flexShrink: 0 }}>{alignEnd}</div> : null}
    </header>
  );
}
