"use client";

import { useState } from "react";

import { postBoilVolume, gravityPoints } from "@/calculators/boilOff";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSNumberField from "@/modules/hopskip/components/HSNumberField";
import ResultGauge from "./ResultGauge";

interface Props {
  accent?: string;
}

export default function BoilOffCalculator({ accent = hsTokens.roast }: Props) {
  const [preBoilVol, setPreBoilVol] = useState(28);
  const [preBoilSG, setPreBoilSG] = useState(1.042);
  const [targetOG, setTargetOG] = useState(1.054);
  const [boilOffRate, setBoilOffRate] = useState(4);

  const postBoil = postBoilVolume(preBoilVol, preBoilSG, targetOG);
  const boilOff = preBoilVol - postBoil;
  const valid =
    Number.isFinite(postBoil) &&
    postBoil > 0 &&
    preBoilSG < targetOG &&
    preBoilVol > 0;
  const boilTimeMin =
    valid && boilOffRate > 0 ? (boilOff / boilOffRate) * 60 : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField
        label="Pre-boil volume"
        value={preBoilVol}
        onChange={setPreBoilVol}
        step={0.5}
        unit="L"
        precision={1}
        accent={hsTokens.water}
      />
      <HSNumberField
        label="Pre-boil gravity"
        value={preBoilSG}
        onChange={setPreBoilSG}
        step={0.001}
        precision={3}
        accent={hsTokens.malt}
      />
      <HSNumberField
        label="Target OG"
        value={targetOG}
        onChange={setTargetOG}
        step={0.001}
        precision={3}
        accent={hsTokens.malt}
      />
      <HSNumberField
        label="Boil-off rate"
        value={boilOffRate}
        onChange={setBoilOffRate}
        step={0.25}
        unit="L/hr"
        precision={2}
        accent={hsTokens.roast}
        hint="optional"
      />
      <div
        style={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        <ResultGauge
          label="Post-boil volume"
          value={valid ? postBoil.toFixed(1) : "—"}
          unit={valid ? "L" : undefined}
          accent={accent}
        />
        <ResultGauge
          label="Boil-off"
          value={valid ? boilOff.toFixed(1) : "—"}
          unit={valid ? "L" : undefined}
          accent={hsTokens.roast}
          note={
            valid ? `${((boilOff / preBoilVol) * 100).toFixed(1)}%` : undefined
          }
        />
        <ResultGauge
          label="Boil time"
          value={
            boilTimeMin != null && Number.isFinite(boilTimeMin)
              ? Math.round(boilTimeMin).toString()
              : "—"
          }
          unit={boilTimeMin != null ? "min" : undefined}
          accent={hsTokens.honey}
        />
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.muted,
        }}
      >
        Pre-boil points:{" "}
        <span style={{ fontFamily: hsTokens.mono }}>
          {gravityPoints(preBoilSG).toFixed(1)}
        </span>{" "}
        · Target points:{" "}
        <span style={{ fontFamily: hsTokens.mono }}>
          {gravityPoints(targetOG).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
