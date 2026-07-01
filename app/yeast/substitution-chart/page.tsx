import type { Metadata } from "next";

import { hsTokens } from "@/modules/builder/tokens";
import IngredientDetailHeader from "@/modules/ingredients/IngredientDetailHeader";
import YeastSidebar from "@/modules/ingredients/yeast/YeastSidebar";
import YeastSubstitutionChart from "@/modules/ingredients/yeast/YeastSubstitutionChart";
import { yeastChartRows } from "@/modules/ingredients/yeast/yeastKind";
import { ingredientDetailJsonLd } from "@/modules/ingredients/jsonLd";

const ROWS = yeastChartRows();
const ROW_COUNT = ROWS.length;

const DESCRIPTION = `Cross-lab equivalents and substitutes for brewing yeast. Find a strain to see the same yeast sold by White Labs, Wyeast, Omega, Fermentis, and more, plus its closest substitutes. Covers ${ROW_COUNT} ale, lager, wheat, and kveik strains.`;

export const metadata: Metadata = {
  title: "Yeast Substitution Chart — Cross-Lab Equivalents",
  description: DESCRIPTION,
  alternates: { canonical: "/yeast/substitution-chart" },
  openGraph: {
    title: "Yeast Substitution Chart | Brewing.It",
    description: DESCRIPTION,
    url: "/yeast/substitution-chart",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Yeast Substitution Chart | Brewing.It",
    description: DESCRIPTION,
  },
};

const FAQ = [
  {
    q: "Can I use a different lab's version of a yeast?",
    a: "Usually, yes. A lot of strains are the same yeast sold under different names. US-05, WLP001, and Wyeast 1056 are all the Chico ale strain, for example. On this chart, the same-strain rows ferment the same; substitutes are close but not identical.",
  },
  {
    q: "What is the difference between a yeast equivalent and a substitute?",
    a: "An equivalent is the same strain from another lab, so it behaves the same. A substitute is a different strain that does a similar job. This chart shows both, labelled on each row.",
  },
];

export default function YeastSubstitutionChartPage() {
  const jsonLd = ingredientDetailJsonLd({
    name: "Yeast Substitution Chart",
    termLabel: "yeast substitution chart",
    description: DESCRIPTION,
    path: "/yeast/substitution-chart",
    sectionLabel: "Yeast",
    sectionPath: "/yeast",
    faq: FAQ,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <IngredientDetailHeader
          crumbs={[
            { name: "Home", href: "/" },
            { name: "Yeast", href: "/yeast" },
          ]}
          title="Yeast Substitution Chart"
          lede="The same yeast turns up under different names at different labs. Find a strain below to see the same strain sold elsewhere, plus its closest substitutes."
        />

        <div className="subchart-grid">
          <div style={{ minWidth: 0 }}>
            <YeastSubstitutionChart />

            <section className="subchart-footnote">
              <p style={{ margin: 0 }}>
                {ROW_COUNT} strains with a cross-lab match or a known substitute. The
                same-strain rows come from strain lineage and genetics, not from
                matching specs, so a shared row is the same yeast. Substitutes are the
                nearest stand-ins. Tap any name for its attenuation, temperature,
                flocculation, and genetic traits.
              </p>
            </section>
          </div>

          <YeastSidebar />
        </div>

        <style>{`
          .subchart-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(230px, 0.42fr);
            gap: 28px;
            align-items: start;
          }
          .subchart-footnote {
            margin-top: 30px;
            padding-top: 18px;
            border-top: 1px solid color-mix(in oklab, ${hsTokens.ink} 13%, transparent);
            max-width: 680px;
            font-family: ${hsTokens.body};
            font-size: 13px;
            line-height: 1.6;
            color: ${hsTokens.muted};
          }
          @media (max-width: 1024px) {
            .subchart-grid { grid-template-columns: 1fr; }
          }
        `}</style>
      </article>
    </>
  );
}
