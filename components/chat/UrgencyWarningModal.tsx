'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UrgencyWarningModal({
  open,
  remainingMs,
  onClose,
  onPay,
  busy = false,
}: {
  open: boolean;
  remainingMs: number;
  onClose: () => void;
  onPay: () => void;
  busy?: boolean;
}) {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-2xl border border-kumkum/40 bg-gradient-to-b from-ink-2 to-ink p-6 text-center shadow-2xl ring-1 ring-kumkum/30"
          >
            {/* Dismiss button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-paper/50 transition-colors hover:bg-paper/10 hover:text-paper"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Pulsing countdown badge */}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-kumkum/20 ring-4 ring-kumkum/15">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
              >
                <Clock className="h-7 w-7 text-kumkum" />
              </motion.div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-kumkum/40 bg-kumkum/10 px-3 py-0.5 text-xs font-bold text-kumkum">
              <span>⏳</span>
              <span>Only {seconds} seconds remaining!</span>
            </div>

            <h3 className="mt-3 font-display text-xl font-bold text-paper sm:text-2xl">
              Don&apos;t lose your connection!
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-paper/75 sm:text-sm">
              The window will close and you might miss your chance for a partner.
            </p>

            <div className="mt-5 space-y-2.5">
              <Button
                variant="haldi"
                size="lg"
                className="w-full py-3 text-sm font-bold shadow-lg shadow-haldi/25 transition-transform active:scale-95"
                onClick={onPay}
                disabled={busy}
              >
                {busy ? 'Opening payment…' : 'Get Unlimited Time'}
              </Button>

              <button
                type="button"
                onClick={onClose}
                className="w-full text-xs font-medium text-paper/55 transition-colors hover:text-paper"
              >
                Keep chatting ({seconds}s left)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
