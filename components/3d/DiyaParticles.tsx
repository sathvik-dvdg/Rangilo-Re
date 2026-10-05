'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 30;

/** Small floating diya flames drifting upward, as one instanced draw call. */
export function DiyaParticles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 10,
        z: -2 - Math.random() * 6,
        speed: 0.25 + Math.random() * 0.5,
        sway: Math.random() * Math.PI * 2,
        size: 0.04 + Math.random() * 0.06,
      })),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      s.y += s.speed * delta;
      if (s.y > 6) s.y = -6;
      dummy.position.set(s.x + Math.sin(t * 0.6 + s.sway) * 0.3, s.y, s.z);
      const flicker = 1 + Math.sin(t * 9 + s.sway * 3) * 0.15;
      dummy.scale.setScalar(s.size * flicker * 10);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#E08A3C" emissive="#E0782C" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      <pointLight position={[0, -3, 1]} color="#E0782C" intensity={6} distance={12} />
    </>
  );
}
