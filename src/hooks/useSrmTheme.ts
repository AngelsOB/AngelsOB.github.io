"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useThemeStore, type Palette } from "../stores/useThemeStore";
import { useRecipeStore } from "../modules/beta-builder/presentation/stores/recipeStore";
import { recipeCalculationService } from "../modules/beta-builder/domain/services/RecipeCalculationService";
import {
  srmToOklchHue,
  srmToOklchChromaScale,
  srmToOklchLightnessScale,
  srmToBgChromaScale,
} from "../modules/beta-builder/utils/srmToOklchHue";

const DEFAULT_HUE = 65;
const DEFAULT_CHROMA_SCALE = 1;
const DEFAULT_L_SCALE = 1;
const DEFAULT_BG_L_SCALE = 1;
const DEFAULT_BG_C_SCALE = 1;

/** Per-palette lightness range for SRM scaling on recipe pages (accents). */
const PALETTE_L_RANGES: Record<Palette, { bright: number; dark: number }> = {
  default: { bright: 1.1, dark: 0.75 },
  vintage: { bright: 1.08, dark: 0.72 },
  midnight: { bright: 1.15, dark: 0.8 },
  forest: { bright: 1.15, dark: 0.8 },
  copper: { bright: 1.15, dark: 0.8 },
  ink: { bright: 1.05, dark: 0.8 },
  sahara: { bright: 1.1, dark: 0.8 },
  reactive: { bright: 1.15, dark: 0.6 },
};

/**
 * Background lightness ranges — split by mode because the base L is so different.
 *
 * Light mode (base L ≈ 96-99 %):
 *   bright ≈ 1.0  — pale beers barely touch the already-light bg
 *   dark   ≈ 0.83 — stouts darken noticeably
 *
 * Dark mode (base L ≈ 16-20 %):
 *   bright ≈ 1.18 — pale beers visibly lighten the dark bg
 *   dark   ≈ 0.92 — stouts deepen slightly
 */
const PALETTE_BG_L_LIGHT: Record<Palette, { bright: number; dark: number }> = {
  default:  { bright: 1.0, dark: 0.96 },
  vintage:  { bright: 1.0, dark: 0.96 },
  midnight: { bright: 1.0, dark: 0.97 },
  forest:   { bright: 1.0, dark: 0.96 },
  copper:   { bright: 1.0, dark: 0.96 },
  ink:      { bright: 1.0, dark: 0.97 },
  sahara:   { bright: 1.0, dark: 0.96 },
  reactive: { bright: 1.0, dark: 0.93 },
};

const PALETTE_BG_L_DARK: Record<Palette, { bright: number; dark: number }> = {
  default:  { bright: 1.18, dark: 0.92 },
  vintage:  { bright: 1.18, dark: 0.91 },
  midnight: { bright: 1.18, dark: 0.93 },
  forest:   { bright: 1.18, dark: 0.92 },
  copper:   { bright: 1.18, dark: 0.91 },
  ink:      { bright: 1.12, dark: 0.95 },
  sahara:   { bright: 1.18, dark: 0.91 },
  reactive: { bright: 1.25, dark: 0.88 },
};

/**
 * Per-palette background chroma range.
 * `floor` = chroma scale for pale beers (SRM ≤ 4) — kept at 1.0 so light
 *           backgrounds stay clean. Tint ramps progressively with SRM.
 * `boost` = maximum chroma scale for stouts (SRM ≥ 35).
 * Base bg chroma is ~0.007–0.013; combined with per-mode multipliers
 * (LIGHT/DARK_MODE_CHROMA_BOOST), stouts reach 0.07–0.15 = visible tint.
 */
const PALETTE_BG_CHROMA: Record<Palette, { floor: number; boost: number }> = {
  default:  { floor: 1.0, boost: 3.0 },
  vintage:  { floor: 1.0, boost: 3.0 },
  midnight: { floor: 1.0, boost: 2.5 },
  forest:   { floor: 1.0, boost: 2.5 },
  copper:   { floor: 1.0, boost: 2.5 },
  ink:      { floor: 1.0, boost: 1.8 },
  sahara:   { floor: 1.0, boost: 3.0 },
  reactive: { floor: 1.0, boost: 4.0 },
};

