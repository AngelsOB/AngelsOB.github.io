"use client";

import { useEffect, useMemo, useState } from "react";
import FlavorRadar, { type RadarAxis } from "./FlavorRadar";
import type { HopFlavorProfile } from "@/modules/recipe/models/Presets";
import type { MaltFlavorProfile } from "@/modules/corpus-lab/maltFlavor";
import type { SteeringQuery, SteeringResult } from "@/modules/corpus-lab/steering/RecipeSteeringService";
import { getBjcpCategories } from "@/utils/bjcp";

// Real BJCP style list (the same one matchBjcpStyle resolves against) —
// "code. name" as both the label and the value guarantees an exact,
// leading-code match every time, never a free-text near-miss.
const STYLE_CATEGORIES = getBjcpCategories().map((cat) => ({
  label: `${cat.code}. ${cat.name}`,
  options: cat.styles.map((s) => `${s.code}. ${s.name}`),
}));

// Mirrors corpus-lab/maltFlavor.ts's MALT_FLAVOR_KEYS order — that file is
// deliberately self-contained ("promoted into the app's data layer only at
// integration time"), so duplicating the 9 keys here (type-checked against
// the real MaltFlavorProfile type below) is the documented way to consume it
// from outside the lab before that integration happens. Only TYPES are
// imported from corpus-lab on this page — see route.ts for the one real
// runtime exception.
type HopKey = keyof HopFlavorProfile;
type MaltKey = keyof MaltFlavorProfile;

const HOP_AXES: RadarAxis[] = [
  { key: "citrus", label: "Citrus", color: "#facc15" },
  { key: "tropicalFruit", label: "Tropical", color: "#fb923c" },
  { key: "stoneFruit", label: "Stone Fruit", color: "#f97316" },
  { key: "berry", label: "Berry", color: "#a855f7" },
  { key: "floral", label: "Floral", color: "#f472b6" },
  { key: "grassy", label: "Grassy", color: "#84cc16" },
  { key: "herbal", label: "Herbal", color: "#22c55e" },
  { key: "spice", label: "Spice", color: "#ef4444" },
  { key: "resinPine", label: "Resin/Pine", color: "#16a34a" },
];

const MALT_AXES: RadarAxis[] = [
  { key: "grainy", label: "Grainy", color: "#eab308" },
  { key: "biscuit", label: "Biscuit", color: "#d97706" },
  { key: "caramel", label: "Caramel", color: "#f59e0b" },
  { key: "darkFruit", label: "Dark Fruit", color: "#a855f7" },
  { key: "chocolate", label: "Chocolate", color: "#78350f" },
  { key: "coffee", label: "Coffee", color: "#57534e" },
  { key: "roast", label: "Roast", color: "#1c1917" },
  { key: "nutty", label: "Nutty", color: "#b45309" },
  { key: "honey", label: "Honey", color: "#facc15" },
];

// Fallback per-axis ceilings (from the cloud audit, p99 rounded up) used before
// the live axisMax arrives from the engine. Malt axes are heavily compressed —
// a shared 0-5 radar would squash every malt polygon into a tiny centre blob.
const DEFAULT_MALT_MAX: Record<string, number> = { grainy: 1.5, biscuit: 2.5, caramel: 2.5, darkFruit: 2, chocolate: 2.5, coffee: 2.5, roast: 2.5, nutty: 1.5, honey: 2 };
const DEFAULT_HOP_MAX: Record<string, number> = { citrus: 5, tropicalFruit: 4.5, stoneFruit: 3, berry: 3, floral: 3.5, spice: 3, herbal: 3, grassy: 2, resinPine: 4 };
// Fallback maltBody range (robust p1..p99 from the cloud) used before the live
// bodyRange arrives from the engine. The UI shows a normalized 0-100% "thin →
// full" dial and maps it onto this raw range — no more inscrutable -0.3..0.45.
const DEFAULT_BODY_RANGE = { min: -0.3, mid: 0.05, max: 0.45 };

