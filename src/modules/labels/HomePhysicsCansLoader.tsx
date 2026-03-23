'use client';

import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useTopRatedLabels } from './useTopRatedLabels';

// Lazy import the heavy 3D component — only after textures are ready
let HomePhysicsCansModule: typeof import('./HomePhysicsCans') | null = null;

/**
 * Preloads label textures and the HomePhysicsCans module, then mounts the
 * Canvas exactly once with all data ready. No state changes after mount →
 * no re-renders → no WebGL context loss.
 */
export default function HomePhysicsCansLoader() {
  const [isDesktop, setIsDesktop] = useState(false);
  const labelUrls = useTopRatedLabels(5);
  const [ready, setReady] = useState<{
    textures: THREE.Texture[];
    Component: React.ComponentType<{ textures: THREE.Texture[] }>;
  } | null>(null);

  // Desktop gate
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Once we have label URLs + are on desktop, preload everything
  useEffect(() => {
    if (!isDesktop || labelUrls.length === 0 || ready) return;
    let cancelled = false;

    const preload = async () => {
      // Load module + textures in parallel
      const [mod, ...textures] = await Promise.all([
        HomePhysicsCansModule
          ? Promise.resolve(HomePhysicsCansModule)
          : import('./HomePhysicsCans').then((m) => {
              HomePhysicsCansModule = m;
              return m;
            }),
        ...labelUrls.map((url) => loadTexture(url)),
      ]);

      if (cancelled) {
        textures.forEach((t) => { if (t instanceof THREE.Texture) t.dispose(); });
        return;
      }

      // Only spawn cans that have a valid texture
      const validTextures = (textures as (THREE.Texture | null)[]).filter(
        (t): t is THREE.Texture => t instanceof THREE.Texture,
      );
      if (validTextures.length === 0) return;

      setReady({
        textures: validTextures,
        Component: (mod as typeof import('./HomePhysicsCans')).default,
      });
    };

    preload().catch((err) => {
      console.warn('[HomePhysicsCansLoader] preload failed:', err);
    });

    return () => { cancelled = true; };
    // Only run once when labels arrive — `ready` in deps prevents re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, labelUrls]);

  if (!ready) return null;

  const { Component, textures } = ready;
  return <Component textures={textures} />;
}

/** Fetch label image through proxy, load as THREE.Texture */
function loadTexture(url: string): Promise<THREE.Texture | null> {
  if (!url) return Promise.resolve(null);
  return fetch(`/api/label-image?url=${encodeURIComponent(url)}`)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<THREE.Texture | null>((resolve) => {
          const objectUrl = URL.createObjectURL(blob);
          new THREE.TextureLoader().load(
            objectUrl,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = 16; // clamped by renderer at render time
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.magFilter = THREE.LinearFilter;
              tex.generateMipmaps = true;
              URL.revokeObjectURL(objectUrl);
              resolve(tex);
            },
            undefined,
            () => {
              URL.revokeObjectURL(objectUrl);
              resolve(null);
            },
          );
        }),
    )
    .catch(() => null);
}
