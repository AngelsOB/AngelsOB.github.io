"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";

import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { useRecipeCalculations } from "@/modules/beta-builder/presentation/hooks/useRecipeCalculations";
import { useBrewSessionStore } from "@/modules/beta-builder/presentation/stores/brewSessionStore";
import FermentableSection from "@/modules/hopskip/components/builder/FermentableSection";
import HopSection from "@/modules/beta-builder/presentation/components/HopSection";
import MashScheduleSection from "@/modules/beta-builder/presentation/components/MashScheduleSection";
import WaterSection from "@/modules/beta-builder/presentation/components/WaterSection";
import YeastSection from "@/modules/beta-builder/presentation/components/YeastSection";
import FermentationSection from "@/modules/beta-builder/presentation/components/FermentationSection";
import HSBrewSheetSection from "@/modules/hopskip/components/builder/HSBrewSheetSection";
import { EquipmentSection } from "@/modules/beta-builder/presentation/components/EquipmentSection";
import StyleSelectorModal from "@/modules/beta-builder/presentation/components/StyleSelectorModal";
import StyleRangeComparison from "@/modules/beta-builder/presentation/components/StyleRangeComparison";
import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";
import type {
  SessionActuals,
  SessionStatus,
} from "@/modules/beta-builder/domain/models/BrewSession";
import { useAuthStore } from "@/modules/auth/authStore";
import { getBjcpStyleSpec } from "@/utils/bjcpSpecs";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import HSButton from "./HSButton";
import HSForkButton from "./public/HSForkButton";
import HSRatingStars from "./public/HSRatingStars";

const display: CSSProperties = {
  fontFamily: hsTokens.display,
  letterSpacing: "-0.035em",
  lineHeight: 0.92,
};

const BAND_PADDING_X = "clamp(20px, 4vw, 48px)";

type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface TabDef {
  k: TabKey;
  label: string;
  c: string;
  countFrom?: (totals: TabCounts) => number | null;
}

interface TabCounts {
  fermentables: number;
  hops: number;
  mash: number;
  yeasts: number;
  fermentation: number;
}

const TABS: TabDef[] = [
  { k: "fermentables", label: "Fermentables", c: hsTokens.malt, countFrom: (t) => t.fermentables },
  { k: "hops", label: "Hops", c: hsTokens.hops, countFrom: (t) => t.hops },
  { k: "mash", label: "Mash", c: hsTokens.roast, countFrom: (t) => t.mash },
  { k: "water", label: "Water", c: hsTokens.water },
  { k: "yeast", label: "Yeast", c: hsTokens.yeast, countFrom: (t) => t.yeasts },
  { k: "fermentation", label: "Fermentation", c: hsTokens.honey, countFrom: (t) => t.fermentation },
  { k: "brewsheet", label: "Brew sheet", c: hsTokens.ink },
];

interface Props {
  recipeId?: string;
  /** When set, the builder renders in read-only shared-recipe mode. */
  sharedRecipe?: Recipe;
  sharedOwnerName?: string;
  sharedOwnerId?: string;
  sharedRatingAvg?: number;
  sharedRatingCount?: number;
}

