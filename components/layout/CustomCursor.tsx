'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { DandiyaSpark, DandiyaSticks, dandiyaHotspotPx } from '@/components/ui/DandiyaSticks';

const SIZE = 18;
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
  // Counts mouse clicks on interactive elements; each one replays the spark.
  const [sparks, setSparks] = useState(0);
  const reduceMotion = useReducedMotion();
  // Follows the pointer exactly; any easing here shows up as lag.
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  useEffect(() => {
    // Only for a mouse-like pointer that can hover; touch keeps native behaviour.
    if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return;
    setEnabled(true);
    document.body.classList.add('has-custom-cursor');

    let lastTarget: EventTarget | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      x.set(e.clientX - HOTSPOT);
      y.set(e.clientY - HOTSPOT);
      setVisible(true);
      // Selector matching is the costly part; only redo it when the target changes.
      if (e.target === lastTarget) return;
      lastTarget = e.target;
      const t = e.target instanceof Element ? e.target : null;
      const text = !!t?.closest(TEXT_ENTRY);
      setOverText(text);
      setHovering(!text && !!t?.closest(INTERACTIVE));
    };
    const down = (e: PointerEvent) => e.button === 0 && setPressed(true);
    const up = () => setPressed(false);
    const leave = () => setVisible(false);
    const click = (e: MouseEvent) => {
      // detail 0 is a keyboard activation: the stick didn't strike anything.
      if (e.detail === 0 || (e as PointerEvent).pointerType === 'touch') return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest(INTERACTIVE) && !t.closest(TEXT_ENTRY)) setSparks((n) => n + 1);
    };

    window.addEventListener('pointermove', move);
    // Capture, so a handler that stops propagation doesn't swallow the spark.
    window.addEventListener('click', click, true);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur', up);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('click', click, true);
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
      style={{ x, y, opacity: visible && !overText ? 1 : 0 }}
    >
      <DandiyaSticks size={SIZE} state={state} animate={animate} />
      {animate && sparks > 0 && (
        <motion.div
          key={sparks}
          data-testid="dandiya-spark"
          className="absolute left-0 top-0"
          // Bursts outward from the tip, then fades.
          style={{ originX: HOTSPOT / SIZE, originY: HOTSPOT / SIZE }}
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 1.15, opacity: [1, 1, 0] }}
          transition={{ duration: 0.36, ease: 'easeOut' }}
        >
          <DandiyaSpark size={SIZE} />
        </motion.div>
      )}
    </motion.div>
  );
}
