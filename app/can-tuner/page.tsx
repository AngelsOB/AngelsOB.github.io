'use client';

import { useState, useCallback, useRef, useMemo, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { LoopSubdivision } from 'three-subdivide';
import * as THREE from 'three';
import { DEFAULT_CAN_CONFIG, type CanPhysicsConfig } from '@/modules/labels/canPhysicsConfig';

/* ── Slider definitions ─────────────────────────────────────── */

interface SliderDef {
  key: keyof CanPhysicsConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}

const SLIDERS: SliderDef[] = [
  // Physics
  { key: 'gravity', label: 'Gravity', min: -80, max: -1, step: 0.5, group: 'Physics' },
  { key: 'mass', label: 'Mass', min: 0.1, max: 10, step: 0.1, group: 'Physics' },
  { key: 'restitution', label: 'Can Restitution (Bounce)', min: 0, max: 1, step: 0.01, group: 'Physics' },
  { key: 'friction', label: 'Can Friction', min: 0, max: 2, step: 0.05, group: 'Physics' },
  { key: 'linearDamping', label: 'Linear Damping', min: 0, max: 10, step: 0.1, group: 'Physics' },
  { key: 'angularDamping', label: 'Angular Damping', min: 0, max: 20, step: 0.1, group: 'Physics' },
  { key: 'floorRestitution', label: 'Floor Restitution', min: 0, max: 1, step: 0.01, group: 'Physics' },
  { key: 'floorFriction', label: 'Floor Friction', min: 0, max: 2, step: 0.05, group: 'Physics' },

  // Wind
  { key: 'windForce', label: 'Wind Force', min: 0, max: 3, step: 0.05, group: 'Wind' },
  { key: 'windMinInterval', label: 'Wind Min Interval (s)', min: 0.5, max: 15, step: 0.5, group: 'Wind' },
  { key: 'windMaxInterval', label: 'Wind Max Interval (s)', min: 1, max: 30, step: 0.5, group: 'Wind' },

  // Geometry
  { key: 'meshHeight', label: 'Mesh Height', min: 0.5, max: 5, step: 0.1, group: 'Geometry' },
  { key: 'canRadius', label: 'Can Radius', min: 0.1, max: 1.5, step: 0.01, group: 'Geometry' },

  // Camera
  { key: 'cameraZ', label: 'Camera Distance (Z)', min: 3, max: 25, step: 0.5, group: 'Camera' },
  { key: 'cameraFov', label: 'Field of View', min: 20, max: 120, step: 1, group: 'Camera' },

  // Can Material
  { key: 'canMetalness', label: 'Metalness', min: 0, max: 1, step: 0.01, group: 'Can Material' },
  { key: 'canRoughness', label: 'Roughness', min: 0, max: 1, step: 0.01, group: 'Can Material' },

  // Label Material
  { key: 'labelMetalness', label: 'Metalness', min: 0, max: 1, step: 0.01, group: 'Label Material' },
  { key: 'labelRoughness', label: 'Roughness', min: 0, max: 1, step: 0.01, group: 'Label Material' },
  { key: 'labelHeightRatio', label: 'Height Ratio', min: 0.3, max: 1.0, step: 0.01, group: 'Label Material' },
  { key: 'labelYOffset', label: 'Y Offset', min: -0.5, max: 0.5, step: 0.01, group: 'Label Material' },

  // Drag
  { key: 'maxThrowVel', label: 'Max Throw Velocity', min: 1, max: 30, step: 0.5, group: 'Drag' },

  // Swing (pendulum)
  { key: 'swingDamping', label: 'Swing Damping', min: 0, max: 20, step: 0.5, group: 'Swing' },
  { key: 'swingInertia', label: 'Swing Inertia', min: 0, max: 2, step: 0.05, group: 'Swing' },
];

/* ── Constants ────────────────────────────────────────────────── */

const SUBDIVISIONS = 2;
const VEL_HISTORY_LEN = 5;

/* ── OBJ Can Mesh (visual only — matches PhysicsCan) ──────── */

function CanMesh({ config }: { config: CanPhysicsConfig }) {
  const obj = useLoader(OBJLoader, '/can.obj');

  const canMesh = useMemo(() => {
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
    const radialScale = config.canRadius / naturalRadius;
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.translate(-center.x, -center.y, -center.z);
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
    return cloned;
  }, [obj, config.meshHeight, config.canRadius, config.canColor, config.canMetalness, config.canRoughness]);

  return <primitive object={canMesh} />;
}

/* ── Beer Can Rigid Body (tuner version) ─────────────────────── */

function BeerCanBody({ config, showDebug }: { config: CanPhysicsConfig; showDebug: boolean }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { viewport, camera, gl } = useThree();
  const dragging = useRef(false);
  const nextWindTime = useRef(0);
  const cursorPx = useRef({ x: 0, y: 0 });
  const posHistory = useRef<{ x: number; y: number; t: number }[]>([]);

  // Pendulum state
  const grabDist = useRef(0);
  const grabAngle = useRef(0);
  const swingAngle = useRef(0);
  const swingOmega = useRef(0);
  const prevPivot = useRef({ x: 0, y: 0 });
  const prevPivotVel = useRef({ x: 0, y: 0 });
  const lastFrameTime = useRef(0);

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
      // Ignore clicks on the slider panel
      const target = e.target as HTMLElement;
      if (target.closest('[data-tuner-panel]')) return;

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
      grabAngle.current = Math.atan2(ox, oy);

      // Current Z-rotation of the can
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w), 'XYZ',
      );
      swingAngle.current = euler.z;
      swingOmega.current = 0;

      // Initialize pivot tracking
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

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
    };
  }, [pixelToWorld, worldToPixel, viewport.width]);

  // Pendulum drag + wind gusts + Z constraint
  useFrame(() => {
    if (!bodyRef.current) return;
    const cfg = configRef.current;
    const pos = bodyRef.current.translation();

    // ── Drag: pendulum simulation ──
    if (dragging.current) {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime.current) / 1000, 0.05);
      lastFrameTime.current = now;

      const pivot = pixelToWorld(cursorPx.current.x, cursorPx.current.y);

      // Cursor velocity and acceleration for inertial swing
      const pivotVelX = dt > 0 ? (pivot.x - prevPivot.current.x) / dt : 0;
      const pivotVelY = dt > 0 ? (pivot.y - prevPivot.current.y) / dt : 0;
      const pivotAccelX = dt > 0 ? (pivotVelX - prevPivotVel.current.x) / dt : 0;
      prevPivot.current = { x: pivot.x, y: pivot.y };
      prevPivotVel.current = { x: pivotVelX, y: pivotVelY };

      const L = Math.max(grabDist.current, 0.05);
      const armAngle = grabAngle.current + swingAngle.current;

      // Gravity torque
      const alphaGravity = (cfg.gravity / L) * Math.sin(armAngle);
      // Inertial torque from cursor acceleration
      const alphaInertia = -pivotAccelX * Math.cos(armAngle) * cfg.swingInertia / L;

      // Integrate pendulum
      swingOmega.current += (alphaGravity + alphaInertia) * dt;
      swingOmega.current *= Math.max(0, 1 - cfg.swingDamping * dt);
      swingAngle.current += swingOmega.current * dt;

      // Can center = pivot - rotated grab offset
      const newX = pivot.x - Math.sin(armAngle) * L;
      const newY = pivot.y - Math.cos(armAngle) * L;

      bodyRef.current.setNextKinematicTranslation({ x: newX, y: newY, z: 0 });

      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), swingAngle.current,
      );
      bodyRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

      posHistory.current.push({ x: newX, y: newY, t: now });
      if (posHistory.current.length > VEL_HISTORY_LEN) posHistory.current.shift();
    }

    // ── Constrain to Z=0 plane ──
    if (!dragging.current && Math.abs(pos.z) > 0.01) {
      bodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
      const lv = bodyRef.current.linvel();
      bodyRef.current.setLinvel({ x: lv.x, y: lv.y, z: 0 }, true);
    }

    // ── Out-of-bounds safety ──
    if (Math.abs(pos.x) > 20 || Math.abs(pos.y) > 20) {
      bodyRef.current.setTranslation({ x: 0, y: 3, z: 0 }, true);
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
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
      position={[0, 3, 0]}
      colliders={false}
      mass={config.mass}
      restitution={config.restitution}
      friction={config.friction}
      linearDamping={config.linearDamping}
      angularDamping={config.angularDamping}
      enabledTranslations={[true, true, false]}
      enabledRotations={[true, true, true]}
    >
      <CylinderCollider args={[canHalfH, config.canRadius]} />
      <CanMesh config={config} />
      {/* Debug: wireframe collider visualization */}
      {showDebug && (
        <mesh>
          <cylinderGeometry args={[config.canRadius, config.canRadius, config.meshHeight, 32, 1, false]} />
          <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.4} />
        </mesh>
      )}
    </RigidBody>
  );
}

