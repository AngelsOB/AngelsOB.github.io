"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { hsTokens, hsAlpha } from "@/modules/builder/tokens";
import HSButton from "@/modules/builder/components/HSButton";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import { getBjcpCategories } from "@/utils/bjcp";
import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import type { Recipe, FermentationStep } from "@/modules/recipe/models/Recipe";
import type {
  SteeringQuery,
  SteeringResult,
  ReflectResult,
} from "@/modules/corpus-lab/steering/RecipeSteeringService";

import {
  HOP_AXES,
  MALT_AXES,
  DEFAULT_HOP_MAX,
  DEFAULT_MALT_MAX,
  axesWithMax,
} from "./axes";
import SteeringWheel from "./SteeringWheel";
import RecipePreview from "./RecipePreview";

// "code. name" as both label and value guarantees an exact leading-code match
// against matchBjcpStyle — never a free-text near-miss.
const STYLE_CATEGORIES = getBjcpCategories().map((cat) => ({
  label: `${cat.code}. ${cat.name}`,
  options: cat.styles.map((s) => `${s.code}. ${s.name}`),
}));

type ValueMap = Record<string, number>;
type ScalarTarget = { enabled: boolean; value: number };

type FormState = {
  style: string;
  hop: ValueMap; // pushed hop axes only
  malt: ValueMap; // pushed malt axes only
  abv: ScalarTarget;
  ibu: ScalarTarget;
  srm: ScalarTarget;
  /** Grist body signal (cloud `mb` units, ~-0.3…0.45). Overlaid onto the k-NN
   *  query row so it shifts neighbour selection toward thinner/fuller grists;
   *  surfaced as a qualitative Thin→Big scale, never the raw number. */
  body: ScalarTarget;
  /** One consumer knob for "adventurousness" — drives both the engine's
   *  creativity (flavour-match vs popularity) and exploration (sampling past
   *  the top pick, which is what makes "another take" actually differ). */
  creativity: number;
  /** Style ↔ push balance for the rerank (engine `wildness`). 0 = hew to the
   *  style everywhere you didn't push; 1 = chase the pushed axes and let the
   *  rest drift. Pushed axes are always honoured; this tunes the rest. */
  wildness: number;
  /** EXPERIMENTAL: when raising a pushed flavour, prefer ingredients that don't
   *  also drag up an axis you pulled DOWN (engine `avoidCollateral`). */
  avoidCollateral: boolean;
  gristVariation: number; // grain-bill reroll seed
  hopVariation: number; // hop-bill reroll seed
  lockGrain: boolean; // "Another take" keeps the grain bill
  lockHops: boolean; // "Another take" keeps the hop bill
  splitNeighbourhoods: boolean; // search a separate neighbourhood for grain vs hops
};

const INITIAL: FormState = {
  style: "21A. American IPA",
  hop: {},
  malt: {},
  abv: { enabled: false, value: 6 },
  ibu: { enabled: false, value: 45 },
  srm: { enabled: false, value: 8 },
  body: { enabled: false, value: 0.08 }, // cloud mean ≈ 0.08 → "Medium"
  creativity: 0.35,
  wildness: 0.3, // lean on-style by default (good beer first); crank to chase the push
  avoidCollateral: false, // experimental, off by default
  gristVariation: 0,
  hopVariation: 0,
  lockGrain: false,
  lockHops: false,
  splitNeighbourhoods: true, // on by default — the truer per-bill behaviour we're trying
};

// Map the raw grist-body signal (~-0.3…0.45) onto words a brewer actually uses.
// Buckets centre "Medium" on the cloud mean (~0.08); the engine clamps to ±3σ.
const bodyLabel = (v: number): string =>
  v <= -0.12 ? "Thin" : v < 0.02 ? "Light" : v < 0.16 ? "Medium" : v < 0.3 ? "Full" : "Big";

type Locks = { fermentables?: Recipe["fermentables"]; hops?: Recipe["hops"] };

