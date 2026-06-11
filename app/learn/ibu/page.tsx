import type { Metadata } from "next";
import HSLearnArticle from "@/modules/builder/components/HSLearnArticle";
import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

export const metadata: Metadata = {
  title: "Understanding IBU: How Bitterness Is Calculated",
  description:
    "Learn how Brewing.It calculates IBU for every type of hop addition: boil, whirlpool, dry hop, and first wort. The formulas, the reasoning, and what makes our approach different.",
  keywords: [
    "IBU calculator",
    "tinseth formula",
    "hop bitterness",
    "whirlpool hops IBU",
    "dry hop bitterness",
    "first wort hopping",
    "iso-alpha acids",
    "humulinone",
  ],
  alternates: { canonical: "/learn/ibu" },
  openGraph: {
    title: "Understanding IBU: How Bitterness Is Calculated | Brewing.It Learn",
    description:
      "Learn how Brewing.It calculates IBU for every type of hop addition: boil, whirlpool, dry hop, and first wort. The formulas, the reasoning, and what makes our approach different.",
  },
  twitter: {
    card: "summary",
    title: "Understanding IBU: How Bitterness Is Calculated | Brewing.It Learn",
    description:
      "Learn how Brewing.It calculates IBU for every type of hop addition: boil, whirlpool, dry hop, and first wort. The formulas, the reasoning, and what makes our approach different.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Understanding IBU: How Bitterness Is Calculated",
  description:
    "How Brewing.It calculates IBU across boil, whirlpool, dry hop, and first wort additions. The formulas, the reasoning, and the research behind it.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/ibu`,
  },
};

/** Mini UI mockup showing a hop addition row with live IBU */
function HopAdditionPreview() {
  return (
    <div
      className="my-8 rounded-2xl overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
        border:
          "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
      }}
    >
      {/* Header bar */}
      <div
        className="px-5 py-3 flex items-center justify-between grain"
        style={{
          background:
            "linear-gradient(135deg, oklch(82% 0.12 145), oklch(78% 0.1 150))",
        }}
      >
        <span
          className="text-sm font-black tracking-tight"
          style={{ color: "oklch(25% 0.05 145)" }}
        >
          Hops
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: "oklch(95% 0.03 145)",
            color: "oklch(35% 0.06 145)",
          }}
        >
          46 IBU
        </span>
      </div>

      {/* Hop rows */}
      <div className="p-4 space-y-3" style={{ background: "var(--card)" }}>
        {[
          { name: "Centennial", aa: "10.0%", type: "Boil", time: "60 min", weight: "18g", ibu: "18.7" },
          { name: "Simcoe", aa: "13.0%", type: "Boil", time: "15 min", weight: "14g", ibu: "7.4" },
          { name: "Simcoe", aa: "13.0%", type: "Dry Hop", time: "5 days", weight: "28g", ibu: "5.4" },
          { name: "Cascade", aa: "5.5%", type: "Whirlpool", time: "20 min", weight: "28g", ibu: "3.2" },
        ].map((hop, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
            style={{
              background:
                "color-mix(in oklch, var(--surface) 60%, transparent)",
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
            }}
          >
            <div className="flex-1 min-w-0">
              <span className="font-semibold" style={{ color: "var(--fg-strong)" }}>
                {hop.name}
              </span>
              <span className="ml-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                {hop.aa} AA
              </span>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                background:
                  hop.type === "Dry Hop"
                    ? "color-mix(in oklch, oklch(70% 0.15 145) 15%, transparent)"
                    : hop.type === "Whirlpool"
                      ? "color-mix(in oklch, oklch(70% 0.15 60) 15%, transparent)"
                      : "color-mix(in oklch, var(--fg-strong) 8%, transparent)",
                color: "var(--fg-muted)",
              }}
            >
              {hop.type}
            </span>
            <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--fg-muted)" }}>
              {hop.time}
            </span>
            <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--fg-muted)" }}>
              {hop.weight}
            </span>
            <span
              className="text-xs font-bold tabular-nums shrink-0"
              style={{ color: "var(--fg-strong)" }}
            >
              {hop.ibu} IBU
            </span>
          </div>
        ))}
      </div>

      {/* Caption */}
      <div
        className="px-5 py-3 text-xs text-center"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "'Shadows Into Light', cursive",
          fontSize: "0.85rem",
          background:
            "color-mix(in oklch, var(--surface) 50%, transparent)",
          borderTop:
            "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
        }}
      >
        Every addition type (boil, whirlpool, dry hop) gets its own IBU
        contribution.
      </div>
    </div>
  );
}

