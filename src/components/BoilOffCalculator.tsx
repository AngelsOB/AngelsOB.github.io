import { useMemo, useState } from "react";
import CalculatorCard from "./CalculatorCard";
import { postBoilVolume, gravityPoints } from "../calculators/boilOff";

function parseNum(input: string): number | null {
  const v = input.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function BoilOffCalculator() {
  const [preVolInput, setPreVolInput] = useState("7");
  const [preGravInput, setPreGravInput] = useState("1.042");
  const [targetOGInput, setTargetOGInput] = useState("1.054");
  const [boilOffRate, setBoilOffRate] = useState("1.25");

  const calc = useMemo(() => {
    const preVol = parseNum(preVolInput);
    const preSG = parseNum(preGravInput);
    const targetOG = parseNum(targetOGInput);
    const rate = parseNum(boilOffRate);

    if (preVol == null || preSG == null || targetOG == null)
      return { error: "Fill in volume, gravity, and target OG" };

    if (preVol <= 0) return { error: "Pre-boil volume must be > 0" };
    if (preSG < 1.0 || preSG > 1.2) return { error: "Pre-boil gravity out of range" };
    if (targetOG < 1.0 || targetOG > 1.2) return { error: "Target OG out of range" };
    if (preSG >= targetOG)
      return { error: "Pre-boil gravity must be lower than target OG" };

    const postVol = postBoilVolume(preVol, preSG, targetOG);
    if (!Number.isFinite(postVol) || postVol <= 0)
      return { error: "Invalid result" };

    const boilOff = preVol - postVol;
    const boilTime = rate && rate > 0 ? (boilOff / rate) * 60 : null;

    return {
      error: null,
      postVol,
      boilOff,
      boilTime,
      prePoints: gravityPoints(preSG),
      targetPoints: gravityPoints(targetOG),
    };
  }, [preVolInput, preGravInput, targetOGInput, boilOffRate]);

  const inputClass =
    "w-full rounded-md border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-600)]";

  return (
    <CalculatorCard title="Boil-Off / Pre-Boil Gravity">
      <p className="text-xs text-muted leading-relaxed">
        Measure your pre-boil volume &amp; gravity, enter your target OG, and
        see how far you need to boil down.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <div className="text-sm text-muted mb-1">Pre-Boil Volume</div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              className={inputClass}
              value={preVolInput}
              onChange={(e) => setPreVolInput(e.target.value)}
              placeholder="7.0"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
              gal
            </span>
          </div>
        </label>

        <label className="block">
          <div className="text-sm text-muted mb-1">Pre-Boil Gravity</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className={inputClass}
            value={preGravInput}
            onChange={(e) => setPreGravInput(e.target.value)}
            placeholder="1.042"
          />
        </label>

        <label className="block">
          <div className="text-sm text-muted mb-1">Target OG</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className={inputClass}
            value={targetOGInput}
            onChange={(e) => setTargetOGInput(e.target.value)}
            placeholder="1.054"
          />
        </label>
      </div>

      <label className="block">
        <div className="text-sm text-muted mb-1">
          Boil-Off Rate{" "}
          <span className="text-xs opacity-60">(optional, for time estimate)</span>
        </div>
        <div className="relative max-w-48">
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            className={inputClass}
            value={boilOffRate}
            onChange={(e) => setBoilOffRate(e.target.value)}
            placeholder="1.25"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
            gal/hr
          </span>
        </div>
      </label>

      <div className="mt-1">
        {calc.error ? (
          <div className="text-sm text-muted">{calc.error}</div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border bg-emerald-500/10 px-4 py-3">
              <div className="text-sm text-muted">Target Post-Boil Volume</div>
              <div className="text-3xl font-semibold tracking-tight">
                {calc.postVol!.toFixed(2)}{" "}
                <span className="text-base font-normal text-muted">gal</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs text-muted">Boil Off</div>
                <div className="text-lg font-semibold">
                  {calc.boilOff!.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted">gal</span>
                </div>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs text-muted">Est. Boil Time</div>
                <div className="text-lg font-semibold">
                  {calc.boilTime != null
                    ? `${Math.round(calc.boilTime)} min`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted opacity-70 pt-1">
              {calc.prePoints!.toFixed(1)} pts × {parseNum(preVolInput)!} gal ={" "}
              {calc.targetPoints!.toFixed(1)} pts × {calc.postVol!.toFixed(2)} gal
            </div>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
