import type { Metadata } from "next";
import HSLearnArticle from "@/modules/hopskip/components/HSLearnArticle";
import HSFormulaCallout from "@/modules/hopskip/components/HSFormulaCallout";

export const metadata: Metadata = {
  title: "Gravity & ABV: How Your Beer's Strength Is Built",
  description:
    "How Brewing.It calculates original gravity, final gravity, and ABV from your grain bill, mash efficiency, and yeast attenuation.",
  keywords: [
    "original gravity calculator",
    "final gravity",
    "ABV homebrew",
    "PPG gravity model",
    "mash efficiency",
    "attenuation",
  ],
  alternates: { canonical: "/learn/gravity" },
  openGraph: {
    title: "Gravity & ABV: How Your Beer's Strength Is Built | Brewing.It Learn",
    description:
      "How Brewing.It calculates original gravity, final gravity, and ABV from your grain bill, mash efficiency, and yeast attenuation.",
  },
  twitter: {
    card: "summary",
    title: "Gravity & ABV: How Your Beer's Strength Is Built | Brewing.It Learn",
    description:
      "How Brewing.It calculates original gravity, final gravity, and ABV from your grain bill, mash efficiency, and yeast attenuation.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Gravity & ABV: How Your Beer's Strength Is Built",
  description:
    "How Brewing.It builds OG from your grain bill, predicts FG from yeast attenuation, and calculates ABV.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/gravity`,
  },
};

/** Stat strip showing the OG → FG → ABV pipeline */
function GravityPipelinePreview() {
  return (
    <div
      className="my-8 rounded-2xl overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
        border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
      }}
    >
      <div
        className="px-5 py-3 grain"
        style={{
          background: "linear-gradient(135deg, oklch(82% 0.1 55), oklch(78% 0.08 60))",
        }}
      >
        <span className="text-sm font-black tracking-tight" style={{ color: "oklch(25% 0.05 55)" }}>
          Recipe Stats
        </span>
      </div>

      <div className="px-5 py-4 flex items-center justify-center gap-3" style={{ background: "var(--card)" }}>
        {[
          { label: "OG", value: "1.062", sub: "from grain bill" },
          { label: "FG", value: "1.014", sub: "from yeast" },
          { label: "ABV", value: "6.3%", sub: "(OG − FG) × 131.25" },
        ].map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-3">
            {i > 0 && (
              <span className="text-lg" style={{ color: "var(--fg-muted)" }}>→</span>
            )}
            <div
              className="text-center px-4 py-2.5 rounded-xl min-w-[5.5rem]"
              style={{
                background: "color-mix(in oklch, var(--surface) 60%, transparent)",
                border: "1px solid color-mix(in oklch, var(--fg-strong) 6%, transparent)",
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--fg-muted)" }}>
                {stat.label}
              </div>
              <div className="text-xl font-black tabular-nums" style={{ color: "var(--fg-strong)" }}>
                {stat.value}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                {stat.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="px-5 py-2.5 text-center text-xs"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "'Shadows Into Light', cursive",
          fontSize: "0.85rem",
          background: "color-mix(in oklch, var(--surface) 50%, transparent)",
          borderTop: "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
        }}
      >
        Grain builds the sugar. Yeast eats it. What&apos;s left determines your beer.
      </div>
    </div>
  );
}

export default function GravityPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HSLearnArticle
        title="Gravity & ABV"
        subtitle="How your grain bill becomes alcohol"
        relatedLearn={["/learn/mash-temperature", "/learn/abv-calculator"]}
      >
        <p className="text-base leading-relaxed">
          Gravity is the density of your wort. It tells you how much sugar is
          dissolved in it. Original gravity (OG) is measured before
          fermentation. Final gravity (FG) is what&apos;s left after yeast has
          eaten the fermentable sugars. The difference between them determines
          your ABV.
        </p>

        <p className="text-sm leading-relaxed">
          In the recipe builder, OG, FG, and ABV all update automatically as
          you adjust your grain bill, batch size, efficiency, or yeast
          selection. The whole pipeline is connected. Change one thing and
          everything recalculates.
        </p>

        <GravityPipelinePreview />

        <h2 id="original-gravity" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Original Gravity
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Every fermentable in your recipe has a <strong>PPG</strong> value: points per pound per gallon. It&apos;s a measure of how much sugar
          that ingredient contributes. 2-Row malt has a PPG of ~37, meaning 1
          pound in 1 gallon gives a gravity of 1.037.
        </p>

        <HSFormulaCallout
          title="Original Gravity"
          expression={"OG = 1 + \\frac{\\sum (PPG_i \\times W_i \\times \\eta_i)}{V \\times 1000}"}
          description="PPG = extract potential, W = weight (lbs), η = efficiency (100% for sugars/extracts, mash efficiency for grains), V = batch volume (gal)."
        />

        <p className="text-sm leading-relaxed">
          Sugars (corn sugar, honey, candi sugar) and extracts (DME, LME) use
          100% efficiency. They dissolve completely and bypass the mash. Only
          grains that go through the mash get your mash efficiency applied. This
          is the industry standard approach.
        </p>

        <h2 id="final-gravity" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Final Gravity
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          FG depends on two things: which sugars are fermentable, and how
          thoroughly your yeast ferments them. Not all grain extract is
          fermentable. Crystal malts produce less fermentable sugar than base
          malt, and lactose isn&apos;t fermentable at all.
        </p>

        <div className="space-y-4">
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 60)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              Per-ingredient fermentability
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Each ingredient has a fermentability value from 0 to 1. Base malt
              is 1.0 (fully fermentable by the yeast&apos;s stated attenuation).
              Crystal malts range from 0.90 (light) down to 0.75 (dark), based
              on Briess maltster data. Lactose is 0. The gravity from each
              ingredient is split into fermentable and non-fermentable fractions.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 30)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              Mash temperature effect
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Mash temperature is the biggest lever on final gravity. Lower
              temps favor beta-amylase (more fermentable sugars, lower FG).
              Higher temps favor alpha-amylase (more dextrins, higher FG,
              fuller body). We offer three models for this. See the{" "}
              <a href="/learn/mash-temperature" className="text-[var(--coral-500)] hover:underline font-medium">
                mash temperature
              </a>{" "}
              page for the full story.
            </p>
          </div>
        </div>

        <h2 id="abv" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          ABV
        </h2>

        <HSFormulaCallout
          title="ABV Formula"
          expression={"ABV = (OG - FG) \\times 131.25"}
          description="The industry standard approximation. Accurate to within 0.1% for beers under 1.080 OG."
        />

        <p className="text-sm leading-relaxed">
          The 131.25 constant comes from the well-established relationship
          between gravity drop and ethanol production. For the full breakdown,
          see the{" "}
          <a href="/learn/abv-calculator" className="text-[var(--coral-500)] hover:underline font-medium">
            ABV calculator
          </a>{" "}
          page.
        </p>

      </HSLearnArticle>
    </>
  );
}
