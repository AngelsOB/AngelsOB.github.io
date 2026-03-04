'use client';

import { useMemo, useState } from "react";
import CalculatorCard from "./CalculatorCard";
import {
  ibuTotal,
  type HopAddition,
  type HopTimingType,
} from "../calculators/ibu";

type VolumeUnit = "L" | "gal";

export default function IbuCalculator() {
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("L");
  const [postBoilVolume, setPostBoilVolume] = useState<string>("20"); // L by default
  const [og, setOg] = useState<string>("1.050");
  const [hops, setHops] = useState<
    Array<{
      grams: string;
      aa: string;
      type: HopTimingType;
      time: string; // boil/first-wort minutes
      wpTemp?: string; // whirlpool °C
      wpTime?: string; // whirlpool minutes
    }>
  >([{ grams: "20", aa: "10", type: "boil", time: "60" }]);

  const liters = useMemo(() => {
    const v = Number(postBoilVolume);
    if (!Number.isFinite(v) || v <= 0) return null;
    return volumeUnit === "L" ? v : v / 0.264172;
  }, [postBoilVolume, volumeUnit]);

  const ibu = useMemo(() => {
    const gravity = Number(og);
    if (!Number.isFinite(gravity) || gravity < 1 || gravity > 1.2) return null;
    if (liters == null) return null;
    const additions: HopAddition[] = hops
      .map((h) => {
        const base: HopAddition = {
          weightGrams: Number(h.grams),
          alphaAcidPercent: Number(h.aa),
          boilTimeMinutes: 0,
          type: h.type,
        };
        if (h.type === "boil" || h.type === "first wort") {
          base.boilTimeMinutes = Number(h.time);
        } else if (h.type === "whirlpool") {
          base.whirlpoolTempC = Number(h.wpTemp);
          base.whirlpoolTimeMinutes = Number(h.wpTime);
        }
        return base;
      })
      .filter((a) => {
        if (
          !Number.isFinite(a.weightGrams) ||
          !Number.isFinite(a.alphaAcidPercent) ||
          a.weightGrams <= 0 ||
          a.alphaAcidPercent <= 0
        )
          return false;
        switch (a.type) {
          case "boil":
          case "first wort":
            return Number.isFinite(a.boilTimeMinutes) && a.boilTimeMinutes >= 0;
          case "whirlpool":
            return (
              Number.isFinite(a.whirlpoolTimeMinutes) &&
              Number.isFinite(a.whirlpoolTempC)
            );
          default:
            // dry hop / mash -> allowed, will count as 0 IBU
            return true;
        }
      });
    if (additions.length === 0) return null;
    return ibuTotal(additions, liters, gravity);
  }, [hops, liters, og]);

  return (
    <CalculatorCard title="IBU (Tinseth)">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <div className="text-sm text-muted mb-1">Post-boil Volume</div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              className="w-full rounded-md border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-600)]"
              value={postBoilVolume}
              onChange={(e) => setPostBoilVolume(e.target.value)}
              placeholder={volumeUnit === "L" ? "20" : "5"}
            />
            <select
              className="rounded-md border px-2 py-2"
              value={volumeUnit}
              onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}
            >
              <option value="L">L</option>
              <option value="gal">gal</option>
            </select>
          </div>
        </label>

        <label className="block">
          <div className="text-sm text-muted mb-1">Original Gravity</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.2"
            className="w-full rounded-md border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            value={og}
            onChange={(e) => setOg(e.target.value)}
            placeholder="1.050"
          />
        </label>
      </div>

      <div className="mt-3 space-y-3">
        {hops.map((h, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-start">
            <select
              aria-label="Method"
              className="rounded-md border px-2 py-2"
              value={h.type}
              onChange={(e) => {
                const c = [...hops];
                c[i] = { ...c[i], type: e.target.value as HopTimingType };
                setHops(c);
              }}
            >
              <option value="boil">Boil</option>
              <option value="whirlpool">Whirlpool</option>
              <option value="first wort">First Wort</option>
              <option value="dry hop">Dry Hop</option>
              <option value="mash">Mash</option>
            </select>
            <input
              aria-label="Grams"
              type="number"
              min="0"
              step="0.1"
              className="rounded-md border px-3 py-2"
              value={h.grams}
              onChange={(e) => {
                const c = [...hops];
                c[i] = { ...c[i], grams: e.target.value };
                setHops(c);
              }}
              placeholder="20"
            />
            <input
              aria-label="Alpha %"
              type="number"
              min="0"
              step="0.1"
              className="rounded-md border px-3 py-2"
              value={h.aa}
              onChange={(e) => {
                const c = [...hops];
                c[i] = { ...c[i], aa: e.target.value };
                setHops(c);
              }}
              placeholder="10"
            />
            {h.type === "whirlpool" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Temp °C"
                  type="number"
                  min="0"
                  step="0.1"
                  className="rounded-md border px-3 py-2"
                  value={h.wpTemp ?? "80"}
                  onChange={(e) => {
                    const c = [...hops];
                    c[i] = { ...c[i], wpTemp: e.target.value };
                    setHops(c);
                  }}
                  placeholder="80"
                />
                <input
                  aria-label="WP Minutes"
                  type="number"
                  min="0"
                  step="1"
                  className="rounded-md border px-3 py-2"
                  value={h.wpTime ?? "15"}
                  onChange={(e) => {
                    const c = [...hops];
                    c[i] = { ...c[i], wpTime: e.target.value };
                    setHops(c);
                  }}
                  placeholder="15"
                />
              </div>
            ) : (
              <input
                aria-label="Minutes"
                type="number"
                min="0"
                step="1"
                className="rounded-md border px-3 py-2"
                value={h.time}
                onChange={(e) => {
                  const c = [...hops];
                  c[i] = { ...c[i], time: e.target.value };
                  setHops(c);
                }}
                placeholder="60"
              />
            )}
          </div>
        ))}
        <div>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-white/10"
            onClick={() =>
              setHops((h) => [
                ...h,
                { grams: "", aa: "", type: "boil", time: "" },
              ])
            }
          >
            + Hop Addition
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="rounded-lg border bg-emerald-500/10 px-4 py-3">
          <div className="text-sm text-muted">Estimated IBU</div>
          <div className="text-3xl font-semibold tracking-tight">
            {ibu != null ? ibu.toFixed(1) : "—"}
          </div>
        </div>
      </div>
    </CalculatorCard>
  );
}
