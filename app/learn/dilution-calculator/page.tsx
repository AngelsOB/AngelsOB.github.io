import type { Metadata } from "next";
import { hsTokens } from "@/modules/hopskip/tokens";
import DilutionCalculator from "@/modules/hopskip/components/calculators/DilutionCalculator";
import CalculatorEmbed from "@/modules/hopskip/components/calculators/CalculatorEmbed";
import HSLearnArticle from "@/modules/hopskip/components/HSLearnArticle";
import HSFormulaCallout from "@/modules/hopskip/components/HSFormulaCallout";

export const metadata: Metadata = {
  title: "Dilution Calculator: Hit Your Target Gravity",
  description: "Calculate how much water to add to hit your target gravity. Conservation of gravity points. Simple and exact.",
  keywords: ["dilution calculator", "gravity dilution", "water addition brewing", "sparge calculator"],
  alternates: { canonical: "/learn/dilution-calculator" },
  openGraph: {
    title: "Dilution Calculator: Hit Your Target Gravity | Brewing.It Learn",
    description: "Calculate how much water to add to hit your target gravity. Conservation of gravity points. Simple and exact.",
  },
  twitter: {
    card: "summary",
    title: "Dilution Calculator: Hit Your Target Gravity | Brewing.It Learn",
    description: "Calculate how much water to add to hit your target gravity. Conservation of gravity points. Simple and exact.",
  },
};

const jsonLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication",
  name: "Dilution Calculator",
  description: "Calculate how much water to add to hit your target gravity.",
  applicationCategory: "UtilityApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/dilution-calculator`,
};

export default function DilutionCalcPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HSLearnArticle
        title="Dilution Calculator"
        subtitle="How much water to add when your gravity is too high"
        relatedLearn={["/learn/boil-off-calculator", "/learn/gravity"]}
        ctaText="Build a full recipe"
      >
        <p className="text-base leading-relaxed">
          Overshot your target gravity? This calculator tells you exactly how
          much water to add to bring it back down. Enter your current volume
          and gravity, set your target, and it gives you the water volume
          needed.
        </p>

        <div className="my-8">
          <CalculatorEmbed
            eyebrow="Dilution"
            title="Water to add for target OG"
            glyph="water"
            accent={hsTokens.water}
          >
            <DilutionCalculator />
          </CalculatorEmbed>
        </div>

        <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
          How We Calculate It
        </h2>
        <HSFormulaCallout
          title="Gravity Points Conservation"
          expression={"V_{total} = \\frac{V_{current} \\times G_{current}}{G_{target}}"}
          description="Sugar doesn&apos;t disappear when you add water. The total gravity points stay constant. Water to add = total volume − current volume."
        />
        <p className="text-sm leading-relaxed">
          This is basic conservation of mass. The gravity points (sugar content)
          in your wort don&apos;t change when you add water. You&apos;re just
          spreading them across a larger volume. It&apos;s exact, not an
          approximation.
        </p>

      </HSLearnArticle>
    </>
  );
}