/** Round a raw p99 ceiling up to a tidy radar max (nearest 0.5, floor 1). */
const niceMax = (v: number) => Math.max(1, Math.ceil(v * 2) / 2);

/** Attach each axis's own display ceiling — live engine axisMax if we have it, else the audited fallback. */
function axesWithMax(axes: RadarAxis[], live: Record<string, number> | undefined, fallback: Record<string, number>): RadarAxis[] {
  return axes.map((a) => ({ ...a, max: niceMax(live?.[a.key] ?? fallback[a.key] ?? 5) }));
}

type AxisOverride = { enabled: boolean; value: number };
const axisDefaults = (axes: RadarAxis[]): Record<string, AxisOverride> =>
  Object.fromEntries(axes.map((a) => [a.key, { enabled: false, value: 2.5 }]));

type ScalarOverride = AxisOverride;

type FormState = {
  style: string;
  k: number;
  styleGate: "family" | "strict" | "none";
  yeastName: string;
  /** 0-1 how adventurous the ingredient picks are; 0 = always the popular choice. */
  exploration: number;
  /** Independent reroll seeds — bump one to reroll that bill while the other stays put. */
  gristVariation: number;
  hopVariation: number;
  abv: ScalarOverride;
  ibu: ScalarOverride;
  srm: ScalarOverride;
  body: ScalarOverride;
  hop: Record<HopKey, AxisOverride>;
  malt: Record<MaltKey, AxisOverride>;
};

const INITIAL_STATE: FormState = {
  style: "21A. American IPA",
  k: 40,
  styleGate: "family",
  yeastName: "",
  exploration: 0,
  gristVariation: 0,
  hopVariation: 0,
  abv: { enabled: false, value: 6.5 },
  ibu: { enabled: false, value: 50 },
  srm: { enabled: false, value: 8 },
  body: { enabled: false, value: 50 }, // 0-100% "thin → full" dial (mapped to raw maltBody in buildQuery)
  hop: axisDefaults(HOP_AXES) as Record<HopKey, AxisOverride>,
  malt: axisDefaults(MALT_AXES) as Record<MaltKey, AxisOverride>,
};

function buildQuery(form: FormState, bodyRange: { min: number; max: number }): SteeringQuery {
  const hop: Partial<HopFlavorProfile> = {};
  for (const ax of HOP_AXES) {
    const o = form.hop[ax.key as HopKey];
    if (o.enabled) hop[ax.key as HopKey] = o.value;
  }
  const malt: Partial<MaltFlavorProfile> = {};
  for (const ax of MALT_AXES) {
    const o = form.malt[ax.key as MaltKey];
    if (o.enabled) malt[ax.key as MaltKey] = o.value;
  }
  const target: SteeringQuery["target"] = {};
  if (Object.keys(hop).length) target.hop = hop;
  if (Object.keys(malt).length) target.malt = malt;
  if (form.abv.enabled) target.abv = form.abv.value;
  if (form.ibu.enabled) target.ibu = form.ibu.value;
  if (form.srm.enabled) target.srm = form.srm.value;
  // Map the 0-100% "thin → full" dial onto the cloud's real maltBody range.
  if (form.body.enabled) target.body = bodyRange.min + (form.body.value / 100) * (bodyRange.max - bodyRange.min);

  return {
    style: form.style,
    k: form.k,
    styleGate: form.styleGate,
    yeastName: form.yeastName.trim() || undefined,
    exploration: form.exploration,
    gristVariation: form.gristVariation,
    hopVariation: form.hopVariation,
    target: Object.keys(target).length ? target : undefined,
  };
}

