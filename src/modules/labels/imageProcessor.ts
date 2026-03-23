const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB upload limit (Storage rules)
const MAX_DIMENSION = 1200;

function supportsWebP(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function toBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compress image.'));
      },
      mimeType,
      quality,
    );
  });
}

export type ProcessResult = {
  blob: Blob;
  /** True if the image was resized or quality-reduced beyond the default 1200px/85% pass */
  wasCompressed: boolean;
};

/**
 * Resize and compress a label image client-side.
 * Progressively reduces quality/dimensions until output is under 2 MB.
 * Returns a WebP blob (or JPEG fallback) ready for upload.
 */
export async function processLabelImage(file: File): Promise<ProcessResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Please use PNG, JPEG, or WebP.');
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const useWebP = supportsWebP();
  const mimeType = useWebP ? 'image/webp' : 'image/jpeg';

  // Try progressively smaller dimensions and lower quality until we fit
  const dimensionSteps = [MAX_DIMENSION, 900, 600];
  const qualitySteps = [0.85, 0.7, 0.5];

  let isFirstAttempt = true;
  for (const maxDim of dimensionSteps) {
    for (const quality of qualitySteps) {
      let newWidth = width;
      let newHeight = height;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        newWidth = Math.round(width * scale);
        newHeight = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

      const blob = await toBlob(canvas, mimeType, quality);
      if (blob.size <= MAX_OUTPUT_BYTES) {
        bitmap.close();
        return { blob, wasCompressed: !isFirstAttempt };
      }
      isFirstAttempt = false;
    }
  }

  bitmap.close();
  throw new Error('Image could not be compressed under 5 MB. Try a smaller image.');
}
