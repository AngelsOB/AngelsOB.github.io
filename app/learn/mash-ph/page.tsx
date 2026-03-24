import type { Metadata } from "next";
import LearnArticle from "@/modules/learn/LearnArticle";
import FormulaCallout from "@/modules/learn/FormulaCallout";

export const metadata: Metadata = {
  title: "Mash pH: The Proton Deficit Model",
  description:
    "How Brewing.It predicts mash pH from your grain bill and water chemistry using the proton deficit model. Understand the science behind pH adjustment.",
  keywords: [
    "mash pH calculator",
    "proton deficit model",
    "water chemistry brewing",
    "residual alkalinity",
    "mash pH prediction",
    "brewing water adjustment",
  ],
  alternates: { canonical: "/learn/mash-ph" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Mash pH: The Proton Deficit Model",
  description: "How Brewing.It predicts and adjusts mash pH using the proton deficit equilibrium model.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/mash-ph`,
  },
};

/** pH gauge mockup */
function PhGaugePreview() {
  const pH = 5.38;
  const min = 4.5;
  const max = 6.5;
  const targetLow = 5.2;
  const targetHigh = 5.6;
  const pct = ((pH - min) / (max - min)) * 100;
  const targetLowPct = ((targetLow - min) / (max - min)) * 100;
  const targetHighPct = ((targetHigh - min) / (max - min)) * 100;

  return (
    <div
      className="my-8 rounded-2xl overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
        border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, oklch(82% 0.08 220), oklch(78% 0.06 225))" }}
      >
        <span className="text-sm font-black tracking-tight" style={{ color: "oklch(25% 0.04 220)" }}>
          Predicted Mash pH
        </span>
        <span className="text-lg font-black tabular-nums" style={{ color: "oklch(25% 0.04 220)" }}>
          {pH.toFixed(2)}
        </span>
      </div>

      <div className="px-5 py-5" style={{ background: "var(--card)" }}>
        {/* pH scale bar */}
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "color-mix(in oklch, var(--fg-strong) 8%, transparent)" }}>
          {/* Target range highlight */}
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${targetLowPct}%`,
              width: `${targetHighPct - targetLowPct}%`,
              background: "color-mix(in oklch, oklch(70% 0.12 145) 25%, transparent)",
            }}
          />
          {/* Current pH indicator */}
          <div
            className="absolute top-0 h-full w-1 rounded-full"
            style={{
              left: `${pct}%`,
              background: "oklch(55% 0.15 220)",
              boxShadow: "0 0 6px oklch(55% 0.15 220 / 50%)",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1.5 tabular-nums" style={{ color: "var(--fg-muted)" }}>
          <span>4.5</span>
          <span>5.0</span>
          <span style={{ color: "oklch(50% 0.1 145)", fontWeight: 700 }}>5.2–5.6 target</span>
          <span>6.0</span>
          <span>6.5</span>
        </div>
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
        Predicted from your grain bill + water profile. Adjustments calculated automatically.
      </div>
    </div>
  );
}

export default function MashPhPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LearnArticle
        title="Mash pH"
        subtitle="Predicting and adjusting your mash from grain and water chemistry"
        relatedLearn={["/learn/mash-temperature", "/learn/gravity"]}
      >
        <p className="text-base leading-relaxed">
          Mash pH affects enzyme activity, tannin extraction, and flavor. Most
          brewers aim for 5.2–5.6. Too high and you extract harsh tannins. Too
          low and enzyme activity drops off. The recipe builder predicts your
          mash pH from your grain bill and water profile, and tells you how much
          acid or baking soda to add if it&apos;s off.
        </p>

        <PhGaugePreview />

        <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          How We Calculate It
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          We use the <strong>proton deficit model</strong>, the current gold
          standard for mash pH prediction. The idea is simple: every grain adds
          acid to the mash, and every water ion adds alkalinity. At the correct
          pH, all these contributions balance out to zero. We solve for that
          equilibrium point.
        </p>

        <FormulaCallout
          title="Proton Balance"
          expression={"f(pH) = \\text{Alk}_{water} + \\sum \\text{Deficit}_{grain_i} - \\text{Acid}_{added} = 0"}
          description="The solver finds the pH where total proton contributions sum to zero."
        />

        <div className="space-y-4 mt-6">
          <div
            className="rounded-xl p-5"
            style={{
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E") repeat, linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 220)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              Every grain has a pH fingerprint
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Base malt has a distilled-water pH of ~5.7. Roasted barley drops to
              ~4.5. Acidulated malt is ~3.4 (it contains lactic acid). Each grain
              also has a buffering capacity of ~40 mEq/kg/pH, which measures how much it resists
              pH change. We use grain data from published sources and interpolate
              by color for specialty malts.
            </p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E") repeat, linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 180)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
              Your water fights back
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Bicarbonate in your water resists the acid from grain. Calcium and
              magnesium help counteract this by reacting with malt phosphates
              (Kolbach&apos;s factors: Ca/3.5 and Mg/7). Hard water with high
              bicarbonate pushes pH up. Soft water lets the grain pull it down
              naturally.
            </p>
          </div>
        </div>

        <h2 id="accuracy" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          How Accurate Is It?
        </h2>
        <p className="text-sm leading-relaxed">
          Typically within ±0.1 pH for standard grain bills. Good enough to
          calculate water adjustments before brew day, but still worth
          measuring with a pH meter to calibrate for your specific system. The
          model works best when your water report is accurate and your grain
          is fresh.
        </p>

        <h2 id="where-this-comes-from" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed">
          The proton deficit model was published by AJ deLange in the MBAA
          Technical Quarterly (2013, 2015). The grain pH data comes from
          Bru&apos;n Water and Braukaiser. Kolbach&apos;s calcium and magnesium
          factors date to mid-20th century German brewing research. This is the
          same framework used by the most respected water chemistry tools in
          homebrewing.
        </p>

        <h2 id="sources" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Sources
        </h2>
        <ul className="text-sm space-y-1.5 list-disc pl-5" style={{ color: "var(--fg-muted)" }}>
          <li>deLange, A.J. &ldquo;Understanding and Adjusting Mash pH.&rdquo; <em>MBAA TQ</em>, 2013 &amp; 2015.</li>
          <li>Troester, K. &ldquo;Mash pH and Alkalinity.&rdquo; braukaiser.com.</li>
        </ul>
      </LearnArticle>
    </>
  );
}