function ScalarRow({
  label,
  override,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  override: ScalarOverride;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: ScalarOverride) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <input
        type="checkbox"
        checked={override.enabled}
        onChange={(e) => onChange({ ...override, enabled: e.target.checked })}
        className="shrink-0"
      />
      <span className="w-24 shrink-0 truncate text-xs">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={override.value}
        disabled={!override.enabled}
        onChange={(e) => onChange({ ...override, value: parseFloat(e.target.value) })}
        className="flex-1 disabled:opacity-30"
      />
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-500">
        {override.value.toFixed(unit === "%" ? 1 : 0)}
        {unit}
      </span>
    </div>
  );
}

function hopTimingLabel(h: SteeringResult["recipe"]["hops"][number]): string {
  if (h.type === "dry hop") return `${h.dryHopDays}d dry hop`;
  if (h.type === "whirlpool") return `${h.whirlpoolTimeMinutes}min whirlpool`;
  if (h.type === "first wort") return "first wort (full boil)";
  return `${h.timeMinutes}min ${h.type}`;
}

export default function SteeringPlaygroundClient() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [result, setResult] = useState<SteeringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The style's norm band + per-axis ceilings, fetched with a no-target steer
  // whenever the style changes, so the interactive radars show where each
  // flavour typically sits for THIS style before you push anything.
  const [norms, setNorms] = useState<SteeringResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lab/steering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: form.style, k: form.k, styleGate: form.styleGate }),
    })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j && !j.error) setNorms(j as SteeringResult); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on style only; k/gate rarely matter for the norm band
  }, [form.style]);

  // Rim = axisMax (typical ceiling); the radar is the "normal" zone and a push
  // runs off the charts past the rim — same scale the Studio wheels use.
  const hopAxes = useMemo(() => axesWithMax(HOP_AXES, norms?.axisMax.hop as Record<string, number> | undefined, DEFAULT_HOP_MAX), [norms]);
  const maltAxes = useMemo(() => axesWithMax(MALT_AXES, norms?.axisMax.malt as Record<string, number> | undefined, DEFAULT_MALT_MAX), [norms]);

  const liveRequestedHop = useMemo(() => {
    const values: Record<string, number> = {};
    for (const ax of HOP_AXES) if (form.hop[ax.key as HopKey].enabled) values[ax.key] = form.hop[ax.key as HopKey].value;
    return values;
  }, [form.hop]);
  const liveRequestedMalt = useMemo(() => {
    const values: Record<string, number> = {};
    for (const ax of MALT_AXES) if (form.malt[ax.key as MaltKey].enabled) values[ax.key] = form.malt[ax.key as MaltKey].value;
    return values;
  }, [form.malt]);

  // Click/drag on an axis -> set that flavour push (clear it if dragged to ~0).
  const setHopAxis = (key: string, value: number) =>
    setForm((f) => ({ ...f, hop: { ...f.hop, [key]: { enabled: value > 0.05, value: Math.round(value * 20) / 20 } } }));
  const setMaltAxis = (key: string, value: number) =>
    setForm((f) => ({ ...f, malt: { ...f.malt, [key]: { enabled: value > 0.05, value: Math.round(value * 20) / 20 } } }));
  const clearPushes = () =>
    setForm((f) => ({ ...f, hop: axisDefaults(HOP_AXES) as Record<HopKey, AxisOverride>, malt: axisDefaults(MALT_AXES) as Record<MaltKey, AxisOverride> }));

  async function runQuery(state: FormState) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lab/steering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildQuery(state, norms?.bodyRange ?? DEFAULT_BODY_RANGE)),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        setResult(null);
      } else {
        setResult(json as SteeringResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const handleCalculate = () => runQuery(form);
  // Reroll bumps a seed AND recomputes — grain and hops reroll independently, so
  // "↻ Grain" keeps the hops (and vice versa): lock one, reroll the other.
  const reroll = (which: "both" | "grain" | "hops") => {
    const next = {
      ...form,
      gristVariation: form.gristVariation + (which !== "hops" ? 1 : 0),
      hopVariation: form.hopVariation + (which !== "grain" ? 1 : 0),
    };
    setForm(next);
    runQuery(next);
  };

  const totalKg = result ? result.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) : 0;

  return (
    <div style={{ colorScheme: "light" }}>
      {/* Force light-mode native form-control rendering: without this, a `dark`
          ancestor class flips native <select>/<input> chrome to a dark
          background, and our explicit dark text (assuming a light one)
          becomes unreadable dark-on-dark. Set once here so it cascades to
          every control on the page instead of patching each one. */}
      {/* Always-visible action bar — style + Calculate live here, never scroll out of reach.
          Inline styles on purpose: guaranteed visible regardless of the app's theme/Tailwind setup. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 24px",
          background: "#111827",
          color: "white",
          borderBottom: "1px solid #374151",
        }}
      >
        <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>Steering Playground</strong>
        <select
          value={form.style}
          onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
          style={{ flex: 1, maxWidth: 420, padding: "6px 8px", borderRadius: 4, background: "white", color: "#111827" }}
        >
          {STYLE_CATEGORIES.map((cat) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={handleCalculate}
          disabled={loading || !form.style}
          style={{
            background: loading || !form.style ? "#475569" : "#2563eb",
            color: "white",
            padding: "8px 20px",
            borderRadius: 6,
            fontWeight: 600,
            border: "none",
            cursor: loading || !form.style ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Calculating…" : "Calculate"}
        </button>
        {error && <span style={{ color: "#fca5a5", fontSize: 12 }}>{error}</span>}
      </div>

      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-gray-500">
          Pick a style up top, push whatever flavour axes you care about below, leave the rest unchecked (they
          default to that style&apos;s own median). Hits the real 148k-recipe cloud on the server — first
          calculation loads it and can take a few seconds.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* ── query form ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                k (neighbours)
              <input
                type="number"
                min={5}
                max={100}
                className="mt-1 w-full rounded border px-2 py-1"
                value={form.k}
                onChange={(e) => setForm((f) => ({ ...f, k: parseInt(e.target.value, 10) || 20 }))}
              />
            </label>
            <label className="text-sm">
              Style gate
              <select
                className="mt-1 w-full rounded border px-2 py-1"
                value={form.styleGate}
                onChange={(e) => setForm((f) => ({ ...f, styleGate: e.target.value as FormState["styleGate"] }))}
              >
                <option value="family">family (default)</option>
                <option value="strict">strict</option>
                <option value="none">none</option>
              </select>
            </label>
            <label className="text-sm">
              Yeast override (optional)
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={form.yeastName}
                onChange={(e) => setForm((f) => ({ ...f, yeastName: e.target.value }))}
                placeholder="e.g. SafAle US-05"
              />
            </label>
            <label className="text-sm">
              Adventurousness ({form.exploration.toFixed(2)})
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="mt-1 w-full"
                value={form.exploration}
                onChange={(e) => setForm((f) => ({ ...f, exploration: parseFloat(e.target.value) }))}
              />
            </label>
            <div className="flex items-end gap-1" title={form.exploration <= 0 ? "Raise adventurousness above 0 to reroll" : undefined}>
              {(["both", "grain", "hops"] as const).map((which) => (
                <button
                  key={which}
                  onClick={() => reroll(which)}
                  disabled={loading || form.exploration <= 0}
                  className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-30"
                  title={which === "both" ? "Reroll both bills" : which === "grain" ? "Reroll the grain bill, keep the hops" : "Reroll the hop bill, keep the grain"}
                >
                  ↻ {which === "both" ? "Both" : which === "grain" ? "Grain" : "Hops"}
                </button>
              ))}
            </div>
            <p className="col-span-2 text-xs text-gray-400">
              How far past the popular pick the ingredient choices can reach. Same style + same reroll always gives
              the same recipe; the %s and doses stay put — only which malt/hop fills each slot changes.
              <span className="text-gray-500"> ↻ Grain and ↻ Hops reroll one bill and leave the other alone (lock one, reroll the other).</span>
            </p>
          </div>

          <div className="rounded border p-3">
            <div className="mb-1 text-sm font-medium">Stats (unchecked = style median)</div>
            <ScalarRow label="ABV %" unit="%" min={2} max={16} step={0.1} override={form.abv} onChange={(v) => setForm((f) => ({ ...f, abv: v }))} />
            <ScalarRow label="IBU" min={0} max={120} step={1} override={form.ibu} onChange={(v) => setForm((f) => ({ ...f, ibu: v }))} />
            <ScalarRow label="SRM" min={0} max={80} step={1} override={form.srm} onChange={(v) => setForm((f) => ({ ...f, srm: v }))} />
            {/* Normalized 0-100% "thin → full" dial; buildQuery maps it onto the cloud's real maltBody range (from result.bodyRange). No more raw -0.3..0.45. */}
            <ScalarRow label="Body (thin→full)" unit="%" min={0} max={100} step={5} override={form.body} onChange={(v) => setForm((f) => ({ ...f, body: v }))} />
          </div>

          <div className="col-span-full rounded border p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-sm font-medium">Flavour push — click an axis to set it</div>
              <button onClick={clearPushes} className="text-xs text-blue-600 hover:underline">clear all</button>
            </div>
            <p className="mb-2 text-xs text-gray-400">
              Grey band = where <span className="font-medium">{norms?.style.matchedName ?? form.style}</span> usually sits (p25–p75). Click or drag on an axis to push that
              flavour; drag back to the centre to clear it. Each axis is scaled to its own realistic range, so the whole
              dial is usable even for the compressed malt flavours.
            </p>
            <div className="flex flex-wrap items-start justify-center gap-8">
              <div className="text-center">
                <div className="text-xs text-gray-400">Hop</div>
                <FlavorRadar
                  axes={hopAxes}
                  onPick={setHopAxis}
                  series={[
                    { name: "style p75", values: norms?.styleNorms.hop.p75 ?? {}, color: "#9ca3af" },
                    { name: "style p25", values: norms?.styleNorms.hop.p25 ?? {}, dashed: true, color: "#9ca3af" },
                    { name: "requested", values: liveRequestedHop, handles: true, color: "#3b82f6" },
                  ]}
                  size={260}
                />
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Malt</div>
                <FlavorRadar
                  axes={maltAxes}
                  onPick={setMaltAxis}
                  series={[
                    { name: "style p75", values: norms?.styleNorms.malt.p75 ?? {}, color: "#9ca3af" },
                    { name: "style p25", values: norms?.styleNorms.malt.p25 ?? {}, dashed: true, color: "#9ca3af" },
                    { name: "requested", values: liveRequestedMalt, handles: true, color: "#a16207" },
                  ]}
                  size={260}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── results ─────────────────────────────────────────────────── */}
        <div>
          {!result && !error && <div className="text-sm text-gray-400">Set your params and hit Calculate.</div>}
          {result && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold">{result.recipe.name}</div>
                <div className="text-sm text-gray-500">
                  &quot;{result.style.input}&quot; → {result.style.matchedCode ?? "(unmatched)"} {result.style.matchedName ?? ""} · family {result.style.family}
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center">
                {[
                  ["OG", result.calculations.og.toFixed(3)],
                  ["FG", result.calculations.fg.toFixed(3)],
                  ["ABV", `${result.calculations.abv.toFixed(1)}%`],
                  ["IBU", result.calculations.ibu.toFixed(0)],
                  ["SRM", result.calculations.srm.toFixed(1)],
                  ["Mash", `${result.recipe.mashSteps[0]?.temperatureC ?? "?"}°C`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border p-2">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="font-mono text-sm font-medium">{value}</div>
                  </div>
                ))}
              </div>

              {(() => {
                const { band, ratio, meanNeighborDistance, baselineDistance } = result.styleFit;
                const meta = {
                  typical: { cls: "border-green-300 bg-green-50 text-green-800", label: "✓ Typical for this style" },
                  stretch: { cls: "border-amber-300 bg-amber-50 text-amber-800", label: "○ A stretch — pushing the style's edges" },
                  experimental: { cls: "border-red-300 bg-red-50 text-red-800", label: "⚠ Experimental — the corpus barely has this" },
                }[band];
                const pct = Math.min(100, (ratio / 2.5) * 100); // bar fill across 0..2.5× typical density
                return (
                  <div className={`rounded border p-2 text-sm ${meta.cls}`}>
                    <div className="flex items-center justify-between">
                      <span>{meta.label}</span>
                      <span className="text-xs tabular-nums opacity-70">{ratio.toFixed(2)}× typical density</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-black/10">
                      <div className="h-1.5 rounded bg-current opacity-60" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs opacity-60">
                      mean neighbour distance {meanNeighborDistance.toFixed(2)} vs baseline {baselineDistance.toFixed(2)}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400">hop: style&apos;s typical range (grey) · requested (dashed) · achieved</div>
                  <FlavorRadar
                    axes={hopAxes}
                    series={[
                      { name: "style p75", values: result.styleNorms.hop.p75, color: "#9ca3af" },
                      { name: "style p25", values: result.styleNorms.hop.p25, dashed: true, color: "#9ca3af" },
                      { name: "requested", values: result.requestedFlavor.hop, dashed: true, color: "#3b82f6" },
                      { name: "achieved", values: result.achievedFlavor.hop, color: "#3b82f6" },
                    ]}
                    size={220}
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">malt: style&apos;s typical range (grey) · requested (dashed) · achieved</div>
                  <FlavorRadar
                    axes={maltAxes}
                    series={[
                      { name: "style p75", values: result.styleNorms.malt.p75, color: "#9ca3af" },
                      { name: "style p25", values: result.styleNorms.malt.p25, dashed: true, color: "#9ca3af" },
                      { name: "requested", values: result.requestedFlavor.malt, dashed: true, color: "#a16207" },
                      { name: "achieved", values: result.achievedFlavor.malt, color: "#a16207" },
                    ]}
                    size={220}
                  />
                </div>
              </div>
              <div className="text-center text-xs text-gray-400">
                typical range from {result.styleNorms.recordCount} {result.styleNorms.level === "style" ? "style-specific" : result.styleNorms.level === "family" ? "family-level" : "cloud-wide"} recipes
                {result.styleNorms.level !== "style" && " (this style alone didn't have enough data)"}
              </div>

              <div>
                <div className="mb-1 text-sm font-medium">Grain bill</div>
                <table className="w-full text-sm">
                  <tbody>
                    {result.recipe.fermentables.map((f) => (
                      <tr key={f.id} className="border-b">
                        <td className="py-1">{f.name}</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">{f.colorLovibond}°L</td>
                        <td className="py-1 text-right tabular-nums">{f.weightKg.toFixed(2)} kg</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">
                          {totalKg > 0 ? ((100 * f.weightKg) / totalKg).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="mb-1 text-sm font-medium">
                  Hop schedule <span className="text-xs font-normal text-gray-400">(g/L is the real output — grams are just that dose at this recipe&apos;s batch size)</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {result.recipe.hops.map((h) => (
                      <tr key={h.id} className="border-b">
                        <td className="py-1">{h.name}</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">{h.alphaAcid.toFixed(1)}% AA</td>
                        <td className="py-1 text-right tabular-nums">{(h.grams / result.recipe.batchVolumeL).toFixed(2)} g/L</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">({h.grams.toFixed(1)}g)</td>
                        <td className="py-1 text-right text-gray-500">{hopTimingLabel(h)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm">
                <span className="font-medium">Yeast: </span>
                {result.recipe.yeasts[0]?.name} ({((result.recipe.yeasts[0]?.attenuation ?? 0) * 100).toFixed(0)}% attenuation,{" "}
                {result.recipe.yeasts[0]?.laboratory})
              </div>

              {result.notes.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {result.notes.map((n, i) => (
                    <div key={i}>• {n}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
