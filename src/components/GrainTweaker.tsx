"use client";

import { useState } from "react";
import { GRAIN_DEFAULTS, type GrainParams } from "./GrainOverlay";

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--fg-muted)" }}>{label}</span>
        <span className="font-mono text-xs tabular-nums" style={{ color: "var(--fg-strong)" }}>
          {step < 1 ? value.toFixed(2) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--brew-accent-500)" }}
      />
    </div>
  );
}

export default function GrainTweaker({
  params, onChange,
}: {
  params: GrainParams; onChange: (p: GrainParams) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const set = (key: keyof GrainParams, value: number) => onChange({ ...params, [key]: value });

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {isOpen && (
        <div
          className="w-64 rounded-2xl p-4 shadow-2xl"
          style={{
            background: "var(--brew-card)",
            border: "1px solid color-mix(in oklch, var(--fg-strong) 12%, transparent)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--brew-accent-600)", letterSpacing: "0.18em" }}>
              Grain
            </span>
            <button onClick={() => onChange(GRAIN_DEFAULTS)} className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Reset
            </button>
          </div>
          <div className="space-y-3">
            <Slider label="Opacity"    value={params.opacity}   min={0}   max={0.3} step={0.005} onChange={(v) => set("opacity",   v)} />
            <Slider label="Contrast"   value={params.contrast}  min={1}   max={6}   step={0.1}   onChange={(v) => set("contrast",  v)} />
            <Slider label="Grain size" value={params.blockSize} min={1}   max={6}   step={0.5}   onChange={(v) => set("blockSize", v)} />
            <Slider label="Octaves"    value={params.octaves}   min={1}   max={6}   step={1}     onChange={(v) => set("octaves",   v)} />
            <Slider label="Seed"       value={params.seed}      min={0}   max={99}  step={1}     onChange={(v) => set("seed",      v)} />
            {/* Blue noise toggle */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: "var(--fg-muted)" }}>Blue noise</span>
                <span className="text-[10px] leading-tight" style={{ color: "var(--fg-muted)", opacity: 0.6 }}>
                  High-pass · even distribution
                </span>
              </div>
              <button
                onClick={() => onChange({ ...params, blueNoise: !params.blueNoise })}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{
                  background: params.blueNoise
                    ? "var(--brew-accent-500)"
                    : "color-mix(in oklch, var(--fg-strong) 18%, transparent)",
                }}
                aria-pressed={params.blueNoise}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ left: params.blueNoise ? "calc(100% - 18px)" : "2px" }}
                />
              </button>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-snug" style={{ color: "var(--fg-muted)" }}>
            Copy final values → GrainOverlay GRAIN_DEFAULTS
          </p>
        </div>
      )}
      <button onClick={() => setIsOpen((v) => !v)} className="brew-btn-ghost !rounded-xl !px-3 !py-2 text-xs font-semibold shadow-lg">
        ◈ Grain
      </button>
    </div>
  );
}
