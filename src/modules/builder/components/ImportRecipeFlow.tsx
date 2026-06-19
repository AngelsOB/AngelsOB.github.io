"use client";

/**
 * Import-a-recipe flow (global mount).
 *
 * Mounted once in ClientShell so the combined Import modal is reachable from
 * anywhere — the header dropdown (HSHeader "New › Import") and the /recipes
 * page both open it via the importStore. Owns the review sheet + commit logic
 * for both import paths:
 *
 *  • BeerXML → parse; a clean file commits straight away, a file with
 *    low-confidence matches goes through the review sheet first.
 *  • Pasted text → always through the review sheet (process vitals get a look
 *    before commit).
 *
 * loadRecipes() after each commit refreshes the /recipes list via shared store
 * state — no reload needed.
 */

import { useState } from "react";

import { useImportStore } from "@/modules/recipe/stores/importStore";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import {
  beerXmlImportService,
  type BeerXmlImportResult,
  type PendingMatch,
  type SourceVitals,
} from "@/modules/recipe/services/BeerXmlImportService";
import {
  textRecipeImportService,
  type ImportVitals,
} from "@/modules/recipe/services/textRecipeImportService";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import { toast } from "@/stores/toastStore";

import ImportRecipeModal from "./ImportRecipeModal";
import ReviewImportMatchesModal from "./ReviewImportMatchesModal";

// Deltas beyond which the file's stated OG/ABV diverge more than our model noise
// can explain — usually an efficiency-basis mismatch (e.g. a Grainfather export
// storing MASH efficiency in BeerXML's EFFICIENCY field where the spec, and we,
// expect BREWHOUSE). IBU is intentionally NOT escalated on: utilization models
// differ enough between tools that an IBU gap is expected, not a red flag.
const OG_WARN_DELTA = 0.005; // ~5 gravity points
const ABV_WARN_DELTA = 0.6; // percentage points

/**
 * Post-import reconciliation notice. Always shows what the file claimed vs what
 * we compute (when the file stated vitals); escalates to a persistent warning
 * when OG/ABV diverge beyond what's reasonable — the cheap guard against the
 * efficiency-basis trap, which OG can't otherwise reveal silently.
 */
function announceImport(saved: Recipe, sourceVitals?: SourceVitals): void {
  const hasVitals =
    sourceVitals != null &&
    (sourceVitals.og != null || sourceVitals.ibu != null || sourceVitals.abv != null);
  if (!hasVitals) {
    toast.success(`Imported "${saved.name}"`);
    return;
  }

  const calc = recipeCalculationService.calculate(saved);
  const parts: string[] = [];
  if (sourceVitals!.og != null)
    parts.push(`OG ${calc.og.toFixed(3)} (file ${sourceVitals!.og.toFixed(3)})`);
  if (sourceVitals!.ibu != null)
    parts.push(`${Math.round(calc.ibu)} IBU (file ${Math.round(sourceVitals!.ibu)})`);
  if (sourceVitals!.abv != null)
    parts.push(`${calc.abv.toFixed(1)}% ABV (file ${sourceVitals!.abv.toFixed(1)}%)`);
  const comparison = parts.join(" · ");

  const ogOff =
    sourceVitals!.og != null && Math.abs(calc.og - sourceVitals!.og) >= OG_WARN_DELTA;
  const abvOff =
    sourceVitals!.abv != null && Math.abs(calc.abv - sourceVitals!.abv) >= ABV_WARN_DELTA;

  if (ogOff || abvOff) {
    toast.warning(
      `Imported "${saved.name}", but our numbers differ from the file: ${comparison}. ` +
        `If this came from Grainfather, its BeerXML stores mash efficiency where we expect ` +
        `brewhouse — adjust the efficiency in the builder. Otherwise double-check batch volume and units.`,
      { duration: 0 }
    );
  } else {
    toast.success(`Imported "${saved.name}" — ${comparison}`);
  }
}

export default function ImportRecipeFlow() {
  const isOpen = useImportStore((s) => s.isOpen);
  const closeImport = useImportStore((s) => s.close);

  const parseBeerXml = useRecipeStore((s) => s.parseBeerXml);
  const commitImportedRecipe = useRecipeStore((s) => s.commitImportedRecipe);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  // Import review — BeerXML opens it only for low-confidence matches; text
  // imports ALWAYS go through it (extracted process vitals get a look before
  // commit). `source` picks which service applies the resolutions.
  const [importReview, setImportReview] = useState<{
    recipe: Recipe;
    pendingMatches: PendingMatch[];
    source: "beerxml" | "text";
    vitals?: ImportVitals;
    targetOg?: number;
    sourceVitals?: SourceVitals;
  } | null>(null);

  const handleBeerXmlText = async (text: string) => {
    const result = parseBeerXml(text);
    if (!result) {
      toast.error("Couldn't read that BeerXML file");
      return;
    }
    closeImport();
    if (result.pendingMatches.length === 0) {
      const saved = await commitImportedRecipe(result.recipe);
      if (saved) {
        loadRecipes();
        announceImport(saved, result.sourceVitals);
      } else {
        toast.error("Failed to save imported recipe");
      }
      return;
    }
    setImportReview({ ...result, source: "beerxml" });
  };

  const handlePasteContinue = (result: BeerXmlImportResult, targetOg?: number) => {
    closeImport();
    // Text imports always pass through review — the full confirmation sheet
    // (ingredients, amounts, title, process) gets a look before commit.
    setImportReview({
      ...result,
      source: "text",
      vitals: textRecipeImportService.vitalsFromRecipe(result.recipe),
      targetOg,
    });
  };

  return (
    <>
      <ImportRecipeModal
        isOpen={isOpen}
        onClose={closeImport}
        onPasteContinue={handlePasteContinue}
        onBeerXmlText={handleBeerXmlText}
      />

      <ReviewImportMatchesModal
        isOpen={importReview !== null}
        pendingMatches={importReview?.pendingMatches ?? []}
        recipe={importReview?.source === "text" ? importReview.recipe : undefined}
        targetOg={importReview?.targetOg}
        vitals={importReview?.vitals}
        onCancel={() => {
          setImportReview(null);
          toast.success("Import canceled");
        }}
        onConfirm={async (resolutions, editedVitals, sheetEdits) => {
          if (!importReview) return;
          let resolved =
            importReview.source === "text"
              ? textRecipeImportService.applyResolutions(importReview.recipe, resolutions)
              : beerXmlImportService.applyResolutions(importReview.recipe, resolutions);
          if (importReview.source === "text" && sheetEdits) {
            resolved = textRecipeImportService.applySheetEdits(resolved, sheetEdits);
          }
          if (importReview.source === "text" && editedVitals) {
            resolved = textRecipeImportService.applyVitals(resolved, editedVitals);
          }
          const saved = await commitImportedRecipe(resolved);
          const sourceVitals = importReview.sourceVitals;
          setImportReview(null);
          if (saved) {
            loadRecipes();
            announceImport(saved, sourceVitals);
          } else {
            toast.error("Failed to save imported recipe");
          }
        }}
      />
    </>
  );
}
