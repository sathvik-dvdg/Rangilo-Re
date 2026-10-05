'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Mandala } from './Mandala';
import { StarField } from './StarField';
import { DiyaParticles } from './DiyaParticles';

export default function MandalaScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stop rendering entirely once the hero scrolls out of view.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 12], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.25} />
        <pointLight position={[5, 5, 5]} intensity={60} color="#F3EADB" />
        <pointLight position={[-5, -5, -5]} intensity={40} color="#B23A2E" />
        <StarField />
        <Mandala />
        <DiyaParticles />
      </Canvas>
    </div>
  );
}
