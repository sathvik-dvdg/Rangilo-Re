'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { DandiyaSticks, dandiyaHotspotPx } from '@/components/ui/DandiyaSticks';

const SIZE = 20;
const HOTSPOT = dandiyaHotspotPx(SIZE);

// Must match the native-cursor rules in app/globals.css.
const NATIVE_TYPES = ['checkbox', 'radio', 'submit', 'button', 'reset', 'range', 'color', 'file', 'image'];
const TEXT_ENTRY = `textarea, [contenteditable]:not([contenteditable="false"]), input${NATIVE_TYPES.map((t) => `:not([type="${t}"])`).join('')}`;
const INTERACTIVE = 'a[href], button, [role="button"], summary, label, select, input, [data-cursor="hover"]';

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [overText, setOverText] = useState(false);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 400, damping: 28 });
  const sy = useSpring(y, { stiffness: 400, damping: 28 });

  useEffect(() => {
    // Only for a mouse-like pointer that can hover; touch keeps native behaviour.
    if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return;
    setEnabled(true);
    document.body.classList.add('has-custom-cursor');

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      x.set(e.clientX - HOTSPOT);
      y.set(e.clientY - HOTSPOT);
      setVisible(true);
      const t = e.target instanceof Element ? e.target : null;
      const text = !!t?.closest(TEXT_ENTRY);
      setOverText(text);
      setHovering(!text && !!t?.closest(INTERACTIVE));
    };
    const down = (e: PointerEvent) => e.button === 0 && setPressed(true);
    const up = () => setPressed(false);
    const leave = () => setVisible(false);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur', up);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur', up);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.body.classList.remove('has-custom-cursor');
    };
  }, [x, y]);

  if (!enabled) return null;
  const animate = !reduceMotion;
  const state = !animate ? 'default' : pressed ? 'press' : hovering ? 'hover' : 'default';
  return (
    <motion.div
      aria-hidden
      data-testid="dandiya-cursor"
      data-state={state}
      className="pointer-events-none fixed left-0 top-0 z-[100]"
      // Over text fields the system I-beam takes over (see globals.css).
      style={{ x: animate ? sx : x, y: animate ? sy : y, opacity: visible && !overText ? 1 : 0 }}
    >
      <DandiyaSticks size={SIZE} state={state} animate={animate} />
    </motion.div>
  );
}
