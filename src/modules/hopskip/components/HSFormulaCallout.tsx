import MathBlock from "@/modules/learn/MathBlock";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";

interface Props {
  /** Label shown above the formula (e.g. "Tinseth Utilization") */
  title: string;
  /** LaTeX expression */
  expression: string;
  /** Optional plain-language description below the formula */
  description?: string;
}

/**
 * HS-native formula callout. Flat cream-2 panel with a hairline ink border,
 * eyebrow caption, math expression centered, and a muted description below.
 */
export default function HSFormulaCallout({
  title,
  expression,
  description,
}: Props) {
  return (
    <figure
      style={{
        background: hsTokens.cream2,
        border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
        borderRadius: 12,
        padding: "20px 22px",
        margin: "28px 0",
      }}
    >
      <figcaption style={{ marginBottom: 12 }}>
        <HSEyebrow>{title}</HSEyebrow>
      </figcaption>
      <MathBlock expression={expression} />
      {description ? (
        <p
          style={{
            marginTop: 10,
            fontFamily: hsTokens.body,
            fontSize: 13,
            lineHeight: 1.55,
            color: hsTokens.muted,
          }}
        >
          {description}
        </p>
      ) : null}
    </figure>
  );
}
