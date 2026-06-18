import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

export default function StrikeTempContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        Strike water temperature is the temperature your infusion water needs to
        be before you add it to the grain. The cold grain absorbs heat from the
        water, dropping it to your target mash temperature. Get this wrong and
        you&apos;re mashing too hot or too cold — alpha and beta amylase work at
        different temperatures, so it matters.
      </p>

      <p className="text-sm leading-relaxed">
        The calculation is simple: more grain relative to water means you need
        hotter strike water, and colder grain means you need hotter water. The
        calculator above uses Palmer&apos;s heat balance equation, the standard
        across brewing software. For a step mash, the first rest uses this
        equation; subsequent rests add boiling water to raise temperature, which
        the recipe builder handles automatically.
      </p>

      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>

      <HSFormulaCallout
        title="Palmer Heat Balance Equation"
        expression={
          "T_{strike} = T_{mash} + \\frac{0.41}{r} \\times (T_{mash} - T_{grain})"
        }
        description="Where r is mash thickness in L/kg and 0.41 is the grain/water heat capacity ratio."
      />

      <p className="text-sm leading-relaxed mb-4">
        The 0.41 constant is the ratio of grain&apos;s specific heat capacity to
        water&apos;s (approximately 1.71 kJ/kg·K ÷ 4.18 kJ/kg·K). It tells you
        how much less heat grain holds compared to water at the same
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

      <h2 id="mash-thickness" className="text-xl font-bold mt-10 mb-4">
        Mash Thickness
      </h2>
      <p className="text-sm leading-relaxed mb-4">
        Mash thickness (the water-to-grain ratio) is how many liters of water
        you use per kilogram of grain. A typical single infusion mash runs
        2.5–4.0 L/kg. Thinner mashes (more water) are more temperature-stable
        and easier to control. Thicker mashes (less water) can improve
        efficiency but require more precise strike temperatures.
      </p>

      <h2 id="grain-temperature" className="text-xl font-bold mt-10 mb-4">
        Grain Temperature
      </h2>
      <p className="text-sm leading-relaxed">
        If your grain is stored in a cold garage (5–10°C) versus a warm kitchen
        (22°C), your strike temperature changes by several degrees. It&apos;s
        worth measuring actual grain temp rather than guessing room temperature
        — especially in winter. The recipe builder defaults to 20°C (68°F),
        which is fine for grain stored indoors. Related:{" "}
        <a
          href="/learn/mash-temperature"
          className="text-[var(--coral-500)] hover:underline font-medium"
        >
          how mash temperature shapes fermentability
        </a>
        .
      </p>
    </>
  );
}
