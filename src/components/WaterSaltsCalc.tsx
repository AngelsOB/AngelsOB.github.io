'use client';

import { useEffect, useMemo, useState } from "react";
import Collapsible from "./Collapsible";
import CalculatorCard from "./CalculatorCard";
import {
  type SaltAdditions,
  type WaterProfile,
  COMMON_WATER_PROFILES,
  ionDeltaFromSalts,
  mixProfiles,
  ION_KEYS,
  DEFAULT_TOLERANCE_PPM,
  loadSavedWaterProfiles,
  saveNewWaterProfile,
  updateSavedWaterProfile,
  type SavedWaterProfile,
  ION_HINTS,
  STYLE_TARGETS,
} from "../utils/water";
import InputWithSuffix from "./InputWithSuffix";

// Display labels for salts
const SALT_LABELS: Record<keyof SaltAdditions, string> = {
  gypsum_g: "Gypsum (CaSO4)",
  cacl2_g: "Calcium Chloride (CaCl2)",
  epsom_g: "Epsom Salt (MgSO4)",
  nacl_g: "Table Salt (NaCl)",
  nahco3_g: "Baking Soda (NaHCO3)",
};

// Helper: prefix the first 'Target:' line with the ion symbol, e.g. 'Na Target:'
function withIonPrefix(ion: keyof WaterProfile, text: string): string {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i];
    const m = t.match(/^(\s*)Target:\s*/);
    if (m) {
      lines[i] = `${m[1]}${ion} Target: ${t.slice(m[0].length)}`;
      break;
    }
  }
  return lines.join("\n");
}

// Hover hints for salt inputs (from mineral guidance), with ion-prefixed targets
const SALT_HINTS: Record<keyof SaltAdditions, string> = {
  gypsum_g: `${withIonPrefix("Ca", ION_HINTS.Ca)}\n\n${withIonPrefix(
    "SO4",
    ION_HINTS.SO4
  )}`,
  cacl2_g: `${withIonPrefix("Ca", ION_HINTS.Ca)}\n\n${withIonPrefix(
    "Cl",
    ION_HINTS.Cl
  )}`,
  epsom_g: `${withIonPrefix("Mg", ION_HINTS.Mg)}\n\n${withIonPrefix(
    "SO4",
    ION_HINTS.SO4
  )}`,
  nacl_g: `${withIonPrefix("Na", ION_HINTS.Na)}\n\n${withIonPrefix(
    "Cl",
    ION_HINTS.Cl
  )}`,
  nahco3_g: `${withIonPrefix("Na", ION_HINTS.Na)}\n\n${withIonPrefix(
    "HCO3",
    ION_HINTS.HCO3
  )}`,
};

