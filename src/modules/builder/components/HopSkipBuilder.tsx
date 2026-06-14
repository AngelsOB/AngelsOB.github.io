"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";

import { isRecipeDirty, useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useRecipeCalculations } from "@/modules/recipe/hooks/useRecipeCalculations";
import { useBrewSessionStore } from "@/modules/recipe/stores/brewSessionStore";
import FermentableSection from "@/modules/builder/components/builder/FermentableSection";
import HopSection from "@/modules/builder/components/builder/HopSection";
import MashSection from "@/modules/builder/components/builder/MashSection";
import WaterSection from "@/modules/builder/components/builder/WaterSection";
import YeastSection from "@/modules/builder/components/builder/YeastSection";
import FermentationSection from "./builder/FermentationSection";
import HSBrewSheetSection from "@/modules/builder/components/builder/HSBrewSheetSection";
import EquipmentSection from "@/modules/builder/components/builder/EquipmentSection";
import BjcpStylePresetModal from "./modals/BjcpStylePresetModal";
import UnsavedChangesModal from "@/modules/builder/components/UnsavedChangesModal";
import { useUnsavedChangesGuard } from "@/modules/recipe/hooks/useUnsavedChangesGuard";
import BJCPStyleRail from "./BJCPStyleRail";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import {
  BEER_STYLE_TARGETS,
  COMMON_WATER_PROFILES,
  getWaterTargetForBjcpStyle,
} from "@/modules/recipe/services/WaterChemistryService";
import type {
  SessionActuals,
  SessionStatus,
} from "@/modules/recipe/models/BrewSession";
import { useAuthStore } from "@/modules/auth/authStore";
import { getBjcpStyleSpec } from "@/utils/bjcpSpecs";
import HSButton from "./HSButton";
import HSForkButton from "./public/HSForkButton";
import HSRatingStars from "./public/HSRatingStars";
import dynamic from "next/dynamic";
import BuilderTitleBar from "./builder/BuilderTitleBar";
import BrewersNotesButton from "./builder/BrewersNotesButton";
import { isSectionEmpty } from "./builder/sectionEmpty";

