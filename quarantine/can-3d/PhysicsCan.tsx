'use client';

import { useRef, useEffect, useState, useMemo, useCallback, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { LoopSubdivision } from 'three-subdivide';
import * as THREE from 'three';
import { DEFAULT_CAN_CONFIG, type CanPhysicsConfig } from './canPhysicsConfig';

/* ── Constants ──────────────────────────────────────────────── */

const SUBDIVISIONS = 2;        // Loop subdivision iterations on OBJ mesh
const VEL_HISTORY_LEN = 5;     // frames of position history for throw velocity

/* ── Helpers ────────────────────────────────────────────────── */

/** Get the sticky footer rect if visible */
function getFooterRect(): DOMRect | null {
  const els = document.querySelectorAll<HTMLElement>('.fixed.bottom-0');
  for (const el of els) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.top < window.innerHeight) return rect;
  }
  return null;
}

/* ── OBJ Can Mesh (visual only) ─────────────────────────────── */

function CanMesh({ labelUrl, config }: { labelUrl: string; config: CanPhysicsConfig }) {
  const obj = useLoader(OBJLoader, '/can.obj');
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const { canMesh, labelRadius } = useMemo(() => {
    const cloned = obj.clone(true);
    const box = new THREE.Box3();
    cloned.traverse((child) => {
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
    const radialScale = config.canRadius / naturalRadius; // shrink/grow X/Z to match configured radius
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.translate(-center.x, -center.y, -center.z);
        // Subdivide for smooth silhouette
        const subdivided = LoopSubdivision.modify(child.geometry, SUBDIVISIONS, {
          split: true,
          uvSmooth: false,
          flatOnly: false,
        });
        child.geometry = subdivided;
        child.geometry.computeVertexNormals();
        child.material = new THREE.MeshStandardMaterial({
          color: config.canColor, metalness: config.canMetalness, roughness: config.canRoughness,
        });
      }
    });
    cloned.scale.set(scaleY * radialScale, scaleY, scaleY * radialScale);
    return { canMesh: cloned, labelRadius: config.canRadius };
  }, [obj, config.meshHeight, config.canRadius, config.canColor, config.canMetalness, config.canRoughness]);

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
          tex.anisotropy = 16;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          setTexture(tex);
        });
      })
      .catch((err) => console.warn('PhysicsCan: failed to load texture', err));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [labelUrl]);

  const labelGeo = useMemo(() => {
    const labelH = config.meshHeight * config.labelHeightRatio;
    return new THREE.CylinderGeometry(
      labelRadius + 0.003, labelRadius + 0.003,
      labelH, 64, 1, true, 0, Math.PI * 2,
    );
  }, [labelRadius, config.meshHeight, config.labelHeightRatio]);

  return (
    <group>
      <primitive object={canMesh} />
      {texture && (
        <mesh geometry={labelGeo} position={[0, config.labelYOffset, 0]}>
          <meshStandardMaterial map={texture} metalness={config.labelMetalness} roughness={config.labelRoughness} side={THREE.FrontSide} />
        </mesh>
      )}
    </group>
  );
}

/* ── Beer Can Rigid Body ────────────────────────────────────── */