export default function IbuPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HSLearnArticle
        title="IBU & Bitterness"
        subtitle="What it means, how it works, and what makes our approach different"
        relatedLearn={["/learn/hop-flavor", "/learn/gravity"]}
      >
        {/* ── What IBU Is ── */}
        <p className="text-base leading-relaxed">
          IBU stands for International Bitterness Units. It&apos;s how brewers
          measure hop bitterness. A light lager might sit around 10 IBU. A West
          Coast IPA pushes 60+. The number tells you how bitter the beer will
          taste, though malt sweetness and other flavors can balance it out.
        </p>

        <p className="text-sm leading-relaxed">
          In the recipe builder, IBU updates automatically every time you add,
          change, or remove a hop addition. Boil hops, whirlpool hops, first
          wort hops, dry hops. They all contribute, and the builder tracks
          every one of them.
        </p>

        <HopAdditionPreview />

        {/* ── How We Calculate It ── */}
        <h2
          id="how-we-calculate-it"
          className="text-xl font-bold mt-10 mb-4"
        >
          How We Calculate It
        </h2>

        <p className="text-sm leading-relaxed">
          We use the <strong>Tinseth model</strong>, the industry standard
          formula that virtually every brewing calculator is built on. It
          accounts for two things: how your wort&apos;s gravity affects
          extraction, and how long the hops are in contact with hot wort.
        </p>

        <HSFormulaCallout
          title="Tinseth IBU"
          expression={"IBU = \\frac{W \\times \\alpha \\times U \\times 75}{V}"}
          description="W = hop weight (oz), α = alpha acid %, U = utilization factor, V = batch volume (gal)."
        />

        <p className="text-sm leading-relaxed">
          The utilization factor is where the real physics lives. Heavier wort
          suppresses bitterness extraction, and longer boils increase it, but
          with diminishing returns past about 60 minutes.
        </p>

        <HSFormulaCallout
          title="Utilization"
          expression={"U = \\underbrace{1.65 \\times 0.000125^{\\,(G - 1)}}_{\\text{gravity}} \\times \\underbrace{\\frac{1 - e^{-0.04t}}{4.15}}_{\\text{time}}"}
        />

        {/* ── Each addition type ── */}
        <h2
          id="beyond-the-boil"
          className="text-xl font-bold mt-10 mb-4"
        >
          Beyond the Boil
        </h2>

        <p className="text-sm leading-relaxed mb-6">
          The Tinseth formula covers boil additions. But modern recipes use hops
          in a lot more places, and each one adds bitterness differently.
        </p>

        {/* Addition type cards */}
        <div className="space-y-4">
          {/* Whirlpool */}
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 60)), var(--card))`,
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3
                className="text-base font-bold"
              >
                Whirlpool &amp; Hop Stand
              </h3>
              <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
                temperature-scaled
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Isomerization doesn&apos;t stop when the flame goes off. It just
              slows down. At 80°C, you get about 29% of the extraction rate of a
              full boil. We scale the Tinseth utilization by a temperature factor
              that drops to zero below 60°C, where extraction becomes negligible.
            </p>
          </div>

          {/* Dry Hops */}
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.12 145)), var(--card))`,
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3
                className="text-base font-bold"
              >
                Dry Hops
              </h3>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  background:
                    "color-mix(in oklch, var(--coral-500) 12%, transparent)",
                  color: "var(--coral-600)",
                }}
              >
                unique to Brewing.It
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Dry hops do contribute measurable bitterness. During hop pellet
              processing, some alpha acids oxidize into compounds called{" "}
              <strong>humulinones</strong>. These dissolve into beer at
              room temperature. We model both the humulinone contribution and a
              small amount of non-isomerized alpha acid dissolution, with an
              extraction efficiency that decreases at very high dry-hop rates.
              A heavy dry hop (8 g/L, 12% AA) adds about 12 measurable IBU, enough to shift the balance in hop-forward styles.
            </p>
          </div>

          {/* First Wort */}
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 30)), var(--card))`,
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3
                className="text-base font-bold"
              >
                First Wort Hops
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              First wort hopping means adding hops during lautering, before the
              boil. They get the full boil time plus extra contact, producing
              more IBU with a smoother, rounder perceived bitterness. We model
              this by adding 20 minutes to the boil time for utilization
              calculations, so a 60-minute boil treats FWH as 80 minutes of
              contact time.
            </p>
          </div>

          {/* Mash */}
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 80)), var(--card))`,
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3
                className="text-base font-bold"
              >
                Mash Hops
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Hops added during the mash contribute very little bitterness. Most alpha acids wash out with the grain. We apply{" "}
              <strong>20% utilization</strong>, which is the standard approach.
              Community experiments suggest the real number may be closer to
              10–15%, so our figure is slightly generous.
            </p>
          </div>
        </div>

        {/* ── Worked Example ── */}
        <h2
          id="worked-example"
          className="text-xl font-bold mt-10 mb-4"
        >
          Worked Example
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Here&apos;s the math for a single hop addition: 1 oz of Cascade
          (7% alpha acid) boiled for 60 minutes in 5 gallons of 1.050 wort:
        </p>

        <div
          className="grain rounded-xl p-5 my-4"
          style={{
            background: `var(--surface)`,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div className="text-sm space-y-2" style={{ color: "var(--fg-strong)" }}>
            <p>
              Gravity factor = 1.65 × 0.000125<sup>0.050</sup> ={" "}
              <strong>1.053</strong>
            </p>
            <p>
              Time factor = (1 − e<sup>−2.4</sup>) / 4.15 ={" "}
              <strong>0.219</strong>
            </p>
            <p>
              Utilization = 1.053 × 0.219 = <strong>23.1%</strong>
            </p>
            <div
              className="mt-3 pt-3"
              style={{
                borderTop:
                  "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
              }}
            >
              <p>
                IBU = (1 × 7 × 0.231 × 75) / 5 ={" "}
                <strong className="text-base">24.2 IBU</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── The Research ── */}
        <h2
          id="the-research"
          className="text-xl font-bold mt-10 mb-4"
        >
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          The Tinseth model has been the industry standard since 1995. Our dry
          hop model is based on research showing that humulinones formed during
          pellet processing dissolve into beer without heat, contributing
          measurable bitterness.
        </p>
      </HSLearnArticle>
    </>
  );
}
