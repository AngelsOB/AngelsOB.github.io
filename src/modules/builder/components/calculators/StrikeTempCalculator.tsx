"use client";

import { useMemo, useState } from "react";

import {
  calculateStrikeTemp,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "@/calculators/strikeTemp";
import { hsTokens } from "@/modules/builder/tokens";
import HSNumberField from "@/modules/builder/components/HSNumberField";
import ResultGauge from "./ResultGauge";
import Segmented from "./Segmented";

type TempUnit = "C" | "F";

interface Props {
  accent?: string;
}

export default function StrikeTempCalculator({
  accent = hsTokens.roast,
}: Props) {
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");
  const [targetMash, setTargetMash] = useState(67);
  const [grainTemp, setGrainTemp] = useState(20);
  const [thickness, setThickness] = useState(3);

  const calc = useMemo(() => {
    const targetC =
      tempUnit === "F" ? fahrenheitToCelsius(targetMash) : targetMash;
    const grainC =
      tempUnit === "F" ? fahrenheitToCelsius(grainTemp) : grainTemp;

    if (targetC < 50 || targetC > 80)
      return { error: "Mash temp out of range (50–80°C)" };
    if (grainC < -10 || grainC > 40)
      return { error: "Grain temp out of range (-10 to 40°C)" };
    if (thickness < 1 || thickness > 8)
      return { error: "Thickness out of range (1–8 L/kg)" };

    const strikeC = calculateStrikeTemp(targetC, grainC, thickness);
    const strikeF = celsiusToFahrenheit(strikeC);
    return {
      error: null as string | null,
      strikeC,
      strikeF,
      targetC,
      grainC,
    };
  }, [tempUnit, targetMash, grainTemp, thickness]);

  function handleUnit(next: TempUnit) {
    if (next === tempUnit) return;
    const convert = next === "F" ? celsiusToFahrenheit : fahrenheitToCelsius;
    setTargetMash((t) => Number(convert(t).toFixed(1)));
    setGrainTemp((t) => Number(convert(t).toFixed(1)));
    setTempUnit(next);
  }

  const tempLabel = tempUnit === "C" ? "°C" : "°F";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
        }}
      >
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
          onChange={handleUnit}
          accent={accent}
          size="sm"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
        }}
      >
        <HSNumberField
          label="Target mash"
          value={targetMash}
          onChange={setTargetMash}
          step={0.5}
          unit={tempLabel}
          precision={1}
          accent={accent}
        />
        <HSNumberField
          label="Grain temp"
          value={grainTemp}
          onChange={setGrainTemp}
          step={0.5}
          unit={tempLabel}
          precision={1}
          accent={hsTokens.malt}
        />
        <HSNumberField
          label="Mash thickness"
          value={thickness}
          onChange={setThickness}
          step={0.1}
          unit="L/kg"
          precision={1}
          accent={hsTokens.water}
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
          <ResultGauge
            label="Strike water temperature"
            value={
              tempUnit === "C"
                ? calc.strikeC!.toFixed(1)
                : calc.strikeF!.toFixed(1)
            }
            unit={tempLabel}
            accent={accent}
            note={
              tempUnit === "C"
                ? `${calc.strikeF!.toFixed(1)} °F`
                : `${calc.strikeC!.toFixed(1)} °C`
            }
            size="lg"
          />
          <div
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
              opacity: 0.7,
            }}
          >
            {calc.strikeC!.toFixed(1)}°C = {calc.targetC!.toFixed(1)} + (0.41 ÷{" "}
            {thickness.toFixed(1)}) × ({calc.targetC!.toFixed(1)} −{" "}
            {calc.grainC!.toFixed(1)})
          </div>
        </>
      )}
    </div>
  );
}
