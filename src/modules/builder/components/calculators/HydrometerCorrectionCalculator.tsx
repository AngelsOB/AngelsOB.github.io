"use client";

import { useMemo, useState } from "react";

import { correctHydrometer } from "@/calculators/hydrometerCorrection";
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "@/calculators/carbonation";
import { hsTokens } from "@/modules/builder/tokens";
import HSNumberField from "@/modules/builder/components/HSNumberField";
import ResultGauge from "./ResultGauge";
import Segmented from "./Segmented";

type TempUnit = "C" | "F";
type CalPreset = "15" | "20";

interface Props {
  accent?: string;
}

export default function HydrometerCorrectionCalculator({
  accent = hsTokens.yeast,
}: Props) {
  const [sg, setSg] = useState(1.05);
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");
  const [temp, setTemp] = useState(30);
  const [calPreset, setCalPreset] = useState<CalPreset>("20");

  const calTempC = calPreset === "15" ? 15 : 20;

  const calc = useMemo(() => {
    if (sg < 0.98 || sg > 1.2)
      return { error: "Gravity reading out of range (0.98–1.20)" };

    const sampleC = tempUnit === "C" ? temp : fahrenheitToCelsius(temp);
    if (sampleC < 0 || sampleC > 100)
      return { error: "Temperature out of range (0–100°C)" };

    const corrected = correctHydrometer(sg, sampleC, calTempC);
    const correction = corrected - sg;
    return {
      error: null as string | null,
      corrected,
      correction,
      sampleC,
    };
  }, [sg, temp, tempUnit, calTempC]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            Calibrated at
          </span>
          <Segmented<CalPreset>
            ariaLabel="Calibration temperature"
            value={calPreset}
            options={[
              { value: "20", label: "20 / 68" },
              { value: "15", label: "15 / 59" },
            ]}
            onChange={setCalPreset}
            accent={accent}
            size="sm"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            Units
          </span>
          <Segmented<TempUnit>
            ariaLabel="Temperature unit"
            value={tempUnit}
            options={[
              { value: "C", label: "°C" },
              { value: "F", label: "°F" },
            ]}
            onChange={(next) => {
              if (next === tempUnit) return;
              const convert =
                next === "F" ? celsiusToFahrenheit : fahrenheitToCelsius;
              setTemp((t) => Number(convert(t).toFixed(1)));
              setTempUnit(next);
            }}
            accent={accent}
            size="sm"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <HSNumberField
          label="Reading"
          value={sg}
          onChange={setSg}
          step={0.001}
          precision={3}
          accent={hsTokens.malt}
        />
        <HSNumberField
          label="Sample temp"
          value={temp}
          onChange={setTemp}
          step={0.5}
          unit={tempUnit === "C" ? "°C" : "°F"}
          precision={1}
          accent={accent}
        />
      </div>

      {calc.error ? (
        <div
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
          }}
        >
          {calc.error}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <ResultGauge
              label="Corrected SG"
              value={calc.corrected!.toFixed(3)}
              accent={accent}
              note={calc.correction! > 0 ? "warmer reads low" : "cooler reads high"}
            />
            <ResultGauge
              label="Correction"
              value={`${calc.correction! >= 0 ? "+" : ""}${calc.correction!.toFixed(3)}`}
              accent={hsTokens.malt}
            />
          </div>
          <div
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
              opacity: 0.7,
            }}
          >
            {sg.toFixed(3)} @ {calc.sampleC!.toFixed(1)}°C → calibrated{" "}
            {calTempC}°C
          </div>
        </>
      )}
    </div>
  );
}