/* ── Floor + Walls ──────────────────────────────────────────── */

function Boundaries({ config }: { config: CanPhysicsConfig }) {
  const { viewport } = useThree();
  const halfW = viewport.width / 2 + 1;
  const halfH = viewport.height / 2 + 1;

  return (
    <>
      {/* Floor — fixed at bottom of viewport */}
      <RigidBody type="fixed" position={[0, -viewport.height / 2, 0]} restitution={config.floorRestitution} friction={config.floorFriction}>
        <CuboidCollider args={[50, 0.1, 50]} />
      </RigidBody>
      {/* Visible floor line */}
      <mesh position={[0, -viewport.height / 2, 0]}>
        <planeGeometry args={[viewport.width, 0.02]} />
        <meshBasicMaterial color="#555" />
      </mesh>
      {/* Left wall */}
      <RigidBody type="fixed" position={[-halfW, 0, 0]}>
        <CuboidCollider args={[0.1, halfH, 50]} />
      </RigidBody>
      {/* Right wall */}
      <RigidBody type="fixed" position={[halfW, 0, 0]}>
        <CuboidCollider args={[0.1, halfH, 50]} />
      </RigidBody>
      {/* Ceiling */}
      <RigidBody type="fixed" position={[0, halfH, 0]}>
        <CuboidCollider args={[50, 0.1, 50]} />
      </RigidBody>
    </>
  );
}

