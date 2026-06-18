import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

/**
 * IBU calculator article body — a tool-focused condensation. The full
 * derivation and the science of each addition type lives in the concept
 * article at /learn/ibu; this page cross-links to it rather than duplicating
 * it.
 */
export default function IbuContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        IBU stands for International Bitterness Units — how brewers measure hop
        bitterness. A light lager sits near 10 IBU; a West Coast IPA pushes
        60+. The calculator above sums every hop addition: boil, whirlpool,
        first wort, mash, and dry hop all contribute, and each is modeled
        differently.
      </p>

      {/* How we calculate it */}
      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>

      <p className="text-sm leading-relaxed">
        Boil additions use the <strong>Tinseth model</strong>, the industry
        standard. It accounts for two things: how wort gravity suppresses
        extraction, and how boil time increases it with diminishing returns.
      </p>

      <HSFormulaCallout
        title="Tinseth IBU"
        expression={"IBU = \\frac{W \\times \\alpha \\times U \\times 75}{V}"}
        description="W = hop weight (oz), α = alpha acid %, U = utilization factor, V = batch volume (gal)."
      />

      <HSFormulaCallout
        title="Utilization"
        expression={
          "U = \\underbrace{1.65 \\times 0.000125^{\\,(G - 1)}}_{\\text{gravity}} \\times \\underbrace{\\frac{1 - e^{-0.04t}}{4.15}}_{\\text{time}}"
        }
      />

      {/* Addition types — condensed */}
      <h2 id="beyond-the-boil" className="text-xl font-bold mt-10 mb-4">
        Beyond the Boil
      </h2>
      <p className="text-sm leading-relaxed mb-4">
        Modern recipes use hops in more places than the boil, and the calculator
        handles each:
      </p>
      <ul
        className="text-sm space-y-2 list-disc pl-5"
        style={{ color: "var(--fg-muted)" }}
      >
        <li>
          <strong>Whirlpool &amp; hop stand</strong> — isomerization slows but
          continues below boiling. Utilization is scaled by temperature (about
          29% of the boil rate at 80°C, dropping to zero below ~60°C).
        </li>
        <li>
          <strong>Dry hops</strong> — humulinones formed during pellet
          processing dissolve without heat and add measurable bitterness. A
          heavy dry hop adds roughly 12 IBU.
        </li>
        <li>
          <strong>First wort hops</strong> — added during lautering, they get
          the full boil plus extra contact; we treat them as the boil time plus
          20 minutes.
        </li>
        <li>
          <strong>Mash hops</strong> — most alpha acids wash out with the grain,
          so we apply a standard 20% utilization.
        </li>
      </ul>

      {/* Worked example */}
      <h2 id="worked-example" className="text-xl font-bold mt-10 mb-4">
        Worked Example
      </h2>
      <p className="text-sm leading-relaxed mb-4">
        One ounce of Cascade (7% alpha acid) boiled 60 minutes in 5 gallons of
        1.050 wort:
      </p>
      <div
        className="grain rounded-xl p-5 my-4"
        style={{
          background: `var(--surface)`,
          border:
            "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
        }}
      >
        <div
          className="text-sm space-y-2"
          style={{ color: "var(--fg-strong)" }}
        >
          <p>
            Gravity factor = 1.65 × 0.000125<sup>0.050</sup> ={" "}
            <strong>1.053</strong>
          </p>
          <p>
            Time factor = (1 − e<sup>−2.4</sup>) / 4.15 = <strong>0.219</strong>
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

      {/* Where this comes from */}
      <h2 id="where-this-comes-from" className="text-xl font-bold mt-10 mb-4">
        Where This Comes From
      </h2>
      <p className="text-sm leading-relaxed">
        The Tinseth model has been the industry standard since 1995, and our
        dry-hop model follows research on humulinones dissolving without heat.
        For the full derivation — including whirlpool temperature scaling and
        the dry-hop humulinone model — see{" "}
        <a
          href="/learn/ibu"
          className="text-[var(--coral-500)] hover:underline font-medium"
        >
          Understanding IBU &amp; Bitterness
        </a>
        .
      </p>
    </>
  );
}