/**
 * Dark-mode chroma needs a much higher multiplier to be visible.
 * At L ≈ 16-20 %, base chroma ~0.005 — even 5× only gives 0.025 which
 * looks grey. This extra multiplier compensates so dark backgrounds
 * carry the same warmth as light-mode backgrounds.
 */
/**
 * Extra chroma multiplier per mode.
 * Dark backgrounds have very low base chroma (~0.005) and need a large
 * multiplier to show any colour at low lightness.
 * Light backgrounds have slightly higher base chroma (~0.008–0.013) but
 * still wash out to grey when lightness shifts — a moderate bump keeps
 * the tint feeling integrated.
 */
const LIGHT_MODE_CHROMA_BOOST = 0.8;
const DARK_MODE_CHROMA_BOOST = 0.2;

export function useSrmTheme() {
  const palette = useThemeStore((s) => s.palette);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const pathname = usePathname();
  const isRecipePage = pathname?.startsWith("/recipes/") || pathname?.startsWith("/r/");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const isReactive = palette === "reactive";
    const isDark = resolvedTheme === "dark";

    // Non-recipe page or no recipe → defaults
    if (!isRecipePage || !currentRecipe) {
      // Always set l-scale to 1 (all palettes use it now)
      document.documentElement.style.setProperty("--srm-l-scale", String(DEFAULT_L_SCALE));
      document.documentElement.style.setProperty("--srm-bg-l-scale", String(DEFAULT_BG_L_SCALE));
      document.documentElement.style.setProperty("--srm-bg-c-scale", String(DEFAULT_BG_C_SCALE));

      if (isReactive) {
        document.documentElement.style.setProperty("--srm-hue", String(DEFAULT_HUE));
        document.documentElement.style.setProperty(
          "--srm-chroma-scale",
          String(DEFAULT_CHROMA_SCALE)
        );
      } else {
        document.documentElement.style.removeProperty("--srm-hue");
        document.documentElement.style.removeProperty("--srm-chroma-scale");
      }
      return;
    }

    // Recipe page with a recipe → calculate SRM-based values
    const srm = recipeCalculationService.calculateSRM(currentRecipe);
    const range = PALETTE_L_RANGES[palette] ?? { bright: 1.0, dark: 1.0 };
    const lScale = srmToOklchLightnessScale(srm, range.bright, range.dark);
    const bgRanges = isDark ? PALETTE_BG_L_DARK : PALETTE_BG_L_LIGHT;
    const bgRange = bgRanges[palette] ?? { bright: 1.0, dark: 1.0 };
    const bgLScale = srmToOklchLightnessScale(srm, bgRange.bright, bgRange.dark);
    const bgC = PALETTE_BG_CHROMA[palette] ?? { floor: 1.0, boost: 1.0 };
    const darkMul = isDark ? DARK_MODE_CHROMA_BOOST : LIGHT_MODE_CHROMA_BOOST;
    const bgCScale = srmToBgChromaScale(srm, bgC.boost * darkMul, bgC.floor * darkMul);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // Lightness scaling applies to ALL palettes
      document.documentElement.style.setProperty(
        "--srm-l-scale",
        String(Math.round(lScale * 100) / 100)
      );
      document.documentElement.style.setProperty(
        "--srm-bg-l-scale",
        String(Math.round(bgLScale * 100) / 100)
      );
      document.documentElement.style.setProperty(
        "--srm-bg-c-scale",
        String(Math.round(bgCScale * 100) / 100)
      );

      // Hue + chroma shifting only applies to reactive palette
      if (isReactive) {
        const hue = srmToOklchHue(srm);
        const chromaScale = srmToOklchChromaScale(srm);
        document.documentElement.style.setProperty("--srm-hue", String(Math.round(hue * 10) / 10));
        document.documentElement.style.setProperty(
          "--srm-chroma-scale",
          String(Math.round(chromaScale * 100) / 100)
        );
      } else {
        document.documentElement.style.removeProperty("--srm-hue");
        document.documentElement.style.removeProperty("--srm-chroma-scale");
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [palette, resolvedTheme, currentRecipe, isRecipePage]);
}
