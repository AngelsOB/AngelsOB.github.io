"use client";

import GrainGradient from "@/components/GrainGradient";

/**
 * JSX mockup components that mimic slices of the recipe builder.
 * Used in the getting-started page to show what each section looks like.
 * These are static — no interactivity needed.
 */

/* ── Shared wrapper ── */
function MockupCard({
  title,
  hue,
  children,
  caption,
}: {
  title: string;
  hue: number;
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div
      className="my-6 rounded-2xl overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
        border:
          "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
      }}
    >
      <div className="relative px-5 py-2.5 overflow-hidden">
        <GrainGradient
          stops={[
            { pos: 0, color: `oklch(82% 0.1 ${hue})` },
            { pos: 1, color: `oklch(78% 0.08 ${hue + 5})` },
          ]}
          direction={135}
          displacement={0.5}
          grainOpacity={0.65}
          radius={8}
        />
        <span
          className="relative z-10 text-sm font-black tracking-tight"
          style={{ color: `oklch(25% 0.05 ${hue})` }}
        >
          {title}
        </span>
      </div>
      <div className="p-4" style={{ background: "var(--card)" }}>
        {children}
      </div>
      {caption && (
        <div
          className="px-5 py-2 text-center"
          style={{
            color: "var(--fg-muted)",
            fontFamily: "'Shadows Into Light', cursive",
            fontSize: "0.82rem",
            background:
              "color-mix(in oklch, var(--surface) 50%, transparent)",
            borderTop:
              "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

/* ── Gauge row used in equipment ── */
function Gauge({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div
      className="flex-1 text-center px-3 py-2.5 rounded-xl"
      style={{
        background:
          "color-mix(in oklch, var(--surface) 60%, transparent)",
        border:
          "1px solid color-mix(in oklch, var(--fg-strong) 6%, transparent)",
      }}
    >
      <div
        className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
        style={{ color: "var(--fg-muted)" }}
      >
        {label}
      </div>
      <span
        className="text-lg font-black tabular-nums"
        style={{ color: "var(--fg-strong)" }}
      >
        {value}
      </span>
      <span className="text-xs ml-0.5" style={{ color: "var(--fg-muted)" }}>
        {unit}
      </span>
    </div>
  );
}

/* ── Equipment ── */
export function EquipmentMockup() {
  return (
    <MockupCard
      title="Equipment & Volumes"
      hue={220}
      caption="These three numbers drive all your volume and gravity calculations."
    >
      <div className="flex gap-3">
        <Gauge label="Batch Volume" value="20" unit="L" />
        <Gauge label="Efficiency" value="75" unit="%" />
        <Gauge label="Boil Time" value="60" unit="min" />
      </div>
    </MockupCard>
  );
}

/* ── Fermentables ── */
export function FermentablesMockup() {
  const grains = [
    { name: "Pale Ale Malt 2-Row", color: "4°L", weight: "5 kg", pct: "92.6%" },
    { name: "Caramel Malt 40L", color: "40°L", weight: "0.27 kg", pct: "5%" },
    { name: "Victory Malt", color: "25°L", weight: "0.16 kg", pct: "3%" },
  ];
  return (
    <MockupCard
      title="Fermentables"
      hue={50}
      caption="Your grain bill builds the OG — we calculate gravity, color, and fermentability."
    >
      <div className="space-y-1.5">
        {grains.map((g) => (
          <div
            key={g.name}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            style={{
              background:
                "color-mix(in oklch, var(--surface) 50%, transparent)",
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
            }}
          >
            <div>
              <span
                className="font-semibold"
                style={{ color: "var(--fg-strong)" }}
              >
                {g.name}
              </span>
              <span
                className="ml-1.5 text-xs"
                style={{ color: "var(--fg-muted)" }}
              >
                {g.color}
              </span>
            </div>
            <div className="text-xs tabular-nums" style={{ color: "var(--fg-muted)" }}>
              {g.weight} · {g.pct}
            </div>
          </div>
        ))}
      </div>
    </MockupCard>
  );
}

/* ── Water Chemistry ── */
export function WaterChemMockup() {
  const ions = [
    { label: "CA", current: 90, target: 100 },
    { label: "MG", current: 10, target: 15 },
    { label: "CL", current: 31, target: 75 },
    { label: "SO₄", current: 211, target: 200 },
  ];
  return (
    <MockupCard
      title="Water Chemistry"
      hue={200}
      caption="Set a target profile, hit Auto-Calculate, and we solve for the optimal salt additions."
    >
      {/* Source → Target */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <span
          className="px-3 py-1 rounded-lg text-xs font-medium"
          style={{
            background:
              "color-mix(in oklch, var(--surface) 70%, transparent)",
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 6%, transparent)",
            color: "var(--fg-muted)",
          }}
        >
          RO / Distilled
        </span>
        <span style={{ color: "var(--fg-muted)" }}>→</span>
        <span
          className="px-3 py-1 rounded-lg text-xs font-semibold"
          style={{
            background:
              "linear-gradient(135deg, oklch(75% 0.1 200), oklch(70% 0.08 210))",
            color: "white",
          }}
        >
          American IPA
        </span>
        <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Cl:SO₄ 0.4:1 (Hoppy)
        </span>
      </div>

      {/* Salt row */}
      <div className="flex items-center gap-2 mb-3">
        {[
          { salt: "Gypsum", g: "9.5" },
          { salt: "CaCl₂", g: "2" },
          { salt: "Epsom", g: "3" },
        ].map((s) => (
          <div
            key={s.salt}
            className="flex-1 text-center py-1.5 rounded-lg text-xs"
            style={{
              background:
                "color-mix(in oklch, var(--surface) 60%, transparent)",
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
            }}
          >
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
              {s.salt}
            </div>
            <div className="font-black tabular-nums" style={{ color: "var(--fg-strong)" }}>
              {s.g}<span className="font-normal text-[10px]"> g</span>
            </div>
          </div>
        ))}
        <button
          className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
          style={{
            background: "var(--card)",
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 10%, transparent)",
            color: "var(--fg-strong)",
          }}
        >
          Auto-Calculate
        </button>
      </div>

      {/* Ion bars */}
      <div className="space-y-2">
        {ions.map((ion) => {
          const max = Math.max(ion.current, ion.target) * 1.3;
          return (
            <div key={ion.label}>
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                  {ion.label}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
                  {ion.current} / {ion.target} ppm
                </span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: "color-mix(in oklch, var(--fg-strong) 6%, transparent)" }}>
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    width: `${(ion.current / max) * 100}%`,
                    background: `linear-gradient(90deg, oklch(65% 0.12 200), oklch(60% 0.1 210))`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-px"
                  style={{
                    left: `${(ion.target / max) * 100}%`,
                    background: "var(--fg-muted)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </MockupCard>
  );
}

/* ── Mash ── */
export function MashMockup() {
  return (
    <MockupCard
      title="Mash Schedule"
      hue={35}
      caption="We calculate strike temperature and predicted FG from your mash schedule."
    >
      <div className="space-y-1.5">
        {[
          { step: "Saccharification", temp: "65°C", time: "60 min" },
          { step: "Mash Out", temp: "76°C", time: "10 min" },
        ].map((s) => (
          <div
            key={s.step}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            style={{
              background: "color-mix(in oklch, var(--surface) 50%, transparent)",
              border: "1px solid color-mix(in oklch, var(--fg-strong) 5%, transparent)",
            }}
          >
            <span className="font-semibold" style={{ color: "var(--fg-strong)" }}>{s.step}</span>
            <div className="text-xs tabular-nums" style={{ color: "var(--fg-muted)" }}>
              {s.temp} · {s.time}
            </div>
          </div>
        ))}
      </div>
    </MockupCard>
  );
}

/* ── Brew Day Targets ── */
export function BrewDayMockup() {
  return (
    <MockupCard
      title="Brew Day Targets"
      hue={10}
      caption="These are targets — measure your actuals and adjust."
    >
      <div className="flex gap-3">
        <Gauge label="Mash Water" value="14.2" unit="L" />
        <Gauge label="Sparge" value="12.8" unit="L" />
        <Gauge label="Strike Temp" value="71.8" unit="°C" />
      </div>
      <div className="flex gap-3 mt-2">
        <Gauge label="Pre-Boil Vol" value="27.0" unit="L" />
        <Gauge label="Pre-Boil SG" value="1.047" unit="" />
      </div>
    </MockupCard>
  );
}
