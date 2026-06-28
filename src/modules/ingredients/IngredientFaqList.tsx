import { hsTokens, hsAlpha } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";

import type { IngredientFaqItem } from "./types";

/**
 * Compact generated FAQ — a tight set of high-intent Q/As (substitutes, taste,
 * alpha) rendered as crawlable HTML. Terse, factual answers; Phase 3 wraps the
 * same array in FAQPage JSON-LD.
 */
export default function IngredientFaqList({
  items,
}: {
  items: IngredientFaqItem[];
}) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 34 }}>
      <HSEyebrow as="h2">Common questions</HSEyebrow>
      <dl style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {items.map((f) => (
          <div
            key={f.q}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
              gap: "4px 18px",
              alignItems: "baseline",
              paddingBottom: 12,
              borderBottom: `1px solid ${hsAlpha(hsTokens.ink, 10)}`,
            }}
            className="ingredient-faq-row"
          >
            <dt
              style={{
                fontFamily: hsTokens.body,
                fontSize: 14,
                fontWeight: 700,
                color: hsTokens.ink,
              }}
            >
              {f.q}
            </dt>
            <dd
              style={{
                margin: 0,
                fontFamily: hsTokens.body,
                fontSize: 14,
                lineHeight: 1.5,
                color: hsTokens.muted,
              }}
            >
              {f.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
