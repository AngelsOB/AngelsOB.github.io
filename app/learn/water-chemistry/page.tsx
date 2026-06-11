import type { Metadata } from "next";
import { learnBreadcrumb } from "@/modules/learn/breadcrumbs";
import HSLearnArticle from "@/modules/builder/components/HSLearnArticle";
import { WaterChemMockup } from "@/modules/builder/components/HSBuilderMockups";

export const metadata: Metadata = {
  title: "Water Chemistry & the Auto-Calculator",
  description:
    "How Brewing.It handles water chemistry: source profiles, style-based targets, the auto-calculator that solves for optimal salt additions, and what ions actually do to your beer.",
  keywords: [
    "brewing water chemistry",
    "water salt calculator",
    "chloride sulfate ratio",
    "brewing salt additions",
    "water profile brewing",
    "auto calculate water",
  ],
  alternates: { canonical: "/learn/water-chemistry" },
  openGraph: {
    title: "Water Chemistry & the Auto-Calculator | Brewing.It Learn",
    description:
      "How Brewing.It handles water chemistry: source profiles, style-based targets, the auto-calculator that solves for optimal salt additions, and what ions actually do to your beer.",
  },
  twitter: {
    card: "summary",
    title: "Water Chemistry & the Auto-Calculator | Brewing.It Learn",
    description:
      "How Brewing.It handles water chemistry: source profiles, style-based targets, the auto-calculator that solves for optimal salt additions, and what ions actually do to your beer.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Water Chemistry & the Auto-Calculator",
  description:
    "How Brewing.It handles water chemistry: source profiles, targets, and the optimizer that finds the best salt additions.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/water-chemistry`,
  },
};

