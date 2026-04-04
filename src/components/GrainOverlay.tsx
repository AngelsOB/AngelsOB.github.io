"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useThemeStore } from "../stores/useThemeStore";

export interface GrainParams {
  /** Grain size: 1 = fine film grain, 4 = coarse/chunky. Default: 1.5 */
  blockSize: number;
  /** Noise layers 1–6. More octaves = more complex texture. Default: 3 */
  octaves: number;
  /** Contrast of the noise 1–6. Default: 4.6 */
  contrast: number;
  /** Overall opacity 0–1. Default: 0.06 */
  opacity: number;
  /** Seed for different grain patterns. Default: 42 */
  seed: number;
  /**
   * Blue noise mode: Laplacian high-pass filter (feConvolveMatrix) on single-octave noise.
   * Suppresses low-frequency clumping — produces a fine, even speckle distribution.
   * Default: true
   */
  blueNoise: boolean;
}

export const GRAIN_DEFAULTS: GrainParams = {
  blockSize: 1.5,
  octaves: 3,
  contrast: 4.6,
  opacity: 0.06,
  seed: 42,
  blueNoise: true,
};

function buildNoiseUrl(
  blockSize: number,
  octaves: number,
  contrast: number,
  seed: number,
  blueNoise: boolean,
): string {
  const freq = (0.85 / blockSize).toFixed(3);
  const intercept = (-(contrast - 1) / 2).toFixed(3);

  // Warm film tint: boost reds, keep greens, reduce blues
  const colorStep = `<feColorMatrix type="matrix" values="1.1 0 0 0 0.02  0 1.0 0 0 0.01  0 0 0.85 0 0  0 0 0 1 0"/>`;

  // Per-channel contrast: slight R boost, slight B reduction for warm tonal variation
  const transferR = `<feFuncR type="linear" slope="${(contrast * 1.05).toFixed(3)}" intercept="${intercept}"/>`;
  const transferG = `<feFuncG type="linear" slope="${contrast}" intercept="${intercept}"/>`;
  const transferB = `<feFuncB type="linear" slope="${(contrast * 0.9).toFixed(3)}" intercept="${intercept}"/>`;

  let filter: string;
  if (blueNoise) {
    filter = [
      `<filter id="g">`,
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="1" seed="${seed}" stitchTiles="stitch" result="n"/>`,
      `<feConvolveMatrix in="n" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="1" bias="0.5" preserveAlpha="true" result="hp"/>`,
      colorStep,
      `<feComponentTransfer>`,
      transferR, transferG, transferB,
      `</feComponentTransfer>`,
      `</filter>`,
    ].join("");
  } else {
    filter = [
      `<filter id="g">`,
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>`,
      colorStep,
      `<feComponentTransfer>`,
      transferR, transferG, transferB,
      `</feComponentTransfer>`,
      `</filter>`,
    ].join("");
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${filter}<rect width="256" height="256" filter="url(#g)"/></svg>`;
  return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}

function GrainLayer({ blockSize, octaves, contrast, opacity, seed, blueNoise }: GrainParams) {
  const ref = useRef<HTMLDivElement>(null);
  const noiseUrl = buildNoiseUrl(blockSize, octaves, contrast, seed, blueNoise);

  // Shift backgroundPosition to match scroll — grain tracks document coords
  // rather than being anchored to the viewport (screen-space).
  // Passive listener: no repaint, just a style property update per frame.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      el.style.backgroundPositionX = `${window.scrollX}px`;
      el.style.backgroundPositionY = `${window.scrollY}px`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={ref}
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
      }}
    />
  );
}

/** Light mode gets slightly higher grain opacity for visibility against bright backgrounds */
const LIGHT_OPACITY_BOOST = 1.5;

export default function GrainOverlay(params: GrainParams) {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const opacity = resolvedTheme === "light" ? params.opacity * LIGHT_OPACITY_BOOST : params.opacity;

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setMount(el);
    return () => { document.body.removeChild(el); };
  }, []);

  if (!mount) return null;
  return createPortal(<><GrainLayer {...params} opacity={opacity} /><DustLayer /></>, mount);
}

/** Dust overlay — warm cream-tinted sparse specks, fixed to viewport */
function DustLayer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><filter id="d"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="8" seed="19" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 0 0 0 1"/><feFuncG type="discrete" tableValues="0 0 0 0 0.95"/><feFuncB type="discrete" tableValues="0 0 0 0 0.85"/></feComponentTransfer></filter><rect width="512" height="512" filter="url(%23d)"/></svg>`;
  const dustUrl = `url("data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(svg) : ''}")`;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: dustUrl,
        backgroundRepeat: "repeat",
        backgroundSize: "2048px 2048px",
        zIndex: 9997,
        opacity: 0.12,
        mixBlendMode: "screen",
      }}
    />
  );
}
