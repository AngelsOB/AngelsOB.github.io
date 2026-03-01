import { useMemo, useState } from "react";
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

  return (
    <div className="brew-section" data-accent="mash">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="brew-section-title">Boil-Off</h2>
        <span className="text-xs text-muted">pre-boil gravity method</span>
      </div>

      <p className="text-sm text-muted mb-5 leading-relaxed">
        Measure your pre-boil volume &amp; gravity, enter your target OG, and
        see how far you need to boil down.
      </p>

      {/* Inputs — 4 across on desktop, 2x2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Pre-Boil Vol
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              className="brew-input w-full tabular-nums"
              value={preVolInput}
              onChange={(e) => setPreVolInput(e.target.value)}
              placeholder="7.0"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted opacity-50">
              gal
            </span>
          </div>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Pre-Boil SG
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className="brew-input w-full tabular-nums"
            value={preGravInput}
            onChange={(e) => setPreGravInput(e.target.value)}
            placeholder="1.042"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Target OG
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className="brew-input w-full tabular-nums"
            value={targetOGInput}
            onChange={(e) => setTargetOGInput(e.target.value)}
            placeholder="1.054"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Boil-Off Rate
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              className="brew-input w-full tabular-nums"
              value={boilOffRate}
              onChange={(e) => setBoilOffRate(e.target.value)}
              placeholder="1.25"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted opacity-50">
              gal/hr
            </span>
          </div>
        </label>
      </div>

      {/* Results */}
      {calc.error ? (
        <div className="text-sm text-muted">{calc.error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {/* Primary result — larger */}
            <div className="brew-gauge">
              <div className="brew-gauge-label">Post-Boil Volume</div>
              <div className="brew-gauge-value text-3xl tabular-nums">
                {calc.postVol!.toFixed(2)}
                <span className="text-sm font-normal text-muted ml-1">gal</span>
              </div>
            </div>

            <div className="brew-gauge">
              <div className="brew-gauge-label">Boil Off</div>
              <div className="brew-gauge-value tabular-nums">
                {calc.boilOff!.toFixed(2)}
                <span className="text-sm font-normal text-muted ml-1">gal</span>
              </div>
            </div>

            <div className="brew-gauge">
              <div className="brew-gauge-label">Est. Boil Time</div>
              <div className="brew-gauge-value tabular-nums">
                {calc.boilTime != null ? Math.round(calc.boilTime) : "—"}
                <span className="text-sm font-normal text-muted ml-1">min</span>
              </div>
            </div>
          </div>

          {/* Formula breakdown */}
          <div className="text-[11px] text-muted opacity-50 font-mono tabular-nums">
            {calc.prePoints!.toFixed(1)} pts × {parseNum(preVolInput)!} gal ={" "}
            {calc.targetPoints!.toFixed(1)} pts × {calc.postVol!.toFixed(2)} gal
          </div>
        </div>
      )}
    </div>
  );
}
