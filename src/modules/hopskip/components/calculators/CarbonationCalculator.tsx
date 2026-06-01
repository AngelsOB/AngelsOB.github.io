"use client";

import { useMemo, useState } from "react";

import {
  carbonationPsi,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  psiToBar,
} from "@/calculators/carbonation";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSNumberField from "@/modules/hopskip/components/HSNumberField";
import ResultGauge from "./ResultGauge";
import Segmented from "./Segmented";

type TempUnit = "C" | "F";

interface Props {
  accent?: string;
}

export default function CarbonationCalculator({
  accent = hsTokens.water,
}: Props) {
  const [volumes, setVolumes] = useState(2.4);
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");
  const [temp, setTemp] = useState(4);

  const calc = useMemo(() => {
    if (volumes < 0.5 || volumes > 5)
      return { error: "CO₂ volumes out of range (0.5–5.0)" };

    const tempF = tempUnit === "C" ? celsiusToFahrenheit(temp) : temp;
    const tempC = tempUnit === "F" ? fahrenheitToCelsius(temp) : temp;
    if (tempC < -2 || tempC > 30)
      return { error: "Temperature out of range (-2 to 30°C)" };

    const psi = carbonationPsi(tempF, volumes);
    const bar = psiToBar(psi);
    return { error: null as string | null, psi, bar, tempC, tempF };
  }, [volumes, temp, tempUnit]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <HSNumberField
          label="Target CO₂"
          value={volumes}
          onChange={setVolumes}
          step={0.1}
          unit="vols"
          precision={1}
          accent={accent}
          min={0.5}
          max={5}
        />
        <HSNumberField
          label="Beer temp"
          value={temp}
          onChange={setTemp}
          step={0.5}
          unit={tempUnit === "C" ? "°C" : "°F"}
          precision={1}
          accent={hsTokens.malt}
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
              label="Regulator pressure"
              value={calc.psi!.toFixed(1)}
              unit="psi"
              accent={accent}
              note="set the gauge"
            />
            <ResultGauge
              label="Metric"
              value={calc.bar!.toFixed(2)}
              unit="bar"
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
            {volumes.toFixed(1)} vols @ {calc.tempC!.toFixed(1)}°C /{" "}
            {calc.tempF!.toFixed(1)}°F
          </div>
        </>
      )}
    </div>
  );
}
