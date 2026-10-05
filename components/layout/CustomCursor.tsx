'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 400, damping: 28 });
  const sy = useSpring(y, { stiffness: 400, damping: 28 });

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    if (!fine.matches) return;
    setEnabled(true);
    document.body.classList.add('has-custom-cursor');

    const move = (e: PointerEvent) => {
      x.set(e.clientX - 12);
      y.set(e.clientY - 12);
      const t = e.target as HTMLElement | null;
      setHovering(!!t?.closest('a, button, [role="button"], input, textarea, [data-cursor="hover"]'));
    };
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointermove', move);
      document.body.classList.remove('has-custom-cursor');
    };
  }, [x, y]);

  if (!enabled) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] h-6 w-6 rounded-full border-2 border-haldi"
      style={{ x: sx, y: sy, mixBlendMode: hovering ? 'difference' : 'normal' }}
      animate={{ scale: hovering ? 3 : 1, backgroundColor: hovering ? '#D8A23A' : 'rgba(216,162,58,0)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    />
  );
}
