/**
 * Dither-grain texture generator.
 *
 * Generates a tileable grayscale dither texture for use with
 * mix-blend-mode: overlay. Each "grain block" is either:
 *   - a light dot  (~180/255) → overlay brightens the surface
 *   - a dark dot   (~80/255)  → overlay darkens the surface
 *   - transparent             → no effect
 *
 * The equal mix of light and dark dots is what makes it feel like
 * genuine dithered grain rather than a tinted overlay.
 */

function hash(x: number, y: number, seed: number): number {
  let h = (x * 73856093) ^ (y * 19349669) ^ (seed * 83492791);
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h & 0xffff) / 0xffff;
}

export interface GrainOptions {
  /** Texture tile size in px (default 256) */
  size?: number;
  /** Grain block size in px — 1 = pixel-sharp, 2 = slightly chunky (default 1) */
  grainSize?: number;
  /**
   * Fraction of blocks that become a grain dot, 0–1 (default 0.35).
   * Half will be light dots, half dark dots.
   */
  density?: number;
  /**
   * Alpha of each dot, 0–1 (default 0.25).
   * Higher = more visible grain. Works best with mix-blend-mode: overlay.
   */
  dotOpacity?: number;
  /** Random seed (default 0) */
  seed?: number;
}

export function generateGrainTexture(options: GrainOptions = {}): string {
  const size = options.size ?? 256;
  const grainSize = Math.max(1, Math.round(options.grainSize ?? 1));
  const density = Math.max(0, Math.min(1, options.density ?? 0.35));
  const dotOpacity = Math.max(0, Math.min(1, options.dotOpacity ?? 0.25));
  const seed = options.seed ?? 0;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;

  const alpha = Math.round(dotOpacity * 255);
  const halfDensity = density / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bx = Math.floor(x / grainSize);
      const by = Math.floor(y / grainSize);
      const v = hash(bx, by, seed);

      const idx = (y * size + x) * 4;
      if (v < halfDensity) {
        // Light dot — brightens surface via overlay
        d[idx] = 210;
        d[idx + 1] = 205;
        d[idx + 2] = 195;
        d[idx + 3] = alpha;
      } else if (v < density) {
        // Dark dot — darkens surface via overlay
        d[idx] = 45;
        d[idx + 1] = 42;
        d[idx + 2] = 38;
        d[idx + 3] = alpha;
      }
      // else: transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function applyGrainTexture(options: GrainOptions = {}): void {
  if (typeof document === "undefined") return;
  const url = generateGrainTexture(options);
  const root = document.documentElement;
  root.style.setProperty("--noise-texture", `url("${url}")`);
  root.style.setProperty("--grain-overlay", `url("${url}")`);
  root.style.setProperty("--paper-texture", "none");
}

/** @deprecated Use applyGrainTexture */
export const applyGrainTextures = applyGrainTexture;
