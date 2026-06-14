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
} from "@/modules/recipe/services/BeerXmlImportService";
import {
  textRecipeImportService,
  type ImportVitals,
} from "@/modules/recipe/services/textRecipeImportService";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import { toast } from "@/stores/toastStore";

import ImportRecipeModal from "./ImportRecipeModal";
import ReviewImportMatchesModal from "./ReviewImportMatchesModal";

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
        toast.success(`Imported "${saved.name}"`);
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
          setImportReview(null);
          if (saved) {
            loadRecipes();
            toast.success(`Imported "${saved.name}"`);
          } else {
            toast.error("Failed to save imported recipe");
          }
        }}
      />
    </>
  );
}
