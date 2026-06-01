"use client";

import { useMemo, useState } from "react";

import type { Hop, Recipe } from "@/modules/beta-builder/domain/models/Recipe";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import HSNumberField from "@/modules/hopskip/components/HSNumberField";
import HSRangeBar from "@/modules/hopskip/components/HSRangeBar";
import ResultGauge from "./ResultGauge";

interface Props {
  accent?: string;
}

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

export default function IbuCalculator({ accent = hsTokens.hops }: Props) {
  const [batchVolumeL, setBatchVolumeL] = useState(20);
  const [og, setOg] = useState(1.054);
  const [additions, setAdditions] = useState<IbuAddition[]>([
    {
      id: makeId(),
      variety: "Cascade",
      alphaAcid: 5.5,
      grams: 28,
      timeMinutes: 60,
      type: "boil",
    },
    {
      id: makeId(),
      variety: "Citra",
      alphaAcid: 12,
      grams: 28,
      timeMinutes: 10,
      type: "boil",
    },
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
        <HSNumberField
          label="Batch volume"
          value={batchVolumeL}
          onChange={setBatchVolumeL}
          step={0.5}
          unit="L"
          precision={1}
          accent={hsTokens.water}
        />
        <HSNumberField
          label="OG"
          value={og}
          onChange={setOg}
          step={0.001}
          precision={3}
          accent={hsTokens.malt}
        />
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <HSEyebrow>Hop additions</HSEyebrow>
          <button
            type="button"
            onClick={() =>
              setAdditions((prev) => [
                ...prev,
                {
                  id: makeId(),
                  variety: "New hop",
                  alphaAcid: 10,
                  grams: 28,
                  timeMinutes: 15,
                  type: "boil",
                },
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
              gridTemplateColumns:
                "minmax(120px, 1.4fr) 70px 80px 70px minmax(90px, 1fr) 28px",
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
                gridTemplateColumns:
                  "minmax(120px, 1.4fr) 70px 80px 70px minmax(90px, 1fr) 28px",
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
                    prev.map((x) =>
                      x.id === a.id ? { ...x, variety: e.target.value } : x,
                    ),
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
                    prev.map((x) =>
                      x.id === a.id
                        ? {
                            ...x,
                            alphaAcid: parseFloat(e.target.value) || 0,
                          }
                        : x,
                    ),
                  )
                }
                style={{
                  ...inputStyle(),
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <input
                type="number"
                step={1}
                value={a.grams}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) =>
                      x.id === a.id
                        ? { ...x, grams: parseFloat(e.target.value) || 0 }
                        : x,
                    ),
                  )
                }
                style={{
                  ...inputStyle(),
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <input
                type="number"
                step={1}
                value={a.timeMinutes}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) =>
                      x.id === a.id
                        ? {
                            ...x,
                            timeMinutes: parseInt(e.target.value) || 0,
                          }
                        : x,
                    ),
                  )
                }
                style={{
                  ...inputStyle(),
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <select
                value={a.type}
                onChange={(e) =>
                  setAdditions((prev) =>
                    prev.map((x) =>
                      x.id === a.id
                        ? { ...x, type: e.target.value as Hop["type"] }
                        : x,
                    ),
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
                onClick={() =>
                  setAdditions((prev) => prev.filter((x) => x.id !== a.id))
                }
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
          <HSRangeBar
            value={ibu}
            lo={IBU_STYLE_LO}
            hi={IBU_STYLE_HI}
            suffix=" IBU"
            fill={hsTokens.hops}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: hsTokens.body,
            fontSize: 11,
            color: hsTokens.muted,
          }}
        >
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