export default function WaterChemistryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, learnBreadcrumb("water-chemistry")]) }}
      />
      <HSLearnArticle
        title="Water Chemistry"
        subtitle="Why your water matters, and how we handle it for you"
        relatedLearn={["/learn/mash-ph", "/learn/getting-started"]}
      >
        {/* ── What it is ── */}
        <p className="text-base leading-relaxed">
          Water makes up 90%+ of your beer. The ions in it (calcium,
          magnesium, chloride, sulfate, sodium, bicarbonate) affect
          everything from hop bitterness perception to mash pH to mouthfeel.
          The water chemistry section lets you define your source water, set a
          target profile, and calculate the salt additions to get there.
        </p>

        <WaterChemMockup />

        {/* ── How it works ── */}
        <h2
          id="how-it-works"
          className="text-xl font-bold mt-10 mb-4"
        >
          How It Works
        </h2>

        <p className="text-sm leading-relaxed mb-4">
          You start with a <strong>source water profile</strong>: your tap
          water or RO/distilled. Then you set a <strong>target</strong>,
          either from our BJCP style presets (which automatically match your
          recipe&apos;s style) or as a custom profile. The builder shows you
          where your current water sits relative to the target for each ion,
          with visual bars you can read at a glance.
        </p>

        {/* ── The auto-calculator ── */}
        <h2
          id="auto-calculator"
          className="text-xl font-bold mt-10 mb-4"
        >
          The Auto-Calculator
        </h2>

        <p className="text-sm leading-relaxed mb-4">
          Hit <strong>Auto-Calculate</strong> and we solve for the optimal
          combination of brewing salts to match your target. This isn&apos;t
          trial-and-error. It&apos;s a mathematical optimizer that finds the
          best answer in one pass.
        </p>

        <div className="space-y-4">
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 200)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-base font-bold">
                Bounded least squares
              </h3>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  background: "color-mix(in oklch, var(--coral-500) 12%, transparent)",
                  color: "var(--coral-600)",
                }}
              >
                unique to Brewing.It
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Each brewing salt contributes specific ions at known rates. Gypsum
              adds calcium and sulfate, calcium chloride adds calcium and
              chloride, and so on. The problem is finding the combination that
              gets all six ions as close to the target as possible, without going
              negative (you can&apos;t remove salt). We solve this as a weighted
              least-squares optimization with bounds. Chloride and sulfate are
              weighted more heavily because the Cl:SO₄ ratio has the biggest
              impact on flavor.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 145)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2">
              Smart rounding
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Nobody measures 9.47g of gypsum. After solving, we round to 0.1g
              increments, but we don&apos;t just round each salt independently.
              We test all possible floor/ceil combinations and pick the one that
              minimizes total ion error. This matters because rounding one salt
              up might offset rounding another down.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 60)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2">
              Mash &amp; sparge splits
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              The builder splits your total salt additions proportionally
              between mash and sparge water based on their volumes. This gives
              you the exact grams to add to each pot.
            </p>
          </div>
        </div>

        {/* ── What the ions do ── */}
        <h2
          id="what-ions-do"
          className="text-xl font-bold mt-10 mb-4"
        >
          What the Ions Actually Do
        </h2>

        <div
          className="grain rounded-xl p-5 my-6"
          style={{
            background: `var(--surface)`,
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div className="text-sm space-y-2.5" style={{ color: "var(--fg-muted)" }}>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Calcium (Ca)</strong>
              {" "}: promotes enzyme activity, yeast health, and beer clarity.
              50–150 ppm is typical.
            </p>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Magnesium (Mg)</strong>
              {" "}: yeast nutrient in small amounts. Too much tastes sour/astringent.
              10–30 ppm.
            </p>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Sodium (Na)</strong>
              {" "}: rounds out flavor at low levels, harsh and salty above ~75 ppm.
            </p>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Chloride (Cl)</strong>
              {" "}: enhances malt sweetness, body, and fullness. Key half of the
              Cl:SO₄ ratio.
            </p>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Sulfate (SO₄)</strong>
              {" "}: accentuates hop bitterness. Dry, crisp, assertive. The other
              half of the Cl:SO₄ ratio.
            </p>
            <p>
              <strong style={{ color: "var(--fg-strong)" }}>Bicarbonate (HCO₃)</strong>
              {" "}: resists pH change (alkalinity). High bicarb pushes mash pH up,
              which is a problem for pale beers.
            </p>
          </div>
        </div>

        {/* ── The Cl:SO4 ratio ── */}
        <h2
          id="chloride-sulfate-ratio"
          className="text-xl font-bold mt-10 mb-4"
        >
          The Cl:SO₄ Ratio
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          This is the single most impactful water chemistry metric for beer
          flavor. It controls the balance between malt fullness and hop
          crispness:
        </p>

        <div
          className="rounded-xl overflow-hidden my-6"
          style={{
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <table className="w-full text-sm" style={{ background: "var(--card)" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid color-mix(in oklch, var(--fg-strong) 10%, transparent)" }}>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Cl:SO₄</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Character</th>
              </tr>
            </thead>
            <tbody>
              {[
                { ratio: "< 0.5", char: "Very hoppy: dry, crisp bitterness" },
                { ratio: "0.5–0.8", char: "Hop-forward, balanced toward bitterness" },
                { ratio: "0.8–1.2", char: "Balanced" },
                { ratio: "1.2–2.0", char: "Malt-forward, softer, rounder" },
                { ratio: "> 2.0", char: "Very malty: full, sweet character" },
              ].map((row, i, arr) => (
                <tr
                  key={row.ratio}
                  style={{
                    borderBottom: i < arr.length - 1
                      ? "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)"
                      : "none",
                  }}
                >
                  <td className="px-4 py-2 font-semibold tabular-nums" style={{ color: "var(--fg-strong)" }}>{row.ratio}</td>
                  <td className="px-4 py-2" style={{ color: "var(--fg-muted)" }}>{row.char}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm leading-relaxed">
          When you select a BJCP style target, we set the Cl:SO₄ ratio
          automatically. A West Coast IPA gets a sulfate-heavy profile
          (~0.4:1). A Scottish ale gets chloride-heavy (~2:1). You can always
          override this with a custom target.
        </p>

        {/* ── How salts contribute ── */}
        <h2
          id="the-five-salts"
          className="text-xl font-bold mt-10 mb-4"
        >
          The Five Brewing Salts
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Each salt adds specific ions at known rates per gram per liter.
          The optimizer works with these exact stoichiometric values:
        </p>

        <div
          className="rounded-xl overflow-hidden my-6"
          style={{
            border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <table className="w-full text-sm" style={{ background: "var(--card)" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid color-mix(in oklch, var(--fg-strong) 10%, transparent)" }}>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Salt</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Adds</th>
              </tr>
            </thead>
            <tbody>
              {[
                { salt: "Gypsum (CaSO₄)", adds: "Ca + SO₄" },
                { salt: "Calcium Chloride (CaCl₂)", adds: "Ca + Cl" },
                { salt: "Epsom Salt (MgSO₄)", adds: "Mg + SO₄" },
                { salt: "Table Salt (NaCl)", adds: "Na + Cl" },
                { salt: "Baking Soda (NaHCO₃)", adds: "Na + HCO₃ (optional)" },
              ].map((row, i, arr) => (
                <tr
                  key={row.salt}
                  style={{
                    borderBottom: i < arr.length - 1
                      ? "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)"
                      : "none",
                  }}
                >
                  <td className="px-4 py-2 font-semibold" style={{ color: "var(--fg-strong)" }}>{row.salt}</td>
                  <td className="px-4 py-2" style={{ color: "var(--fg-muted)" }}>{row.adds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm leading-relaxed">
          Baking soda is optional in the auto-calculator because bicarbonate
          is usually handled separately via acid additions for pH adjustment.
          Toggle the NaHCO₃ checkbox if you want it included.
        </p>

        {/* ── Connection to mash pH ── */}
        <h2
          id="connection-to-ph"
          className="text-xl font-bold mt-10 mb-4"
        >
          Connection to Mash pH
        </h2>
        <p className="text-sm leading-relaxed">
          Your water profile feeds directly into the{" "}
          <a
            href="/learn/mash-ph"
            className="text-[var(--coral-500)] hover:underline font-medium"
          >
            mash pH prediction
          </a>
          . Calcium and magnesium consume alkalinity (via Kolbach&apos;s factors),
          while bicarbonate adds it. When you change your salt additions,
          the predicted mash pH updates automatically. If it&apos;s
          outside the 5.2–5.6 range, the builder recommends acid or baking
          soda adjustments.
        </p>
      </HSLearnArticle>
    </>
  );
}
