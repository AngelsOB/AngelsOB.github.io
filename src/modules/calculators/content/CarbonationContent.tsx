export default function CarbonationContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        CO₂ volumes tell you how carbonated your beer is. A British bitter might
        be 1.5 volumes; a German wheat beer pushes 4.0+. If you&apos;re kegging,
        you need to know what PSI to set at your serving temperature — the
        calculator above gives you that number instantly.
      </p>

      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>
      <p className="text-sm leading-relaxed mb-4">
        CO₂ equilibrium pressure depends on temperature. Colder beer absorbs
        more CO₂ at the same pressure. We use an empirical polynomial fit to the
        CO₂ solubility curve. Enter your desired volumes and serving temp, and
        the calculator solves for the pressure needed.
      </p>

      <div
        className="grain rounded-xl p-5 my-6"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 220)), var(--card))`,
          border:
            "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
        }}
      >
        <h3 className="text-base font-bold mb-2">Typical CO₂ Volumes by Style</h3>
        <div className="text-sm space-y-1" style={{ color: "var(--fg-muted)" }}>
          <p>
            <strong>1.5–2.0</strong>: British ales, cask-conditioned
          </p>
          <p>
            <strong>2.2–2.7</strong>: American ales, lagers, most styles
          </p>
          <p>
            <strong>2.7–3.5</strong>: Belgian ales, saisons
          </p>
          <p>
            <strong>3.5–4.5</strong>: German wheat beers, highly carbonated
            styles
          </p>
        </div>
      </div>
    </>
  );
}
