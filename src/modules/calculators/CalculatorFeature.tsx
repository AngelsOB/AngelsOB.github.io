import { hsTokens } from "@/modules/builder/tokens";
import Glyph from "@/modules/builder/components/Glyph";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";

import { getCalculator } from "./calculatorsConfig";
import QuickAnswer from "./QuickAnswer";
import FaqList from "./FaqList";
import RelatedLinks from "./RelatedLinks";
import CalcAccordion from "./CalcAccordion";

/**
 * The featured column for one calculator. Tool-first and deliberately short:
 * the live tool (its card header carries the page <h1>), a one-line quick
 * answer, then the explanation + FAQ tucked into disclosure rows so the page
 * stays clean while the content stays in the DOM for search/answer engines.
 */
export default function CalculatorFeature({ slug }: { slug: string }) {
  const calc = getCalculator(slug);
  if (!calc) return null;
  const { Calculator, Article } = calc;

  return (
    <article>
      {/* Featured tool — header carries the H1 */}
      <HSCard shadow={4} padding={0} style={{ overflow: "hidden" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 22px",
            borderBottom: `2px solid ${hsTokens.ink}`,
            background: hsTokens.cream2,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              background: calc.accent,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Glyph kind={calc.glyph} size={24} color={hsTokens.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HSEyebrow>{calc.eyebrow}</HSEyebrow>
            <h1
              style={{
                fontFamily: hsTokens.display,
                fontSize: 24,
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                color: hsTokens.ink,
                margin: "4px 0 0",
              }}
            >
              {calc.h1}
            </h1>
          </div>
        </header>

        <div style={{ padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <HSScriptNote color={calc.accent} size={20} rotate={-2}>
              {calc.tagline}
            </HSScriptNote>
          </div>
          <Calculator accent={calc.accent} />
        </div>
      </HSCard>

      <QuickAnswer data={calc.quickAnswer} accent={calc.accent} />

      <CalcAccordion
        items={[
          {
            id: "how",
            title: "How it works",
            children: (
              <div className="learn-prose">
                <Article />
              </div>
            ),
          },
          {
            id: "faq",
            title: "FAQ",
            children: <FaqList faq={calc.faq} />,
          },
        ]}
      />

      <RelatedLinks related={calc.related} variant="inline" />
    </article>
  );
}
