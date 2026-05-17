"use client";

import { useMemo, useState } from "react";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HSNumberField from "@/modules/hopskip/components/HSNumberField";
import HSRangeBar from "@/modules/hopskip/components/HSRangeBar";
import Glyph, { type GlyphKind } from "@/modules/hopskip/components/Glyph";
import { abvFromOGFG } from "@/calculators/abv";
import { postBoilVolume, gravityPoints } from "@/calculators/boilOff";
import { dilutionWater } from "@/calculators/dilution";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import type { Hop, Recipe } from "@/modules/beta-builder/domain/models/Recipe";

type CalcId = "abv" | "ibu" | "boil-off" | "dilution";

const CALC_META: Record<
  CalcId,
  {
    title: string;
    eyebrow: string;
    category: string;
    accent: string;
    glyph: GlyphKind;
    blurb: string;
  }
> = {
  abv: {
    title: "Alcohol by volume",
    eyebrow: "ABV",
    category: "Gravity & ABV",
    accent: hsTokens.malt,
    glyph: "drop",
    blurb: "From original and final gravity.",
  },
  ibu: {
    title: "Bitterness, Tinseth style",
    eyebrow: "IBU",
    category: "Hops & bitterness",
    accent: hsTokens.hops,
    glyph: "hop",
    blurb: "Sum of hop additions with isomerization.",
  },
  "boil-off": {
    title: "Boil-off / target OG",
    eyebrow: "Boil-off",
    category: "Boil & volume",
    accent: hsTokens.roast,
    glyph: "flame",
    blurb: "Volume to boil down to the OG you want.",
  },
  dilution: {
    title: "Wort dilution",
    eyebrow: "Dilution",
    category: "Boil & volume",
    accent: hsTokens.water,
    glyph: "water",
    blurb: "Water to add to drop into spec.",
  },
};

const CATEGORIES: { label: string; calcs: CalcId[]; accent: string }[] = [
  { label: "Gravity & ABV", calcs: ["abv"], accent: hsTokens.malt },
  { label: "Hops & bitterness", calcs: ["ibu"], accent: hsTokens.hops },
  { label: "Boil & volume", calcs: ["boil-off", "dilution"], accent: hsTokens.water },
  { label: "Mash & water", calcs: [], accent: hsTokens.roast },
];

