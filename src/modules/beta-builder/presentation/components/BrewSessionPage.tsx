'use client';

/**
 * Brew Session Tracker Page
 *
 * Focused on brew-day execution with inline edits.
 * Refactored from 912 lines to ~150 lines by extracting sub-components.
 */

import { useEffect, useRef, useState } from 'react';
import { uid } from "@/utils/uid";
import { useParams, useRouter } from "next/navigation";
import { useBrewSessionStore } from '../stores/brewSessionStore';
import { useRecipeStore } from '../stores/recipeStore';
import { useRecipeCalculations } from '../hooks/useRecipeCalculations';
import { useAuthStore } from '../../../auth/authStore';
import type { SessionStatus } from '../../domain/models/BrewSession';
import { type Recipe, type RecipeVersion, deepCloneRecipe } from '../../domain/models/Recipe';
import { waterChemistryService } from '../../domain/services/WaterChemistryService';
import { recipeVersionRepository } from '../../domain/repositories/RecipeVersionRepository';
import { volumeCalculationService } from '../../domain/services/VolumeCalculationService';
import {
  BrewSessionHeader,
  IngredientsDisplaySection,
  GravityTrackingSection,
  BrewInstructionsSection,
  BrewNotesSection,
  BrewedVersionModal,
} from './brew-session';

export default function BrewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const {
    loadSession,
    currentSession,
    updateActuals,
    updateStatus,
    updateSession,
    saveCurrentSession,
  } = useBrewSessionStore();
  const {
    currentRecipe: editorRecipe,
    setCurrentRecipe: setEditorRecipe,
    updateRecipe: updateEditorRecipe,
  } = useRecipeStore();
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const saveTimerRef = useRef<number | null>(null);
  const hasPendingSaveRef = useRef(false);
  const editorSnapshotRef = useRef<Recipe | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, isAuthLoading, loadSession]);

  // Update document title with session recipe name
  useEffect(() => {
    if (currentSession?.recipeName) {
      document.title = `Brew: ${currentSession.recipeName} | Brewing.It`;
    }
    return () => {
      document.title = 'Brewing.It - Homebrewing Recipe Builder & Calculator';
    };
  }, [currentSession?.recipeName]);

  // Flush pending saves on unmount or tab close to prevent data loss
  useEffect(() => {
    const flushPendingSave = () => {
      if (hasPendingSaveRef.current) {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        saveCurrentSession();
        hasPendingSaveRef.current = false;
      }
    };

    const handleBeforeUnload = () => {
      flushPendingSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushPendingSave(); // Also flush on component unmount (navigation)
    };
  }, [saveCurrentSession]);

  const brewDayCalcs = useRecipeCalculations(currentSession?.brewDayRecipe ?? null);
  const editorCalcs = useRecipeCalculations(editorRecipe ?? null);

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg">Loading session...</div>
      </div>
    );
  }

  const sessionRecipe = currentSession.brewDayRecipe;
  const targetMashTempC = sessionRecipe.mashSteps[0]?.temperatureC ?? 66;
  const strikeTempC = volumeCalculationService.calculateStrikeTemp(
    targetMashTempC,
    sessionRecipe.equipment.mashThicknessLPerKg
  );
  const spargeTempC = 76;
  const pitchTempC = sessionRecipe.fermentationSteps[0]?.temperatureC;
  const mashWaterL = brewDayCalcs?.mashWaterL ?? 0;
  const spargeWaterL = brewDayCalcs?.spargeWaterL ?? 0;
  const saltAdditions = sessionRecipe.waterChemistry?.saltAdditions ?? {};
  const { mashSalts, spargeSalts } = waterChemistryService.splitSaltsProportionally(
    saltAdditions,
    mashWaterL,
    spargeWaterL
  );

  const queueSave = () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    hasPendingSaveRef.current = true;
    saveTimerRef.current = window.setTimeout(() => {
      saveCurrentSession();
      hasPendingSaveRef.current = false;
    }, 400);
  };

  const updateActual = (updates: Partial<typeof currentSession.actuals>) => {
    updateActuals(updates);
    queueSave();
  };

  const openBrewedEditor = () => {
    editorSnapshotRef.current = editorRecipe;
    const clone = deepCloneRecipe(sessionRecipe);
    setEditorRecipe(clone);
    setIsEditModalOpen(true);
  };

  const closeBrewedEditor = () => {
    setIsEditModalOpen(false);
    setEditorRecipe(editorSnapshotRef.current ?? null);
  };

  const saveBrewedVersion = () => {
    if (!editorRecipe) return;
    const now = new Date().toISOString();
    const versionNumber =
      currentSession.brewedVersionNumber ??
      recipeVersionRepository.getLatestVersionNumber(currentSession.recipeId) + 1;

    const brewedSnapshot: Recipe = {
      ...editorRecipe,
      currentVersion: versionNumber,
      updatedAt: now,
    };

    const brewedVersion: RecipeVersion = {
      id: uid(),
      recipeId: currentSession.recipeId,
      versionNumber,
      createdAt: now,
      changeNotes: `Brew session ${currentSession.id}`,
      recipeSnapshot: brewedSnapshot,
    };

    recipeVersionRepository.save(brewedVersion);
    updateSession({
      brewDayRecipe: brewedSnapshot,
      recipeName: brewedSnapshot.name,
      brewedVersionNumber: versionNumber,
    });
    saveCurrentSession();
    closeBrewedEditor();
  };

  const handleStatusChange = (status: SessionStatus) => {
    updateStatus(status);
    saveCurrentSession();
  };

  const handleSave = () => {
    saveCurrentSession();
    router.push('/recipes');
  };

  const handleNotesChange = (notes: string) => {
    updateSession({ notes });
    queueSave();
  };

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
        <BrewSessionHeader
          recipeName={currentSession.recipeName}
          brewDate={currentSession.brewDate}
          recipeVersionNumber={currentSession.recipeVersionNumber}
          brewedVersionNumber={currentSession.brewedVersionNumber}
          status={currentSession.status}
          onStatusChange={handleStatusChange}
          onEditBrewedVersion={openBrewedEditor}
          onSave={handleSave}
        />

        <IngredientsDisplaySection
          recipe={sessionRecipe}
          mashWaterL={mashWaterL}
          spargeWaterL={spargeWaterL}
          mashSalts={mashSalts}
          spargeSalts={spargeSalts}
          actuals={currentSession.actuals}
          onUpdateActual={updateActual}
        />

        <GravityTrackingSection
          calculations={brewDayCalcs}
          actuals={currentSession.actuals}
          onUpdateActual={updateActual}
        />

        <BrewInstructionsSection
          recipe={sessionRecipe}
          mashWaterL={mashWaterL}
          spargeWaterL={spargeWaterL}
          strikeTempC={strikeTempC}
          spargeTempC={spargeTempC}
          pitchTempC={pitchTempC}
          mashSalts={mashSalts}
          spargeSalts={spargeSalts}
        />

        <BrewNotesSection
          notes={currentSession.notes}
          onNotesChange={handleNotesChange}
        />

      <BrewedVersionModal
        isOpen={isEditModalOpen}
        recipe={editorRecipe}
        calculations={editorCalcs}
        onRecipeNameChange={(name) => updateEditorRecipe({ name })}
        onCancel={closeBrewedEditor}
        onSave={saveBrewedVersion}
      />
    </div>
  );
}
