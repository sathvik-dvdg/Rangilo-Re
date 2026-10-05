'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function Diya({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 6c5 8 7 13 7 17a7 7 0 0 1-14 0c0-4 2-9 7-17Z" fill="#E0782C" />
      <path d="M32 14c2.5 4 3.5 7 3.5 9a3.5 3.5 0 0 1-7 0c0-2 1-5 3.5-9Z" fill="#F3D27A" />
      <path d="M6 34h52c-2 12-12 20-26 20S8 46 6 34Z" fill="#B23A2E" />
      <path d="M10 34h44" stroke="#D8A23A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="44" r="2" fill="#D8A23A" />
      <circle cx="32" cy="46" r="2" fill="#D8A23A" />
      <circle cx="42" cy="44" r="2" fill="#D8A23A" />
    </svg>
  );
}

export function TimerExpiredOverlay({ show, onExtend }: { show: boolean; onExtend: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 px-6 backdrop-blur-sm"
        >
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="max-w-xs text-center">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }} className="mx-auto w-16">
              <Diya className="h-16 w-16" />
            </motion.div>
            <h2 className="mt-4 font-display text-3xl text-paper">Time&apos;s Up! 🪔</h2>
            <p className="mt-2 text-paper/70">Your free 2-minute chat has ended. Continue dancing together?</p>
            <Button variant="haldi" size="lg" className="mt-6 w-full" onClick={onExtend}>
              Extend Chat ₹29 →
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