export default function HopSkipCalculators() {
  const [active, setActive] = useState<CalcId>("abv");
  const meta = CALC_META[active];

  return (
    <main>
      {/* Title bar */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 24px",
        }}
      >
        <HSScriptNote color={hsTokens.water} size={26} rotate={-3}>
          the brewer&apos;s pocket library —
        </HSScriptNote>
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 6vw, 88px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
            margin: "10px 0 0",
            color: hsTokens.ink,
          }}
        >
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 0.18em",
              display: "inline-block",
              transform: "rotate(-1.5deg)",
              border: `2px solid ${hsTokens.ink}`,
              boxShadow: hsTokens.sh1,
            }}
          >
            Calculators
          </span>{" "}
          for brew day.
        </h1>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 15,
            lineHeight: 1.55,
            color: hsTokens.muted,
            maxWidth: 540,
            marginTop: 18,
          }}
        >
          Quick gravity and volume math &mdash; no spreadsheet required. Pick a calculator
          on the right; the inputs update live as you type.
        </p>
      </section>

      {/* Featured + catalog */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 56px) clamp(40px, 6vw, 96px)",
        }}
      >
        <div
          className="hs-calc-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.9fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <HSCard shadow={4} padding={0} style={{ overflow: "hidden" }}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px 22px",
                borderBottom: `2px solid ${hsTokens.ink}`,
                background: hsTokens.cream2,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  background: meta.accent,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Glyph kind={meta.glyph} size={24} color={hsTokens.ink} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <HSEyebrow>{meta.eyebrow}</HSEyebrow>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 22,
                    letterSpacing: "-0.035em",
                    color: hsTokens.ink,
                    marginTop: 4,
                  }}
                >
                  {meta.title}
                </div>
              </div>
              <HSScriptNote color={meta.accent} size={20} rotate={-3}>
                live ✦
              </HSScriptNote>
            </header>

            <div style={{ padding: 22 }}>
              {active === "abv" ? <AbvCalc accent={meta.accent} /> : null}
              {active === "ibu" ? <IbuCalc accent={meta.accent} /> : null}
              {active === "boil-off" ? <BoilOffCalc accent={meta.accent} /> : null}
              {active === "dilution" ? <DilutionCalc accent={meta.accent} /> : null}
            </div>
          </HSCard>

          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CATEGORIES.map((cat) => (
              <HSCard key={cat.label} shadow={2} padding="14px 16px 16px">
                <HSEyebrow>{cat.label}</HSEyebrow>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  {cat.calcs.length === 0 ? (
                    <span
                      style={{
                        fontFamily: hsTokens.script,
                        color: hsTokens.muted,
                        fontSize: 16,
                      }}
                    >
                      more on the way ✦
                    </span>
                  ) : (
                    cat.calcs.map((cid) => {
                      const c = CALC_META[cid];
                      const isActive = cid === active;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => setActive(cid)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 999,
                            border: `1.5px solid ${hsTokens.ink}`,
                            background: isActive ? c.accent : hsTokens.paper,
                            color: hsTokens.ink,
                            cursor: "pointer",
                            fontFamily: hsTokens.body,
                            fontSize: 13,
                            textAlign: "left",
                            transition: "background 120ms var(--hs-ease, ease)",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: c.accent,
                                border: `1px solid ${hsTokens.ink}`,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{c.title}</span>
                          </span>
                          {isActive ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                background: hsTokens.ink,
                                color: hsTokens.cream,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              open
                            </span>
                          ) : (
                            <span style={{ color: hsTokens.muted, fontSize: 16 }} aria-hidden>
                              →
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </HSCard>
            ))}
            <HSCard shadow={1} padding="12px 14px" bg={hsTokens.cream2}>
              <HSEyebrow>More on the way</HSEyebrow>
              <p
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                Strike temp, mash pH, carbonation, hydrometer correction — coming next.
              </p>
            </HSCard>
          </aside>
        </div>
        <style>{`
          @media (max-width: 1024px) {
            .hs-calc-layout { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </main>
  );
}

/* ────────────────── individual calcs ────────────────── */

function ResultGauge({
  label,
  value,
  accent,
  note,
  unit,
}: {
  label: string;
  value: string;
  accent: string;
  note?: string;
  unit?: string;
}) {
  return (
    <div
      style={{
        background: hsTokens.cream2,
        borderTop: `5px solid ${accent}`,
        borderRadius: 12,
        padding: "14px 18px",
        position: "relative",
      }}
    >
      <HSEyebrow>{label}</HSEyebrow>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 48,
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          color: hsTokens.ink,
        }}
      >
        {value}
        {unit ? (
          <span style={{ fontSize: 18, color: hsTokens.muted, marginLeft: 4 }}>{unit}</span>
        ) : null}
      </div>
      {note ? (
        <div style={{ position: "absolute", top: 10, right: 14 }}>
          <HSScriptNote color={accent} size={18} rotate={-4}>
            {note}
          </HSScriptNote>
        </div>
      ) : null}
    </div>
  );
}

function AbvCalc({ accent }: { accent: string }) {
  const [og, setOg] = useState(1.054);
  const [fg, setFg] = useState(1.012);
  const abv = abvFromOGFG(og, fg);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField label="OG" value={og} onChange={setOg} step={0.001} precision={3} accent={hsTokens.malt} />
      <HSNumberField label="FG" value={fg} onChange={setFg} step={0.001} precision={3} accent={hsTokens.yeast} />
      <div style={{ gridColumn: "1 / -1" }}>
        <ResultGauge label="Estimated ABV" value={abv.toFixed(2)} unit="%" accent={accent} note={abv > 8 ? "boozy!" : "looking good"} />
      </div>
    </div>
  );
}

function BoilOffCalc({ accent }: { accent: string }) {
  const [preBoilVol, setPreBoilVol] = useState(28);
  const [preBoilSG, setPreBoilSG] = useState(1.042);
  const [targetOG, setTargetOG] = useState(1.054);
  const postBoil = postBoilVolume(preBoilVol, preBoilSG, targetOG);
  const boilOff = preBoilVol - postBoil;
  const valid = Number.isFinite(postBoil) && postBoil > 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField label="Pre-boil volume" value={preBoilVol} onChange={setPreBoilVol} step={0.5} unit="L" precision={1} accent={hsTokens.water} />
      <HSNumberField label="Pre-boil gravity" value={preBoilSG} onChange={setPreBoilSG} step={0.001} precision={3} accent={hsTokens.malt} />
      <HSNumberField label="Target OG" value={targetOG} onChange={setTargetOG} step={0.001} precision={3} accent={hsTokens.malt} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ResultGauge
          label="Post-boil volume"
          value={valid ? postBoil.toFixed(1) : "—"}
          unit="L"
          accent={accent}
        />
        <ResultGauge
          label="Boil-off"
          value={valid ? boilOff.toFixed(1) : "—"}
          unit="L"
          accent={hsTokens.roast}
          note={valid ? `${((boilOff / preBoilVol) * 100).toFixed(1)}%` : undefined}
        />
      </div>
      <div style={{ gridColumn: "1 / -1", fontFamily: hsTokens.body, fontSize: 12, color: hsTokens.muted }}>
        Pre-boil points: <span style={{ fontFamily: hsTokens.mono }}>{gravityPoints(preBoilSG).toFixed(1)}</span> · Target points:{" "}
        <span style={{ fontFamily: hsTokens.mono }}>{gravityPoints(targetOG).toFixed(1)}</span>
      </div>
    </div>
  );
}

function DilutionCalc({ accent }: { accent: string }) {
  const [vol, setVol] = useState(20);
  const [currentSG, setCurrentSG] = useState(1.072);
  const [targetSG, setTargetSG] = useState(1.06);
  const water = dilutionWater(vol, currentSG, targetSG);
  const ok = Number.isFinite(water) && water > 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField label="Current volume" value={vol} onChange={setVol} step={0.5} unit="L" precision={1} accent={hsTokens.water} />
      <HSNumberField label="Current gravity" value={currentSG} onChange={setCurrentSG} step={0.001} precision={3} accent={hsTokens.malt} />
      <HSNumberField label="Target gravity" value={targetSG} onChange={setTargetSG} step={0.001} precision={3} accent={hsTokens.malt} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ResultGauge
          label="Water to add"
          value={ok ? water.toFixed(2) : "—"}
          unit="L"
          accent={accent}
          note={ok ? "splash in" : "out of range"}
        />
      </div>
    </div>
  );
}

/* ────────── IBU calc with editable hop additions ────────── */

type IbuAddition = {
  id: string;
  variety: string;
  alphaAcid: number;
  grams: number;
  timeMinutes: number;
  type: Hop["type"];
};

const IBU_STYLE_LO = 25;
const IBU_STYLE_HI = 45;

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function IbuCalc({ accent }: { accent: string }) {
  const [batchVolumeL, setBatchVolumeL] = useState(20);
  const [og, setOg] = useState(1.054);
  const [additions, setAdditions] = useState<IbuAddition[]>([
    { id: makeId(), variety: "Cascade", alphaAcid: 5.5, grams: 28, timeMinutes: 60, type: "boil" },
    { id: makeId(), variety: "Citra", alphaAcid: 12, grams: 28, timeMinutes: 10, type: "boil" },
  ]);

  const recipeShim = useMemo<Recipe>(() => {
    return {
      id: "calc",
      name: "calc",
      tags: [],
      currentVersion: 1,
      batchVolumeL,
      equipment: {
        boilTimeMin: 60,
        boilOffRateLPerHour: 3,
        mashEfficiencyPercent: 75,
        mashThicknessLPerKg: 3,
        grainAbsorptionLPerKg: 1,
        mashTunDeadspaceLiters: 0,
        mashTunLossLiters: 0,
        kettleLossLiters: 0,
        hopsAbsorptionLPerKg: 0.7,
        chillerLossLiters: 0,
        fermenterLossLiters: 0,
        coolingShrinkagePercent: 4,
      },
      fermentables: [],
      hops: additions.map<Hop>((a) => ({
        id: a.id,
        name: a.variety,
        alphaAcid: a.alphaAcid,
        grams: a.grams,
        type: a.type,
        timeMinutes: a.timeMinutes,
      })),
      yeasts: [],
      mashSteps: [],
      fermentationSteps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Recipe;
  }, [batchVolumeL, additions]);

  const ibu = recipeCalculationService.calculateIBU(recipeShim, og);
  const inRange = ibu >= IBU_STYLE_LO && ibu <= IBU_STYLE_HI;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <HSNumberField label="Batch volume" value={batchVolumeL} onChange={setBatchVolumeL} step={0.5} unit="L" precision={1} accent={hsTokens.water} />
        <HSNumberField label="OG" value={og} onChange={setOg} step={0.001} precision={3} accent={hsTokens.malt} />
      </div>

      {/* Additions table */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <HSEyebrow>Hop additions</HSEyebrow>
          <button
            type="button"
            onClick={() =>
              setAdditions((prev) => [
                ...prev,
                { id: makeId(), variety: "New hop", alphaAcid: 10, grams: 28, timeMinutes: 15, type: "boil" },
              ])
            }
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              background: hsTokens.paper,
              padding: "4px 10px",
              cursor: "pointer",
              color: hsTokens.ink,
            }}
          >
            + Add
          </button>
        </div>
        <div
          style={{
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 12,
            background: hsTokens.cream2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 1.4fr) 70px 80px 70px minmax(90px, 1fr) 28px",
              gap: 0,
              padding: "8px 12px",
              background: hsTokens.cream,
              borderBottom: `1.5px solid ${hsTokens.ink}`,
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            <span>Variety</span>
            <span style={{ textAlign: "right" }}>AA%</span>
            <span style={{ textAlign: "right" }}>g</span>
            <span style={{ textAlign: "right" }}>min</span>
            <span>Type</span>
            <span />
          </div>
          {additions.map((a) => (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1.4fr) 70px 80px 70px minmax(90px, 1fr) 28px",
                gap: 6,
                padding: "8px 12px",
                alignItems: "center",
                borderBottom: `1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent)`,
              }}
            >
              <input
                type="text"
                value={a.variety}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, variety: e.target.value } : x))
                  )
                }
                style={inputStyle()}
              />
              <input
                type="number"
                step={0.1}
                value={a.alphaAcid}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, alphaAcid: parseFloat(e.target.value) || 0 } : x))
                  )
                }
                style={{ ...inputStyle(), textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              />
              <input
                type="number"
                step={1}
                value={a.grams}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, grams: parseFloat(e.target.value) || 0 } : x))
                  )
                }
                style={{ ...inputStyle(), textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              />
              <input
                type="number"
                step={1}
                value={a.timeMinutes}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, timeMinutes: parseInt(e.target.value) || 0 } : x))
                  )
                }
                style={{ ...inputStyle(), textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              />
              <select
                value={a.type}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, type: e.target.value as Hop["type"] } : x))
                  )
                }
                style={{ ...inputStyle(), padding: "4px 6px" }}
              >
                <option value="boil">Boil</option>
                <option value="whirlpool">Whirlpool</option>
                <option value="first wort">First wort</option>
                <option value="dry hop">Dry hop</option>
                <option value="mash">Mash</option>
              </select>
              <button
                type="button"
                aria-label="Remove addition"
                onClick={() => setAdditions((prev) => prev.filter((x) => x.id !== a.id))}
                style={{
                  width: 24,
                  height: 24,
                  border: `1.5px solid ${hsTokens.ink}`,
                  background: hsTokens.paper,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  color: hsTokens.ink,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <ResultGauge
        label="Total IBU"
        value={Math.round(ibu).toString()}
        accent={accent}
        note={inRange ? "in range ✓" : "out of range"}
      />

      <div>
        <HSEyebrow>vs. example style range</HSEyebrow>
        <div style={{ marginTop: 8 }}>
          <HSRangeBar value={ibu} lo={IBU_STYLE_LO} hi={IBU_STYLE_HI} suffix=" IBU" fill={hsTokens.hops} />
        </div>
        <div style={{ marginTop: 6, fontFamily: hsTokens.body, fontSize: 11, color: hsTokens.muted }}>
          Example: American Pale Ale range, {IBU_STYLE_LO}–{IBU_STYLE_HI} IBU.
        </div>
      </div>
    </div>
  );
}

function inputStyle() {
  return {
    background: hsTokens.paper,
    border: `1px solid color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
    borderRadius: 6,
    padding: "4px 8px",
    fontFamily: hsTokens.body,
    fontSize: 13,
    color: hsTokens.ink,
    outline: "none",
    width: "100%",
    minWidth: 0,
  } as const;
}
