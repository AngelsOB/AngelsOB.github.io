import type { Metadata } from "next";
import LearnArticle from "@/modules/learn/LearnArticle";
import FormulaCallout from "@/modules/learn/FormulaCallout";

export const metadata: Metadata = {
  title: "Yeast Starters: Cell Counts & Growth Models",
  description:
    "How Brewing.It calculates yeast pitching rates, viability decay, and starter sizes using the White and Braukaiser growth models.",
  keywords: [
    "yeast starter calculator",
    "yeast pitching rate",
    "yeast cell count",
    "yeast viability",
    "white model yeast",
    "braukaiser yeast model",
  ],
  alternates: { canonical: "/learn/yeast-starters" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Yeast Starters: Cell Counts & Growth Models",
  description: "How Brewing.It calculates yeast pitching rates, viability, and multi-step starter plans.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/yeast-starters`,
  },
};

export default function YeastStartersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LearnArticle
        title="Yeast Starters"
        subtitle="Hitting the right pitch rate, and the science of growing yeast"
        relatedLearn={["/learn/gravity", "/learn/mash-temperature"]}
      >
        <p className="text-base leading-relaxed">
          Pitching rate (how many yeast cells you add to your wort) affects
          flavor, fermentation speed, and attenuation. Underpitch and you get
          more esters and fusel alcohols (sometimes that&apos;s what you want
          in a Belgian, usually not in a lager). Overpitch and you lose yeast
          character. The starter calculator helps you hit the right number.
        </p>
        <p className="text-sm leading-relaxed">
          In the recipe builder, the yeast section shows whether you need a
          starter based on your OG, batch size, and yeast package date. If you
          do, it calculates the starter volume and DME needed, with support
          for multi-step starters when a single step isn&apos;t enough.
        </p>

        <h2 id="pitching-rate" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Pitching Rate
        </h2>

        <FormulaCallout
          title="Required Cells"
          expression={"\\text{cells (B)} = \\text{rate} \\times V_L \\times \\degree P"}
          description="Rate = 0.75 M cells/mL/°P for ales, 1.0–1.5 for lagers. V = batch volume in liters. °P = degrees Plato from OG."
        />

        <h2 id="viability" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Viability
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Yeast cells die during storage at about 0.7% per day. A 3-month-old
          liquid pack might be at ~40% viability. That&apos;s why starters
          exist. We calculate available cells from your package type, count, and
          manufacture date.
        </p>

        <h2 id="growth-models" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Two Growth Models
        </h2>

        <div className="space-y-4">
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 80)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              White Model <span className="text-xs font-normal ml-1" style={{ color: "var(--fg-muted)" }}>polynomial growth</span>
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Based on White Labs yeast growth data. Growth depends on
              inoculation rate. At lower cell densities, each cell has more
              nutrients and reproduces more. Aeration adds +0.5 to the growth
              factor. This is the more sophisticated model and what most starter
              calculators use.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 145)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              Braukaiser Model <span className="text-xs font-normal ml-1" style={{ color: "var(--fg-muted)" }}>linear growth</span>
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Simpler: each gram of DME produces about 1.4 billion new cells,
              regardless of starting density. Based on Kai Troester&apos;s
              cell-counting experiments. Works well for typical 1–2L starters
              and is easier to reason about.
            </p>
          </div>
        </div>

        <h2 id="where-this-comes-from" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed">
          The White model polynomial comes directly from <em>Yeast: The
          Practical Guide to Beer Fermentation</em> (2010). The Braukaiser
          model comes from Kai Troester&apos;s documented cell-counting
          experiments. Viability decay rates are from White Labs packaging data.
          Package cell counts come from manufacturer spec sheets.
        </p>

        <h2 id="sources" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Sources
        </h2>
        <ul className="text-sm space-y-1.5 list-disc pl-5" style={{ color: "var(--fg-muted)" }}>
          <li>White, C. &amp; Zainasheff, J. <em>Yeast</em>. Brewers Publications, 2010.</li>
          <li>Troester, K. &ldquo;Yeast Starter.&rdquo; braukaiser.com.</li>
        </ul>
      </LearnArticle>
    </>
  );
}