function buildQuery(form: FormState, locks?: Locks): SteeringQuery {
  const target: NonNullable<SteeringQuery["target"]> = {};
  if (Object.keys(form.hop).length) target.hop = form.hop;
  if (Object.keys(form.malt).length) target.malt = form.malt;
  if (form.abv.enabled) target.abv = form.abv.value;
  if (form.ibu.enabled) target.ibu = form.ibu.value;
  if (form.srm.enabled) target.srm = form.srm.value;
  if (form.body.enabled) target.body = form.body.value;
  return {
    style: form.style,
    exploration: form.creativity, // `creativity` slider now drives exploration (the creativity knob was removed)
    gristVariation: form.gristVariation,
    hopVariation: form.hopVariation,
    target: Object.keys(target).length ? target : undefined,
    // Rerank several candidates by flavour match and close the reachable residual
    // — this is what makes a pushed wheel actually LAND on what it asked for
    // (and lets the 0-4/dial-5 scale be a real target, not a lie).
    candidates: 16,
    wildness: form.wildness,
    correctResidual: true,
    splitNeighbourhoods: form.splitNeighbourhoods,
    avoidCollateral: form.avoidCollateral,
    // A locked bill is sent back verbatim so the engine keeps it exactly.
    lockedFermentables: locks?.fermentables?.length ? locks.fermentables : undefined,
    lockedHops: locks?.hops?.length ? locks.hops : undefined,
  };
}

// The engine leaves fermentationSteps empty (the corpus has no schedule data);
// without a step the builder mock falls back to its hardcoded sample steps,
// which would misrepresent the recipe. A sensible default ale primary keeps the
// preview (and the saved recipe) truthful and editable.
const DEFAULT_FERM_STEP: FermentationStep = {
  id: "ferm-1",
  name: "Primary Fermentation",
  type: "primary",
  durationDays: 14,
  temperatureC: 20,
};

/** Per-axis resting value = midpoint of the style's p25–p75 band. */
function midpoint(p25: ValueMap, p75: ValueMap): ValueMap {
  const out: ValueMap = {};
  for (const k of Object.keys(p75)) out[k] = ((p25[k] ?? 0) + (p75[k] ?? 0)) / 2;
  return out;
}

async function callLab<T>(body: object): Promise<T> {
  const res = await fetch("/api/lab/steering", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? "Something went wrong");
  return json as T;
}

async function callSteering(body: object): Promise<SteeringResult> {
  return callLab<SteeringResult>(body);
}

async function callReflect(recipe: Recipe, style?: string): Promise<ReflectResult> {
  return callLab<ReflectResult>({ mode: "reflect", recipe, style });
}