export default function HopSkipBuilder({
  recipeId,
  sharedRecipe,
  sharedOwnerName,
  sharedOwnerId,
  sharedRatingAvg,
  sharedRatingCount,
}: Props) {
  const isShared = Boolean(sharedRecipe);
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const loadRecipe = useRecipeStore((s) => s.loadRecipe);
  const createNewRecipe = useRecipeStore((s) => s.createNewRecipe);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const saveCurrentRecipe = useRecipeStore((s) => s.saveCurrentRecipe);
  const viewerUid = useAuthStore((s) => s.user?.uid);
  const isOwnedByViewer = Boolean(viewerUid && sharedOwnerId && viewerUid === sharedOwnerId);

  // Brew Mode wiring (Phase 2.5b)
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") ?? null;
  const sessionParam = searchParams?.get("session") ?? null;

  const currentSession = useBrewSessionStore((s) => s.currentSession);
  const allSessions = useBrewSessionStore((s) => s.sessions);
  const loadSessionForBrew = useBrewSessionStore((s) => s.loadSession);
  const loadSessionsByRecipeId = useBrewSessionStore(
    (s) => s.loadSessionsByRecipeId
  );
  const createSession = useBrewSessionStore((s) => s.createSession);
  const updateActuals = useBrewSessionStore((s) => s.updateActuals);
  const updateAddedFlags = useBrewSessionStore((s) => s.updateAddedFlags);
  const updateStatus = useBrewSessionStore((s) => s.updateStatus);
  const saveCurrentSession = useBrewSessionStore((s) => s.saveCurrentSession);

  const isBrewMode = Boolean(sessionParam && currentSession?.id === sessionParam);

  const initialActiveTab: TabKey =
    tabParam && TABS.some((t) => t.k === tabParam)
      ? (tabParam as TabKey)
      : "fermentables";
  const [activeTab, setActiveTab] = useState<TabKey>(initialActiveTab);
  const [tabDirection, setTabDirection] = useState<"left" | "right">("right");
  const [savedRecently, setSavedRecently] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [showStyleRanges, setShowStyleRanges] = useState(true);

  const switchTab = useCallback(
    (next: TabKey) => {
      if (next === activeTab) return;
      const prevIdx = TABS.findIndex((t) => t.k === activeTab);
      const nextIdx = TABS.findIndex((t) => t.k === next);
      setTabDirection(nextIdx > prevIdx ? "right" : "left");
      setActiveTab(next);
    },
    [activeTab]
  );

  const calc = useRecipeCalculations(currentRecipe);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (sharedRecipe) setCurrentRecipe(sharedRecipe);
    else if (recipeId) loadRecipe(recipeId);
    else createNewRecipe();
  }, [recipeId, sharedRecipe, loadRecipe, createNewRecipe, setCurrentRecipe]);

  const handleSave = useCallback(() => {
    saveCurrentRecipe();
    setSavedRecently(true);
    const t = setTimeout(() => setSavedRecently(false), 2000);
    return () => clearTimeout(t);
  }, [saveCurrentRecipe]);

  // ─── Brew Mode plumbing (Phase 2.5b) ───
  // Load a session when ?session=<id> is present in the URL
  useEffect(() => {
    if (!sessionParam) return;
    if (currentSession?.id === sessionParam) return;
    loadSessionForBrew(sessionParam);
  }, [sessionParam, currentSession?.id, loadSessionForBrew]);

  // Preload all sessions for this recipe once the brew sheet tab is active,
  // so the Brew button picker has data ready.
  const sessionsPrefetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTab !== "brewsheet") return;
    if (!currentRecipe || isShared) return;
    if (sessionsPrefetchedRef.current === currentRecipe.id) return;
    sessionsPrefetchedRef.current = currentRecipe.id;
    loadSessionsByRecipeId(currentRecipe.id);
  }, [activeTab, currentRecipe, isShared, loadSessionsByRecipeId]);

  const priorSessionsForRecipe = useMemo(() => {
    if (!currentRecipe) return [];
    return allSessions
      .filter((s) => s.recipeId === currentRecipe.id)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [allSessions, currentRecipe]);

  // Auto-save: 400ms debounce + flush on unload (mirrors classic BrewSessionPage)
  const saveTimerRef = useRef<number | null>(null);
  const hasPendingSaveRef = useRef(false);
  const queueSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    hasPendingSaveRef.current = true;
    saveTimerRef.current = window.setTimeout(() => {
      saveCurrentSession();
      hasPendingSaveRef.current = false;
    }, 400);
  }, [saveCurrentSession]);

  useEffect(() => {
    const flush = () => {
      if (!hasPendingSaveRef.current) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveCurrentSession();
      hasPendingSaveRef.current = false;
    };
    const handler = () => flush();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      flush();
    };
  }, [saveCurrentSession]);

  const handleActualsChange = useCallback(
    (partial: Partial<SessionActuals>) => {
      updateActuals(partial);
      queueSave();
    },
    [updateActuals, queueSave]
  );

  const handleAddedChange = useCallback(
    (id: string, checked: boolean) => {
      updateAddedFlags({ [id]: checked });
      queueSave();
    },
    [updateAddedFlags, queueSave]
  );

  const handleIngredientActualChange = useCallback(
    (id: string, amount: number | undefined) => {
      const existing = currentSession?.actuals.ingredientActualAmounts ?? {};
      let next: Record<string, number>;
      if (amount === undefined) {
        next = { ...existing };
        delete next[id];
      } else {
        next = { ...existing, [id]: amount };
      }
      updateActuals({ ingredientActualAmounts: next });
      queueSave();
    },
    [currentSession, updateActuals, queueSave]
  );

  const handleStatusChange = useCallback(
    (status: SessionStatus) => {
      updateStatus(status);
      queueSave();
    },
    [updateStatus, queueSave]
  );

  const startNewSession = useCallback(() => {
    if (!currentRecipe) return;
    const session = createSession(currentRecipe);
    saveCurrentSession();
    router.replace(
      `/recipes/${currentRecipe.id}?tab=brewsheet&session=${session.id}`
    );
  }, [currentRecipe, createSession, saveCurrentSession, router]);

  const resumeSession = useCallback(
    (id: string) => {
      if (!currentRecipe) return;
      router.replace(
        `/recipes/${currentRecipe.id}?tab=brewsheet&session=${id}`
      );
    },
    [currentRecipe, router]
  );

  const exitBrewMode = useCallback(() => {
    if (!currentRecipe) return;
    if (hasPendingSaveRef.current) {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveCurrentSession();
      hasPendingSaveRef.current = false;
    }
    router.replace(`/recipes/${currentRecipe.id}?tab=brewsheet`);
  }, [currentRecipe, router, saveCurrentSession]);

  const handleToggleBrewMode = useCallback(() => {
    if (isBrewMode) {
      exitBrewMode();
      return;
    }
    // Entering Brew Mode — if no prior sessions, create new immediately;
    // otherwise the SessionPicker handles the choice (rendered by HSBrewSheetSection).
    if (priorSessionsForRecipe.length === 0) {
      startNewSession();
    }
    // else: caller (HSBrewSheetSection) opens the picker; no-op here.
  }, [isBrewMode, priorSessionsForRecipe.length, exitBrewMode, startNewSession]);

  if (!currentRecipe) {
    return (
      <section
        style={{
          padding: `80px ${BAND_PADDING_X}`,
          textAlign: "center",
          color: hsTokens.muted,
        }}
      >
        Loading recipe…
      </section>
    );
  }

  const totals: TabCounts = {
    fermentables: currentRecipe.fermentables.length,
    hops: currentRecipe.hops.length,
    mash: currentRecipe.mashSteps.length,
    yeasts: currentRecipe.yeasts.length,
    fermentation: currentRecipe.fermentationSteps.length,
  };

  const bjcpSpec = getBjcpStyleSpec(currentRecipe.style?.split(".")[0]?.trim());
  const rangeStr = (r?: [number, number], precision = 3, suffix = "") =>
    r ? `${r[0].toFixed(precision)}${suffix}–${r[1].toFixed(precision)}${suffix}` : "—";

  return (
    <>
      {/* ── Sub-header band ── */}
      <div
        style={{
          padding: `10px ${BAND_PADDING_X}`,
          background: hsTokens.cream2,
          borderBottom: `2px solid ${hsTokens.ink}`,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={isShared ? "/browse" : "/recipes"}
          style={{
            background: "transparent",
            color: hsTokens.muted,
            border: "none",
            padding: "6px 0",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
            fontFamily: hsTokens.body,
          }}
        >
          ← {isShared ? "Back to browse" : "Back to recipes"}
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isShared ? (
            <>
              {isOwnedByViewer && currentRecipe ? (
                <HSButton variant="ghost" size="sm" href={`/recipes/${currentRecipe.id}`}>
                  Open in builder ↗
                </HSButton>
              ) : null}
              {currentRecipe ? (
                <HSForkButton
                  recipeId={currentRecipe.id}
                  recipeName={currentRecipe.name}
                  size="sm"
                />
              ) : null}
            </>
          ) : (
            <>
              <span
                style={{
                  fontSize: 12,
                  color: savedRecently ? hsTokens.hops : hsTokens.muted,
                  transition: "color 0.2s",
                  fontFamily: hsTokens.body,
                }}
              >
                {savedRecently ? "✓ Saved!" : "Edits not saved"}
              </span>
              <Link
                href={recipeId ? `/betabuilder/recipes/${recipeId}` : "/betabuilder/recipes/new"}
                style={{
                  background: hsTokens.paper,
                  color: hsTokens.ink,
                  border: `2px solid ${hsTokens.ink}`,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 999,
                  boxShadow: hsTokens.sh1,
                  fontFamily: hsTokens.body,
                  textDecoration: "none",
                }}
              >
                Open in classic ↗
              </Link>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  background: hsTokens.hops,
                  color: hsTokens.cream,
                  border: `2px solid ${hsTokens.ink}`,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 999,
                  boxShadow: hsTokens.sh2,
                  cursor: "pointer",
                  fontFamily: hsTokens.body,
                }}
              >
                Save recipe →
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Title band ── */}
      <section
        style={{
          padding: `28px ${BAND_PADDING_X} 20px`,
          borderBottom: `2px solid ${hsTokens.ink}`,
        }}
      >
        <HSScriptNote
          color={isShared ? hsTokens.water : hsTokens.yeast}
          size={28}
        >
          {isShared ? "shared recipe —" : "recipe draft —"}
        </HSScriptNote>
        <div style={{ marginTop: 6 }}>
          {isShared ? (
            <h1
              style={{
                ...display,
                fontSize: 72,
                fontFamily: hsTokens.display,
                color: hsTokens.ink,
                margin: 0,
                width: "100%",
                minWidth: 0,
              }}
            >
              {currentRecipe.name || "Untitled recipe"}
            </h1>
          ) : (
            <input
              type="text"
              value={currentRecipe.name ?? ""}
              onChange={(e) => updateRecipe({ name: e.target.value })}
              aria-label="Recipe name"
              placeholder="Untitled recipe"
              style={{
                ...display,
                fontSize: 72,
                border: "none",
                background: "transparent",
                fontFamily: hsTokens.display,
                color: hsTokens.ink,
                outline: "none",
                padding: 0,
                width: "100%",
                minWidth: 0,
              }}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <ClickableMetaPill
            label="STYLE"
            value={currentRecipe.style ?? (isShared ? "—" : "Add style…")}
            color={hsTokens.malt}
            onClick={isShared ? undefined : () => setIsStyleModalOpen(true)}
            readOnly={isShared}
          />
          <NumericMetaPill
            label="BATCH"
            value={currentRecipe.batchVolumeL}
            unit="L"
            color={hsTokens.water}
            step={0.5}
            min={1}
            max={500}
            onChange={(v) => updateRecipe({ batchVolumeL: v })}
            readOnly={isShared}
          />
          <NumericMetaPill
            label="BOIL"
            value={currentRecipe.equipment?.boilTimeMin ?? 60}
            unit="min"
            color={hsTokens.roast}
            step={5}
            min={15}
            max={180}
            onChange={(v) =>
              updateRecipe({
                equipment: { ...currentRecipe.equipment, boilTimeMin: v },
              })
            }
            readOnly={isShared}
          />
          <NumericMetaPill
            label="EFF"
            value={currentRecipe.equipment?.mashEfficiencyPercent ?? 75}
            unit="%"
            color={hsTokens.hops}
            step={1}
            min={30}
            max={100}
            onChange={(v) =>
              updateRecipe({
                equipment: { ...currentRecipe.equipment, mashEfficiencyPercent: v },
              })
            }
            readOnly={isShared}
          />
          <button
            type="button"
            onClick={() => setIsEquipmentOpen((v) => !v)}
            aria-expanded={isEquipmentOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isEquipmentOpen ? hsTokens.ink : "transparent",
              color: isEquipmentOpen ? hsTokens.cream : hsTokens.muted,
              border: `1.5px solid ${
                isEquipmentOpen
                  ? hsTokens.ink
                  : `color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`
              }`,
              borderRadius: 999,
              padding: "6px 14px 6px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: hsTokens.body,
              cursor: "pointer",
            }}
          >
            <span>Advanced</span>
            <span style={{ marginLeft: 2 }}>{isEquipmentOpen ? "▲" : "▼"}</span>
          </button>
          {currentRecipe.style ? (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                color: hsTokens.muted,
                border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: hsTokens.body,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={showStyleRanges}
                onChange={(e) => setShowStyleRanges(e.target.checked)}
                style={{
                  width: 13,
                  height: 13,
                  accentColor: hsTokens.ink,
                  margin: 0,
                  cursor: "pointer",
                }}
              />
              <span>Style ranges</span>
            </label>
          ) : null}
        </div>
      </section>

      {/* ── Shared-recipe attribution + ratings band ── */}
      {isShared ? (
        <div
          style={{
            padding: `12px ${BAND_PADDING_X}`,
            background: hsTokens.cream2,
            borderBottom: `2px solid ${hsTokens.ink}`,
            display: "flex",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.muted,
            }}
          >
            <HSScriptNote color={hsTokens.water} size={18} rotate={-3}>
              by —
            </HSScriptNote>
            {sharedOwnerName ? (
              sharedOwnerId ? (
                <Link
                  href={`/u/${sharedOwnerId}`}
                  style={{ color: hsTokens.ink, textDecoration: "underline", fontWeight: 600 }}
                >
                  {sharedOwnerName}
                </Link>
              ) : (
                <span style={{ color: hsTokens.ink, fontWeight: 600 }}>{sharedOwnerName}</span>
              )
            ) : null}
            {currentRecipe?.parentRecipeName ? (
              <span>
                · forked from{" "}
                {currentRecipe.parentRecipeShareSlug ? (
                  <Link
                    href={`/r/${currentRecipe.parentRecipeShareSlug}`}
                    style={{
                      color: hsTokens.ink,
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    {currentRecipe.parentRecipeName}
                  </Link>
                ) : (
                  <span style={{ color: hsTokens.ink, fontWeight: 600 }}>
                    {currentRecipe.parentRecipeName}
                  </span>
                )}
                {currentRecipe.parentRecipeOwnerName ? (
                  <> by {currentRecipe.parentRecipeOwnerName}</>
                ) : null}
              </span>
            ) : null}
          </div>
          {currentRecipe ? (
            <HSRatingStars
              recipeId={currentRecipe.id}
              ratingAvg={sharedRatingAvg}
              ratingCount={sharedRatingCount}
            />
          ) : null}
        </div>
      ) : null}

      {/* ── Advanced expander band ── */}
      <div
        className={`hs-collapse${isEquipmentOpen ? " is-open" : ""}`}
        aria-hidden={!isEquipmentOpen}
      >
        <div className="hs-collapse-inner">
          <section
            ref={(node) => {
              if (!node) return;
              node.querySelectorAll<HTMLDetailsElement>("details.equip-advanced").forEach((d) => {
                if (!d.open) d.open = true;
              });
            }}
            className="brew-theme hs-loose-section"
            style={{
              padding: `20px ${BAND_PADDING_X} 24px`,
              borderBottom: `2px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            <EquipmentSection />
          </section>
        </div>
      </div>

      {/* ── BJCP band ── */}
      {calc && currentRecipe.style ? (
        <div
          className={`hs-collapse${showStyleRanges ? " is-open" : ""}`}
          aria-hidden={!showStyleRanges}
        >
          <div className="hs-collapse-inner">
            <section
              className="brew-theme hs-bjcp"
              style={{
                padding: `18px ${BAND_PADDING_X}`,
                borderBottom: `2px solid ${hsTokens.ink}`,
                background: hsTokens.paper,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 10,
                }}
              >
                <HSEyebrow>BJCP style ranges</HSEyebrow>
                <span style={{ fontSize: 11, color: hsTokens.muted, fontFamily: hsTokens.body }}>
                  · {currentRecipe.style}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: hsTokens.ink,
                    opacity: 0.18,
                  }}
                />
                <HSScriptNote color={hsTokens.yeast} size={16} rotate={-3}>
                  where you sit
                </HSScriptNote>
              </div>
              <div className="hs-bjcp-grid">
                <StyleRangeComparison
                  styleCode={currentRecipe.style}
                  abv={calc.abv}
                  og={calc.og}
                  fg={calc.fg}
                  ibu={calc.ibu}
                  srm={calc.srm}
                />
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* ── Live numbers band ── */}
      {calc ? (
        <section
          style={{
            padding: `20px ${BAND_PADDING_X}`,
            borderBottom: `2px solid ${hsTokens.ink}`,
            background: hsTokens.cream2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <HSEyebrow>Live numbers</HSEyebrow>
            <HSScriptNote color={hsTokens.yeast} size={18} rotate={-2}>
              {isShared ? "set when published ✦" : "updates as you type ✦"}
            </HSScriptNote>
          </div>
          <div
            className="hs-livestats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 12,
            }}
          >
            <StatCard k="OG" v={calc.og.toFixed(3)} c={hsTokens.malt} range={rangeStr(bjcpSpec?.og, 3)} />
            <StatCard k="FG" v={calc.fg.toFixed(3)} c={hsTokens.malt} range={rangeStr(bjcpSpec?.fg, 3)} />
            <StatCard k="ABV" v={calc.abv.toFixed(1)} u="%" c={hsTokens.roast} range={rangeStr(bjcpSpec?.abv, 1, "%")} />
            <StatCard k="IBU" v={Math.round(calc.ibu).toString()} c={hsTokens.hops} range={rangeStr(bjcpSpec?.ibu, 0)} />
            <StatCard k="pH" v={calc.estimatedMashPh?.toFixed(2) ?? "—"} c={hsTokens.water} range="5.2–5.6" />
            <StatCard k="Cal" v={Math.round(calc.calories ?? 0).toString()} u="/12oz" c={hsTokens.muted} range="—" />
          </div>
          <ColorIndicatorBar
            srm={calc.srm}
            styleSrmRange={bjcpSpec?.srm}
          />
          <style>{`
            @media (max-width: 900px) {
              .hs-livestats { grid-template-columns: repeat(3, 1fr) !important; }
            }
            @media (max-width: 640px) {
              .hs-livestats { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `}</style>
        </section>
      ) : null}

      {/* ── Tabs + section body band ── */}
      <section
        style={{
          padding: `0 ${BAND_PADDING_X} 32px`,
          background: hsTokens.cream2,
          borderBottom: `2px solid ${hsTokens.ink}`,
        }}
      >
        <div
          role="tablist"
          aria-label="Recipe sections"
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            overflowX: "auto",
            position: "relative",
            zIndex: 5,
            paddingTop: 18,
            marginBottom: -2,
          }}
          className="hs-no-scrollbar"
        >
          {(() => {
            const mainTabs = TABS.filter((t) => t.k !== "brewsheet");
            const rightTabs = TABS.filter((t) => t.k === "brewsheet");
            const renderTab = (t: TabDef, i: number, arr: TabDef[]) => {
              const isActive = t.k === activeTab;
              const count = t.countFrom ? t.countFrom(totals) : null;
              const isFirst = i === 0;
              const isLast = i === arr.length - 1;
              return (
                <button
                  key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(t.k)}
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: `2px solid ${hsTokens.ink}`,
                    borderLeft: isFirst ? `2px solid ${hsTokens.ink}` : `1px solid ${hsTokens.ink}`,
                    borderRight: isLast ? `2px solid ${hsTokens.ink}` : `1px solid ${hsTokens.ink}`,
                    borderBottom: isActive
                      ? `2px solid ${hsTokens.paper}`
                      : `2px solid ${hsTokens.ink}`,
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    background: isActive ? hsTokens.paper : hsTokens.cream,
                    color: isActive ? hsTokens.ink : hsTokens.muted,
                    fontFamily: hsTokens.body,
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                    cursor: "pointer",
                    position: "relative",
                    /* overflow: hidden so the active tab's absolute accent
                       strip is clipped at the inner border curve and never
                       bleeds into the 2px ink frame at the rounded top
                       corners. */
                    overflow: "hidden",
                    zIndex: isActive ? 2 : 1,
                    marginRight: isLast ? 0 : -1,
                    /* Inactive tabs scale down slightly; transform-origin at
                       bottom keeps the tab anchored to its connection point
                       with the section (so the 2px ink bottom border still
                       aligns with the row's bottom line). Active tab stays
                       full-size so it visually pops. */
                    transform: isActive ? "none" : "scaleY(0.92)",
                    transformOrigin: "center bottom",
                    transition: "transform 120ms ease, background 120ms ease",
                  }}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: t.c,
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      background: t.c,
                      borderRadius: 3,
                      border: `1.5px solid ${hsTokens.ink}`,
                      opacity: isActive ? 1 : 0.6,
                    }}
                  />
                  <span style={{ ...display, fontSize: 14 }}>{t.label}</span>
                  {count !== null && count !== undefined ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: hsTokens.muted,
                        fontVariantNumeric: "tabular-nums",
                        padding: "2px 7px",
                        background: isActive ? hsTokens.cream2 : hsTokens.paper,
                        border: `1px solid ${hsTokens.ink}22`,
                        borderRadius: 999,
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            };
            return (
              <>
                {mainTabs.map((t, i) => renderTab(t, i, mainTabs))}
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    minWidth: 24,
                    borderBottom: `2px solid ${hsTokens.ink}`,
                    alignSelf: "stretch",
                  }}
                />
                {rightTabs.map((t, i) => renderTab(t, i, rightTabs))}
              </>
            );
          })()}
        </div>

        <div
          key={activeTab}
          className={`hs-section-frame brew-theme hs-tab-slide hs-tab-slide-${tabDirection}${
            isShared ? " brew-read-only" : ""
          }`}
          style={{ position: "relative" }}
        >
          {activeTab === "fermentables" ? <FermentableSection /> : null}
          {activeTab === "hops" ? <HopSection /> : null}
          {activeTab === "mash" ? <MashScheduleSection /> : null}
          {activeTab === "water" && calc ? <WaterSection recipe={currentRecipe} calculations={calc} /> : null}
          {activeTab === "yeast" ? <YeastSection /> : null}
          {activeTab === "fermentation" ? <FermentationSection /> : null}
          {activeTab === "brewsheet" && calc ? (
            <HSBrewSheetSection
              recipe={currentRecipe}
              calculations={calc}
              isBrewMode={isBrewMode}
              sessionId={isBrewMode ? currentSession?.id : undefined}
              sessionStatus={isBrewMode ? currentSession?.status : undefined}
              actuals={isBrewMode ? currentSession?.actuals : undefined}
              addedFlags={isBrewMode ? currentSession?.addedFlags : undefined}
              onActualsChange={isBrewMode ? handleActualsChange : undefined}
              onAddedChange={isBrewMode ? handleAddedChange : undefined}
              onIngredientActualChange={
                isBrewMode ? handleIngredientActualChange : undefined
              }
              onStatusChange={isBrewMode ? handleStatusChange : undefined}
              onToggleBrewMode={isShared ? undefined : handleToggleBrewMode}
              priorSessions={priorSessionsForRecipe}
              onResumeSession={resumeSession}
              onCreateNewSession={startNewSession}
            />
          ) : null}
        </div>
      </section>

      <StyleSelectorModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        onSelect={(style: string) => updateRecipe({ style: style || undefined })}
      />
    </>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */

function ClickableMetaPill({
  label,
  value,
  color,
  onClick,
  readOnly,
}: {
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          boxShadow: hsTokens.sh1,
          borderRadius: 999,
          padding: "6px 14px 6px 10px",
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
          cursor: "default",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <HSEyebrow>{label}</HSEyebrow>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{value}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        boxShadow: hsTokens.sh1,
        borderRadius: 999,
        padding: "6px 14px 6px 10px",
        cursor: "pointer",
        fontFamily: hsTokens.body,
        color: hsTokens.ink,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <HSEyebrow>{label}</HSEyebrow>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: 10, color: hsTokens.muted, marginLeft: 2 }}>⌄</span>
    </button>
  );
}

interface NumericMetaPillProps {
  label: string;
  value: number;
  unit: string;
  color: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  readOnly?: boolean;
}

function NumericMetaPill({
  label,
  value,
  unit,
  color,
  step,
  min,
  max,
  onChange,
  readOnly,
}: NumericMetaPillProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        boxShadow: hsTokens.sh1,
        borderRadius: 999,
        padding: "6px 14px 6px 10px",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <HSEyebrow>{label}</HSEyebrow>
      {readOnly ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: hsTokens.body,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
            minWidth: 28,
            textAlign: "right",
          }}
        >
          {value}
        </span>
      ) : (
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          inputMode="decimal"
          aria-label={label}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          style={{
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            background: "transparent",
            fontFamily: hsTokens.body,
            color: hsTokens.ink,
            outline: "none",
            padding: 0,
            width: 56,
            fontVariantNumeric: "tabular-nums",
          }}
        />
      )}
      <span style={{ fontSize: 11, color: hsTokens.muted }}>{unit}</span>
    </div>
  );
}

// ─── Color indicator bar (rich SRM visualization) ────────────────
// Sits below the live-numbers stat card grid. Long horizontal SRM
// gradient, a vertical ink marker at the current SRM, optional hollow
// markers for the BJCP style range endpoints, and a script-font color
// adjective on the right.

function srmAdjective(srm: number): string {
  if (srm < 2) return "straw ✦";
  if (srm < 4) return "pale gold ✦";
  if (srm < 7) return "gold ✦";
  if (srm < 10) return "amber ✦";
  if (srm < 15) return "deep amber ✦";
  if (srm < 20) return "copper ✦";
  if (srm < 28) return "deep red ✦";
  if (srm < 36) return "brown ✦";
  return "black ✦";
}

/**
 * Build the SRM gradient programmatically by sampling srmToRgb at 1-SRM
 * intervals so the color at any X position matches what srmToRgb(srm)
 * returns for that SRM. This guarantees the indicator pin's color
 * (which uses srmToRgb(srm) directly) visually aligns with the gradient
 * underneath it.
 */
const SRM_BAR_MAX = 40;
const SRM_GRADIENT = (() => {
  const stops: string[] = [];
  for (let s = 1; s <= SRM_BAR_MAX; s += 1) {
    const pct = ((s - 1) / (SRM_BAR_MAX - 1)) * 100;
    stops.push(`${srmToRgb(s)} ${pct.toFixed(2)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
})();

function ColorIndicatorBar({
  srm,
  styleSrmRange,
}: {
  srm: number;
  styleSrmRange?: [number, number];
}) {
  const styleMin = styleSrmRange ? styleSrmRange[0] : undefined;
  const styleMax = styleSrmRange ? styleSrmRange[1] : undefined;
  // The gradient is sampled from SRM 1 → 40, so the percentage for an SRM
  // value uses the same 1-based denominator. This is what keeps the pin's
  // color match the underlying gradient color at its position.
  const pct = (n: number) => {
    const clamped = Math.max(1, Math.min(SRM_BAR_MAX, n));
    return `${((clamped - 1) / (SRM_BAR_MAX - 1)) * 100}%`;
  };
  const ebc = Math.round(srm * 1.97);
  const pinColor = srmToRgb(Math.max(1, Math.min(SRM_BAR_MAX, srm)));
  return (
    <div
      style={{
        marginTop: 12,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <HSEyebrow>Color</HSEyebrow>
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 20,
          borderRadius: 4,
          border: `1.5px solid ${hsTokens.ink}`,
          background: SRM_GRADIENT,
        }}
      >
        {/* Style-range endpoint markers (hollow rings) */}
        {styleMin !== undefined && styleMax !== undefined ? (
          <>
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: `calc(${pct(styleMin)} - 5px)`,
                width: 10,
                height: 10,
                borderRadius: 999,
                background: hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                boxSizing: "border-box",
              }}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: `calc(${pct(styleMax)} - 5px)`,
                width: 10,
                height: 10,
                borderRadius: 999,
                background: hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                boxSizing: "border-box",
              }}
            />
          </>
        ) : null}
        {/* Current SRM marker — fill is the actual beer color (srmToRgb)
            so the pin previews what the finished beer looks like. The
            2px ink border keeps it visible against both light and dark
            gradient regions. */}
        <span
          aria-hidden
          title={`${srm.toFixed(1)} SRM · ${pinColor}`}
          style={{
            position: "absolute",
            left: `calc(${pct(srm)} - 7px)`,
            top: -6,
            width: 14,
            height: 32,
            background: pinColor,
            borderRadius: 3,
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: `0 0 0 1.5px ${hsTokens.cream}`,
            boxSizing: "border-box",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 20,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            color: hsTokens.ink,
          }}
        >
          {srm.toFixed(1)}
        </span>
        <span style={{ fontFamily: hsTokens.mono, fontSize: 11, color: hsTokens.muted }}>
          SRM / {ebc} EBC
        </span>
      </div>
      <HSScriptNote color={hsTokens.roast} size={18} rotate={-3}>
        {srmAdjective(srm)}
      </HSScriptNote>
    </div>
  );
}

function StatCard({
  k,
  v,
  u,
  c,
  range,
}: {
  k: string;
  v: string;
  u?: string;
  c: string;
  range: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        padding: "12px 14px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: c,
          /* Inner radius = parent radius (12) − parent border (2px) = 10 */
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          pointerEvents: "none",
        }}
      />
      <HSEyebrow>{k}</HSEyebrow>
      <div
        style={{
          ...display,
          fontSize: 26,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
        {u ? (
          <span style={{ fontSize: 11, color: hsTokens.muted, marginLeft: 3 }}>{u}</span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 10,
          color: hsTokens.muted,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
          fontFamily: hsTokens.mono,
        }}
      >
        {range}
      </div>
    </div>
  );
}
