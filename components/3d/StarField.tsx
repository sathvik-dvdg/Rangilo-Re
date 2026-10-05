'use client';

import { Stars } from '@react-three/drei';

export function StarField() {
  return <Stars radius={80} depth={60} count={3000} factor={5} saturation={0} fade speed={0.6} />;
}
