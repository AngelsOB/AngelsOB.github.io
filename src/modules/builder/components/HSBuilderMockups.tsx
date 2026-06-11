"use client";

import { hsTokens, hsBrewAccentMap } from "../tokens";

/**
 * HS-native versions of the builder mockup slices used inside learn articles.
 * Same component names as classic BuilderMockups so import swaps are mechanical.
 * Each MockupCard renders as a paper-bg + 2px ink card with an ingredient-
 * accent top stripe (5px), matching the rest of HS card surfaces.
 */

type AccentKey = keyof typeof hsBrewAccentMap;

function MockupCard({
  title,
  accent,
  children,
  caption,
}: {
  title: string;
  accent: AccentKey;
  children: React.ReactNode;
  caption?: string;
}) {
  const accentColor = hsBrewAccentMap[accent];
  return (
    <div
      style={{
        margin: "24px 0",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: accentColor,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      />
      <div
        style={{
          padding: "16px 18px 6px",
          background: hsTokens.cream2,
          borderBottom: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 14,
            letterSpacing: "-0.02em",
            color: hsTokens.ink,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: 16, background: hsTokens.paper }}>{children}</div>
      {caption ? (
        <div
          style={{
            padding: "10px 18px 14px",
            color: hsTokens.muted,
            fontFamily: hsTokens.script,
            fontSize: 16,
            background: hsTokens.cream2,
            borderTop: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}

function Gauge({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        padding: "10px 12px",
        background: hsTokens.cream2,
        border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: hsTokens.ink,
        }}
      >
        {value}
      </span>
      {unit ? (
        <span style={{ fontSize: 11, marginLeft: 3, color: hsTokens.muted }}>{unit}</span>
      ) : null}
    </div>
  );
}

export function EquipmentMockup() {
  return (
    <MockupCard
      title="Equipment & Volumes"
      accent="equipment"
      caption="These three numbers drive all your volume and gravity calculations."
    >
      <div style={{ display: "flex", gap: 12 }}>
        <Gauge label="Batch Volume" value="20" unit="L" />
        <Gauge label="Efficiency" value="75" unit="%" />
        <Gauge label="Boil Time" value="60" unit="min" />
      </div>
    </MockupCard>
  );
}

export function FermentablesMockup() {
  const grains = [
    { name: "Pale Ale Malt 2-Row", color: "4°L", weight: "5 kg", pct: "92.6%" },
    { name: "Caramel Malt 40L", color: "40°L", weight: "0.27 kg", pct: "5%" },
    { name: "Victory Malt", color: "25°L", weight: "0.16 kg", pct: "3%" },
  ];
  return (
    <MockupCard
      title="Fermentables"
      accent="grain"
      caption="Your grain bill builds the OG — we calculate gravity, color, and fermentability."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {grains.map((g) => (
          <div
            key={g.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: hsTokens.cream2,
              border: `1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent)`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: hsTokens.body,
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: hsTokens.ink }}>{g.name}</span>
              <span style={{ marginLeft: 6, fontSize: 11, color: hsTokens.muted }}>{g.color}</span>
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {g.weight} · {g.pct}
            </div>
          </div>
        ))}
      </div>
    </MockupCard>
  );
}

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
      accent="water"
      caption="Set a target profile, hit Auto-Calculate, and we solve for the optimal salt additions."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            background: hsTokens.cream2,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 600,
            color: hsTokens.muted,
          }}
        >
          RO / Distilled
        </span>
        <span style={{ color: hsTokens.muted, fontFamily: hsTokens.body }}>→</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 14px",
            background: hsTokens.water,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 700,
            color: hsTokens.cream,
            boxShadow: hsTokens.sh1,
          }}
        >
          American IPA
        </span>
        <span style={{ fontSize: 11, color: hsTokens.muted, fontFamily: hsTokens.body }}>
          Cl:SO₄ 0.4:1 (Hoppy)
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 14 }}>
        {[
          { salt: "Gypsum", g: "9.5" },
          { salt: "CaCl₂", g: "2" },
          { salt: "Epsom", g: "3" },
        ].map((s) => (
          <div
            key={s.salt}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 6px",
              background: hsTokens.cream2,
              border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: hsTokens.muted,
              }}
            >
              {s.salt}
            </div>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 16,
                letterSpacing: "-0.025em",
                fontVariantNumeric: "tabular-nums",
                color: hsTokens.ink,
              }}
            >
              {s.g}
              <span style={{ fontFamily: hsTokens.body, fontWeight: 400, fontSize: 11, marginLeft: 2 }}>
                g
              </span>
            </div>
          </div>
        ))}
        <button
          type="button"
          style={{
            padding: "8px 12px",
            background: hsTokens.ink,
            color: hsTokens.cream,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: hsTokens.sh1,
            flexShrink: 0,
            cursor: "default",
          }}
        >
          Auto-Calc
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ions.map((ion) => {
          const max = Math.max(ion.current, ion.target) * 1.3;
          return (
            <div key={ion.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                  }}
                >
                  {ion.label}
                </span>
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: 10,
                    color: hsTokens.muted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {ion.current} / {ion.target} ppm
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 8,
                  background: hsTokens.cream,
                  border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${(ion.current / max) * 100}%`,
                    background: hsTokens.water,
                    opacity: 0.7,
                    borderRadius: 999,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    bottom: -2,
                    left: `${(ion.target / max) * 100}%`,
                    width: 2,
                    background: hsTokens.ink,
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

export function MashMockup() {
  return (
    <MockupCard
      title="Mash Schedule"
      accent="mash"
      caption="We calculate strike temperature and predicted FG from your mash schedule."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { step: "Saccharification", temp: "65°C", time: "60 min" },
          { step: "Mash Out", temp: "76°C", time: "10 min" },
        ].map((s) => (
          <div
            key={s.step}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: hsTokens.cream2,
              border: `1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent)`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: hsTokens.body,
            }}
          >
            <span style={{ fontWeight: 700, color: hsTokens.ink }}>{s.step}</span>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.temp} · {s.time}
            </div>
          </div>
        ))}
      </div>
    </MockupCard>
  );
}

export function BrewDayMockup() {
  return (
    <MockupCard
      title="Brew Day Targets"
      accent="targets"
      caption="These are targets — measure your actuals and adjust."
    >
      <div style={{ display: "flex", gap: 10 }}>
        <Gauge label="Mash Water" value="14.2" unit="L" />
        <Gauge label="Sparge" value="12.8" unit="L" />
        <Gauge label="Strike Temp" value="71.8" unit="°C" />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Gauge label="Pre-Boil Vol" value="27.0" unit="L" />
        <Gauge label="Pre-Boil SG" value="1.047" unit="" />
      </div>
    </MockupCard>
  );
}
