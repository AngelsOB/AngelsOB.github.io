import type { Metadata } from "next";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/learn/* is the quarantined reference; intentional import
import OLD_BoilOffCalculator from "@/components/OLD_BoilOffCalculator";
import LearnArticle from "@/modules/learn/LearnArticle";
import FormulaCallout from "@/modules/learn/FormulaCallout";

export const metadata: Metadata = {
  title: "Boil-Off Calculator: Pre-Boil to Post-Boil Volume",
  description: "Calculate your post-boil volume and how long to boil to hit your target OG. Same conservation principle as dilution, in reverse.",
  keywords: ["boil off calculator", "pre boil gravity", "post boil volume", "boil time calculator"],
  alternates: { canonical: "/learn/boil-off-calculator" },
  openGraph: {
    title: "Boil-Off Calculator: Pre-Boil to Post-Boil Volume | Brewing.It Learn",
    description: "Calculate your post-boil volume and how long to boil to hit your target OG. Same conservation principle as dilution, in reverse.",
  },
  twitter: {
    card: "summary",
    title: "Boil-Off Calculator: Pre-Boil to Post-Boil Volume | Brewing.It Learn",
    description: "Calculate your post-boil volume and how long to boil to hit your target OG. Same conservation principle as dilution, in reverse.",
  },
};

const jsonLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication",
  name: "Boil-Off Calculator",
  description: "Calculate post-boil volume from pre-boil measurements and target OG.",
  applicationCategory: "UtilityApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/boil-off-calculator`,
};

export default function BoilOffCalcPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LearnArticle
        title="Boil-Off Calculator"
        subtitle="How much volume you'll lose, and when to stop boiling"
        relatedLearn={["/learn/dilution-calculator", "/learn/gravity"]}
        ctaText="Build a full recipe"
      >
        <p className="text-base leading-relaxed">
          During the boil, water evaporates but sugar stays. That concentrates
          your wort. Gravity goes up as volume goes down. This calculator
          tells you how much volume you&apos;ll end up with, or how long to
          boil to hit your target gravity.
        </p>

        <div className="my-8"><OLD_BoilOffCalculator /></div>

        <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          How We Calculate It
        </h2>
        <FormulaCallout
          title="Post-Boil Volume"
          expression={"V_{post} = \\frac{V_{pre} \\times G_{pre}}{G_{target}}"}
          description="Same conservation principle as dilution, in reverse. Water leaves, sugar stays, gravity concentrates."
        />
        <p className="text-sm leading-relaxed">
          If you know your boil-off rate (liters per hour), you can also
          calculate the boil time needed to reach your target. Typical
          boil-off rates are 3–5 L/hr depending on your kettle and burner.
        </p>

      </LearnArticle>
    </>
  );
}
