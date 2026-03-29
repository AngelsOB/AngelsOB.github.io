"use client";

import { useEffect, useRef } from "react";

/**
 * GrainGradient — stochastic displacement shader rendered on canvas.
 *
 * Renders a gradient with authentic film-grain by displacing each pixel's
 * sample position in a random 2D direction (rather than layering noise on top).
 *
 * Usage:
 *   <div className="relative overflow-hidden">
 *     <GrainGradient
 *       stops={[{ pos: 0, color: 'var(--coral-300)' }, { pos: 1, color: 'transparent' }]}
 *       direction={135}
 *       displacement={0.6}
 *       grainOpacity={0.7}
 *     />
 *     <div className="relative z-10">content</div>
 *   </div>
 */

export interface GrainStop {
  pos: number;   // 0–1 along the gradient
  color: string; // any CSS color string: hex, oklch, rgb, var(--foo), etc.
}

interface GrainGradientProps {
  stops: GrainStop[];
  /** Angle in degrees (0 = top→bottom) or 'horizontal'. Default: 0 (vertical) */
  direction?: number | "horizontal";
  /** Displacement strength 0–1. Default: 0.6 */
  displacement?: number;
  /** Crossfade between clean and displaced pixel 0–1. Default: 0.7 */
  grainOpacity?: number;
  /** Grain block size px. 1 = fine film grain, 2–3 = chunky risograph. Default: 1 */
  grainSize?: number;
  /** Max displacement radius px. Default: 12 */
  radius?: number;
  /** Extra className on the canvas element */
  className?: string;
}

// ─── Shader helpers ────────────────────────────────────────────────────────

function hash(x: number, y: number, seed: number): number {
  let h = (x * 73856093) ^ (y * 19349669) ^ (seed * 83492791);
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h & 0xffff) / 0xffff;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Resolve any CSS color string (including vars, oklch, color-mix, transparent) to [r,g,b,a 0-255].
 *
 * Two-step approach:
 *   1. DOM element to resolve CSS custom properties (var(), color-mix(), oklch(), etc.)
 *   2. 1px canvas draw to convert the computed value to reliable 0-255 RGBA bytes,
 *      regardless of whether the browser returns rgb(), color(srgb ...), oklch(), etc.
 */
function resolveColor(color: string): [number, number, number, number] {
  // Step 1 — resolve CSS variables via DOM
  const el = document.createElement("div");
  el.style.cssText = `color:${color};display:none`;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  if (!computed) return [0, 0, 0, 0];

  // Step 2 — draw computed color to a 1×1 canvas for reliable 0-255 RGBA bytes.
  // This handles any output format (rgb, rgba, color(srgb …), oklch(…), etc.)
  const px = document.createElement("canvas");
  px.width = 1;
  px.height = 1;
  const ctx = px.getContext("2d")!;
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

/** Draw a linear gradient on a canvas and return its ImageData. Preserves alpha. */
function renderGradientSource(
  w: number,
  h: number,
  resolvedStops: Array<{ pos: number; rgba: [number, number, number, number] }>,
  direction: number
): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  // Start transparent — gradient stops may have partial/zero alpha
  ctx.clearRect(0, 0, w, h);

  const rad = (direction * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const halfLen = Math.abs(Math.cos(rad) * h / 2) + Math.abs(Math.sin(rad) * w / 2);
  const x0 = cx - Math.sin(rad) * halfLen;
  const y0 = cy - Math.cos(rad) * halfLen;
  const x1 = cx + Math.sin(rad) * halfLen;
  const y1 = cy + Math.cos(rad) * halfLen;

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of resolvedStops) {
    const [r, g, b, a] = stop.rgba;
    grad.addColorStop(stop.pos, `rgba(${r},${g},${b},${a / 255})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  return ctx.getImageData(0, 0, w, h).data;
}

/** Apply the grain displacement shader to srcData, writing into outData. */
function applyGrainShader(
  srcData: Uint8ClampedArray,
  outData: Uint8ClampedArray,
  w: number,
  h: number,
  opts: { displacement: number; grainOpacity: number; grainSize: number; radius: number }
) {
  const { displacement, grainOpacity, grainSize, radius } = opts;
  const maxDisp = radius * displacement;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bx = Math.floor(x / grainSize);
      const by = Math.floor(y / grainSize);

      const r1 = hash(bx, by, 1);
      const r2 = hash(bx, by, 2);

      const angle = r1 * 6.2831853;
      const dist = r2 * maxDisp;
      const sx = clamp(x + Math.cos(angle) * dist, 0, w - 1);
      const sy = clamp(y + Math.sin(angle) * dist, 0, h - 1);

      // Bilinear sample from source
      const dispIdx = (Math.round(sy) * w + Math.round(sx)) * 4;
      const origIdx = (y * w + x) * 4;
      const outIdx = origIdx;

      outData[outIdx]     = Math.round(srcData[origIdx]     + (srcData[dispIdx]     - srcData[origIdx])     * grainOpacity);
      outData[outIdx + 1] = Math.round(srcData[origIdx + 1] + (srcData[dispIdx + 1] - srcData[origIdx + 1]) * grainOpacity);
      outData[outIdx + 2] = Math.round(srcData[origIdx + 2] + (srcData[dispIdx + 2] - srcData[origIdx + 2]) * grainOpacity);
      // Crossfade alpha too — preserves transparency from the source gradient
      outData[outIdx + 3] = Math.round(srcData[origIdx + 3] + (srcData[dispIdx + 3] - srcData[origIdx + 3]) * grainOpacity);
    }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function GrainGradient({
  stops,
  direction = 0,
  displacement = 0.6,
  grainOpacity = 0.7,
  grainSize = 1,
  radius = 12,
  className = "",
}: GrainGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dirDeg = direction === "horizontal" ? 90 : direction;

    function render() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w === 0 || h === 0) return;

      // Resolve CSS colors to RGBA
      const resolvedStops = stops.map((s) => ({
        pos: s.pos,
        rgba: resolveColor(s.color),
      }));

      // Render gradient source
      const srcData = renderGradientSource(w, h, resolvedStops, dirDeg);

      // Apply shader
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const out = ctx.createImageData(w, h);
      applyGrainShader(srcData, out.data, w, h, {
        displacement,
        grainOpacity,
        grainSize,
        radius,
      });
      ctx.putImageData(out, 0, 0);
    }

    render();

    const observer = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    });
    const parent = canvas.parentElement;
    if (parent) observer.observe(parent);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stops, direction, displacement, grainOpacity, grainSize, radius]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ display: "block" }}
    />
  );
}
