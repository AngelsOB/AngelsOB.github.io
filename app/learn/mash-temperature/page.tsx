import type { Metadata } from "next";
import { learnBreadcrumb } from "@/modules/learn/breadcrumbs";
import HSLearnArticle from "@/modules/builder/components/HSLearnArticle";
import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

export const metadata: Metadata = {
  title: "Mash Temperature & Enzyme Kinetics",
  description:
    "How mash temperature controls fermentability through enzyme kinetics. Brewing.It's default Kinetic model simulates the mash enzymology and is validated against ~50 real measured-FG batches.",
  keywords: [
    "mash temperature",
    "enzyme kinetics brewing",
    "alpha amylase beta amylase",
    "limit dextrinase",
    "fermentability",
    "step mash",
    "final gravity prediction",
  ],
  alternates: { canonical: "/learn/mash-temperature" },
  openGraph: {
    title: "Mash Temperature & Enzyme Kinetics | Brewing.It Learn",
    description:
      "How mash temperature controls fermentability, and how Brewing.It's Kinetic model simulates the mash enzymology, validated against real measured-FG batches.",
  },
  twitter: {
    card: "summary",
    title: "Mash Temperature & Enzyme Kinetics | Brewing.It Learn",
    description:
      "How mash temperature controls fermentability, and how Brewing.It's Kinetic model simulates the mash enzymology, validated against real measured-FG batches.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Mash Temperature & Enzyme Kinetics",
  description:
    "How mash temperature controls fermentability, and how Brewing.It's Kinetic model simulates the mash enzymology, validated against real measured-FG batches.",
  author: { "@type": "Organization", name: "Brewing.It" },
  publisher: { "@type": "Organization", name: "Brewing.It" },
  datePublished: "2026-03-23",
  dateModified: "2026-06-12",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"}/learn/mash-temperature`,
  },
};

/**
 * Apparent attenuation vs single-infusion mash temperature: our two model curves
 * over real measured-FG batches (each normalised to a 75% base yeast so they're
 * comparable). Static SVG — renders at build time, no client JS.
 */
