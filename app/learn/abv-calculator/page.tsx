import type { Metadata } from "next";
import AbvCalculator from "@/components/AbvCalculator";
import LearnArticle from "@/modules/learn/LearnArticle";
import FormulaCallout from "@/modules/learn/FormulaCallout";

export const metadata: Metadata = {
  title: "ABV Calculator: Alcohol by Volume",
  description:
    "Calculate alcohol by volume from original and final gravity readings. Learn how the formula works and when to use it on brew day.",
  keywords: [
    "ABV calculator",
    "alcohol by volume",
    "OG FG calculator",
    "homebrew ABV",
    "gravity to ABV",
    "beer alcohol calculator",
  ],
  alternates: { canonical: "/learn/abv-calculator" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ABV Calculator",
  description:
    "Free ABV calculator for homebrewers. Enter original and final gravity to estimate alcohol by volume.",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/abv-calculator`,
};

export default function AbvCalcPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LearnArticle
        title="ABV Calculator"
        subtitle="How strong is your beer?"
        relatedLearn={["/learn/gravity", "/learn/hydrometer-calculator"]}
        ctaText="Build a full recipe"
      >
        {/* What it is */}
        <p className="text-base leading-relaxed">
          ABV (alcohol by volume) tells you how strong your beer is. A
          session pale ale might be 4.5%. A barleywine pushes 10%+. It comes
          down to one thing: how much sugar your yeast ate.
        </p>

        <p className="text-sm leading-relaxed">
          You measure gravity before fermentation (OG) and after (FG). The
          bigger the drop, the more sugar your yeast converted to alcohol. In
          the recipe builder, ABV updates automatically as you adjust your grain
          bill and yeast selection, but this standalone version is handy on
          brew day.
        </p>

        <div className="my-6">
          <AbvCalculator />
        </div>

        <p className="text-sm leading-relaxed">
          If your sample temperature differs from your hydrometer&apos;s
          calibration temperature, correct the reading first with the{" "}
          <a
            href="/learn/hydrometer-calculator"
            className="text-[var(--coral-500)] hover:underline font-medium"
          >
            hydrometer correction calculator
          </a>
          .
        </p>

        {/* How we calculate it */}
        <h2
          id="how-we-calculate-it"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          How We Calculate It
        </h2>

        <FormulaCallout
          title="ABV Formula"
          expression={"ABV = (OG - FG) \\times 131.25"}
          description="The industry standard formula. Accurate to within 0.1% ABV for beers under 1.080 OG."
        />

        <p className="text-sm leading-relaxed mb-4">
          That&apos;s it. The gravity drop times 131.25. It works because the
          relationship between sugar consumed and alcohol produced is nearly
          linear for normal-strength beers.
        </p>

        {/* Worked example */}
        <div
          className="rounded-xl p-5 my-6"
          style={{
            background: `
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E") repeat,
              var(--surface)
            `,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div className="text-sm" style={{ color: "var(--fg-strong)" }}>
            <p>
              A beer with <strong>OG 1.052</strong> and{" "}
              <strong>FG 1.012</strong>:
            </p>
            <p className="mt-2">
              (1.052 − 1.012) × 131.25 = 0.040 × 131.25 ={" "}
              <strong className="text-base">5.25% ABV</strong>
            </p>
          </div>
        </div>

        {/* Limits & edge cases */}
        <div
          className="rounded-xl p-5 my-6"
          style={{
            background: `
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E") repeat,
              linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 60)), var(--card))
            `,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <h3
            className="text-base font-bold mb-2"
            style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
          >
            For high-gravity beers
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            Above about 1.080 OG, the linear relationship between gravity drop
            and alcohol starts to curve. More accurate alternatives exist (like
            the Cutaia formula), but for the vast majority of beers the simple
            formula is within a tenth of a percent. We use the standard approach
            because the difference only shows up in imperial stouts and
            barleywines, and even then it&apos;s small.
          </p>
        </div>

        {/* Where this comes from */}
        <h2
          id="where-this-comes-from"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed">
          The 131.25 constant traces back to Balling&apos;s 1865 work on
          fermentation chemistry, later refined by Michael Hall in{" "}
          <em>Zymurgy</em> (1995). It simplifies a more complex relationship
          between gravity drop and ethanol production, one that holds
          remarkably well for the beers most of us are brewing.
        </p>

      </LearnArticle>
    </>
  );
}
