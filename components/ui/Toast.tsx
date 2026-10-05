'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
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
          <span className="rounded-full bg-haldi px-5 py-2.5 text-sm font-bold text-ink shadow-lg">✓ {message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