function FermentabilityChart() {
  const W = 680, H = 380, padL = 44, padR = 16, padT = 16, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xMin = 60, xMax = 74, yMin = 50, yMax = 92;
  const sx = (t: number) => padL + ((t - xMin) / (xMax - xMin)) * plotW;
  const sy = (a: number) => padT + ((yMax - a) / (yMax - yMin)) * plotH;

  // Kinetic model curve (base yeast 75%, single infusion) — emitted from the live model.
  const kinetic: Array<[number, number]> = [
    [60, 83.0], [62, 83.0], [63, 82.6], [64, 81.9], [65, 80.9], [66, 79.5], [67, 77.0],
    [68, 72.5], [69, 67.3], [70, 63.1], [71, 60.0], [72, 57.7], [73, 56.1], [74, 55.0],
  ];
  // Linear (Grainfather) curve: 75 − 2.25 × (clamp(T,62.5,72.5) − 67.5).
  const clamp = (t: number) => Math.min(72.5, Math.max(62.5, t));
  const linear: Array<[number, number]> = kinetic.map(([t]) => [t, 75 - 2.25 * (clamp(t) - 67.5)]);
  // Every in-fit single-infusion batch in the validation set, normalised to a 75% base
  // yeast. Confounded batches (diastaticus, fruit/wheat, approx-OG) and step mashes (no
  // single mash temp) are excluded here — they'd mislead the eye, not inform it.
  const data: Array<[number, number]> = [
    [65, 86.4], [67, 84.5], [64, 82.2], [73, 53.1], [64, 89.3], [71, 62.9], [64, 78.4],
    [73, 55.2], [64, 85.5], [73, 78.4], [65, 77.8], [68, 68.5], [65, 85.0], [68, 79.2],
    [63, 80.4], [66, 76.1], [66, 77.1], [64, 82.0], [65, 78.8], [66, 70.0], [68, 76.9],
    [65, 80.0], [65.6, 76.6],
    // Round 4: 26 more mid-range single infusions (Brulosophy, hydrometer-measured).
    [67.8, 75.8], [67.8, 72.0], [66.7, 83.0], [66.7, 66.9], [66.7, 76.5], [67.8, 67.7],
    [65.6, 81.8], [67.8, 78.3], [66.7, 77.5], [67.8, 75.5], [67.8, 82.4], [66.7, 82.6],
    [67.0, 83.0], [64.4, 83.3], [67.8, 74.2], [66.1, 78.5], [65.6, 81.1], [66.7, 78.8],
    [66.7, 75.6], [66.7, 88.1], [66.7, 83.6], [66.1, 81.6], [67.2, 79.2], [66.7, 66.4],
    [66.7, 71.7], [67.8, 68.7],
  ];
  const toPath = (pts: Array<[number, number]>) =>
    pts.map(([t, a], i) => `${i === 0 ? "M" : "L"}${sx(t).toFixed(1)},${sy(a).toFixed(1)}`).join(" ");

  return (
    <figure
      className="my-8 rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)", boxShadow: "var(--shadow-card)" }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Scatter plot of apparent attenuation versus mash temperature for 23 in-fit single-infusion batches. The Kinetic curve falls in a smooth S-shape, tracking the batch data through the normal range and sitting a few points above the hottest (71 to 73 degree) measurements; the Linear (Grainfather) dashed curve runs higher at low mash temps; a flat dotted line representing no mash-temperature adjustment misses the downward trend entirely. The typical mash range from 63 to 70 degrees is shaded.">
        <title>Apparent attenuation vs mash temperature</title>
        {/* Typical single-infusion mash window (~63–70°C / 145–158°F) */}
        <rect x={sx(63)} y={padT} width={sx(70) - sx(63)} height={plotH} fill="color-mix(in oklch, var(--coral-500) 6%, transparent)" />
        <line x1={sx(63)} y1={padT} x2={sx(63)} y2={padT + plotH} stroke="color-mix(in oklch, var(--coral-600) 28%, transparent)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={sx(70)} y1={padT} x2={sx(70)} y2={padT + plotH} stroke="color-mix(in oklch, var(--coral-600) 28%, transparent)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={(sx(63) + sx(70)) / 2} y={padT + 11} textAnchor="middle" fontSize={10} fill="var(--coral-600)">typical mash range</text>
        {[50, 60, 70, 80, 90].map((a) => (
          <g key={a}>
            <line x1={padL} y1={sy(a)} x2={W - padR} y2={sy(a)} stroke="color-mix(in oklch, var(--fg-strong) 8%, transparent)" strokeWidth={1} />
            <text x={padL - 6} y={sy(a) + 4} textAnchor="end" fontSize={11} fill="var(--fg-muted)">{a}%</text>
          </g>
        ))}
        {[60, 64, 68, 72].map((t) => (
          <text key={t} x={sx(t)} y={H - padB + 18} textAnchor="middle" fontSize={11} fill="var(--fg-muted)">{t}°C</text>
        ))}
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--fg-muted)">mash temperature</text>
        {/* Flat baseline: yeast's nominal attenuation, no mash-temp term. */}
        <line x1={sx(xMin)} y1={sy(75)} x2={sx(xMax)} y2={sy(75)} stroke="color-mix(in oklch, var(--fg-strong) 32%, transparent)" strokeWidth={1.5} strokeDasharray="2 5" />
        <path d={toPath(linear)} fill="none" stroke="var(--fg-muted)" strokeWidth={2} strokeDasharray="6 5" />
        <path d={toPath(kinetic)} fill="none" stroke="var(--coral-600)" strokeWidth={3} />
        {data.map(([t, a], i) => (
          <circle key={i} cx={sx(t)} cy={sy(a)} r={4} fill="oklch(58% 0.12 245)" opacity={0.85} />
        ))}
      </svg>
      <figcaption className="mt-2 px-1 text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: "var(--fg-muted)" }}>
        <span><span style={{ color: "var(--coral-600)" }}>━</span> Kinetic (default)</span>
        <span><span style={{ color: "var(--fg-muted)" }}>╌╌</span> Linear (Grainfather-style)</span>
        <span><span style={{ color: "color-mix(in oklch, var(--fg-strong) 45%, transparent)" }}>┈┈</span> No mash-temp adjustment</span>
        <span><span style={{ color: "oklch(58% 0.12 245)" }}>●</span> real measured batches</span>
      </figcaption>
    </figure>
  );
}

