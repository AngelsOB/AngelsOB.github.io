'use client';

import { useRef, useEffect, useMemo, useCallback, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { LoopSubdivision } from 'three-subdivide';
import * as THREE from 'three';
import { HOME_CAN_CONFIG, type CanPhysicsConfig } from './canPhysicsConfig';
import { DomColliders } from './DomColliders';

/* ── Constants ──────────────────────────────────────────────── */

const CAN_COUNT = 10;
const SUBDIVISIONS = 1;
const VEL_HISTORY_LEN = 5;
const GRAVITY: [number, number, number] = [0, HOME_CAN_CONFIG.gravity, 0];
const CANVAS_GL = { antialias: true, alpha: true, powerPreference: 'low-power' as const };
const CANVAS_DPR: [number, number] = [1, 1.5];
const CANVAS_STYLE = { background: 'transparent', pointerEvents: 'none' as const };
const CANVAS_EVENTS = () => ({ enabled: false, priority: 0, compute: () => {} }) as never;
const OVERLAY_STYLE: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 41, pointerEvents: 'none' };
const CAMERA_CONFIG = { position: [0, 0, HOME_CAN_CONFIG.cameraZ] as [number, number, number], fov: HOME_CAN_CONFIG.cameraFov };

/* ── Shared can geometry (subdivide once, reuse for all cans) ── */

function useSharedCanGeometry(config: CanPhysicsConfig) {
  const obj = useLoader(OBJLoader, '/can.obj');

  return useMemo(() => {
    const box = new THREE.Box3();
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) box.union(child.geometry.boundingBox);
      }
    });
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const scaleY = config.meshHeight / size.y;
    const naturalRadius = (Math.max(size.x, size.z) / 2) * scaleY;
    const radialScale = config.canRadius / naturalRadius;

    let sharedGeo: THREE.BufferGeometry | null = null;
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && !sharedGeo) {
        const geo = child.geometry.clone();
        geo.translate(-center.x, -center.y, -center.z);
        sharedGeo = LoopSubdivision.modify(geo, SUBDIVISIONS, {
          split: true, uvSmooth: false, flatOnly: false,
        });
        sharedGeo.computeVertexNormals();
      }
    });

    const canMaterial = new THREE.MeshStandardMaterial({
      color: config.canColor, metalness: config.canMetalness, roughness: config.canRoughness,
    });

    const labelH = config.meshHeight * config.labelHeightRatio;
    const labelGeo = new THREE.CylinderGeometry(
      config.canRadius + 0.003, config.canRadius + 0.003,
      labelH, 64, 1, true, 0, Math.PI * 2,
    );

    return {
      geometry: sharedGeo!,
      canMaterial,
      labelGeo,
      scale: [scaleY * radialScale, scaleY, scaleY * radialScale] as [number, number, number],
    };
  }, [obj, config.meshHeight, config.canRadius, config.canColor, config.canMetalness, config.canRoughness, config.labelHeightRatio]);
}

/* ── Can Mesh (visual only, uses shared geometry + preloaded texture) ── */

function HomeCanMesh({
  texture,
  config,
  shared,
}: {
  texture: THREE.Texture | null;
  config: CanPhysicsConfig;
  shared: ReturnType<typeof useSharedCanGeometry>;
}) {
  return (
    <group scale={shared.scale}>
      <mesh geometry={shared.geometry} material={shared.canMaterial} />
      {texture && (
        <mesh geometry={shared.labelGeo} position={[0, config.labelYOffset, 0]}>
          <meshStandardMaterial map={texture} metalness={config.labelMetalness} roughness={config.labelRoughness} side={THREE.FrontSide} />
        </mesh>
      )}
    </group>
  );
}

/* ── Simplified Beer Can Body (no pendulum swing) ──────────── */

