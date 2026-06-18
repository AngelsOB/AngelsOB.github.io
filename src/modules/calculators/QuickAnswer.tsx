import { hsTokens } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import type { CalculatorQuickAnswer } from "./calculatorsMeta";

/**
 * Compact, always-visible answer strip: the formula up front (extractable by
 * answer engines), one plain-language line under it. The worked example lives
 * in the "How it works" disclosure, not here.
 */
export default function QuickAnswer({
  data,
  accent,
}: {
  data: CalculatorQuickAnswer;
  accent: string;
}) {
  return (
    <div
      style={{
        margin: "16px 0",
        padding: "13px 16px",
        background: hsTokens.cream2,
        border: `2px solid ${hsTokens.ink}`,
        borderLeft: `6px solid ${accent}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh1,
      }}
    >
      <HSEyebrow>Quick answer</HSEyebrow>
      {data.formula ? (
        <div
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 15,
            fontWeight: 600,
            color: hsTokens.ink,
            margin: "8px 0 6px",
            overflowX: "auto",
          }}
        >
          {data.formula}
        </div>
      ) : null}
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: hsTokens.muted,
          margin: 0,
        }}
      >
        {data.answer}
      </p>
    </div>
  );
}
