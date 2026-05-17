import type { Metadata } from "next";
import HSLearnArticle from "@/modules/hopskip/components/HSLearnArticle";
import HSFormulaCallout from "@/modules/hopskip/components/HSFormulaCallout";
import HopRadarDemo from "@/modules/learn/HopRadarDemo";

export const metadata: Metadata = {
  title: "The Hop Flavor Radar: Mapping Hop Character Beyond IBU",
  description:
    "How Brewing.It maps hop flavor across 9 axes: citrus, tropical, resin, floral, and more. Understand the aroma model that shows what your hops actually taste like.",
  keywords: [
    "hop flavor profile",
    "hop aroma calculator",
    "hop character chart",
    "citrus hops",
    "tropical hops",
    "hop radar chart",
  ],
  alternates: { canonical: "/learn/hop-flavor" },
  openGraph: {
    title: "The Hop Flavor Radar: Mapping Hop Character Beyond IBU | Brewing.It Learn",
    description:
      "How Brewing.It maps hop flavor across 9 axes: citrus, tropical, resin, floral, and more. Understand the aroma model that shows what your hops actually taste like.",
  },
  twitter: {
    card: "summary",
    title: "The Hop Flavor Radar: Mapping Hop Character Beyond IBU | Brewing.It Learn",
    description:
      "How Brewing.It maps hop flavor across 9 axes: citrus, tropical, resin, floral, and more. Understand the aroma model that shows what your hops actually taste like.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The Hop Flavor Radar: Mapping Hop Character Beyond IBU",
  description:
    "How Brewing.It maps hop flavor across 9 axes using dose, timing, and aroma retention factors.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/hop-flavor`,
  },
};


export default function HopFlavorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HSLearnArticle
        title="Hop Flavor Radar"
        subtitle="What your hops actually taste like, beyond the IBU number"
        relatedLearn={["/learn/ibu", "/learn/gravity"]}
      >
        <p className="text-base leading-relaxed">
          IBU tells you how bitter your beer is. But 40 IBU of Cascade and 40
          IBU of Hallertau taste completely different. One is grapefruity and
          piney, the other is floral and spicy. The hop flavor radar shows the{" "}
          <em>shape</em> of your hop character, not just the intensity.
        </p>

        <p className="text-sm leading-relaxed">
          As you add hops to your recipe, the radar updates in real time
          across 9 flavor axes: citrus, tropical fruit, stone fruit, berry,
          floral, grassy, herbal, spice, and resin/pine. It&apos;s useful for
          comparing hop bills, understanding substitutions, and checking whether
          your hop character matches the style you&apos;re aiming for.
        </p>

        <div
          className="my-8 rounded-2xl overflow-hidden"
          style={{
            boxShadow: "var(--shadow-card)",
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between grain"
            style={{
              background: "linear-gradient(135deg, oklch(82% 0.12 145), oklch(78% 0.1 150))",
            }}
          >
            <span className="text-sm font-black tracking-tight" style={{ color: "oklch(25% 0.05 145)" }}>
              Hop Flavor Profile
            </span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "color-mix(in oklch, var(--coral-500) 15%, oklch(95% 0.02 145))",
                color: "var(--coral-600)",
              }}
            >
              unique to Brewing.It
            </span>
          </div>
          <div style={{ background: "var(--card)" }}>
            <HopRadarDemo />
          </div>
          <div
            className="px-5 py-2.5 text-center"
            style={{
              color: "var(--fg-muted)",
              fontFamily: "'Shadows Into Light', cursive",
              fontSize: "0.85rem",
              background: "color-mix(in oklch, var(--surface) 50%, transparent)",
              borderTop: "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
            }}
          >
            A West Coast IPA: heavy on citrus and pine, light on everything else.
          </div>
        </div>

        <h2
          id="how-we-calculate-it"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          How We Calculate It
        </h2>

        <p className="text-sm leading-relaxed mb-4">
          Each hop variety has a flavor profile across all 9 axes (sourced from
          published hop descriptors). Each addition is then weighted by two
          things: <strong>dose</strong> (grams per liter) and{" "}
          <strong>aroma retention</strong>, how much flavor survives the
          brewing process.
        </p>

        <div className="space-y-4">
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.12 145)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3
              className="text-base font-bold mb-2"
              style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
            >
              Aroma Retention by Addition Type
            </h3>
            <div className="text-sm space-y-1.5" style={{ color: "var(--fg-muted)" }}>
              <p><strong>Dry hops</strong> retain ~80% of volatile aroma compounds because there&apos;s no heat to drive them off.</p>
              <p><strong>Whirlpool hops</strong> retain 50–100% depending on temperature and time. Cooler, shorter stands preserve more.</p>
              <p><strong>Boil additions</strong> lose aroma exponentially. A 60-minute boil retains only about 5%. Bitterness goes up, flavor fades.</p>
              <p><strong>First wort &amp; mash hops</strong> retain almost nothing (5–8%). They&apos;re for bitterness, not flavor.</p>
            </div>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 60)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3
              className="text-base font-bold mb-2"
              style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
            >
              The Perceptual Ceiling
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              The model uses a sigmoidal intensity curve. Doubling your dry hops
              doesn&apos;t double the displayed flavor. There&apos;s a practical
              limit to perceivable aroma intensity. This prevents the radar from
              blowing out to unrealistic values on heavily hopped recipes.
            </p>
          </div>
        </div>

        <HSFormulaCallout
          title="Intensity Curve"
          expression={"\\text{magnitude} = 5 \\times \\left(1 - e^{-0.7 \\times w_{total}}\\right)"}
          description="The overall intensity approaches a ceiling of 5 as total hop weight increases. Diminishing returns, just like in real life."
        />

        <h2
          id="what-its-good-for"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          What It&apos;s Good For
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          <strong>Comparing hop bills:</strong> swap Galaxy for Simcoe and
          instantly see the profile shift from tropical to resin.
        </p>
        <p className="text-sm leading-relaxed mb-3">
          <strong>Checking style fit:</strong> a NEIPA should light up the
          tropical and citrus axes. If your radar shows mostly herbal, your hop
          bill might need rethinking.
        </p>
        <p className="text-sm leading-relaxed">
          <strong>Understanding additions:</strong> see why moving hops from a
          60-minute boil to a dry hop completely changes the flavor character,
          even though the same hop variety is used.
        </p>

        <h2
          id="where-this-comes-from"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed">
          This is an original model. There&apos;s no published standard for
          predicting hop flavor profiles. The aroma retention factors are
          informed by general hop oil volatility research and brewing science
          principles. It&apos;s not a lab measurement, and it can&apos;t predict
          exactly what a beer will taste like. But it gives a useful comparative
          signal for comparing hop bills and understanding how additions affect flavor.
        </p>

      </HSLearnArticle>
    </>
  );
}