function HomeBeerCan({
  texture,
  config,
  startPosition,
  shared,
}: {
  texture: THREE.Texture | null;
  config: CanPhysicsConfig;
  startPosition: [number, number, number];
  shared: ReturnType<typeof useSharedCanGeometry>;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const nextWindTime = useRef(0);
  const cursorPx = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  const posHistory = useRef<{ x: number; y: number; t: number }[]>([]);

  const canHalfH = config.meshHeight / 2;

  const pixelToWorld = useCallback((px: number, py: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((px - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((py - rect.top) / rect.height) * 2 + 1;
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
    vec.unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(dist));
  }, [camera, gl]);

  const worldToPixel = useCallback((wx: number, wy: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const vec = new THREE.Vector3(wx, wy, 0);
    vec.project(camera);
    return {
      x: (vec.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-vec.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }, [camera, gl]);

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const HIT_PAD = 15;

    const isInsideCan = (clientX: number, clientY: number) => {
      if (!bodyRef.current) return false;
      const cfg = configRef.current;
      const pos = bodyRef.current.translation();
      const screen = worldToPixel(pos.x, pos.y);
      const dx = clientX - screen.x;
      const dy = clientY - screen.y;
      const topScreen = worldToPixel(pos.x, pos.y + cfg.meshHeight / 2);
      const rightScreen = worldToPixel(pos.x + cfg.canRadius, pos.y);
      const hitHalfH = Math.abs(topScreen.y - screen.y) + HIT_PAD;
      const hitHalfW = Math.abs(rightScreen.x - screen.x) + HIT_PAD;
      return (dx / hitHalfW) ** 2 + (dy / hitHalfH) ** 2 <= 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!bodyRef.current) return;
      if (!isInsideCan(e.clientX, e.clientY)) return;

      e.preventDefault();
      document.body.style.cursor = 'grabbing';
      dragging.current = true;
      cursorPx.current = { x: e.clientX, y: e.clientY };

      const pos = bodyRef.current.translation();
      const pointerWorld = pixelToWorld(e.clientX, e.clientY);
      grabOffset.current = { x: pointerWorld.x - pos.x, y: pointerWorld.y - pos.y };

      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setBodyType(2, true); // KinematicPositionBased
      posHistory.current = [{ x: pos.x, y: pos.y, t: performance.now() }];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      cursorPx.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      if (!dragging.current || !bodyRef.current) return;
      document.body.style.cursor = '';
      dragging.current = false;
      bodyRef.current.setBodyType(0, true); // Dynamic

      const cfg = configRef.current;
      const hist = posHistory.current;
      if (hist.length >= 2) {
        const recent = hist[hist.length - 1];
        let old = hist[0];
        for (let i = hist.length - 2; i >= 0; i--) {
          if (recent.t - hist[i].t >= 50) { old = hist[i]; break; }
        }
        const dt = (recent.t - old.t) / 1000;
        if (dt > 0.001) {
          let vx = (recent.x - old.x) / dt;
          let vy = (recent.y - old.y) / dt;
          const mag = Math.sqrt(vx * vx + vy * vy);
          if (mag > cfg.maxThrowVel) {
            vx *= cfg.maxThrowVel / mag;
            vy *= cfg.maxThrowVel / mag;
          }
          bodyRef.current.setLinvel({ x: vx, y: vy, z: 0 }, true);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current || !bodyRef.current) return;
      document.body.style.cursor = isInsideCan(e.clientX, e.clientY) ? 'grab' : '';
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.body.style.cursor = '';
    };
  }, [pixelToWorld, worldToPixel]);

  // Drag + wind + Z constraint
  useFrame(() => {
    if (!bodyRef.current) return;
    const cfg = configRef.current;
    const pos = bodyRef.current.translation();

    if (dragging.current) {
      const now = performance.now();
      const target = pixelToWorld(cursorPx.current.x, cursorPx.current.y);
      const newX = target.x - grabOffset.current.x;
      const newY = target.y - grabOffset.current.y;
      bodyRef.current.setNextKinematicTranslation({ x: newX, y: newY, z: 0 });
      posHistory.current.push({ x: newX, y: newY, t: now });
      if (posHistory.current.length > VEL_HISTORY_LEN) posHistory.current.shift();
    }

    if (!dragging.current && Math.abs(pos.z) > 0.01) {
      bodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
      const lv = bodyRef.current.linvel();
      bodyRef.current.setLinvel({ x: lv.x, y: lv.y, z: 0 }, true);
    }

    if (!dragging.current) {
      const now = performance.now();
      if (now >= nextWindTime.current) {
        const lv = bodyRef.current.linvel();
        const speed = Math.abs(lv.x) + Math.abs(lv.y);
        if (speed < 1.0) {
          bodyRef.current.applyImpulse(
            { x: (Math.random() - 0.5) * 2 * cfg.windForce, y: 0, z: 0 },
            true,
          );
          bodyRef.current.applyTorqueImpulse(
            { x: 0, y: 0, z: (Math.random() - 0.5) * cfg.windForce * 0.3 },
            true,
          );
        }
        const interval = cfg.windMinInterval + Math.random() * (cfg.windMaxInterval - cfg.windMinInterval);
        nextWindTime.current = now + interval * 1000;
      }
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={startPosition}
      colliders={false}
      mass={config.mass}
      restitution={config.restitution}
      friction={config.friction}
      linearDamping={config.linearDamping}
      angularDamping={config.angularDamping}
      enabledTranslations={[true, true, false]}
      enabledRotations={[true, true, true]}
      ccd
    >
      <CylinderCollider args={[canHalfH, config.canRadius]} />
      <HomeCanMesh texture={texture} config={config} shared={shared} />
    </RigidBody>
  );
}

/* ── Walls (left, right, ceiling + safety floor) ───────────── */

function Walls({ config }: { config: CanPhysicsConfig }) {
  const { viewport } = useThree();
  const wallThick = 5;
  const halfW = viewport.width / 2 + wallThick;
  const halfH = viewport.height / 2 + wallThick;
  const safetyFloorY = -viewport.height - 2;

  return (
    <>
      <RigidBody type="fixed" position={[-halfW, 0, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[wallThick, halfH * 3, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[halfW, 0, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[wallThick, halfH * 3, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, halfH, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[50, wallThick, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, safetyFloorY, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[50, 0.1, 50]} />
      </RigidBody>
    </>
  );
}

/* ── Scene ──────────────────────────────────────────────────── */

function HomeScene({ textures, config }: { textures: THREE.Texture[]; config: CanPhysicsConfig }) {
  const { gl } = useThree();
  const shared = useSharedCanGeometry(config);

  const startPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const rect = gl.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const worldHalfW = Math.tan((config.cameraFov * Math.PI) / 360) * config.cameraZ * aspect;
    const worldHalfH = Math.tan((config.cameraFov * Math.PI) / 360) * config.cameraZ;
    for (let i = 0; i < CAN_COUNT; i++) {
      const frac = 0.1 + (0.8 * i) / (CAN_COUNT - 1);
      const worldX = (frac * 2 - 1) * worldHalfW;
      const worldY = worldHalfH + 1 + i * 1.2;
      positions.push([worldX, worldY, 0]);
    }
    return positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Randomly distribute available textures across all cans
  const canTextures = useMemo(() =>
    Array.from({ length: CAN_COUNT }, () =>
      textures[Math.floor(Math.random() * textures.length)],
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textures],
  );

  return (
    <>
      <Environment preset="city" environmentIntensity={0.4} />
      <Physics gravity={GRAVITY} timeStep="vary">
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 5]} intensity={1.8} color="#fff8ee" />
        <directionalLight position={[-3, 2, 4]} intensity={0.8} color="#f0f4ff" />
        <directionalLight position={[0, 3, -5]} intensity={2.5} color="#ffffff" />
        {canTextures.map((tex, i) => (
          <HomeBeerCan
            key={i}
            texture={tex}
            config={config}
            startPosition={startPositions[i]}
            shared={shared}
          />
        ))}
        <DomColliders />
        <Walls config={config} />
      </Physics>
    </>
  );
}

/* ── Error boundary ─────────────────────────────────────────── */

class HomeCanErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.error('[HomePhysicsCans] Error boundary caught:', error.message, error.stack);
    this.retryTimer = setTimeout(() => this.setState({ hasError: false }), 2000);
  }
  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

/* ── Main export ────────────────────────────────────────────── */

/**
 * Receives preloaded textures from HomePhysicsCansLoader.
 * Mounts the Canvas exactly once — no hooks that cause state changes.
 */
export default function HomePhysicsCans({ textures }: { textures: THREE.Texture[] }) {
  const config = HOME_CAN_CONFIG;

  return (
    <HomeCanErrorBoundary>
      <div style={OVERLAY_STYLE}>
        <Canvas
          camera={CAMERA_CONFIG}
          gl={CANVAS_GL}
          dpr={CANVAS_DPR}
          style={CANVAS_STYLE}
          events={CANVAS_EVENTS}
        >
          <HomeScene textures={textures} config={config} />
        </Canvas>
      </div>
    </HomeCanErrorBoundary>
  );
}