const SideColumnMorph = dynamic(() => import("./builder/SideColumnMorph"), {
  ssr: false,
});
const MainSectionMorph = dynamic(() => import("./builder/MainSectionMorph"), {
  ssr: false,
});

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
  /** Title-bar heading, hoisted out of each section so the colored
      bottom rule can span the full builder grid width. */
  heading?: string;
  /** Use a smaller heading clamp for titles that wrap (Fermentation). */
  smallHeading?: boolean;
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
  { k: "fermentables", label: "Fermentables", c: hsTokens.malt, heading: "Fermentables.", countFrom: (t) => t.fermentables },
  { k: "hops", label: "Hops", c: hsTokens.hops, heading: "Hops.", countFrom: (t) => t.hops },
  { k: "mash", label: "Mash", c: hsTokens.roast, heading: "Mash.", countFrom: (t) => t.mash },
  { k: "water", label: "Water", c: hsTokens.water, heading: "Water." },
  { k: "yeast", label: "Yeast", c: hsTokens.yeast, heading: "Yeast.", countFrom: (t) => t.yeasts },
  { k: "fermentation", label: "Fermentation", c: hsTokens.honey, heading: "Fermentation & Conditioning.", smallHeading: true, countFrom: (t) => t.fermentation },
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
  const savedSnapshot = useRecipeStore((s) => s.savedSnapshot);
  const recipeError = useRecipeStore((s) => s.error);
  const loadRecipe = useRecipeStore((s) => s.loadRecipe);
  const createNewRecipe = useRecipeStore((s) => s.createNewRecipe);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const saveCurrentRecipe = useRecipeStore((s) => s.saveCurrentRecipe);
  const viewerUid = useAuthStore((s) => s.user?.uid);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
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
  const [isTitleAreaHovered, setIsTitleAreaHovered] = useState(false);
  const [isSubtitleFocused, setIsSubtitleFocused] = useState(false);

  // Tab strip responsive layout — measure the tablist's available width
  // and tier the rendering: full chrome → drop count → drop swatch →
  // tight padding → two rows. See `tabStageConfig` for thresholds.
  const [tabStripWidth, setTabStripWidth] = useState<number | null>(null);
  // Callback ref: setup/teardown when the tablist mounts/unmounts. Critical
  // because the parent early-returns a Loading state when currentRecipe is
  // null, so the tablist doesn't exist on first render — a useEffect with
  // empty deps would miss the mount entirely and the ResizeObserver would
  // never attach, leaving tabStripWidth=null forever (stuck at stage A).
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureFnRef = useRef<(() => void) | null>(null);
  const tabStripRef = useCallback((el: HTMLDivElement | null) => {
    // Teardown previous observer + listener
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (measureFnRef.current) {
      window.removeEventListener("resize", measureFnRef.current);
      measureFnRef.current = null;
    }
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setTabStripWidth((prev) => (prev === w ? prev : w));
    };
    measureFnRef.current = measure;
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      observerRef.current = ro;
    }
    window.addEventListener("resize", measure);
  }, []);
  const tabStage: "A" | "B" | "C" | "D" | "E" = (() => {
    const w = tabStripWidth ?? 1200;
    if (w >= 1000) return "A";
    if (w >= 850) return "B";
    if (w >= 700) return "C";
    if (w >= 560) return "D";
    return "E";
  })();
  const tabStageConfig = {
    A: { padding: "12px 20px", labelSize: 14, showSwatch: true, showCount: true },
    B: { padding: "12px 18px", labelSize: 14, showSwatch: true, showCount: false },
    C: { padding: "12px 14px", labelSize: 14, showSwatch: false, showCount: false },
    D: { padding: "10px 12px", labelSize: 13, showSwatch: false, showCount: false },
    E: { padding: "10px 12px", labelSize: 13, showSwatch: false, showCount: false },
  } as const;
  const tabCfg = tabStageConfig[tabStage];

  // In stage E we split the swappable tabs into two 3-tab groups and keep
  // Brew sheet pinned to the bottom-right. Track which swappable group
  // was last active so selecting Brew sheet doesn't churn the layout.
  // Group A = Fermentables, Hops, Mash. Group B = Water, Yeast, Fermentation.
  const [lastSwappable, setLastSwappable] = useState<"A" | "B">("A");
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.k === activeTab);
    if (idx >= 0 && idx < 3) setLastSwappable("A");
    else if (idx >= 3 && idx < 6) setLastSwappable("B");
    // brewsheet (idx 6): leave lastSwappable alone
  }, [activeTab]);

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
    // Shared (public) recipes are handed in directly — no auth or fetch needed.
    if (sharedRecipe) {
      initialized.current = true;
      setCurrentRecipe(sharedRecipe);
      return;
    }
    // Wait for Firebase auth to settle before choosing a data source. Until it
    // does, getRecipeRepo() returns null, so we'd read the wrong (localStorage)
    // store, find nothing, and — because init runs once — never retry. That was
    // the "stuck on Loading recipe…" hard-refresh bug: this effect fired before
    // onAuthStateChanged rehydrated the user. Deferring until isAuthLoading
    // flips lets the effect re-run and load against the correct repo (Firestore
    // for signed-in users, localStorage for anonymous).
    if (isAuthLoading) return;
    initialized.current = true;
    if (recipeId) loadRecipe(recipeId);
    else createNewRecipe();
  }, [recipeId, sharedRecipe, isAuthLoading, loadRecipe, createNewRecipe, setCurrentRecipe]);

  const handleSave = useCallback(() => {
    saveCurrentRecipe();
    setSavedRecently(true);
    const t = setTimeout(() => setSavedRecently(false), 2000);
    return () => clearTimeout(t);
  }, [saveCurrentRecipe]);

  // Async save wrapper for the unsaved-changes guard. Resolves true on
  // successful persistence so the guard knows whether to proceed with the
  // pending navigation. Mirrors `handleSave` but awaits the store action.
  const trySave = useCallback(async (): Promise<boolean> => {
    const ok = await saveCurrentRecipe();
    if (ok) {
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2000);
    }
    return ok;
  }, [saveCurrentRecipe]);

  // Unsaved-changes guard. Inert when the recipe is being viewed in
  // read-only shared mode. Registers a beforeunload listener and a popstate
  // listener (with the history.pushState sentinel trick) and exposes
  // `guardedPush` for the "Back to recipes / browse" link below.
  const { guardedPush } = useUnsavedChangesGuard({
    enabled: !isShared,
    onSave: trySave,
  });

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
    // Only treat it as a failure once auth has settled and the store reported
    // an error — otherwise we're still in the normal fetch window.
    if (recipeError && !isAuthLoading) {
      return (
        <section style={{ padding: `80px ${BAND_PADDING_X}`, textAlign: "center" }}>
          <HSScriptNote color={hsTokens.roast} size={22}>
            hmm —
          </HSScriptNote>
          <h1
            style={{
              ...display,
              fontFamily: hsTokens.display,
              fontSize: "clamp(28px, 5vw, 44px)",
              color: hsTokens.ink,
              margin: "10px 0 8px",
            }}
          >
            Couldn&rsquo;t load this recipe.
          </h1>
          <p
            style={{
              color: hsTokens.muted,
              fontFamily: hsTokens.body,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            It may have been deleted, set to private, or the link is wrong.
          </p>
          <HSButton href={isShared ? "/browse" : "/recipes"} variant="ink" color={hsTokens.hops} arrow>
            {isShared ? "Back to browse" : "Back to recipes"}
          </HSButton>
        </section>
      );
    }
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

  // Live (recompute every render) — drives the full-width collapse when a
  // section is empty/intro. Never memoize on activeTab alone, never key on it.
  const sectionEmpty =
    activeTab !== "brewsheet" && isSectionEmpty(activeTab, currentRecipe);

  const bjcpSpec = getBjcpStyleSpec(currentRecipe.style?.split(".")[0]?.trim());

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
        {/* Back link routed through the unsaved-changes guard. Rendered as a
            button (not a <Link>) so the guard can preventDefault and pop the
            confirmation modal before navigating when edits are dirty. */}
        <button
          type="button"
          onClick={() => guardedPush(isShared ? "/browse" : "/recipes")}
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
            cursor: "pointer",
          }}
        >
          ← {isShared ? "Back to browse" : "Back to recipes"}
        </button>
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
          ) : (() => {
            const isDirty = isRecipeDirty(currentRecipe, savedSnapshot);
            return (
              <>
                {/* Signed-out recipes are local-only and can't be shared —
                    the toggle appears once the user signs in. */}
                {viewerUid ? (
                  <ShareToggle
                    isPublic={currentRecipe.isPublic !== false}
                    onToggle={() =>
                      updateRecipe({
                        isPublic: currentRecipe.isPublic === false,
                      })
                    }
                  />
                ) : null}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty}
                    style={{
                      background: hsTokens.hops,
                      color: hsTokens.cream,
                      border: `2px solid ${hsTokens.ink}`,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 999,
                      boxShadow: isDirty ? hsTokens.sh2 : "none",
                      cursor: isDirty ? "pointer" : "default",
                      fontFamily: hsTokens.body,
                      opacity: isDirty ? 1 : 0.4,
                      transition:
                        "opacity 280ms ease, box-shadow 240ms ease",
                    }}
                  >
                    Save recipe →
                  </button>
                  <SaveStatusNote savedRecently={savedRecently} isDirty={isDirty} />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Title band ── */}
      <section
        style={{
          padding: `28px ${BAND_PADDING_X} 20px`,
          borderBottom: isEquipmentOpen ? "none" : `2px solid ${hsTokens.ink}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
        <HSScriptNote
          color={isShared ? hsTokens.water : hsTokens.yeast}
          size={28}
        >
          {isShared ? "shared recipe —" : "recipe draft —"}
        </HSScriptNote>
        <div
          style={{ marginTop: 6 }}
          onMouseEnter={() => setIsTitleAreaHovered(true)}
          onMouseLeave={() => setIsTitleAreaHovered(false)}
        >
          {isShared ? (
            <h1
              style={{
                ...display,
                fontSize: "clamp(36px, 8.5vw, 72px)",
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
                fontSize: "clamp(36px, 8.5vw, 72px)",
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
          {/* ── Subtitle (attribution / tagline) ──
              Empty state collapses; reveals on hover of title block or focus. */}
          {isShared ? (
            currentRecipe.subtitle ? (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: hsTokens.script,
                  fontSize: "clamp(20px, 3vw, 28px)",
                  lineHeight: 1.1,
                  color: hsTokens.muted,
                }}
              >
                {currentRecipe.subtitle}
              </div>
            ) : null
          ) : (() => {
            const hasValue = !!(
              currentRecipe.subtitle && currentRecipe.subtitle.length > 0
            );
            const reveal = hasValue || isTitleAreaHovered || isSubtitleFocused;
            return (
              <div
                style={{
                  overflow: "hidden",
                  maxHeight: reveal ? 44 : 0,
                  opacity: reveal ? 1 : 0,
                  marginTop: reveal ? 4 : 0,
                  transition:
                    "max-height 200ms ease, opacity 180ms ease, margin-top 200ms ease",
                }}
              >
                <input
                  type="text"
                  value={currentRecipe.subtitle ?? ""}
                  onChange={(e) =>
                    updateRecipe({ subtitle: e.target.value || undefined })
                  }
                  onFocus={() => setIsSubtitleFocused(true)}
                  onBlur={() => setIsSubtitleFocused(false)}
                  aria-label="Recipe subtitle or attribution"
                  placeholder="Subtitle…"
                  style={{
                    fontFamily: hsTokens.script,
                    fontSize: "clamp(20px, 3vw, 28px)",
                    lineHeight: 1.1,
                    border: "none",
                    background: "transparent",
                    color: hsTokens.muted,
                    outline: "none",
                    padding: 0,
                    width: "100%",
                    minWidth: 0,
                    display: "block",
                  }}
                />
              </div>
            );
          })()}
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
            <svg
              aria-hidden
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                marginLeft: 2,
                transform: isEquipmentOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 180ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
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
          </div>
          <div style={{ flexShrink: 0, marginRight: "10%" }}>
            <BrewersNotesButton
              notes={currentRecipe.notes ?? ""}
              tags={currentRecipe.tags ?? []}
              onNotesChange={(v) => updateRecipe({ notes: v || undefined })}
              onTagsChange={(v) =>
                updateRecipe({ tags: v.length ? v : undefined })
              }
              readOnly={isShared}
            />
          </div>
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
            style={{
              padding: `20px ${BAND_PADDING_X} 24px`,
              borderBottom: `2px solid ${hsTokens.ink}`,
            }}
          >
            <EquipmentSection />
          </section>
        </div>
      </div>

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
          </div>
          <div
            className="hs-livestats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 12,
            }}
          >
            <StatCard k="OG" v={calc.og.toFixed(3)} c={hsTokens.malt} />
            <StatCard k="FG" v={calc.fg.toFixed(3)} c={hsTokens.malt} />
            <StatCard k="ABV" v={calc.abv.toFixed(1)} u="%" c={hsTokens.roast} />
            <StatCard k="IBU" v={Math.round(calc.ibu).toString()} c={hsTokens.hops} />
            <StatCard k="pH" v={calc.estimatedMashPh?.toFixed(2) ?? "—"} c={hsTokens.water} />
            <StatCard k="Cal" v={Math.round(calc.calories ?? 0).toString()} u="/12oz" c={hsTokens.muted} />
          </div>
          {currentRecipe.style ? (
            <div
              className={`hs-collapse${showStyleRanges ? " is-open" : ""}`}
              aria-hidden={!showStyleRanges}
            >
              <div className="hs-collapse-inner">
                {/* paddingRight/Bottom reserves clearance for the rail's
                    4px hard shadow — the collapse-inner clips overflow to
                    animate height. */}
                <div style={{ paddingTop: 18, paddingRight: 6, paddingBottom: 6 }}>
                  <BJCPStyleRail
                    styleCode={currentRecipe.style}
                    og={calc.og}
                    fg={calc.fg}
                    abv={calc.abv}
                    ibu={calc.ibu}
                    srm={calc.srm}
                    srmRange={bjcpSpec?.srm}
                    onSwitchStyle={isShared ? undefined : () => setIsStyleModalOpen(true)}
                  />
                </div>
              </div>
            </div>
          ) : null}
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
          ref={tabStripRef}
          role="tablist"
          aria-label="Recipe sections"
          data-tab-stage={tabStage}
          data-tab-strip-width={tabStripWidth ?? "null"}
          style={{
            position: "relative",
            zIndex: 5,
            paddingTop: tabStage === "E" ? 8 : 18,
            marginBottom: -3,
          }}
          className="hs-no-scrollbar"
        >
          {/* Hover effect for inactive tabs: rise 4px and reveal a faded
              version of the tab's accent color at the top. !important
              overrides the inline transform (used by the swap/scale logic).
              Active tab is unaffected — its accent strip stays at opacity 1
              and it shouldn't move. */}
          <style>{`
            /* Hover-rise: applies to all inactive tabs. */
            .hs-builder-tab:not([aria-selected="true"]):hover {
              transform: translateY(-3px) !important;
            }
            /* Counter-translate the inner bottom line so it stays anchored
               to the content frame top while the rest of the tab lifts. */
            .hs-builder-tab:not([aria-selected="true"]):hover .hs-bottom-line {
              transform: translateY(3px);
            }
            /* Accent fade-in on hover: applies to all stages. */
            .hs-builder-tab:not([aria-selected="true"]):hover .hs-tab-accent {
              opacity: 0.4;
            }
          `}</style>
          {/* Cover strip — stage E only. Hides the rounded tops of the
              top-row tabs at the very top of the tablist. Cream2 bg
              matches the surrounding band so it's visually invisible.
              z-index above the row containers (z=1, z=2, z=3 inside this
              tablist's stacking context). */}
          {tabStage === "E" ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 12,
                background: hsTokens.cream2,
                zIndex: 6,
                pointerEvents: "none",
              }}
            />
          ) : null}
          {(() => {
            const renderTab = (
              t: TabDef,
              i: number,
              arr: TabDef[],
              isTopRow = false
            ) => {
              const isActive = t.k === activeTab;
              const count = t.countFrom ? t.countFrom(totals) : null;
              const isFirst = i === 0;
              const isLast = i === arr.length - 1;
              const showCount =
                tabCfg.showCount && count !== null && count !== undefined;
              // Single-row visible tab height (= padding-top * 2 + label + borders).
              // Extension is the extra padding-bottom we add so the tab box
              // extends past the visible area; on hover (translateY -4), the
              // bottom of the tab still covers the original visible bottom,
              // hiding the section bg that would otherwise be exposed below.
              const padTop = parseInt(tabCfg.padding.match(/^(\d+)/)?.[1] ?? "12");
              const tabBaseHeight = padTop * 2 + tabCfg.labelSize + 4;
              const SINGLE_ROW_EXTENSION = 8;
              const tabExtendedHeight = tabBaseHeight + SINGLE_ROW_EXTENSION;
              // Top-row tabs in stage E: tall box (90px) with a small
              // padding-top so the label sits near the top of the cap
              // (minimal cream above the words), and a long padding-bottom
              // that extends the box well past the bottom row's top edge
              // for the tuck.
              // Bottom-row tabs in stage E: box is stretched to
              // BOTTOM_HEIGHT (50) by the row container, but only the
              // top 40px is visible (extension clipped by wrapper). Add
              // 10px to padding-bottom so the label is centered in the
              // VISIBLE 40px, not the full 50px box.
              // Single-row tabs (stages A-D): get the same extension trick —
              // padding-bottom is bumped by SINGLE_ROW_EXTENSION, and the
              // tablist inner wrapper clips the extension. Result: hover-rise
              // doesn't expose the section bg underneath.
              const sideMatch = tabCfg.padding.match(/^\d+\s*\w+\s+(\d+\w+)/);
              const sidePadding = sideMatch ? sideMatch[1] : "12px";
              const singleRowPadding = `${padTop}px ${sidePadding} ${padTop + SINGLE_ROW_EXTENSION}px`;
              const padding =
                tabStage === "E"
                  ? isTopRow
                    ? "8px 12px 65px"
                    : "10px 12px 20px"
                  : singleRowPadding;
              const label = t.label;
              // In stage E we drop the inactive-tab scale-down entirely —
              // top-row tabs need their box to fill from y=0 to their full
              // extended height (scaleY would compress and pull the visible
              // top away from the section's top edge). The active/inactive
              // cue in stage E is row position + paper-vs-cream bg, which
              // is plenty.
              const transformValue =
                tabStage === "E"
                  ? "none"
                  : isActive
                    ? "none"
                    : "scaleY(0.92)";
              return (
                <button
                  key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(t.k)}
                  className="hs-builder-tab"
                  data-stage={tabStage}
                  style={{
                    padding,
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
                    background: isActive
                      ? hsTokens.paper
                      : isTopRow
                        ? hsTokens.cream
                        : tabStage === "E"
                          ? // Bottom row in stage E: box is 50px, only the
                            // top 40px visible (10px extension clipped). Put
                            // the gradient transition at 20-40% (= box y=30-40,
                            // the visible bottom 10px) so it actually shows.
                            `linear-gradient(to top, color-mix(in oklch, ${hsTokens.cream} 92.5%, ${hsTokens.ink} 7.5%) 20%, ${hsTokens.cream} 40%)`
                          : // Single-row (A-D): tight bottom gradient.
                            `linear-gradient(to top, color-mix(in oklch, ${hsTokens.cream} 92.5%, ${hsTokens.ink} 7.5%) 0%, ${hsTokens.cream} 25%)`,
                    color: isActive ? hsTokens.ink : hsTokens.muted,
                    fontFamily: hsTokens.body,
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                    // Single-row tabs: explicit height = extended height.
                    // Stage E bottom row is sized by its row container so we
                    // skip the explicit height there. Top row tabs are also
                    // sized by their container.
                    ...(tabStage !== "E" ? { height: tabExtendedHeight, boxSizing: "border-box" } : {}),
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
                    transform: transformValue,
                    transformOrigin: "center bottom",
                    transition: "transform 120ms ease, background 120ms ease",
                  }}
                >
                  {/* Accent strip — always rendered. Opacity 1 when active,
                      0 when inactive (hidden), 0.4 when hovering an inactive
                      tab (faded reveal, applied via CSS below). */}
                  <span
                    aria-hidden="true"
                    className="hs-tab-accent"
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
                      opacity: isActive ? 1 : 0,
                      transition: "opacity 160ms ease",
                    }}
                  />
                  {/* Inactive tabs (bottom-row stage E + all single-row stages):
                      extra ink "line" at the visible bottom of the box. The
                      tab's own borderBottom has been pushed below the visible
                      area by the height extension, so this inner line provides
                      the visible bottom border in its place. Active tab skips
                      this so its paper bg can merge with the content frame.
                      On hover the parent button translateY(-4)s; this line
                      counter-translateY(+4)s (via CSS) so it stays at the
                      same absolute Y — anchored to the content frame top.
                      `top` = visible_height - 4 (= -2 border-top, -2 line height). */}
                  {!isActive && !(tabStage === "E" && isTopRow) ? (
                    <span
                      aria-hidden
                      className="hs-bottom-line"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: tabStage === "E" ? 36 : tabBaseHeight - 4,
                        height: 2,
                        background: hsTokens.ink,
                        pointerEvents: "none",
                        transition: "transform 180ms cubic-bezier(0.32, 0.72, 0, 1)",
                      }}
                    />
                  ) : null}
                  {tabCfg.showSwatch ? (
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
                  ) : null}
                  <span style={{ ...display, fontSize: tabCfg.labelSize }}>{label}</span>
                  {showCount ? (
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

            // Stage E — two-row layout. Swappable tabs split into two stable
            // groups (A: Fermentables/Hops/Mash/Water, B: Yeast/Fermentation).
            // Brew sheet is always anchored bottom-right and never moves.
            // The swappable group containing the active tab gets translated
            // down to sit adjacent to the content frame (preserving the
            // binder pattern). When `lastSwappable` flips, both swappable
            // rows transition translateY simultaneously — Brew sheet stays
            // put. Top-row tabs get extra bottom padding so they appear to
            // tuck under the bottom row (z-index keeps bottom row on top).
            if (tabStage === "E") {
              // Layout math:
              //   Top row tabs sit at wrapper y=0 (= section y=0 since the
              //   tablist drops its paddingTop in stage E). Their natural
              //   height comes from extension padding — taller than the
              //   bottom row — so their bottoms land BELOW the bottom row's
              //   top edge. z-index keeps the bottom row in front, so the
              //   overlap reads as "top tabs tucking under the bottom row."
              //   Bottom row sits at translateY(BOTTOM_TOP). Its tabs are
              //   forced to BOTTOM_HEIGHT via flex stretch and end at
              //   WRAPPER_HEIGHT so the active tab's paper border merges
              //   into the content frame just like single-row mode.
              // Bottom row tabs are sized TALLER than the visible row
              // height, with the extension clipped by the wrapper's
              // overflow:hidden. This way, when a tab rises on hover the
              // exposed area below it is *still* tab body (until the rise
              // exceeds the extension), so you never see the section bg
              // peek through underneath. Wrapper height is anchored to
              // BOTTOM_TOP + BOTTOM_HEIGHT_VISIBLE so the visible bottom
              // stays where it was.
              const BOTTOM_HEIGHT_VISIBLE = 40;
              const BOTTOM_HEIGHT_EXTENSION = 10;
              const BOTTOM_HEIGHT = BOTTOM_HEIGHT_VISIBLE + BOTTOM_HEIGHT_EXTENSION;
              const BOTTOM_TOP = 62;
              const WRAPPER_HEIGHT = BOTTOM_TOP + BOTTOM_HEIGHT_VISIBLE;
              // Top row sits at wrapper top; the tab itself is tall (90px)
              // with the label near the top (small padding-top = small
              // cream gap above the label) and a long padding-bottom that
              // extends the box well past the bottom row's top for a
              // clearly visible tuck.
              const TOP_ROW_OFFSET = 32;
              // Top tab box: padding 8 + label 13 + padding 65 + borders 4 = 90.
              // Label sits at tab y=10 (top border + padding) → very close
              // to the top of the tab. Tab bottom extends to wrapper y=90,
              // bottom row top at wrapper y=62 → 28px of tuck.
              const TOP_TAB_HEIGHT = 90;
              const BREWSHEET_RESERVE = 120;
              const groupA = TABS.slice(0, 3);
              const groupB = TABS.slice(3, 6);
              const brewTab = TABS[6];
              const aIsBottom = lastSwappable === "A";
              const bIsBottom = lastSwappable === "B";
              // Offset the top row horizontally so its tabs don't line up
              // edge-to-edge with the bottom row — a brick-stagger effect
              // that makes the two rows read as distinct strata instead of
              // a grid.
              const TOP_ROW_X_OFFSET = 44;
              const swapRowStyle = (isBottom: boolean): CSSProperties => ({
                position: "absolute",
                left: 0,
                right: BREWSHEET_RESERVE,
                top: 0,
                // Explicit row heights — top row gets TOP_TAB_HEIGHT so flex
                // stretch can fill the buttons to the extended size; bottom
                // row gets BOTTOM_HEIGHT.
                height: isBottom ? BOTTOM_HEIGHT : TOP_TAB_HEIGHT,
                display: "flex",
                alignItems: "stretch",
                transform: isBottom
                  ? `translate(0, ${BOTTOM_TOP}px)`
                  : `translate(${TOP_ROW_X_OFFSET}px, ${TOP_ROW_OFFSET}px)`,
                transition: "transform 90ms cubic-bezier(0.785, 0.135, 0.15, 0.86)",
                zIndex: isBottom ? 2 : 1,
                willChange: "transform",
              });
              return (
                <div
                  style={{
                    position: "relative",
                    height: WRAPPER_HEIGHT,
                    // Clip the top-row tab boxes at the wrapper's bottom
                    // so they can't extend down into the content frame
                    // area below. The bottom row stays within the wrapper
                    // naturally; only the top row's tall boxes would
                    // otherwise extend past. Cover strip at the section
                    // top still handles hiding the rounded tops.
                    overflow: "hidden",
                  }}
                >
                  {/* BOTTOM LINE — stable baseline at the wrapper's bottom
                      edge. z-index above the top row so the line shows
                      through where top tabs would otherwise hide it (e.g.
                      Fermentation extending past Mash). Bottom row tabs
                      and Brewsheet sit on top via DOM order; the active
                      tab's paper bottom border covers the ink line at its
                      position (the binder merge). */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 0,
                      borderBottom: `2px solid ${hsTokens.ink}`,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  />
                  <div style={swapRowStyle(aIsBottom)}>
                    {groupA.map((t, i) =>
                      renderTab(t, i, groupA, !aIsBottom)
                    )}
                  </div>
                  <div style={swapRowStyle(bIsBottom)}>
                    {groupB.map((t, i) =>
                      renderTab(t, i, groupB, !bIsBottom)
                    )}
                  </div>
                  {brewTab ? (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        height: BOTTOM_HEIGHT,
                        display: "flex",
                        alignItems: "stretch",
                        transform: `translateY(${BOTTOM_TOP}px)`,
                        zIndex: 3,
                      }}
                    >
                      {renderTab(brewTab, 0, [brewTab], false)}
                    </div>
                  ) : null}
                </div>
              );
            }

            // Stages A–D — single row with the brew-sheet tab right-anchored
            // and a filler that carries the ink baseline across the gap.
            // Inner wrapper has explicit height = original visible row
            // height, with a clip-path that lets tabs extend ABOVE (for
            // hover-rise visibility) but CLIPS below the wrapper's bottom
            // (so the tab's padding-bottom extension stays hidden in
            // normal state and only fills the gap on hover).
            const mainTabs = TABS.filter((t) => t.k !== "brewsheet");
            const rightTabs = TABS.filter((t) => t.k === "brewsheet");
            const wrapperPadTop = parseInt(tabCfg.padding.match(/^(\d+)/)?.[1] ?? "12");
            const wrapperTabBaseHeight = wrapperPadTop * 2 + tabCfg.labelSize + 4;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 0,
                  height: wrapperTabBaseHeight,
                  clipPath: "polygon(0% -200%, 100% -200%, 100% 100%, 0% 100%)",
                }}
              >
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
              </div>
            );
          })()}
        </div>

        <div
          className={`hs-builder-grid${
            activeTab === "brewsheet" ? " is-brewsheet" : ""
          }${sectionEmpty ? " section-empty" : ""}${
            isShared ? " brew-read-only" : ""
          }`}
          data-tab={activeTab}
        >
          {activeTab !== "brewsheet"
            ? (() => {
                const def = TABS.find((t) => t.k === activeTab);
                if (!def?.heading) return null;
                return (
                  <BuilderTitleBar
                    heading={def.heading}
                    color={def.c}
                    small={def.smallHeading}
                  />
                );
              })()
            : null}
          <div className="hs-builder-main">
            <MainSectionMorph
              activeTab={activeTab}
              direction={tabDirection}
              isShared={isShared}
            >
              {activeTab === "fermentables" ? <FermentableSection /> : null}
              {activeTab === "hops" ? <HopSection /> : null}
              {activeTab === "mash" ? <MashSection /> : null}
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
            </MainSectionMorph>
          </div>

          <SideColumnMorph
            show={!sectionEmpty && activeTab !== "brewsheet"}
            activeTab={activeTab}
          />
        </div>
      </section>

      <BjcpStylePresetModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        currentStyle={currentRecipe.style}
        onSelect={(style: string) => {
          const newStyle = style || undefined;
          const wc = currentRecipe.waterChemistry;
          // Pin the BJCP-mapped water target only when nothing is set, so an
          // explicit or customized target isn't overwritten on style change.
          const waterTargetUnselected =
            !wc?.targetStyleName && !wc?.customTargetProfile;
          if (newStyle && waterTargetUnselected) {
            const bjcpKey = getWaterTargetForBjcpStyle(newStyle);
            if (BEER_STYLE_TARGETS[bjcpKey]) {
              updateRecipe({
                style: newStyle,
                waterChemistry: {
                  sourceProfile: wc?.sourceProfile ?? COMMON_WATER_PROFILES.RO,
                  saltAdditions: wc?.saltAdditions ?? {},
                  sourceProfileName: wc?.sourceProfileName ?? "RO",
                  targetStyleName: bjcpKey,
                  customTargetProfile: undefined,
                },
              });
              return;
            }
          }
          updateRecipe({ style: newStyle });
        }}
      />

      {/* Unsaved-changes confirmation — opens when the guard intercepts a nav
          attempt (back link, NavBar, browser back). Inert in shared view. */}
      <UnsavedChangesModal />
    </>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */

/**
 * Inline pill beside the Save button — controls whether the recipe is
 * publicly shared. Mirrors the meta-pill chrome used in the title band.
 */
function ShareToggle({
  isPublic,
  onToggle,
}: {
  isPublic: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={isPublic}
      aria-label={
        isPublic
          ? "Recipe is public. Click to make private."
          : "Recipe is private. Click to make public."
      }
      title={
        isPublic
          ? "Public — anyone with the link can view. Click to make private."
          : "Private — only you can see this recipe. Click to share publicly."
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: isPublic ? hsTokens.paper : "transparent",
        color: isPublic ? hsTokens.ink : hsTokens.muted,
        border: `1.5px solid ${
          isPublic
            ? hsTokens.ink
            : `color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`
        }`,
        borderRadius: 999,
        padding: "6px 12px 6px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily: hsTokens.body,
        cursor: "pointer",
        boxShadow: isPublic ? hsTokens.sh1 : "none",
        transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: isPublic ? hsTokens.water : "transparent",
          border: `1.5px solid ${isPublic ? hsTokens.water : hsTokens.muted}`,
        }}
      />
      <span>{isPublic ? "Public" : "Private"}</span>
    </button>
  );
}

/**
 * Two-state sticker for save status. Visually mirrors the "extend boil"
 * warning on the Hops tab — paper bg, accent border, script font, slight
 * rotation. The chip animates between two positions:
 *
 *  - Clean (no edits to save): stamps on top of the faded Save button,
 *    centered vertically, slight -1.5° tilt. Acts as the "nothing to do
 *    here" badge.
 *  - Dirty (edits pending): drops down on a string under the solid Save
 *    button, -3° tilt. Acts as the nudge to commit.
 *
 * The transform-only animation keeps `transformOrigin` constant so the
 * tilt feels like a single pendulum motion instead of a snap.
 */
function SaveStatusNote({
  savedRecently,
  isDirty,
}: {
  savedRecently: boolean;
  isDirty: boolean;
}) {
  // savedRecently is a brief "✓ saved!" pulse right after the save action
  // succeeds — treat it like the clean state so the chip stays overlaid on
  // the button rather than dropping back down.
  const overlay = !isDirty;
  const label = savedRecently
    ? "✓ saved!"
    : isDirty
      ? "edits not saved !"
      : "all changes saved";
  const accent = overlay ? hsTokens.hops : hsTokens.roast;
  // Save button is ≈38px tall (8 + 13 + 8 padding/text + 2*2 border).
  // Overlay clips the chip onto the button's lower-right corner — shifted
  // right (translateX 36) and down (translateY 22) with a -10° tilt so the
  // chip reads like a paper tag dangling off the corner and "Save recipe"
  // stays readable in the upper-left of the button. Below drops the chip
  // to 44px so it clears the button bottom by 6px when there are edits
  // pending, with the original -3° tilt.
  const transform = overlay
    ? "translateX(36px) translateY(22px) rotate(-10deg)"
    : "translateY(44px) rotate(-3deg)";
  return (
    <span
      aria-live="polite"
      style={{
        position: "absolute",
        top: 0,
        right: 6,
        transformOrigin: "top right",
        transform,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px 6px",
        background: hsTokens.paper,
        color: accent,
        border: `1.5px solid ${accent}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh2,
        fontFamily: hsTokens.script,
        fontSize: 16,
        lineHeight: 1,
        pointerEvents: "none",
        transition:
          "transform 320ms cubic-bezier(0.32, 0.72, 0, 1), color 220ms ease, border-color 220ms ease",
        zIndex: 2,
      }}
    >
      {label}
    </span>
  );
}

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

function StatCard({
  k,
  v,
  u,
  c,
}: {
  k: string;
  v: string;
  u?: string;
  c: string;
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
    </div>
  );
}
