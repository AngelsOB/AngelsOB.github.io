'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

/** Thin shelf thickness in world units */
const SHELF_HALF_H = 0.15;

interface ShelfEntry {
  id: string;
  el: HTMLElement;
  halfW: number;
}

/**
 * Creates thin shelf colliders at the top edge of each [data-physics] DOM element.
 * Cans bounce off these shelves as they fall — they don't act as full solid blocks.
 * Positions track scroll in useFrame via kinematic bodies.
 */
export function DomColliders() {
  const { camera, gl } = useThree();
  const bodyRefs = useRef<Map<string, RapierRigidBody>>(new Map());
  const dirty = useRef(true);
  const [entries, setEntries] = useState<ShelfEntry[]>([]);
  const [revision, setRevision] = useState(0);

  const pixelToWorld = useCallback(
    (px: number, py: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((px - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((py - rect.top) / rect.height) * 2 + 1;
      const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
      vec.unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      return camera.position.clone().add(dir.multiplyScalar(dist));
    },
    [camera, gl],
  );

  // Build shelf entries — only need width, positioned at top edge of each section
  const buildEntries = useCallback(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-physics]');
    const list: ShelfEntry[] = [];
    for (const el of els) {
      const id = el.dataset.physics!;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const tl = pixelToWorld(rect.left, rect.top);
      const tr = pixelToWorld(rect.right, rect.top);
      list.push({
        id,
        el,
        halfW: Math.abs(tr.x - tl.x) / 2,
      });
    }
    return list;
  }, [pixelToWorld]);

  // Discover elements with retry for SSR hydration
  useEffect(() => {
    let retries = 0;
    const tryBuild = () => {
      const list = buildEntries();
      if (list.length > 0) {
        setEntries(list);
        dirty.current = true;
      } else if (retries < 10) {
        retries++;
        setTimeout(tryBuild, 100);
      }
    };
    requestAnimationFrame(tryBuild);
  }, [buildEntries]);

  // Rebuild on resize
  useEffect(() => {
    const markDirty = () => { dirty.current = true; };
    const onResize = () => {
      dirty.current = true;
      setRevision((r) => r + 1);
      requestAnimationFrame(() => setEntries(buildEntries()));
    };
    window.addEventListener('scroll', markDirty, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', markDirty);
      window.removeEventListener('resize', onResize);
    };
  }, [buildEntries]);

  // Track scroll — position each shelf at the top edge of its section
  useFrame(() => {
    if (!dirty.current || entries.length === 0) return;
    dirty.current = false;

    for (const { id, el } of entries) {
      const body = bodyRefs.current.get(id);
      if (!body) continue;
      const rect = el.getBoundingClientRect();
      // Position at the top edge center of the section
      const topCenter = pixelToWorld(
        rect.left + rect.width / 2,
        rect.top,
      );
      body.setNextKinematicTranslation({ x: topCenter.x, y: topCenter.y, z: 0 });
    }
  });

  const setBodyRef = useCallback((id: string, body: RapierRigidBody | null) => {
    if (body) {
      bodyRefs.current.set(id, body);
      dirty.current = true;
    } else {
      bodyRefs.current.delete(id);
    }
  }, []);

  return (
    <>
      {entries.map(({ id, halfW }) => (
        <RigidBody
          key={`${id}-${revision}`}
          ref={(body) => setBodyRef(id, body)}
          type="kinematicPosition"
          position={[0, 0, 0]}
          restitution={0.5}
          friction={0.3}
        >
          <CuboidCollider args={[halfW, SHELF_HALF_H, 2]} />
        </RigidBody>
      ))}
    </>
  );
}
