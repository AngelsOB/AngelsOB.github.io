'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/** Parse "rgb(r, g, b)" into a THREE.Color */
function parseSrmColor(srmRgb?: string): THREE.Color {
  if (!srmRgb) return new THREE.Color(0.85, 0.65, 0.2); // amber fallback
  const match = srmRgb.match(/(\d+)/g);
  if (!match || match.length < 3) return new THREE.Color(0.85, 0.65, 0.2);
  return new THREE.Color(+match[0] / 255, +match[1] / 255, +match[2] / 255);
}

/* ── Can mesh ──────────────────────────────────────────────── */

function BeerCanMesh({ labelUrl, srmColor }: { labelUrl: string; srmColor?: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const beerColor = useMemo(() => parseSrmColor(srmColor), [srmColor]);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    fetch(`/api/label-image?url=${encodeURIComponent(labelUrl)}`)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        new THREE.TextureLoader().load(objectUrl, (tex) => {
          if (cancelled) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          setTexture(tex);
        });
      })
      .catch((err) => console.warn('Failed to load label texture:', err));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [labelUrl]);

  // Auto-rotate when idle
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  // Can dimensions (proportional to a real 355ml/12oz can)
  const radius = 0.55;
  const height = 2.0;
  const labelHeight = height * 0.7;

  // Build the label as a cylinder section wrapping ~270 degrees
  const labelGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(
      radius + 0.002, // slightly larger to avoid z-fighting
      radius + 0.002,
      labelHeight,
      64,       // segments
      1,
      true,     // open-ended
      0,        // thetaStart
      Math.PI * 2, // full wrap for now, texture handles the visual
    );
    return geo;
  }, [radius, labelHeight]);

  return (
    <group ref={groupRef}>
      {/* Main can body */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 64]} />
        <meshStandardMaterial
          color="#c0c0c0"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* Label wrap */}
      {texture && (
        <mesh geometry={labelGeometry} position={[0, -0.05, 0]}>
          <meshStandardMaterial
            map={texture}
            metalness={0.1}
            roughness={0.6}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* Top cap — slight inset with beer color tint */}
      <mesh position={[0, height / 2, 0]}>
        <circleGeometry args={[radius * 0.95, 64]} />
        <meshStandardMaterial
          color="#a8a8a8"
          metalness={0.9}
          roughness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, height / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, radius * 0.4, 32]} />
        <meshStandardMaterial
          color={beerColor}
          transparent
          opacity={0.3}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* Bottom cap */}
      <mesh position={[0, -height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial
          color="#b0b0b0"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      {/* Rim — top lip */}
      <mesh position={[0, height / 2, 0]}>
        <torusGeometry args={[radius, 0.025, 8, 64]} />
        <meshStandardMaterial
          color="#d0d0d0"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      {/* Rim — bottom lip */}
      <mesh position={[0, -height / 2, 0]}>
        <torusGeometry args={[radius, 0.02, 8, 64]} />
        <meshStandardMaterial
          color="#b8b8b8"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

/* ── Main component ────────────────────────────────────────── */

interface BeerCan3DProps {
  labelUrl: string;
  srmColor?: string;
}

export default function BeerCan3D({ labelUrl, srmColor }: BeerCan3DProps) {
  return (
    <div className="mx-auto h-[320px] w-full max-w-[280px]">
      <Canvas
        camera={{ position: [0, 0.5, 3.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <directionalLight position={[-2, -1, -3]} intensity={0.3} />

        <BeerCanMesh labelUrl={labelUrl} srmColor={srmColor} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
