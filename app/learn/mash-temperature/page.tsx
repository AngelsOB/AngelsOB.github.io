import type { Metadata } from "next";
import LearnArticle from "@/modules/learn/LearnArticle";

export const metadata: Metadata = {
  title: "Mash Temperature & Enzyme Kinetics",
  description:
    "How mash temperature controls fermentability through enzyme kinetics. Brewing.It offers three models (linear, enzyme kinetics, and ODE) for predicting final gravity.",
  keywords: [
    "mash temperature",
    "enzyme kinetics brewing",
    "alpha amylase beta amylase",
    "fermentability",
    "step mash",
    "final gravity prediction",
  ],
  alternates: { canonical: "/learn/mash-temperature" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Mash Temperature & Enzyme Kinetics",
  description: "How mash temperature controls fermentability and why Brewing.It offers three models for predicting the effect.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/mash-temperature`,
  },
};

/** Temperature comparison table showing model divergence */
function ModelComparisonPreview() {
  const data = [
    { temp: "60°C", linear: "82%", enzyme: "80%", ode: "76%" },
    { temp: "65°C", linear: "77%", enzyme: "77%", ode: "77%" },
    { temp: "67°C", linear: "75%", enzyme: "75%", ode: "75%" },
    { temp: "70°C", linear: "72%", enzyme: "69%", ode: "69%" },
    { temp: "75°C", linear: "67%", enzyme: "42%", ode: "36%" },
    { temp: "80°C", linear: "62%", enzyme: "13%", ode: "3%" },
  ];

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
        style={{ background: "linear-gradient(135deg, oklch(82% 0.1 30), oklch(78% 0.08 35))" }}
      >
        <span className="text-sm font-black tracking-tight" style={{ color: "oklch(25% 0.05 30)" }}>
          Apparent Attenuation by Model (base 75%, 60 min)
        </span>
      </div>

      <div style={{ background: "var(--card)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "2px solid color-mix(in oklch, var(--fg-strong) 10%, transparent)" }}>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Temp</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Linear</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Enzyme</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>ODE</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.temp} style={{ borderBottom: i < data.length - 1 ? "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)" : "none" }}>
                <td className="px-4 py-2 font-semibold tabular-nums" style={{ color: "var(--fg-strong)" }}>{row.temp}</td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--fg-muted)" }}>{row.linear}</td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--fg-muted)" }}>{row.enzyme}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: "var(--fg-strong)" }}>{row.ode}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
        The models agree in the normal range (64–70°C) but diverge dramatically at extremes.
      </div>
    </div>
  );
}

export default function MashTemperaturePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LearnArticle
        title="Mash Temperature"
        subtitle="The biggest lever on your beer's body and finish"
        relatedLearn={["/learn/gravity", "/learn/mash-ph"]}
      >
        <p className="text-base leading-relaxed">
          Mash temperature is how you control whether your beer finishes dry or
          full-bodied. Lower temps (around 63–65°C) produce more fermentable
          sugars: lighter body, lower FG, drier finish. Higher temps (68–72°C)
          produce more unfermentable dextrins: fuller body, higher FG, sweeter
          finish.
        </p>
        <p className="text-sm leading-relaxed">
          In the recipe builder, changing the mash temperature updates your
          predicted FG and ABV in real time. We offer three models for this, and you can pick
          the one that matches how much precision you want.
        </p>

        <ModelComparisonPreview />

        <h2 id="the-two-enzymes" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          The Two Enzymes
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          It all comes down to two enzymes in the mash:{" "}
          <strong>beta-amylase</strong> (peaks at ~63°C, produces fermentable
          maltose) and <strong>alpha-amylase</strong> (peaks at ~70°C, produces
          non-fermentable dextrins). The ratio of their activity determines your
          wort&apos;s sugar composition.
        </p>

        <h2 id="three-models" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Three Models
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
              Linear <span className="text-xs font-normal ml-1" style={{ color: "var(--fg-muted)" }}>default</span>
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              The simplest model. About 1% attenuation change per °C from a 67°C
              reference. Works well in the normal brewing range (64–70°C) and
              matches what most calculators do. Falls apart at extremes. It
              still predicts 62% attenuation at 80°C, which isn&apos;t physically
              realistic since both enzymes are dead by then.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.08 30)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-base font-bold" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
                Enzyme Kinetics
              </h3>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ background: "color-mix(in oklch, var(--coral-500) 12%, transparent)", color: "var(--coral-600)" }}
              >
                unique to Brewing.It
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Models both enzymes with temperature-dependent activity (Gaussian
              curves) and thermal denaturation (Arrhenius kinetics). Beta-amylase
              has a half-life of ~14 minutes at 72°C and dies fast. Alpha-amylase
              is essentially immortal at mash temps (half-life measured in days at 67°C).
              13% of beta-amylase is a thermostable isoform that never denatures.
              This model naturally drops to near-zero fermentability at 80°C+.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.1 10)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-base font-bold" style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}>
                ODE Kinetics
              </h3>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ background: "color-mix(in oklch, var(--coral-500) 12%, transparent)", color: "var(--coral-600)" }}
              >
                unique to Brewing.It
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              The full simulation. Tracks three sugar species (starch → dextrins
              → maltose) through coupled differential equations. Captures
              substrate depletion, the alpha-to-beta conversion pipeline, and
              accumulated denaturation across step mash schedules. If beta
              loses 50% activity during a 67°C rest, the 72°C mashout starts
              with only 50%.
            </p>
          </div>
        </div>

        <h2 id="where-this-comes-from" className="text-xl font-bold mt-10 mb-4" style={{ fontFamily: "'Bitter', serif" }}>
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed">
          The enzyme kinetics parameters are based on published brewing science
          research into amylase activity, thermal denaturation rates, and
          thermostable enzyme fractions. The Braukaiser mash temperature studies
          at braukaiser.com were also a key reference.
        </p>
      </LearnArticle>
    </>
  );
}
