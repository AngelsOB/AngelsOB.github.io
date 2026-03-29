"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface GrainParams {
  /** Grain size: 1 = fine film grain, 4 = coarse/chunky. Default: 1 */
  blockSize: number;
  /** Noise layers 1–6. More octaves = more complex texture. Default: 5 */
  octaves: number;
  /** Contrast of the noise 1–6. Default: 3.3 */
  contrast: number;
  /** Overall opacity of the overlay 0–1. Default: 0.06 */
  opacity: number;
  /** Seed for different grain patterns. Default: 42 */
  seed: number;
}

export const GRAIN_DEFAULTS: GrainParams = {
  blockSize: 1.25,
  octaves: 6,
  contrast: 4.0,
  opacity: 0.1,
  seed: 42,
};

function buildNoiseUrl(blockSize: number, octaves: number, contrast: number, seed: number): string {
  const freq = (0.85 / blockSize).toFixed(3);
  const intercept = (-(contrast - 1) / 2).toFixed(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${contrast}" intercept="${intercept}"/><feFuncG type="linear" slope="${contrast}" intercept="${intercept}"/><feFuncB type="linear" slope="${contrast}" intercept="${intercept}"/></feComponentTransfer></filter><rect width="256" height="256" filter="url(#g)"/></svg>`;
  return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}

function GrainLayers({ blockSize, octaves, contrast, opacity, seed }: GrainParams) {
  const noiseUrl = buildNoiseUrl(blockSize, octaves, contrast, seed);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: noiseUrl,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
        zIndex: 9998,
        opacity,
        // No blend mode — mix-blend-mode on a fixed viewport-sized element
        // forces full-viewport compositing on every scroll frame.
      }}
    />
  );
}

export default function GrainOverlay(params: GrainParams) {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setMount(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!mount) return null;
  return createPortal(<GrainLayers {...params} />, mount);
}