function BeerCanBody({ labelUrl, config, startX = 0 }: { labelUrl: string; config: CanPhysicsConfig; startX?: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { viewport, camera, gl } = useThree();
  const dragging = useRef(false);
  const nextWindTime = useRef(0);
  const cursorPx = useRef({ x: 0, y: 0 });
  const posHistory = useRef<{ x: number; y: number; t: number }[]>([]); // for throw velocity

  // Pendulum state
  const grabDist = useRef(0);        // distance from grab point to can center
  const grabAngle = useRef(0);       // angle of grab offset from can center (in world frame at grab time)
  const swingAngle = useRef(0);      // current Z-rotation of the can
  const swingOmega = useRef(0);      // angular velocity of pendulum
  const prevPivot = useRef({ x: 0, y: 0 }); // previous frame pivot for cursor velocity
  const prevPivotVel = useRef({ x: 0, y: 0 }); // previous frame pivot velocity for acceleration
  const lastFrameTime = useRef(0);

  const canHalfH = config.meshHeight / 2;

  // Convert pixel coords to world coords at z=0 plane (uses canvas rect, not window)
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

  // Convert world coords to pixel coords (uses canvas rect, not window)
  const worldToPixel = useCallback((wx: number, wy: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const vec = new THREE.Vector3(wx, wy, 0);
    vec.project(camera);
    return {
      x: (vec.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-vec.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }, [camera, gl]);

  // Initial position — above viewport, offset by startX
  const startPos = useMemo((): [number, number, number] => {
    const worldStart = pixelToWorld(gl.domElement.getBoundingClientRect().left + gl.domElement.getBoundingClientRect().width * 0.5, -100);
    return [worldStart.x + startX, worldStart.y, 0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use a ref for config so pointer event closures always see latest values
  const configRef = useRef(config);
  configRef.current = config;

  // Pointer events for drag
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
      const rot = bodyRef.current.rotation();
      const pointerWorld = pixelToWorld(e.clientX, e.clientY);

      // Grab offset: vector from can center to grab point
      const ox = pointerWorld.x - pos.x;
      const oy = pointerWorld.y - pos.y;
      grabDist.current = Math.sqrt(ox * ox + oy * oy);
      // Angle of the grab offset vector in world space
      grabAngle.current = Math.atan2(ox, oy); // angle from +Y axis

      // Current Z-rotation of the can (extract from quaternion)
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w), 'XYZ',
      );
      swingAngle.current = euler.z;
      swingOmega.current = 0;

      // Initialize pivot tracking for cursor acceleration
      prevPivot.current = { x: pointerWorld.x, y: pointerWorld.y };
      prevPivotVel.current = { x: 0, y: 0 };
      lastFrameTime.current = performance.now();

      // Kill velocity and switch to kinematic
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setBodyType(2, true); // 2 = KinematicPositionBased
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

      // Switch back to dynamic
      bodyRef.current.setBodyType(0, true); // 0 = Dynamic

      // Compute throw velocity from position history
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
      // Transfer pendulum angular velocity to physics
      bodyRef.current.setAngvel({ x: 0, y: 0, z: swingOmega.current }, true);
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
  }, [pixelToWorld, worldToPixel, viewport.width]);

  // Pendulum drag + wind gusts + Z-axis constraint
  useFrame(() => {
    if (!bodyRef.current) return;
    const cfg = configRef.current;
    const pos = bodyRef.current.translation();

    // ── Drag: pendulum simulation ──
    if (dragging.current) {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime.current) / 1000, 0.05); // cap at 50ms
      lastFrameTime.current = now;

      // Pivot = cursor world position
      const pivot = pixelToWorld(cursorPx.current.x, cursorPx.current.y);

      // Compute cursor velocity and acceleration for inertial swing
      const pivotVelX = dt > 0 ? (pivot.x - prevPivot.current.x) / dt : 0;
      const pivotVelY = dt > 0 ? (pivot.y - prevPivot.current.y) / dt : 0;
      const pivotAccelX = dt > 0 ? (pivotVelX - prevPivotVel.current.x) / dt : 0;
      prevPivot.current = { x: pivot.x, y: pivot.y };
      prevPivotVel.current = { x: pivotVelX, y: pivotVelY };

      const L = Math.max(grabDist.current, 0.05); // prevent division by zero

      // The arm angle = grabAngle + swingAngle (where grabAngle is the initial offset direction)
      // "arm" points from pivot toward can center, which is opposite of grab offset
      // Rest position: center of mass directly below pivot → arm points straight down
      // restArmAngle = π (pointing down from pivot, measured from +Y)
      // Current arm angle: grabAngle rotated by the can's swing
      // Deviation from rest = how far the arm is from pointing straight down
      const armAngle = grabAngle.current + swingAngle.current;
      // Gravity torque: restoring toward arm pointing down (armAngle = π from +Y = straight down)
      // sin(armAngle) gives the horizontal deviation — gravity wants to eliminate it
      // gravity is negative (e.g. -30), so: α = (gravity / L) * sin(armAngle)
      // When armAngle = 0 (arm up), sin=0 unstable equilibrium
      // When armAngle has positive sin (arm tilted right), gravity pulls it back left (negative torque)
      const alphaGravity = (cfg.gravity / L) * Math.sin(armAngle);

      // Inertial torque: cursor accelerating right → can swings left
      // Project acceleration onto the perpendicular of the arm
      const alphaInertia = -pivotAccelX * Math.cos(armAngle) * cfg.swingInertia / L;

      // Integrate pendulum
      swingOmega.current += (alphaGravity + alphaInertia) * dt;
      swingOmega.current *= Math.max(0, 1 - cfg.swingDamping * dt); // damping
      swingAngle.current += swingOmega.current * dt;

      // Compute can center: pivot minus the rotated grab offset
      // Grab offset in current frame = (sin(armAngle) * L, cos(armAngle) * L)
      // Can center = pivot - grabOffset = pivot - (sin(armAngle)*L, cos(armAngle)*L)
      const newX = pivot.x - Math.sin(armAngle) * L;
      const newY = pivot.y - Math.cos(armAngle) * L;

      bodyRef.current.setNextKinematicTranslation({ x: newX, y: newY, z: 0 });

      // Set rotation from swing angle
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), swingAngle.current,
      );
      bodyRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

      // Track position history for throw velocity
      posHistory.current.push({ x: newX, y: newY, t: now });
      if (posHistory.current.length > VEL_HISTORY_LEN) posHistory.current.shift();
    }

    // ── Constrain to Z=0 plane ──
    if (!dragging.current && Math.abs(pos.z) > 0.01) {
      bodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
      const lv = bodyRef.current.linvel();
      bodyRef.current.setLinvel({ x: lv.x, y: lv.y, z: 0 }, true);
    }

    // ── Wind gusts (only when not dragging) ──
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
      position={startPos}
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
      <CanMesh labelUrl={labelUrl} config={config} />
    </RigidBody>
  );
}

