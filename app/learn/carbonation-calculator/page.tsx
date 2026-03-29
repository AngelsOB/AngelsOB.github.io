import type { Metadata } from "next";
import CarbonationCalculator from "@/components/CarbonationCalculator";
import LearnArticle from "@/modules/learn/LearnArticle";

export const metadata: Metadata = {
  title: "Carbonation Calculator: PSI for Your CO₂ Volumes",
  description: "Find the right keg pressure for your desired CO₂ volumes at serving temperature. Instant PSI and bar readings.",
  keywords: ["carbonation calculator", "CO2 volumes", "keg PSI", "force carbonation", "beer carbonation"],
  alternates: { canonical: "/learn/carbonation-calculator" },
};

const jsonLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication",
  name: "Carbonation Calculator",
  description: "Find the right keg PSI for your desired CO₂ volumes at serving temperature.",
  applicationCategory: "UtilityApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/carbonation-calculator`,
};

export default function CarbonationCalcPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LearnArticle
        title="Carbonation Calculator"
        subtitle="The right pressure for the right fizz"
        relatedLearn={["/learn/abv-calculator", "/learn/gravity"]}
        ctaText="Build a full recipe"
      >
        <p className="text-base leading-relaxed">
          CO₂ volumes tell you how carbonated your beer is. A British bitter
          might be 1.5 volumes. A German wheat beer pushes 4.0+. If you&apos;re
          kegging, you need to know what PSI to set at your serving temperature
          . This calculator gives you that number instantly.
        </p>

        <div className="my-8"><CarbonationCalculator /></div>

        <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          How We Calculate It
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          CO₂ equilibrium pressure depends on temperature. Colder beer absorbs
          more CO₂ at the same pressure. We use an empirical polynomial fit to
          the CO₂ solubility curve. Enter your desired volumes and serving temp,
          and the calculator solves for the pressure needed.
        </p>

        <div
          className="grain rounded-xl p-5 my-6"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 220)), var(--card))`,
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
            Typical CO₂ Volumes by Style
          </h3>
          <div className="text-sm space-y-1" style={{ color: "var(--fg-muted)" }}>
            <p><strong>1.5–2.0</strong>: British ales, cask-conditioned</p>
            <p><strong>2.2–2.7</strong>: American ales, lagers, most styles</p>
            <p><strong>2.7–3.5</strong>: Belgian ales, saisons</p>
            <p><strong>3.5–4.5</strong>: German wheat beers, highly carbonated styles</p>
          </div>
        </div>

      </LearnArticle>
    </>
  );
}
