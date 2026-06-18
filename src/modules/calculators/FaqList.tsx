import { hsTokens } from "@/modules/builder/tokens";
import type { CalculatorFaq } from "./calculatorsMeta";

/**
 * Bare Q&A list, rendered inside the "FAQ" disclosure row (the row's title is
 * the section label). Mirrors the FAQPage JSON-LD; questions are <h3> so the
 * text is in the DOM whether the row is open or not.
 */
export default function FaqList({ faq }: { faq: CalculatorFaq[] }) {
  if (!faq.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {faq.map((f, i) => (
        <div
          key={i}
          style={{
            paddingBottom: 14,
            borderBottom:
              i < faq.length - 1
                ? `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`
                : "none",
          }}
        >
          <h3
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 14.5,
              color: hsTokens.ink,
              margin: 0,
            }}
          >
            {f.q}
          </h3>
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: hsTokens.muted,
              margin: "6px 0 0",
            }}
          >
            {f.a}
          </p>
        </div>
      ))}
    </div>
  );
}
