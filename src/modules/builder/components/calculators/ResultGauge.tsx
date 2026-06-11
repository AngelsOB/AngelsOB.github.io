"use client";

import { hsTokens } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";

interface Props {
  label: string;
  value: string;
  accent: string;
  unit?: string;
  note?: string;
  size?: "md" | "lg";
}

export default function ResultGauge({
  label,
  value,
  accent,
  unit,
  note,
  size = "md",
}: Props) {
  const fontSize = size === "lg" ? 60 : 48;
  const unitSize = size === "lg" ? 22 : 18;
  return (
    <div
      style={{
        background: hsTokens.cream2,
        borderTop: `5px solid ${accent}`,
        borderRadius: 12,
        padding: "14px 18px",
        position: "relative",
      }}
    >
      <HSEyebrow>{label}</HSEyebrow>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize,
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          color: hsTokens.ink,
        }}
      >
        {value}
        {unit ? (
          <span
            style={{
              fontSize: unitSize,
              color: hsTokens.muted,
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {note ? (
        <div style={{ position: "absolute", top: 10, right: 14 }}>
          <HSScriptNote color={accent} size={18} rotate={-4}>
            {note}
          </HSScriptNote>
        </div>
      ) : null}
    </div>
  );
}
