'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RINGS = 8;

function petalGeometry() {
  // Almond-shaped petal, tip pointing +Y, lightly extruded so light catches its edge.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.45, 0.35, 0.35, 0.85, 0, 1.2);
  s.bezierCurveTo(-0.35, 0.85, -0.45, 0.35, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 16,
  });
  g.center();
  return g;
}

const HALDI = new THREE.Color('#D8A23A');
const KUMKUM = new THREE.Color('#B23A2E');
const PAPER = new THREE.Color('#E7D9C1');

function Ring({ index, geometry }: { index: number; geometry: THREE.BufferGeometry }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);

  const radius = 0.6 + index * 0.48;
  const count = 8 + index * 3;
  const scale = 0.26 + index * 0.03;
  const color = index % 3 === 2 ? PAPER : index % 2 ? KUMKUM : HALDI;
  const outer = index >= RINGS / 2;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      d.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      d.rotation.set(0, 0, a - Math.PI / 2);
      d.scale.setScalar(scale);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, radius, scale]);

  useFrame((_, delta) => {
    // Spec: outer rings +0.003 rad/frame, inner rings −0.005 rad/frame at 60fps.
    if (group.current) group.current.rotation.z += (outer ? 0.003 : -0.005) * delta * 60;
  });

  return (
    <group ref={group} rotation={[0, 0, index * 0.2]}>
      <instancedMesh ref={mesh} args={[geometry, undefined, count]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.55}
          metalness={0.35}
        />
      </instancedMesh>
    </group>
  );
}

export function Mandala() {
  const root = useRef<THREE.Group>(null);
  const geometry = useMemo(petalGeometry, []);

  useFrame(({ clock, pointer }) => {
    const g = root.current;
    if (!g) return;
    g.scale.setScalar(1 + Math.sin(clock.elapsedTime) * 0.05); // 0.95–1.05
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.35 + pointer.y * 0.12, 0.05);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, pointer.x * 0.18, 0.05);
  });

  return (
    <group ref={root} rotation={[-0.35, 0, 0]}>
      <mesh>
        <circleGeometry args={[0.3, 48]} />
        <meshStandardMaterial color={HALDI} emissive={HALDI} emissiveIntensity={0.9} />
      </mesh>
      {Array.from({ length: RINGS }).map((_, i) => (
        <Ring key={i} index={i} geometry={geometry} />
      ))}
    </group>
  );
}
