"use client";

import { useState } from "react";

import { abvFromOGFG } from "@/calculators/abv";
import { hsTokens } from "@/modules/builder/tokens";
import HSNumberField from "@/modules/builder/components/HSNumberField";
import ResultGauge from "./ResultGauge";

interface Props {
  accent?: string;
}

export default function AbvCalculator({ accent = hsTokens.malt }: Props) {
  const [og, setOg] = useState(1.054);
  const [fg, setFg] = useState(1.012);

  const valid = og >= 0.99 && og <= 1.2 && fg >= 0.99 && fg <= 1.2 && fg <= og;
  const abv = valid ? abvFromOGFG(og, fg) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <HSNumberField
        label="OG"
        value={og}
        onChange={setOg}
        step={0.001}
        precision={3}
        accent={hsTokens.malt}
      />
      <HSNumberField
        label="FG"
        value={fg}
        onChange={setFg}
        step={0.001}
        precision={3}
        accent={hsTokens.yeast}
      />
      <div style={{ gridColumn: "1 / -1" }}>
        <ResultGauge
          label="Estimated ABV"
          value={abv != null ? abv.toFixed(2) : "—"}
          unit={abv != null ? "%" : undefined}
          accent={accent}
          note={
            abv == null
              ? "check inputs"
              : abv > 8
                ? "boozy!"
                : "looking good"
          }
        />
      </div>
    </div>
  );
}
