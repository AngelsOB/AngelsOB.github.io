"use client";

import { useState } from "react";

import { dilutionWater, gravityPoints } from "@/calculators/dilution";
import { hsTokens } from "@/modules/builder/tokens";
import HSNumberField from "@/modules/builder/components/HSNumberField";
import ResultGauge from "./ResultGauge";

interface Props {
  accent?: string;
}

export default function DilutionCalculator({ accent = hsTokens.water }: Props) {
  const [vol, setVol] = useState(20);
  const [currentSG, setCurrentSG] = useState(1.072);
  const [targetSG, setTargetSG] = useState(1.06);

  const water = dilutionWater(vol, currentSG, targetSG);
  const valid =
    Number.isFinite(water) &&
    water > 0 &&
    targetSG < currentSG &&
    vol > 0 &&
    currentSG >= 1.0 &&
    targetSG >= 1.0;
  const totalVol = valid ? vol + water : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField
        label="Current volume"
        value={vol}
        onChange={setVol}
        step={0.5}
        unit="L"
        precision={1}
        accent={hsTokens.water}
      />
      <HSNumberField
        label="Current gravity"
        value={currentSG}
        onChange={setCurrentSG}
        step={0.001}
        precision={3}
        accent={hsTokens.malt}
      />
      <HSNumberField
        label="Target gravity"
        value={targetSG}
        onChange={setTargetSG}
        step={0.001}
        precision={3}
        accent={hsTokens.malt}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          gridColumn: "auto",
        }}
      >
        <ResultGauge
          label="Water to add"
          value={valid ? water.toFixed(2) : "—"}
          unit={valid ? "L" : undefined}
          accent={accent}
          note={valid ? "splash in" : "out of range"}
        />
        <ResultGauge
          label="Total volume"
          value={totalVol != null ? totalVol.toFixed(2) : "—"}
          unit={totalVol != null ? "L" : undefined}
          accent={hsTokens.malt}
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
        <span style={{ fontFamily: hsTokens.mono }}>
          {gravityPoints(currentSG).toFixed(1)}
        </span>{" "}
        pts × {vol.toFixed(1)} L ={" "}
        <span style={{ fontFamily: hsTokens.mono }}>
          {gravityPoints(targetSG).toFixed(1)}
        </span>{" "}
        pts ×{" "}
        {totalVol != null ? totalVol.toFixed(2) : "—"} L
      </div>
    </div>
  );
}
