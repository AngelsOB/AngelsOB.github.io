export default function HydrometerContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        Hydrometers are calibrated at a specific temperature (usually 15°C or
        20°C). If your wort sample is warmer or cooler than that, the reading
        will be off. The calculator above corrects for the difference — enter
        your reading, sample temp, and calibration temp, and it gives you the
        true gravity.
      </p>

      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>
      <p className="text-sm leading-relaxed mb-4">
        We use the <strong>Kell (1975) water density equation</strong>, a
        polynomial that models how water density changes with temperature. The
        correction compares the density of water at your sample temperature to
        the density at calibration temperature, then adjusts your gravity
        reading accordingly.
      </p>

      <div
        className="grain rounded-xl p-5 my-6"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 60)), var(--card))`,
          border:
            "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
        }}
      >
        <h3 className="text-base font-bold mb-2">When does it matter?</h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          At 30°C (86°F), a reading of 1.050 is actually closer to 1.052. At
          40°C it&apos;s off by about 4 points. For OG readings taken right
          after chilling, the error is usually small. But if you&apos;re reading
          hot wort or very cold fermented beer, the correction matters for
          accurate{" "}
          <a
            href="/calculators/abv"
            className="text-[var(--coral-500)] hover:underline font-medium"
          >
            ABV calculations
          </a>
          .
        </p>
      </div>

      <h2 id="sources" className="text-xl font-bold mt-10 mb-4">
        Sources
      </h2>
      <ul
        className="text-sm space-y-1.5 list-disc pl-5"
        style={{ color: "var(--fg-muted)" }}
      >
        <li>
          Kell, G.S. &ldquo;Density, Thermal Expansivity, and Compressibility of
          Liquid Water.&rdquo; <em>J. Chem. Eng. Data</em> 20(1), 1975.
        </li>
      </ul>
    </>
  );
}
