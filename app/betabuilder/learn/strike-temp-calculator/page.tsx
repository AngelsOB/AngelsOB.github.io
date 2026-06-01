import type { Metadata } from "next";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/learn/* is the quarantined reference; intentional import
import OLD_StrikeTempCalculator from "@/components/OLD_StrikeTempCalculator";
import LearnArticle from "@/modules/learn/LearnArticle";
import FormulaCallout from "@/modules/learn/FormulaCallout";

export const metadata: Metadata = {
  title: "Strike Water Temperature Calculator",
  description:
    "Calculate the exact strike water temperature for your mash. Enter your target mash temp, grain temperature, and mash thickness — get the number instantly.",
  keywords: [
    "strike water temperature calculator",
    "strike temp homebrewing",
    "mash infusion temperature",
    "how to calculate strike water",
    "homebrew mash calculator",
    "Palmer strike temperature",
  ],
  alternates: { canonical: "/learn/strike-temp-calculator" },
  openGraph: {
    title: "Strike Water Temperature Calculator | Brewing.It Learn",
    description:
      "Calculate the exact strike water temperature for your mash. Enter your target mash temp, grain temperature, and mash thickness — get the number instantly.",
  },
  twitter: {
    card: "summary",
    title: "Strike Water Temperature Calculator | Brewing.It Learn",
    description:
      "Calculate the exact strike water temperature for your mash. Enter your target mash temp, grain temperature, and mash thickness — get the number instantly.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Strike Water Temperature Calculator",
  description:
    "Free strike water temperature calculator for homebrewers. Uses Palmer's heat balance equation to find the correct infusion temperature.",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/strike-temp-calculator`,
};

export default function StrikeTempCalcPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LearnArticle
        title="Strike Water Temperature Calculator"
        subtitle="Hit your mash temp on the first pour"
        relatedLearn={[
          "/learn/mash-temperature",
          "/learn/mash-ph",
          "/learn/abv-calculator",
        ]}
        ctaText="Build a full recipe"
      >
        <p className="text-base leading-relaxed">
          Strike water temperature is the temperature your infusion water needs
          to be before you add it to the grain. The cold grain absorbs heat from
          the water, dropping it to your target mash temperature. Get this wrong
          and you&apos;re mashing too hot or too cold — alpha and beta amylase
          work at different temperatures, so it matters.
        </p>

        <p className="text-sm leading-relaxed">
          The calculation is simple: more grain relative to water means you need
          hotter strike water. Colder grain means you need hotter water. This
          calculator uses Palmer&apos;s heat balance equation — the same one
          BeerSmith and Brewfather use.
        </p>

        <div className="my-6">
          <OLD_StrikeTempCalculator />
        </div>

        <p className="text-sm leading-relaxed">
          If you&apos;re doing a step mash with decoctions or infusion steps,
          the first rest uses this equation. Subsequent rests use a different
          calculation (adding boiling water to raise temperature), which the
          recipe builder handles automatically.
        </p>

        <h2
          id="how-we-calculate-it"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          How We Calculate It
        </h2>

        <FormulaCallout
          title="Palmer Heat Balance Equation"
          expression={
            "T_{strike} = T_{mash} + \\frac{0.41}{r} \\times (T_{mash} - T_{grain})"
          }
          description="Where r is mash thickness in L/kg and 0.41 is the grain/water heat capacity ratio."
        />

        <p className="text-sm leading-relaxed mb-4">
          The 0.41 constant is the ratio of grain&apos;s specific heat capacity
          to water&apos;s (approximately 1.71 kJ/kg·K ÷ 4.18 kJ/kg·K). It
          tells you how much less heat grain holds compared to water at the same
          temperature — which is why you need strike water hotter than your
          target: the grain steals heat.
        </p>

        {/* Worked example */}
        <div
          className="grain rounded-xl p-5 my-6"
          style={{
            background: `var(--surface)`,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <div className="text-sm" style={{ color: "var(--fg-strong)" }}>
            <p>
              Target mash temp <strong>67°C</strong>, grain at{" "}
              <strong>20°C</strong>, thickness <strong>3.0 L/kg</strong>:
            </p>
            <p className="mt-2 font-mono">
              67 + (0.41 ÷ 3.0) × (67 − 20) = 67 + 0.137 × 47 ={" "}
              <strong>73.4°C</strong>
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
              You need strike water at 73.4°C (164.1°F) to land at your 67°C
              target mash temperature.
            </p>
          </div>
        </div>

        <h2
          id="mash-thickness"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          Mash Thickness
        </h2>

        <p className="text-sm leading-relaxed mb-4">
          Mash thickness (also called the water-to-grain ratio) is how many
          liters of water you use per kilogram of grain. A typical single
          infusion mash runs 2.5–4.0 L/kg. Thinner mashes (more water) are
          more temperature-stable and easier to control. Thicker mashes (less
          water) can improve efficiency but require more precise strike
          temperatures.
        </p>

        <div
          className="grain rounded-xl p-5 my-6"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 60)), var(--card))`,
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          <h3
            className="text-base font-bold mb-3"
            style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
          >
            Typical Mash Thicknesses
          </h3>
          <div
            className="text-sm space-y-1.5"
            style={{ color: "var(--fg-muted)" }}
          >
            <p>
              <strong>2.0–2.5 L/kg</strong> — Thick mash, traditional British
              ale style
            </p>
            <p>
              <strong>2.5–3.5 L/kg</strong> — Standard single infusion, most
              styles
            </p>
            <p>
              <strong>3.5–4.5 L/kg</strong> — Thin mash, BIAB (brew-in-a-bag)
            </p>
          </div>
        </div>

        <h2
          id="grain-temperature"
          className="text-xl font-bold mt-10 mb-4"
          style={{ fontFamily: "'Bitter', serif" }}
        >
          Grain Temperature
        </h2>

        <p className="text-sm leading-relaxed">
          If your grain is stored in a cold garage (5–10°C) versus a warm
          kitchen (22°C), your strike temperature changes by several degrees.
          It&apos;s worth measuring actual grain temp rather than guessing room
          temperature — especially in winter. The recipe builder defaults to
          20°C (68°F), which is fine for grain stored indoors.
        </p>
      </LearnArticle>
    </>
  );
}