/* ── Physics scene — remounts when key changes for collider/mass updates ── */

function PhysicsScene({ config, resetKey, showDebug }: { config: CanPhysicsConfig; resetKey: number; showDebug: boolean }) {
  return (
    <>
      <Environment preset="city" environmentIntensity={0.4} />
      <Physics gravity={[0, config.gravity, 0]} timeStep="vary" key={resetKey}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 5]} intensity={1.8} color="#fff8ee" />
        <directionalLight position={[-3, 2, 4]} intensity={0.8} color="#f0f4ff" />
        <directionalLight position={[0, 3, -5]} intensity={2.5} color="#ffffff" />
        <BeerCanBody config={config} showDebug={showDebug} />
        <Boundaries config={config} />
      </Physics>
    </>
  );
}

/* ── Error boundary ─────────────────────────────────────────── */

class TunerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: string }> {
  state: { hasError: boolean; error?: string } = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#f87171', fontFamily: 'monospace' }}>
          <h2>Physics Error</h2>
          <p>{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ marginTop: 8, padding: '6px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Slider component ───────────────────────────────────────── */

function Slider({
  def,
  value,
  onChange,
}: {
  def: SliderDef;
  value: number;
  onChange: (key: keyof CanPhysicsConfig, value: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <label style={{ width: 170, fontSize: 12, color: '#ccc', flexShrink: 0 }}>{def.label}</label>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#f59e0b' }}
      />
      <input
        type="number"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, parseFloat(e.target.value))}
        style={{
          width: 60, background: '#1e1e1e', color: '#f59e0b', border: '1px solid #333',
          borderRadius: 4, padding: '2px 4px', fontSize: 12, textAlign: 'right',
        }}
      />
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function CanTunerPage() {
  const [config, setConfig] = useState<CanPhysicsConfig>({ ...DEFAULT_CAN_CONFIG });
  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  const onChange = useCallback((key: keyof CanPhysicsConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setConfig({ ...DEFAULT_CAN_CONFIG });
    setResetKey((k) => k + 1);
  }, []);

  const respawn = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  const copyValues = useCallback(() => {
    const code = `export const DEFAULT_CAN_CONFIG: CanPhysicsConfig = ${JSON.stringify(config, null, 2)};`;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [config]);

  const groups = useMemo(() => {
    const map = new Map<string, SliderDef[]>();
    for (const s of SLIDERS) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    }
    return map;
  }, []);

  // Detect changes from defaults
  const hasChanges = useMemo(() => {
    return (Object.keys(DEFAULT_CAN_CONFIG) as (keyof CanPhysicsConfig)[]).some(
      (k) => config[k] !== DEFAULT_CAN_CONFIG[k],
    );
  }, [config]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      {/* Slider panel */}
      <div
        data-tuner-panel
        style={{
          width: 380,
          flexShrink: 0,
          background: '#1a1a1a',
          borderRight: '1px solid #333',
          overflowY: 'auto',
          padding: '16px 16px 80px',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f59e0b' }}>
          Can Physics Tuner
        </h1>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
          Tweak values, grab &amp; throw the can. Changes apply in real-time (some need respawn).
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={respawn} style={btnStyle('#f59e0b', '#000')}>
            Respawn Can
          </button>
          <button onClick={reset} style={btnStyle('#666', '#fff')}>
            Reset Defaults
          </button>
          <button onClick={() => setShowDebug((v) => !v)} style={btnStyle(showDebug ? '#3b82f6' : '#444', showDebug ? '#fff' : '#999')}>
            {showDebug ? 'Hide Collider' : 'Show Collider'}
          </button>
          <button onClick={copyValues} style={btnStyle(hasChanges ? '#10b981' : '#444', hasChanges ? '#000' : '#999')}>
            {copied ? 'Copied!' : 'Copy Config'}
          </button>
        </div>

        {/* Slider groups */}
        {Array.from(groups.entries()).map(([group, sliders]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '0.08em', marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 4 }}>
              {group}
            </h3>
            {/* Color picker for Can Material group */}
            {group === 'Can Material' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ width: 170, fontSize: 12, color: '#ccc', flexShrink: 0 }}>Can Color</label>
                <input
                  type="color"
                  value={config.canColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, canColor: e.target.value }))}
                  style={{ width: 36, height: 24, border: '1px solid #333', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={config.canColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, canColor: e.target.value }))}
                  style={{
                    width: 80, background: '#1e1e1e', color: '#f59e0b', border: '1px solid #333',
                    borderRadius: 4, padding: '2px 4px', fontSize: 12,
                  }}
                />
              </div>
            )}
            {sliders.map((s) => (
              <Slider key={s.key} def={s} value={config[s.key] as number} onChange={onChange} />
            ))}
          </div>
        ))}

        {/* Current values JSON */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>Raw JSON</summary>
          <pre style={{ fontSize: 10, color: '#888', background: '#111', padding: 8, borderRadius: 4, marginTop: 4, overflow: 'auto' }}>
            {JSON.stringify(config, null, 2)}
          </pre>
        </details>
      </div>

      {/* 3D viewport */}
      <div style={{ flex: 1, position: 'relative' }}>
        <TunerErrorBoundary>
          <Canvas
            key={`cam-${config.cameraZ}-${config.cameraFov}-${resetKey}`}
            camera={{ position: [0, 0, config.cameraZ], fov: config.cameraFov }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 1.5]}
            style={{ background: '#111', pointerEvents: 'none' }}
            events={() => ({ enabled: false, priority: 0, compute: () => {} } as never)}
          >
            <PhysicsScene config={config} resetKey={resetKey} showDebug={showDebug} />
          </Canvas>
        </TunerErrorBoundary>

        {/* Viewport overlay info */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, color: '#555' }}>
          Grab &amp; throw the can | Sliders update live | &quot;Respawn&quot; re-drops the can
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */

function btnStyle(bg: string, fg: string): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: bg,
    color: fg,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  };
}
