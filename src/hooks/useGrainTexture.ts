"use client";

import { useEffect } from "react";
import { applyGrainTexture } from "@/utils/grainTexture";

/**
 * Generates canvas-based stochastic grain textures on mount and injects
 * them as CSS custom properties, replacing the SVG feTurbulence versions.
 *
 * Call once near the app root (e.g. ClientShell).
 */
export function useGrainTexture(): void {
  useEffect(() => {
    applyGrainTexture();
  }, []);
}
