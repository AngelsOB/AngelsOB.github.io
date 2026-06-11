import type { ReactNode } from "react";

import { hsTokens } from "../tokens";
import HSCard from "./HSCard";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";

interface Props {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  range?: ReactNode;
  accent?: string;
  note?: ReactNode;
  noteColor?: string;
  noteRotate?: number;
  shadow?: 1 | 2 | 3 | 4;
}

export default function HSStatCard({
  label,
  value,
  unit,
  range,
  accent = hsTokens.malt,
  note,
  noteColor = hsTokens.yeast,
  noteRotate = -8,
  shadow = 2,
}: Props) {
  return (
    <HSCard accent={accent} shadow={shadow} padding="14px 16px 12px">
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
        <HSEyebrow>{label}</HSEyebrow>
        {note ? (
          <HSScriptNote color={noteColor} size={16} rotate={noteRotate}>
            {note}
          </HSScriptNote>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 30,
          letterSpacing: "-0.035em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          marginTop: 6,
          color: hsTokens.ink,
        }}
      >
        {value}
        {unit ? (
          <span style={{ fontSize: 14, marginLeft: 4, color: hsTokens.muted }}>{unit}</span>
        ) : null}
      </div>
      {range ? (
        <div
          style={{
            marginTop: 4,
            fontFamily: hsTokens.mono,
            fontSize: 10,
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {range}
        </div>
      ) : null}
    </HSCard>
  );
}