export default function SteeringStudio() {
  const router = useRouter();
  const commitImportedRecipe = useRecipeStore((s) => s.commitImportedRecipe);
  const recipes = useRecipeStore((s) => s.recipes);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<SteeringResult | null>(null);
  const [reflect, setReflect] = useState<ReflectResult | null>(null);
  const [reflectRecipeId, setReflectRecipeId] = useState<string>("");
  const [norms, setNorms] = useState<SteeringResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [normsLoading, setNormsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Fetch the style's norm band + per-axis ceilings whenever the style changes
  // (a no-target steer). Also warms the server-side cloud cache so the first
  // real Calculate is fast. Cleared when reflecting — reflect brings its own norms.
  useEffect(() => {
    if (reflect) return;
    let cancelled = false;
    setNormsLoading(true);
    setNorms(null);
    setResult(null);
    callSteering({ style: form.style })
      .then((j) => { if (!cancelled) setNorms(j); })
      .catch(() => { /* norms are best-effort; wheels fall back to audited maxes */ })
      .finally(() => { if (!cancelled) setNormsLoading(false); });
    return () => { cancelled = true; };
  }, [form.style, reflect]);

  // Context for the wheels: reflect (imported recipe) > steered result > style norms.
  // Reflect and steer share styleNorms / axisMax / achievedFlavor display fields.
  const ctx = reflect ?? result ?? norms;

  // The recipe as shown/saved — enriched with a default fermentation step when
  // the engine leaves it empty, so the mock never shows fallback sample steps.
  const displayRecipe = useMemo<Recipe | null>(() => {
    const r = reflect?.recipe ?? result?.recipe;
    if (!r) return null;
    return r.fermentationSteps?.length ? r : { ...r, fermentationSteps: [DEFAULT_FERM_STEP] };
  }, [reflect, result]);

  const achievedHop = (reflect ?? result)?.achievedFlavor.hop as ValueMap | undefined;
  const achievedMalt = (reflect ?? result)?.achievedFlavor.malt as ValueMap | undefined;

  // Wheels scale their RIM to axisMax (the typical ceiling), so a strong-but-
  // normal recipe fills the radar — the radar itself is the "normal" zone. A
  // deliberate push then runs past the rim (out to axisDialMax = 1.25×, the
  // reach of residual correction), which the wheel renders as "off the charts".
  const hopAxes = useMemo(
    () => axesWithMax(HOP_AXES, ctx?.axisMax.hop as ValueMap | undefined, DEFAULT_HOP_MAX),
    [ctx],
  );
  const maltAxes = useMemo(
    () => axesWithMax(MALT_AXES, ctx?.axisMax.malt as ValueMap | undefined, DEFAULT_MALT_MAX),
    [ctx],
  );
  const hopMedian = useMemo(() => (ctx ? midpoint(ctx.styleNorms.hop.p25, ctx.styleNorms.hop.p75) : {}), [ctx]);
  const maltMedian = useMemo(() => (ctx ? midpoint(ctx.styleNorms.malt.p25, ctx.styleNorms.malt.p75) : {}), [ctx]);
  const hopBand = ctx ? { p25: ctx.styleNorms.hop.p25 as ValueMap, p75: ctx.styleNorms.hop.p75 as ValueMap } : null;
  const maltBand = ctx ? { p25: ctx.styleNorms.malt.p25 as ValueMap, p75: ctx.styleNorms.malt.p75 as ValueMap } : null;

  const setAxis = (group: "hop" | "malt") => (key: string, value: number | null) =>
    setForm((f) => {
      const next = { ...f[group] };
      if (value === null) delete next[key];
      else next[key] = value;
      return { ...f, [group]: next };
    });
  const resetGroup = (group: "hop" | "malt") => () => setForm((f) => ({ ...f, [group]: {} }));

  const run = useCallback(async (state: FormState, locks?: Locks) => {
    setLoading(true);
    setError(null);
    setReflect(null);
    setReflectRecipeId("");
    try {
      setResult(await callSteering(buildQuery(state, locks)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // PRD-009 Phase 0 — place a saved recipe on the radars (no edits).
  const handleReflect = useCallback(async () => {
    const recipe = recipes.find((r) => r.id === reflectRecipeId);
    if (!recipe) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await callReflect(recipe);
      setReflect(r);
      // Sync the style picker to whatever the recipe matched, so the norm box
      // and any subsequent Calculate start from the same place.
      if (r.style.matchedCode && r.style.matchedName) {
        setForm((f) => ({ ...f, style: `${r.style.matchedCode}. ${r.style.matchedName}` }));
      } else if (recipe.style) {
        setForm((f) => ({ ...f, style: recipe.style! }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setReflect(null);
    } finally {
      setLoading(false);
    }
  }, [recipes, reflectRecipeId]);

  // Every run — the primary Calculate/Recalculate and the "Another take" reroll
  // alike — bumps the reroll seed so it yields a fresh plausible take with the
  // current steering. The rerank's near-best pool means a reroll surfaces a
  // different well-aligned recipe even at creativity 0, so reroll no longer needs
  // any exploration dialled in to do something.
  const runFresh = (state: FormState) => {
    // Bump only the UNLOCKED bills' seeds, and send the locked bill(s) back
    // verbatim so the engine keeps them exactly (lock one, reroll the other).
    const next = {
      ...state,
      gristVariation: state.gristVariation + (state.lockGrain ? 0 : 1),
      hopVariation: state.hopVariation + (state.lockHops ? 0 : 1),
    };
    const locks: Locks = {
      fermentables: state.lockGrain ? result?.recipe.fermentables : undefined,
      hops: state.lockHops ? result?.recipe.hops : undefined,
    };
    setForm(next);
    run(next, locks);
  };

  const handleCalculate = () => runFresh(form);
  const handleReroll = () => runFresh(form);

  const handleOpen = async () => {
    if (!displayRecipe) return;
    // Reflecting a saved recipe — open the original, don't fork a copy.
    if (reflect && reflectRecipeId) {
      router.push(`/recipes/${reflectRecipeId}`);
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const toPersist: Recipe = {
        ...displayRecipe,
        id: uid(),
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
        isPublic: false,
      };
      const saved = await commitImportedRecipe(toPersist);
      if (saved) router.push(`/recipes/${saved.id}`);
      else setError("Couldn't open the recipe — you may be over your recipe limit.");
    } catch {
      setError("Couldn't open the recipe.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="studio-root">
      <StudioStyles />

      <div className="studio-grid" style={{ maxWidth: 1560, margin: "0 auto", padding: "clamp(18px, 2.5vw, 32px) clamp(16px, 3vw, 40px) 80px", display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: "clamp(20px, 3vw, 40px)", alignItems: "start" }}>
        {/* in-page toolbar — the app already has a sticky global header, so the
            style picker + Calculate live in the page flow, not a second bar */}
        <div className="studio-toolbar" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.08 }}>
            <HSEyebrow style={{ color: hsTokens.roast }}>Corpus Lab</HSEyebrow>
            <span style={{ fontFamily: hsTokens.display, fontSize: 24, letterSpacing: "-0.03em" }}>Brew Studio</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 340px" }}>
            {error ? <span style={{ color: hsTokens.roast, fontSize: 12, fontWeight: 700 }}>{error}</span> : null}
            <label className="studio-style-picker" style={{ position: "relative", flex: "1 1 220px", maxWidth: 420 }}>
              <select
                aria-label="Beer style"
                value={form.style}
                onChange={(e) => {
                  setReflect(null);
                  setReflectRecipeId("");
                  setForm((f) => ({ ...f, style: e.target.value }));
                }}
                style={{
                  width: "100%",
                  appearance: "none",
                  padding: "10px 34px 10px 14px",
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 14,
                  color: hsTokens.ink,
                  background: hsTokens.paper,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 999,
                  boxShadow: hsTokens.sh1,
                  cursor: "pointer",
                }}
              >
                {STYLE_CATEGORIES.map((cat) => (
                  <optgroup key={cat.label} label={cat.label}>
                    {cat.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span aria-hidden style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 12 }}>▾</span>
            </label>
            <HSButton
              variant="ink"
              color={hsTokens.hops}
              size="lg"
              onClick={handleCalculate}
              disabled={loading || (normsLoading && !reflect)}
              arrow={!loading}
            >
              {loading ? "Brewing…" : normsLoading && !reflect ? "Warming up…" : result ? "Recalculate" : "Calculate"}
            </HSButton>
          </div>
        </div>

        {/* PRD-009 Phase 0 — reflect a saved recipe onto the radars (no edits). */}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="studio-style-picker" style={{ position: "relative", flex: "1 1 220px", maxWidth: 420 }}>
            <select
              aria-label="Recipe to reflect"
              value={reflectRecipeId}
              onChange={(e) => setReflectRecipeId(e.target.value)}
              style={{
                width: "100%",
                appearance: "none",
                padding: "10px 34px 10px 14px",
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                boxShadow: hsTokens.sh1,
                cursor: "pointer",
              }}
            >
              <option value="">Reflect a saved recipe…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.style ? ` · ${r.style}` : ""}</option>
              ))}
            </select>
            <span aria-hidden style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 12 }}>▾</span>
          </label>
          <HSButton
            variant="ghost"
            size="md"
            onClick={handleReflect}
            disabled={loading || !reflectRecipeId}
          >
            {reflect ? "Re-reflect" : "Show on radars"}
          </HSButton>
          {reflect ? (
            <span style={{ fontFamily: hsTokens.mono, fontSize: 12, color: hsTokens.muted }}>
              reflecting · unmatched {(reflect.unmatchedRate * 100).toFixed(0)}%
              {reflect.styleNorms.level !== "style" ? ` · norms: ${reflect.styleNorms.level}` : ""}
            </span>
          ) : null}
        </div>

        {/* LEFT — steering */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* the two steering wheels */}
          <div className="studio-wheels" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
            <SteeringWheel
              title="Hop character"
              hint="drag to push"
              accent={hsTokens.hops}
              axes={hopAxes}
              median={hopMedian}
              band={hopBand}
              values={form.hop}
              achieved={achievedHop ?? null}
              onChange={setAxis("hop")}
              onReset={resetGroup("hop")}
              locked={form.lockHops}
              onToggleLock={() => setForm((f) => ({ ...f, lockHops: !f.lockHops }))}
              loading={normsLoading && !reflect}
            />
            <SteeringWheel
              title="Malt character"
              hint="drag to push"
              accent={hsTokens.malt}
              axes={maltAxes}
              median={maltMedian}
              band={maltBand}
              values={form.malt}
              achieved={achievedMalt ?? null}
              onChange={setAxis("malt")}
              onReset={resetGroup("malt")}
              locked={form.lockGrain}
              onToggleLock={() => setForm((f) => ({ ...f, lockGrain: !f.lockGrain }))}
              loading={normsLoading && !reflect}
            />
          </div>

          {/* stat targets */}
          <section style={panelStyle}>
            <div style={panelHeadStyle}>
              <HSEyebrow style={{ fontSize: 11 }}>Targets</HSEyebrow>
              <HSScriptNote color={hsTokens.muted} size={14} rotate={-3}>off = style median</HSScriptNote>
            </div>
            <TargetSlider label="ABV" unit="%" min={2} max={14} step={0.1} accent={hsTokens.yeast} target={form.abv} onChange={(t) => setForm((f) => ({ ...f, abv: t }))} />
            <TargetSlider label="IBU" min={0} max={120} step={1} accent={hsTokens.hops} target={form.ibu} onChange={(t) => setForm((f) => ({ ...f, ibu: t }))} />
            <TargetSlider label="SRM" unit="°L" min={0} max={60} step={1} accent={hsTokens.roast} target={form.srm} onChange={(t) => setForm((f) => ({ ...f, srm: t }))} />
            <TargetSlider label="Body" min={-0.3} max={0.45} step={0.02} accent={hsTokens.malt} target={form.body} onChange={(t) => setForm((f) => ({ ...f, body: t }))} format={bodyLabel} />
          </section>

          {/* creativity + reroll */}
          <section style={panelStyle}>
            <div style={panelHeadStyle}>
              <HSEyebrow style={{ fontSize: 11 }}>Creativity</HSEyebrow>
              <span style={{ fontFamily: hsTokens.mono, fontSize: 12, color: hsTokens.muted }}>{Math.round(form.creativity * 100)}%</span>
            </div>
            <input
              className="studio-range"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.creativity}
              onChange={(e) => setForm((f) => ({ ...f, creativity: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: hsTokens.roast }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <HSButton
                variant="ghost"
                size="sm"
                onClick={handleReroll}
                disabled={loading || !result || (form.lockGrain && form.lockHops)}
                title={
                  form.lockGrain && form.lockHops ? "Both bills are locked — unlock one to reroll"
                    : form.lockGrain ? "Rerolls the hops (grain locked)"
                    : form.lockHops ? "Rerolls the grain (hops locked)"
                    : "Another plausible take"
                }
              >
                ↻ Another take
              </HSButton>
            </div>
          </section>

          {/* wildness — how hard the rerank chases your push vs staying on-style */}
          <section style={panelStyle}>
            <div style={panelHeadStyle}>
              <HSEyebrow style={{ fontSize: 11 }}>Wildness</HSEyebrow>
              <span style={{ fontFamily: hsTokens.mono, fontSize: 12, color: hsTokens.muted }}>{Math.round(form.wildness * 100)}%</span>
            </div>
            <input
              className="studio-range"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.wildness}
              onChange={(e) => setForm((f) => ({ ...f, wildness: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: hsTokens.yeast }}
            />
            <div style={{ marginTop: 8 }}>
              <HSScriptNote color={hsTokens.muted} size={13} rotate={-2}>
                {form.wildness <= 0.15 ? "true to the style" : form.wildness >= 0.7 ? "chase the push, let the rest wander" : "lean into your push, stay near the style"}
              </HSScriptNote>
            </div>
          </section>

          {/* experimental toggles */}
          <section style={panelStyle}>
            <div style={panelHeadStyle}>
              <HSEyebrow style={{ fontSize: 11 }}>Experimental</HSEyebrow>
            </div>
            <ToggleRow
              label="Split malt & hop search"
              hint="each bill from its own neighbourhood"
              accent={hsTokens.hops}
              on={form.splitNeighbourhoods}
              onToggle={() => setForm((f) => ({ ...f, splitNeighbourhoods: !f.splitNeighbourhoods }))}
            />
            <ToggleRow
              label="Avoid collateral flavours"
              hint="a push won't drag a pulled-down axis back up"
              accent={hsTokens.malt}
              on={form.avoidCollateral}
              onToggle={() => setForm((f) => ({ ...f, avoidCollateral: !f.avoidCollateral }))}
            />
          </section>

          {result ? <StyleFitBadge fit={result.styleFit} /> : null}
        </div>

        {/* RIGHT — live preview (sticks below the global header) */}
        <div style={{ position: "sticky", top: "calc(var(--hs-header-peek, 88px) + 16px)", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <RecipePreview recipe={displayRecipe} />
          {result ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: hsTokens.display, fontSize: 16, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {result.recipe.name}
                </div>
                <div style={{ fontFamily: hsTokens.mono, fontSize: 11, color: hsTokens.muted }}>
                  {result.calculations.abv.toFixed(1)}% · {result.calculations.ibu.toFixed(0)} IBU · {result.calculations.srm.toFixed(1)} SRM · held in memory
                </div>
              </div>
              <HSButton variant="ink" color={hsTokens.roast} size="lg" onClick={handleOpen} disabled={opening} arrow={!opening}>
                {opening ? "Opening…" : "Open in builder"}
              </HSButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── target slider ────────────────────────────────────────────────────────────
function TargetSlider({
  label,
  unit,
  min,
  max,
  step,
  accent,
  target,
  onChange,
  format,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  accent: string;
  target: ScalarTarget;
  onChange: (t: ScalarTarget) => void;
  /** Custom readout for values with no meaningful unit (e.g. body → "Medium"). */
  format?: (v: number) => string;
}) {
  const on = target.enabled;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <button
        type="button"
        className="studio-focus"
        aria-pressed={on}
        onClick={() => onChange({ ...target, enabled: !on })}
        style={{
          flex: "0 0 auto",
          width: 62,
          textAlign: "left",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
        title={on ? "Using your target" : "Using the style median"}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            flex: "0 0 auto",
            background: on ? accent : "transparent",
            border: `2px solid ${on ? accent : hsAlpha(hsTokens.ink, 35)}`,
            transition: "background 120ms var(--hs-ease, ease), border-color 120ms var(--hs-ease, ease)",
          }}
        />
        <span style={{ fontFamily: hsTokens.body, fontWeight: 700, fontSize: 13, color: on ? hsTokens.ink : hsTokens.muted }}>{label}</span>
      </button>
      <input
        className="studio-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={target.value}
        onChange={(e) => onChange({ enabled: true, value: parseFloat(e.target.value) })}
        style={{ flex: 1, accentColor: accent, opacity: on ? 1 : 0.4 }}
      />
      <span style={{ flex: "0 0 auto", width: 58, textAlign: "right", fontFamily: hsTokens.mono, fontSize: 13, color: on ? hsTokens.ink : hsTokens.muted }}>
        {on ? (format ? format(target.value) : `${target.value.toFixed(unit === "%" ? 1 : 0)}${unit ?? ""}`) : "median"}
      </span>
    </div>
  );
}

// ── experimental toggle row ──────────────────────────────────────────────────
function ToggleRow({ label, hint, accent, on, onToggle }: { label: string; hint: string; accent: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="studio-focus"
      aria-pressed={on}
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 0",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
      title={on ? "On" : "Off"}
    >
      <span
        style={{
          flex: "0 0 auto",
          width: 34,
          height: 18,
          borderRadius: 999,
          background: on ? accent : "transparent",
          border: `2px solid ${on ? accent : hsAlpha(hsTokens.ink, 35)}`,
          position: "relative",
          transition: "background 120ms var(--hs-ease, ease), border-color 120ms var(--hs-ease, ease)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: on ? 16 : 1,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: on ? hsTokens.paper : hsTokens.ink,
            transition: "left 120ms var(--hs-ease, ease)",
          }}
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: hsTokens.body, fontWeight: 700, fontSize: 13, color: on ? hsTokens.ink : hsTokens.muted }}>{label}</span>
        <span style={{ display: "block", fontFamily: hsTokens.body, fontSize: 11, color: hsTokens.muted }}>{hint}</span>
      </span>
    </button>
  );
}

// ── style-fit badge ──────────────────────────────────────────────────────────
function StyleFitBadge({ fit }: { fit: SteeringResult["styleFit"] }) {
  const good = fit.inBounds;
  const color = good ? hsTokens.hops : hsTokens.roast;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        border: `2px solid ${hsTokens.ink}`,
        background: hsAlpha(color, 14),
        boxShadow: hsTokens.sh1,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flex: "0 0 auto" }} />
      <div style={{ fontFamily: hsTokens.body, fontSize: 13, fontWeight: 700, color: hsTokens.ink }}>
        {good ? "Classic for this style" : "Experimental — off the beaten path"}
        <span style={{ fontWeight: 500, color: hsTokens.muted, marginLeft: 6, fontSize: 12 }}>
          {good ? "sits in the corpus's dense region" : "few real recipes land here"}
        </span>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 14,
  boxShadow: hsTokens.sh2,
  padding: "12px 16px 14px",
};
const panelHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: 6,
};

// Scoped styles: HS-flavoured range thumbs + responsive collapse + reduced motion.
function StudioStyles() {
  return (
    <style>{`
      .studio-range { -webkit-appearance: none; appearance: none; height: 22px; background: transparent; cursor: pointer; }
      .studio-range::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: var(--hs-cream-2); border: 1.5px solid var(--hs-ink); }
      .studio-range::-moz-range-track { height: 6px; border-radius: 999px; background: var(--hs-cream-2); border: 1.5px solid var(--hs-ink); }
      .studio-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -6.5px; border-radius: 999px; background: var(--hs-paper); border: 2px solid var(--hs-ink); box-shadow: 1px 1px 0 var(--hs-ink); transition: transform 120ms var(--hs-ease, ease); }
      .studio-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 999px; background: var(--hs-paper); border: 2px solid var(--hs-ink); box-shadow: 1px 1px 0 var(--hs-ink); }
      .studio-range:active::-webkit-slider-thumb { transform: scale(1.15); }
      .studio-range:focus-visible { outline: none; }
      .studio-range:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--hs-ink); outline-offset: 2px; }
      .studio-range:focus-visible::-moz-range-thumb { outline: 2px solid var(--hs-ink); outline-offset: 2px; }
      .studio-style-picker select:focus-visible { outline: 2px solid var(--hs-ink); outline-offset: 2px; }
      .studio-focus:focus-visible { outline: 2px solid var(--hs-ink); outline-offset: 3px; border-radius: 4px; }
      @media (max-width: 1080px) {
        .studio-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 440px) {
        .studio-wheels { grid-template-columns: 1fr !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .studio-root *, .studio-root *::before, .studio-root *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
      }
    `}</style>
  );
}
