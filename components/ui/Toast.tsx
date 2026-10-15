'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Toast({ message, onDone, tone = 'success' }: { message: string | null; onDone: () => void; tone?: 'success' | 'error' }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDone]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center"
        >
          <span className={cn('rounded-full px-5 py-2.5 text-sm font-bold shadow-lg', tone === 'error' ? 'bg-kumkum text-paper' : 'bg-haldi text-ink')}>
            {tone === 'error' ? message : `✓ ${message}`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