export default function MashTemperaturePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, learnBreadcrumb("mash-temperature")]) }} />
      <HSLearnArticle
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
          Change the mash temperature in the recipe builder and your predicted FG and
          ABV update live. The default is a <strong>Kinetic</strong> model that
          simulates the mash enzymology. There&apos;s also a simple{" "}
          <strong>Linear</strong> model if you want to cross-check against another app.
          Here&apos;s how the two compare against real measured batches:
        </p>

        <FermentabilityChart />
        <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
          Every dot is a real batch with the brewer&apos;s own measured gravities.
          Nearly 50 of them, single-infusion mashes, normalised to a 75% base yeast
          so they line up on one axis. (Step mashes are in the test set too. They
          just don&apos;t have one mash temp to plot.) The Kinetic curve runs through
          the middle of them. The Linear formula sits a little high at low temps. The
          flat line, the one that ignores mash temp, misses the trend completely.
        </p>
        <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--fg-muted)" }}>
          Worth being straight about. In the everyday range, 64 to 68°C, the dots
          scatter a good few points wide and all three curves run close together. So
          the model barely matters there. Any sensible guess lands inside the noise.
          The curves only pull apart at the extremes, and that&apos;s where the
          Kinetic model earns its keep. Across the whole set it lands about 2 gravity
          points off, and the very hot end (above 71°C) is where I have the least
          data, so trust it least.
        </p>

        <h2 id="the-enzymes" className="text-xl font-bold mt-10 mb-4">
          The Enzymes That Set Fermentability
        </h2>
        <p className="text-sm leading-relaxed mb-4">
          Three enzymes in the mash decide how fermentable your wort ends up.{" "}
          <strong>Beta-amylase</strong> (happiest around 63°C) snips small,
          fully-fermentable sugar off the ends of the starch chains.{" "}
          <strong>Alpha-amylase</strong> (happiest around 70°C) cuts the chains in
          the middle and leaves bigger sugars the yeast can&apos;t finish.{" "}
          <strong>Limit dextrinase</strong> (around 61°C) unlocks the branch points
          the other two can&apos;t reach. It turns out to be the single biggest
          driver of how fermentable the wort gets. The practical upshot: a cool rest
          keeps the first and third busy, so the beer comes out drier. A hot rest
          hands the wort to alpha-amylase, so it comes out fuller and sweeter.
        </p>

        <h2 id="two-models" className="text-xl font-bold mt-10 mb-4">
          Two Models
        </h2>

        <div className="space-y-4">
          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.1 10)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-base font-bold">Kinetic</h3>
              <span className="text-xs font-normal" style={{ color: "var(--fg-muted)" }}>default</span>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ background: "color-mix(in oklch, var(--coral-500) 12%, transparent)", color: "var(--coral-600)" }}
              >
                unique to Brewing.It
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              A mash simulation. It steps through your actual rest schedule and tracks
              four sugar pools (starch → β-convertible dextrin / branched limit dextrin
              → fermentable sugar) as beta-amylase, alpha-amylase, and limit dextrinase
              work and slowly denature. Because it walks the real schedule, step mashes
              work right. A cool rest early on still counts even if a hotter one follows.
            </p>
            <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--fg-muted)" }}>
              <strong>Long story short:</strong> it works out how much of your starch
              becomes sugar the yeast can eat, and how much it can&apos;t. There&apos;s
              one bit most calculators skip. Even the fermentable sugars aren&apos;t
              equal. Yeast finishes the easy ones and leaves some of the trickiest one
              (maltotriose) behind, and a hot mash makes more of it. So a hot mash ends
              up a touch sweeter than the sugar split alone would say.
            </p>
            <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--fg-muted)" }}>
              On the test batches it&apos;s the most accurate of the bunch, about 2
              gravity points off. The very hot end (above 71°C) is where I have the
              least data, so I trust it least there.
            </p>
          </div>

          <div
            className="grain rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 95%, oklch(80% 0.06 80)), var(--card))`,
              border: "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
            }}
          >
            <h3 className="text-base font-bold mb-2">Linear</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              A simple straight line. Shift the yeast&apos;s attenuation about 2.25%
              per °C off a 67.5°C neutral point, read from your lowest saccharification
              rest. This is <strong>Grainfather&apos;s published formula</strong>. Pick
              it if you want numbers that line up with another tool. It&apos;s less
              accurate than the Kinetic model on real beer. A straight line runs high
              at very low mash temps, and it leans too hard on a single low rest.
            </p>
          </div>
        </div>

        <HSFormulaCallout
          title="The Linear formula"
          expression={"att = nominal - 0.0225 \\times (T_{rest} - 67.5)"}
          description="Drop the yeast's rated attenuation by 2.25% for every °C your lowest mash rest sits above 67.5°C, and raise it below. Clamped to a 62.5–72.5°C window. That's Grainfather's published formula, and that's the whole thing. The Kinetic model doesn't get a tidy one-line equation, on purpose. It's the simulation above, not a formula."
        />

        <h2 id="where-this-comes-from" className="text-xl font-bold mt-10 mb-4">
          Where This Comes From
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          The shape and the numbers behind the Kinetic model come from published
          brewing science, then get tuned against real measured final gravities:
        </p>
        <ul className="text-sm leading-relaxed space-y-1.5 pl-5 list-disc" style={{ color: "var(--fg-muted)" }}>
          <li>
            Brandam et al. (2003), <em>A kinetic model for the mashing process</em>.{" "}
            The sugar-species ODE structure.
          </li>
          <li>
            Muller (1991), <em>J. Inst. Brewing</em> 97:85. In-mash amylase
            thermal-decay rates (used instead of buffer-measured rates, which
            denature beta-amylase far too fast).
          </li>
          <li>
            Stenholm &amp; Home (1999), <em>J. Inst. Brewing</em> 105:205. Limit
            dextrinase as the dominant fermentability driver.
          </li>
          <li>
            De Schepper / Laus et al. (2022), <em>Food &amp; Bioprocess Technology</em>{" "}
            15:2294. Isothermal mash fermentability measured in 1°C steps from 55 to
            80°C, which informs the shape (peak ~65°C, gentle decline above it).
          </li>
          <li>
            Stewart et al. on wort sugar uptake. Maltotriose gets fermented last and
            least completely, which is why a hot, maltotriose-heavy wort finishes
            below its sugar breakdown.
          </li>
          <li>
            Validation set: ~50 measured-FG batches with the brewer&apos;s own
            gravities, from Braukaiser, Woodland, and Brulosophy experiments, plus
            published BYO/German step-mash recipes.
          </li>
        </ul>
        <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--fg-muted)" }}>
          Where I&apos;d be careful. The rate constants are tuned to measured beers,
          not derived from pure theory. The hot-side bend follows a real mechanism
          (yeast leaving maltotriose behind), but its size leans on only a handful of
          very-hot batches. So above 71°C is the shakiest part, and up there the yeast
          strain matters more than the mash anyway. Very high-gravity worts are hard
          too. Take the number as a good estimate, around 2 gravity points, not a
          promise.
        </p>
      </HSLearnArticle>
    </>
  );
}