/* ── Floor + Walls ──────────────────────────────────────────── */

function Boundaries({ config }: { config: CanPhysicsConfig }) {
  const floorRef = useRef<RapierRigidBody>(null);
  const { viewport } = useThree();

  useFrame(() => {
    if (!floorRef.current) return;
    const footer = getFooterRect();
    const vh = window.innerHeight;
    const footerFrac = footer ? footer.top / vh : 1;
    const floorY = -(footerFrac * viewport.height) + viewport.height / 2;
    const pos = floorRef.current.translation();
    if (Math.abs(pos.y - floorY) > 0.01) {
      floorRef.current.setTranslation({ x: 0, y: floorY, z: 0 }, true);
    }
  });

  const wallThick = 5; // thick walls prevent tunneling at high velocities
  const halfW = viewport.width / 2 + wallThick;
  const halfH = viewport.height / 2 + wallThick;

  return (
    <>
      <RigidBody ref={floorRef} type="fixed" position={[0, -viewport.height / 2, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[50, 0.1, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[-halfW, 0, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[wallThick, halfH, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[halfW, 0, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[wallThick, halfH, 50]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, halfH, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[50, wallThick, 50]} />
      </RigidBody>
    </>
  );
}

/* ── Error boundary ─────────────────────────────────────────── */

class CanErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.warn('[PhysicsCan] Error boundary caught:', error.message);
    // Auto-retry after 2s (handles WebGL context loss during HMR)
    this.retryTimer = setTimeout(() => this.setState({ hasError: false }), 2000);
  }
  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

/* ── Main component ─────────────────────────────────────────── */

export interface PhysicsCanProps {
  labelUrl: string;
  srmColor?: string;
  config?: CanPhysicsConfig;
  canCount?: number;
}

/** Generate a random X offset in world units so stacked spawns don't overlap */
function randomStartX() {
  return (Math.random() - 0.5) * 4; // ±2 world units from center
}

function PhysicsCanInner({ labelUrl, srmColor, config = DEFAULT_CAN_CONFIG, canCount = 1 }: PhysicsCanProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  // Stable list of keys — grows as canCount increases, never shrinks (physics bodies stay)
  const canKeys = useRef<number[]>([]);
  const nextId = useRef(0);
  const startXs = useRef<number[]>([]);

  // Grow the key list when canCount increases
  while (canKeys.current.length < canCount) {
    canKeys.current.push(nextId.current++);
    startXs.current.push(randomStartX());
  }

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isDesktop || canCount === 0) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 41, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, config.cameraZ], fov: config.cameraFov }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent', pointerEvents: 'none' }}
        events={() => ({ enabled: false, priority: 0, compute: () => {} } as never)}
      >
        <Environment preset="city" environmentIntensity={0.4} />
        <Physics gravity={[0, config.gravity, 0]} timeStep="vary">
          <ambientLight intensity={0.3} />
          <directionalLight position={[3, 4, 5]} intensity={1.8} color="#fff8ee" />
          <directionalLight position={[-3, 2, 4]} intensity={0.8} color="#f0f4ff" />
          <directionalLight position={[0, 3, -5]} intensity={2.5} color="#ffffff" />
          {srmColor && <pointLight position={[1, -1, 3]} intensity={2.0} color={srmColor} distance={15} decay={2} />}
          {canKeys.current.slice(0, canCount).map((key, i) => (
            <BeerCanBody key={key} labelUrl={labelUrl} config={config} startX={startXs.current[i]} />
          ))}
          <Boundaries config={config} />
        </Physics>
      </Canvas>
    </div>
  );
}

export default function PhysicsCan(props: PhysicsCanProps) {
  return (
    <CanErrorBoundary>
      <PhysicsCanInner {...props} />
    </CanErrorBoundary>
  );
}