// HoverHint component used for salt labels
function HoverHint({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span className="relative group cursor-help inline-flex items-center text-white/40 hover:text-primary-strong transition-colors">
      {children}
      <span className="pointer-events-none absolute left-0 top-full mt-2 z-20 hidden group-hover:block">
        <span className="inline-block w-[44rem] max-w-[20vw] rounded-xl border border-white/10 bg-white/10 p-1 shadow-2xl shadow-black/30 backdrop-blur-sm supports-[backdrop-filter]:bg-white/5">
          <span className="block w-full rounded-lg bg-neutral-900/90 p-2 text-xs whitespace-pre-wrap text-white/70">
            {text}
          </span>
        </span>
      </span>
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}

export default function WaterSaltsCalc({
  mashWaterL = 15,
  spargeWaterL = 10,
  variant = "card",
  compact: compactProp,
  onCompactChange,
  onChange,
  initialTotalSalts,
  initialSourceProfileName,
  initialTargetProfileName,
  initialSourceProfile,
  initialTargetProfile,
}: {
  mashWaterL?: number;
  spargeWaterL?: number;
  variant?: "card" | "embedded";
  compact?: boolean;
  onCompactChange?: (value: boolean) => void;
  onChange?: (data: {
    mashSalts: SaltAdditions;
    spargeSalts: SaltAdditions;
    totalSalts: SaltAdditions;
    totalProfile: WaterProfile;
    sourceProfileName: string;
    targetProfileName: string;
    sourceProfile: WaterProfile;
    targetProfile: WaterProfile;
    sourceProfileCustomName?: string;
    targetProfileCustomName?: string;
  }) => void;
  initialTotalSalts?: SaltAdditions;
  initialSourceProfileName?: string;
  initialTargetProfileName?: string;
  initialSourceProfile?: WaterProfile;
  initialTargetProfile?: WaterProfile;
}) {
  const [localCompact, setLocalCompact] = useState<boolean>(false);
  const [sourceProfileName, setSourceProfileName] = useState<string>(
    initialSourceProfileName ?? "RO"
  );
  const [targetProfileName, setTargetProfileName] = useState<string>(
    initialTargetProfileName ?? "Burton"
  );
  const [customSource, setCustomSource] = useState<WaterProfile | null>(null);
  const [customTarget, setCustomTarget] = useState<WaterProfile | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SavedWaterProfile[]>(() =>
    loadSavedWaterProfiles()
  );
  const [customSourceName, setCustomSourceName] =
    useState<string>("Custom Source");
  const [customTargetName, setCustomTargetName] =
    useState<string>("Custom Target");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [mashVol, setMashVol] = useState<number>(mashWaterL);
  const [spargeVol, setSpargeVol] = useState<number>(spargeWaterL);

  // Use live recipe-provided volumes when embedded to avoid drift; allow edits in card mode
  const effectiveMashVol = variant === "embedded" ? mashWaterL : mashVol;
  const effectiveSpargeVol = variant === "embedded" ? spargeWaterL : spargeVol;
  const [mashSalts, setMashSalts] = useState<SaltAdditions>({});
  const [spargeSalts, setSpargeSalts] = useState<SaltAdditions>({});
  const [singleSalts, setSingleSalts] = useState<SaltAdditions>({});
  const [additionsMode, setAdditionsMode] = useState<"single" | "separate">(
    "single"
  );
  const [autoSplitByVolume, setAutoSplitByVolume] = useState<boolean>(true);
  const [manualMashPercent] = useState<number>(50);

  // Initialize custom profiles when provided by parent (e.g., loading a recipe)
  useEffect(() => {
    // Helper: approximate match to presets/styles so we can select proper options
    const matchProfile = (
      p: WaterProfile | null | undefined
    ):
      | { name: string; custom: false }
      | { name: "Custom"; custom: true }
      | null => {
      if (!p) return null;
      const tol = 3; // ppm per ion
      const isClose = (a: WaterProfile, b: WaterProfile) =>
        Math.max(
          Math.abs(a.Ca - b.Ca),
          Math.abs(a.Mg - b.Mg),
          Math.abs(a.Na - b.Na),
          Math.abs(a.Cl - b.Cl),
          Math.abs(a.SO4 - b.SO4),
          Math.abs(a.HCO3 - b.HCO3)
        ) <= tol;
      // Common profiles
      for (const [k, v] of Object.entries(COMMON_WATER_PROFILES)) {
        if (isClose(p, v)) return { name: k, custom: false };
      }
      // Styles
      for (const [k, v] of Object.entries(STYLE_TARGETS)) {
        if (isClose(p, v.profile))
          return { name: `style:${k}` as const, custom: false };
      }
      return { name: "Custom", custom: true };
    };

    const srcMatch = matchProfile(initialSourceProfile);
    if (srcMatch) {
      setSourceProfileName(srcMatch.name);
      if (srcMatch.custom) setCustomSource(initialSourceProfile!);
      else setCustomSource(null);
    }

    const tgtMatch = matchProfile(initialTargetProfile);
    if (tgtMatch) {
      setTargetProfileName(tgtMatch.name);
      if (tgtMatch.custom) setCustomTarget(initialTargetProfile!);
      else setCustomTarget(null);
    }
  }, [
    initialSourceProfile,
    initialTargetProfile,
    initialSourceProfileName,
    initialTargetProfileName,
    customSourceName,
    customTargetName,
  ]);

  // Keep select values in sync if parent updates the initial names (e.g., loading a recipe)
  useEffect(() => {
    if (initialSourceProfileName)
      setSourceProfileName(initialSourceProfileName);
  }, [initialSourceProfileName]);
  useEffect(() => {
    if (initialTargetProfileName)
      setTargetProfileName(initialTargetProfileName);
  }, [initialTargetProfileName]);

  const totalWater =
    Math.max(0, effectiveMashVol) + Math.max(0, effectiveSpargeVol);
  const mashFrac =
    totalWater > 0 ? Math.max(0, effectiveMashVol) / totalWater : 0;

  const splitMashFrac = autoSplitByVolume
    ? mashFrac
    : Math.max(0, Math.min(1, manualMashPercent / 100));
  const splitSpargeFrac = 1 - splitMashFrac;

  const computedMashSalts: SaltAdditions = useMemo(() => {
    if (additionsMode !== "single") return mashSalts;
    return {
      gypsum_g: (singleSalts.gypsum_g ?? 0) * splitMashFrac,
      cacl2_g: (singleSalts.cacl2_g ?? 0) * splitMashFrac,
      epsom_g: (singleSalts.epsom_g ?? 0) * splitMashFrac,
      nacl_g: (singleSalts.nacl_g ?? 0) * splitMashFrac,
      nahco3_g: (singleSalts.nahco3_g ?? 0) * splitMashFrac,
    };
  }, [
    additionsMode,
    mashSalts,
    singleSalts.gypsum_g,
    singleSalts.cacl2_g,
    singleSalts.epsom_g,
    singleSalts.nacl_g,
    singleSalts.nahco3_g,
    splitMashFrac,
  ]);

  const computedSpargeSalts: SaltAdditions = useMemo(() => {
    if (additionsMode !== "single") return spargeSalts;
    return {
      gypsum_g: (singleSalts.gypsum_g ?? 0) * splitSpargeFrac,
      cacl2_g: (singleSalts.cacl2_g ?? 0) * splitSpargeFrac,
      epsom_g: (singleSalts.epsom_g ?? 0) * splitSpargeFrac,
      nacl_g: (singleSalts.nacl_g ?? 0) * splitSpargeFrac,
      nahco3_g: (singleSalts.nahco3_g ?? 0) * splitSpargeFrac,
    };
  }, [
    additionsMode,
    spargeSalts,
    singleSalts.gypsum_g,
    singleSalts.cacl2_g,
    singleSalts.epsom_g,
    singleSalts.nacl_g,
    singleSalts.nahco3_g,
    splitSpargeFrac,
  ]);

  const source: WaterProfile = useMemo(() => {
    if (sourceProfileName === "Custom" && customSource) return customSource;
    if (sourceProfileName.startsWith("saved:")) {
      const id = sourceProfileName.slice(6);
      const found = savedProfiles.find((s) => s.id === id);
      if (found) return found.profile;
    }
    return COMMON_WATER_PROFILES[sourceProfileName] ?? COMMON_WATER_PROFILES.RO;
  }, [sourceProfileName, customSource, savedProfiles]);

  const target: WaterProfile = useMemo(() => {
    if (targetProfileName === "Custom" && customTarget) return customTarget;
    if (targetProfileName.startsWith("saved:")) {
      const id = targetProfileName.slice(6);
      const found = savedProfiles.find((s) => s.id === id);
      if (found) return found.profile;
    }
    if (targetProfileName.startsWith("style:")) {
      const styleName = targetProfileName.slice(6);
      const style = STYLE_TARGETS[styleName as keyof typeof STYLE_TARGETS];
      if (style) return style.profile;
    }
    return (
      COMMON_WATER_PROFILES[targetProfileName] ?? COMMON_WATER_PROFILES.Burton
    );
  }, [targetProfileName, customTarget, savedProfiles]);

  const styleTips = useMemo(() => {
    if (!targetProfileName.startsWith("style:")) return null;
    const name = targetProfileName.slice(6);
    const s = STYLE_TARGETS[name as keyof typeof STYLE_TARGETS];
    return s ? { name, text: s.tips, profile: s.profile } : null;
  }, [targetProfileName]);

  // Style-aware salt hints
  const saltHints = useMemo(() => {
    const base = SALT_HINTS;
    if (!styleTips) return base;
    const style = STYLE_TARGETS[styleTips.name as keyof typeof STYLE_TARGETS];
    const fmt = (ions: Array<keyof WaterProfile>) => {
      if (style?.ranges) {
        const parts = ions.map((k) => {
          const r = style.ranges?.[k];
          if (r) return `${k} ${r[0]}–${r[1]} ppm`;
          return `${k} ${style.profile[k].toFixed(0)} ppm`;
        });
        return `Style targets: ${parts.join(", ")}`;
      }
      return `Style targets: ${ions
        .map((k) => `${k} ${style.profile[k].toFixed(0)} ppm`)
        .join(", ")}`;
    };
    return {
      gypsum_g: `${fmt(["Ca", "SO4"])}` + `\n\n${base.gypsum_g}`,
      cacl2_g: `${fmt(["Ca", "Cl"])}` + `\n\n${base.cacl2_g}`,
      epsom_g: `${fmt(["Mg", "SO4"])}` + `\n\n${base.epsom_g}`,
      nacl_g: `${fmt(["Na", "Cl"])}` + `\n\n${base.nacl_g}`,
      nahco3_g: `${fmt(["Na", "HCO3"])}` + `\n\n${base.nahco3_g}`,
    } as Record<keyof SaltAdditions, string>;
  }, [styleTips]);

  const mashProfile = useMemo(() => {
    const delta = ionDeltaFromSalts(computedMashSalts, effectiveMashVol);
    return {
      Ca: source.Ca + delta.Ca,
      Mg: source.Mg + delta.Mg,
      Na: source.Na + delta.Na,
      Cl: source.Cl + delta.Cl,
      SO4: source.SO4 + delta.SO4,
      HCO3: source.HCO3 + delta.HCO3,
    };
  }, [source, computedMashSalts, effectiveMashVol]);

  const spargeProfile = useMemo(() => {
    const delta = ionDeltaFromSalts(computedSpargeSalts, effectiveSpargeVol);
    return {
      Ca: source.Ca + delta.Ca,
      Mg: source.Mg + delta.Mg,
      Na: source.Na + delta.Na,
      Cl: source.Cl + delta.Cl,
      SO4: source.SO4 + delta.SO4,
      HCO3: source.HCO3 + delta.HCO3,
    };
  }, [source, computedSpargeSalts, effectiveSpargeVol]);

  const totalProfile = useMemo(
    () =>
      mixProfiles([
        { volumeL: effectiveMashVol, profile: mashProfile },
        { volumeL: effectiveSpargeVol, profile: spargeProfile },
      ]),
    [effectiveMashVol, effectiveSpargeVol, mashProfile, spargeProfile]
  );

  // const ratio = useMemo(() => chlorideToSulfateRatio(totalProfile), [totalProfile]);

  const compact = compactProp ?? localCompact;
  const toggleCompact = () => {
    const next = !compact;
    if (next) setAdditionsMode("single");
    if (onCompactChange) onCompactChange(next);
    else setLocalCompact(next);
  };
  useEffect(() => {
    if (compact) setAdditionsMode("single");
  }, [compact]);

  // Emit changes upwards
  useEffect(() => {
    if (!onChange) return;
    const sum = (a?: number, b?: number) => (a ?? 0) + (b ?? 0);
    const total: SaltAdditions =
      additionsMode === "single"
        ? {
            gypsum_g: singleSalts.gypsum_g ?? 0,
            cacl2_g: singleSalts.cacl2_g ?? 0,
            epsom_g: singleSalts.epsom_g ?? 0,
            nacl_g: singleSalts.nacl_g ?? 0,
            nahco3_g: singleSalts.nahco3_g ?? 0,
          }
        : {
            gypsum_g: sum(mashSalts.gypsum_g, spargeSalts.gypsum_g),
            cacl2_g: sum(mashSalts.cacl2_g, spargeSalts.cacl2_g),
            epsom_g: sum(mashSalts.epsom_g, spargeSalts.epsom_g),
            nacl_g: sum(mashSalts.nacl_g, spargeSalts.nacl_g),
            nahco3_g: sum(mashSalts.nahco3_g, spargeSalts.nahco3_g),
          };
    onChange({
      mashSalts: computedMashSalts,
      spargeSalts: computedSpargeSalts,
      totalSalts: total,
      totalProfile,
      sourceProfileName,
      targetProfileName,
      sourceProfile: source,
      targetProfile: target,
      sourceProfileCustomName:
        sourceProfileName === "Custom" ? customSourceName : undefined,
      targetProfileCustomName:
        targetProfileName === "Custom" ? customTargetName : undefined,
    });
  }, [
    onChange,
    additionsMode,
    singleSalts.gypsum_g,
    singleSalts.cacl2_g,
    singleSalts.epsom_g,
    singleSalts.nacl_g,
    singleSalts.nahco3_g,
    mashSalts.gypsum_g,
    mashSalts.cacl2_g,
    mashSalts.epsom_g,
    mashSalts.nacl_g,
    mashSalts.nahco3_g,
    spargeSalts.gypsum_g,
    spargeSalts.cacl2_g,
    spargeSalts.epsom_g,
    spargeSalts.nacl_g,
    spargeSalts.nahco3_g,
    totalProfile,
    computedMashSalts,
    computedSpargeSalts,
    sourceProfileName,
    targetProfileName,
    source,
    target,
    customSourceName,
    customTargetName,
  ]);

  // Hydrate salts when a recipe provides saved totals; clear when undefined
  useEffect(() => {
    if (initialTotalSalts) {
      setAdditionsMode("single");
      setSingleSalts({ ...initialTotalSalts });
    } else {
      setSingleSalts({});
    }
  }, [initialTotalSalts]);

  const content = (
    <>
      <Collapsible open={!compact}>
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Source Water">
              <select
                className="w-full rounded-md border px-2 py-2.5"
                value={sourceProfileName}
                onChange={(e) => setSourceProfileName(e.target.value)}
              >
                {[
                  ...Object.keys(COMMON_WATER_PROFILES),
                  ...savedProfiles.map((s) => `saved:${s.id}`),
                  "Custom",
                ].map((k) => (
                  <option key={k} value={k}>
                    {k.startsWith("saved:")
                      ? savedProfiles.find((s) => `saved:${s.id}` === k)
                          ?.name ?? k
                      : k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target Water">
              <div className="relative group focus-within:z-10">
                <select
                  className="w-full rounded-md border px-2 py-2.5"
                  value={targetProfileName}
                  onChange={(e) => setTargetProfileName(e.target.value)}
                >
                  <optgroup label="Common">
                    {Object.keys(COMMON_WATER_PROFILES).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </optgroup>
                  {savedProfiles.length > 0 && (
                    <optgroup label="Saved">
                      {savedProfiles.map((s) => (
                        <option key={s.id} value={`saved:${s.id}`}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Beer Styles">
                    {Object.keys(STYLE_TARGETS).map((name) => (
                      <option key={name} value={`style:${name}`}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="Custom">Custom</option>
                </select>
                {styleTips && (
                  <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:block group-focus-within:block z-20">
                    <div className="rounded-xl border border-white/10 bg-white/10 p-1 max-w-[28rem] shadow-2xl shadow-black/30 backdrop-blur-sm supports-[backdrop-filter]:bg-white/5">
                      <div className="rounded-lg bg-neutral-900/90 p-2 text-xs">
                        <div className="font-medium mb-1 text-white/85">
                          Style Tips — {styleTips.name}
                        </div>
                        <pre className="whitespace-pre-wrap text-white/70">
                          {styleTips.text}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Field>
            {variant === "card" ? (
              <>
                <Field label="Mash Volume">
                  <InputWithSuffix
                    value={mashVol}
                    onChange={setMashVol}
                    step={0.1}
                    suffix=" L"
                    suffixClassName="right-3 text-[10px]"
                  />
                </Field>
                <Field label="Sparge Volume">
                  <InputWithSuffix
                    value={spargeVol}
                    onChange={setSpargeVol}
                    step={0.1}
                    suffix=" L"
                    suffixClassName="right-3 text-[10px]"
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="flex flex-col justify-center text-sm py-6 text-muted">
                  <div>Mash: {effectiveMashVol.toFixed(1)} L</div>
                  <div>Sparge: {effectiveSpargeVol.toFixed(1)} L</div>
                </div>
                <div />
              </>
            )}
          </div>
          {/* tips now shown as hover/focus popover near Target select */}
        </div>

        {/* Inline custom editors when Custom is selected */}
        {(sourceProfileName === "Custom" || targetProfileName === "Custom") && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {sourceProfileName === "Custom" && (
              <CustomProfileEditor
                title="Custom Source"
                value={customSource}
                onChange={(p) => setCustomSource(p)}
                variant={variant}
                name={customSourceName}
                onNameChange={setCustomSourceName}
                onSave={() => {
                  if (!customSource) return;
                  if (editingSourceId) {
                    const updated = updateSavedWaterProfile(
                      editingSourceId,
                      customSourceName,
                      customSource
                    );
                    if (updated) setSavedProfiles(loadSavedWaterProfiles());
                  } else {
                    const saved = saveNewWaterProfile(
                      customSourceName,
                      customSource
                    );
                    setSavedProfiles(loadSavedWaterProfiles());
                    setEditingSourceId(saved.id);
                  }
                }}
              />
            )}
            {targetProfileName === "Custom" && (
              <CustomProfileEditor
                title="Custom Target"
                value={customTarget}
                onChange={(p) => setCustomTarget(p)}
                variant={variant}
                name={customTargetName}
                onNameChange={setCustomTargetName}
                onSave={() => {
                  if (!customTarget) return;
                  if (editingTargetId) {
                    const updated = updateSavedWaterProfile(
                      editingTargetId,
                      customTargetName,
                      customTarget
                    );
                    if (updated) setSavedProfiles(loadSavedWaterProfiles());
                  } else {
                    const saved = saveNewWaterProfile(
                      customTargetName,
                      customTarget
                    );
                    setSavedProfiles(loadSavedWaterProfiles());
                    setEditingTargetId(saved.id);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Profile comparison above additions */}
        <ProfileDiff
          source={source}
          target={target}
          adjusted={totalProfile}
          variant={variant}
        />
      </Collapsible>

      {compact ? (
        <div className="mt-4">
          <div className="font-medium mb-2">Salt Additions</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {renderSaltInputs(singleSalts, setSingleSalts, saltHints)}
          </div>
          <div className="mt-2 text-xs text-neutral-600 flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSplitByVolume}
                onChange={(e) => setAutoSplitByVolume(e.target.checked)}
              />
              Auto split by volume
            </label>
            {autoSplitByVolume && (
              <span>
                Mash {effectiveMashVol.toFixed(1)} L • Sparge{" "}
                {effectiveSpargeVol.toFixed(1)} L
              </span>
            )}
          </div>
          {autoSplitByVolume && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {renderSplitPreview(computedMashSalts, computedSpargeSalts)}
            </div>
          )}
        </div>
      ) : additionsMode === "single" ? (
        <div className="mt-4">
          <div className="font-medium mb-2">Salt Additions (total)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {renderSaltInputs(singleSalts, setSingleSalts, saltHints)}
          </div>
          <div className="mt-2 text-xs text-neutral-600 flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSplitByVolume}
                onChange={(e) => setAutoSplitByVolume(e.target.checked)}
              />
              Auto split by volume
            </label>
            {autoSplitByVolume && (
              <span>
                Mash {effectiveMashVol.toFixed(1)} L • Sparge{" "}
                {effectiveSpargeVol.toFixed(1)} L
              </span>
            )}
            {/* Right-aligned mode toggle */}
            <div className="ml-auto flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="saltmode"
                  checked={true}
                  onChange={() => setAdditionsMode("single")}
                />
                Single input (auto split)
              </label>
              <span className="text-neutral-500">•</span>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="saltmode"
                  checked={false}
                  onChange={() => setAdditionsMode("separate")}
                />
                Separate mash and sparge
              </label>
            </div>
          </div>
          {autoSplitByVolume && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {renderSplitPreview(computedMashSalts, computedSpargeSalts)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="font-medium mb-2">Mash Additions</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {renderSaltInputs(mashSalts, setMashSalts, saltHints)}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Sparge Additions</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {renderSaltInputs(spargeSalts, setSpargeSalts, saltHints)}
              </div>
            </div>
          </div>
          {/* Bottom right-aligned mode toggle */}
          <div className="mt-3 text-xs text-neutral-600 flex items-center">
            <div className="ml-auto flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="saltmode"
                  checked={false}
                  onChange={() => setAdditionsMode("single")}
                />
                Single input (auto split)
              </label>
              <span className="text-neutral-500">•</span>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="saltmode"
                  checked={true}
                  onChange={() => setAdditionsMode("separate")}
                />
                Separate mash and sparge
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Removed separate Mash/Sparge/Adjusted cards; Profile Match covers it */}
    </>
  );

  if (variant === "embedded") {
    return <div className="space-y-3">{content}</div>;
  }
  return (
    <CalculatorCard
      title="Water Salts"
      right={
        <button
          type="button"
          className="text-xs rounded-md border px-2 py-1 hover:bg-white/20"
          onClick={toggleCompact}
        >
          {compact ? "Expand" : "Collapse"}
        </button>
      }
    >
      {content}
    </CalculatorCard>
  );
}

function renderSaltInputs(
  values: SaltAdditions,
  setValues: (s: SaltAdditions) => void,
  hints: Record<keyof SaltAdditions, string>
) {
  const update = (k: keyof SaltAdditions, v: number) =>
    setValues({ ...values, [k]: v });
  return (
    <>
      <Field
        label={
          <HoverHint text={hints.gypsum_g}>
            <span>{SALT_LABELS.gypsum_g}</span>
          </HoverHint>
        }
      >
        <InputWithSuffix
          value={values.gypsum_g ?? 0}
          onChange={(n) => update("gypsum_g", n)}
          step={0.1}
          suffix=" g"
          suffixClassName="right-3 text-[10px]"
        />
      </Field>
      <Field
        label={
          <HoverHint text={hints.cacl2_g}>
            <span>{SALT_LABELS.cacl2_g}</span>
          </HoverHint>
        }
      >
        <InputWithSuffix
          value={values.cacl2_g ?? 0}
          onChange={(n) => update("cacl2_g", n)}
          step={0.1}
          suffix=" g"
          suffixClassName="right-3 text-[10px]"
        />
      </Field>
      <Field
        label={
          <HoverHint text={hints.epsom_g}>
            <span>{SALT_LABELS.epsom_g}</span>
          </HoverHint>
        }
      >
        <InputWithSuffix
          value={values.epsom_g ?? 0}
          onChange={(n) => update("epsom_g", n)}
          step={0.1}
          suffix=" g"
          suffixClassName="right-3 text-[10px]"
        />
      </Field>
      <Field
        label={
          <HoverHint text={hints.nacl_g}>
            <span>{SALT_LABELS.nacl_g}</span>
          </HoverHint>
        }
      >
        <InputWithSuffix
          value={values.nacl_g ?? 0}
          onChange={(n) => update("nacl_g", n)}
          step={0.1}
          suffix=" g"
          suffixClassName="right-3 text-[10px]"
        />
      </Field>
      <Field
        label={
          <HoverHint text={hints.nahco3_g}>
            <span>{SALT_LABELS.nahco3_g}</span>
          </HoverHint>
        }
      >
        <InputWithSuffix
          value={values.nahco3_g ?? 0}
          onChange={(n) => update("nahco3_g", n)}
          step={0.1}
          suffix=" g"
          suffixClassName="right-3 text-[10px]"
        />
      </Field>
    </>
  );
}

function renderSplitPreview(mash: SaltAdditions, sparge: SaltAdditions) {
  const Row = ({ label, m, s }: { label: string; m?: number; s?: number }) => (
    <div className="flex items-center justify-between rounded border px-2 py-1 bg-white/40">
      <span className="text-white/40">{label}</span>
      <span className="text-strong font-medium">
        M {m ? m.toFixed(1) : "0.0"} g • S {s ? s.toFixed(1) : "0.0"} g
      </span>
    </div>
  );
  return (
    <>
      <Row label="Gypsum (CaSO4)" m={mash.gypsum_g} s={sparge.gypsum_g} />
      <Row
        label="Calcium Chloride (CaCl2)"
        m={mash.cacl2_g}
        s={sparge.cacl2_g}
      />
      <Row label="Epsom (MgSO4)" m={mash.epsom_g} s={sparge.epsom_g} />
      <Row label="Table Salt (NaCl)" m={mash.nacl_g} s={sparge.nacl_g} />
      <Row label="Baking Soda (NaHCO3)" m={mash.nahco3_g} s={sparge.nahco3_g} />
    </>
  );
}

// Removed old IonCard display in favor of ProfileDiff

function CustomProfileEditor({
  title,
  value,
  onChange,
  variant = "card",
  name,
  onNameChange,
  onSave,
}: {
  title: string;
  value: WaterProfile | null;
  onChange: (p: WaterProfile) => void;
  variant?: "card" | "embedded";
  name?: string;
  onNameChange?: (s: string) => void;
  onSave?: () => void;
}) {
  const current: WaterProfile = value ?? {
    Ca: 0,
    Mg: 0,
    Na: 0,
    Cl: 0,
    SO4: 0,
    HCO3: 0,
  };
  const set = (k: keyof WaterProfile, v: number) =>
    onChange({ ...current, [k]: Math.max(0, v) });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">(
    "idle"
  );
  const onClickSave = async () => {
    if (!onSave || saveState !== "idle") return;
    try {
      setSaveState("saving");
      // Allow for sync or async onSave
      await Promise.resolve(onSave());
      setSaveState("success");
      window.setTimeout(() => setSaveState("idle"), 1000);
    } catch {
      setSaveState("idle");
    }
  };
  return (
    <div
      className={
        variant === "embedded"
          ? "rounded-xl border border-white/5 bg-white/10 p-3"
          : "rounded-xl border border-white/10 bg-white/20 p-3"
      }
    >
      <div className="font-medium mb-2 flex items-center gap-2">
        <span>{title}</span>
        <input
          className="flex-1 rounded-md border px-2 py-1 text-sm"
          placeholder="Profile name"
          value={name ?? ""}
          onChange={(e) => onNameChange?.(e.target.value)}
        />
        <button
          className={`rounded-md border px-2 py-1 text-xs hover:bg-white/30 inline-flex items-center gap-2 ${
            saveState === "saving" ? "opacity-70" : ""
          }`}
          onClick={onClickSave}
          type="button"
          disabled={saveState !== "idle"}
        >
          {saveState === "saving" ? (
            <>
              <svg
                className="h-3 w-3 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Saving
            </>
          ) : saveState === "success" ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-3 h-3 text-emerald-500"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.28a.75.75 0 10-1.22-.9l-3.236 4.386-1.49-1.49a.75.75 0 10-1.06 1.06l2.1 2.1a.75.75 0 001.14-.094l3.766-5.062z"
                  clipRule="evenodd"
                />
              </svg>
              Saved
            </>
          ) : (
            <>Save</>
          )}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ION_KEYS.map((k) => (
          <label key={k} className="block text-sm">
            <div className="text-muted mb-1">{k}</div>
            <input
              type="number"
              className="w-full rounded-md border px-3 py-2"
              value={current[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              step={1}
              min={0}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ProfileDiff({
  source,
  target,
  adjusted,
  tolerance = DEFAULT_TOLERANCE_PPM,
  variant = "card",
}: {
  source: WaterProfile;
  target: WaterProfile;
  adjusted: WaterProfile;
  tolerance?: number;
  variant?: "card" | "embedded";
}) {
  // (no expanded table; compact mode renders directly)
  const badge = (d: number) => {
    const abs = Math.abs(d);
    const within = abs <= tolerance;
    if (within) {
      return (
        <span className="rounded px-2 py-0.5 text-xs bg-emerald-600/60 text-white">
          {d.toFixed(0)}
        </span>
      );
    }
    const over = Math.max(0, abs - tolerance);
    const norm = Math.min(1, over / (tolerance * 5));
    const step = Math.min(5, Math.max(0, Math.floor(norm * 6)));
    if (d > 0) {
      const posBg = [
        "bg-yellow-400/30",
        "bg-yellow-500/40",
        "bg-yellow-600/50",
        "bg-yellow-700/60",
        "bg-yellow-700/70",
        "bg-yellow-800/80",
      ];
      return (
        <span
          className={`rounded px-2 py-0.5 text-xs ${posBg[step]} text-white`}
        >
          {d.toFixed(0)}
        </span>
      );
    } else {
      const negBg = [
        "bg-red-400/30",
        "bg-red-500/40",
        "bg-red-600/50",
        "bg-red-700/60",
        "bg-red-700/70",
        "bg-red-800/80",
      ];
      return (
        <span
          className={`rounded px-2 py-0.5 text-xs ${negBg[step]} text-white`}
        >
          {d.toFixed(0)}
        </span>
      );
    }
  };
  return (
    <div
      className={
        variant === "embedded"
          ? "mt-6 rounded-xl border border-white/5 bg-white/10 p-3"
          : "mt-6 rounded-xl border border-white/10 bg-white/20 p-3"
      }
    >
      <div className="mb-2 font-medium text-white/90">Profile Match</div>
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1 items-center">
          <div className="px-2 py-1 text-xs text-primary-strong" />
          {ION_KEYS.map((k) => (
            <div key={k} className="px-2 py-1 text-xs text-primary-strong">
              {k}
            </div>
          ))}
          <div />
        </div>
        <Row label="Source" values={source} badge={null} />
        <Row label="Target" values={target} badge={null} />
        <Row
          label="Adjusted"
          values={adjusted}
          badge={(k) => badge(adjusted[k] - target[k])}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  values,
  badge,
}: {
  label: string;
  values: WaterProfile;
  badge: null | ((k: keyof WaterProfile) => React.ReactNode);
}) {
  return (
    <div className="grid grid-cols-7 gap-1 items-center">
      <div className="px-2 py-1 text-xs text-primary">{label}</div>
      {ION_KEYS.map((k) => (
        <div key={k} className="px-2 py-1 text-sm flex items-center gap-2">
          <span>{values[k].toFixed(0)}</span>
          {badge ? <span>{badge(k)}</span> : null}
        </div>
      ))}
      <div />
    </div>
  );
}

// Collapsible moved to shared component
