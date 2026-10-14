'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Infinity as InfinityIcon, MessageSquare, Sparkles, UserCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

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

/** Paid Mode: offers unlimited chat & real identity unlock for ₹29 (DEC-013). */
export function TimerExpiredOverlay({ show, onExtend }: { show: boolean; onExtend: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-ink/80 px-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full max-w-sm rounded-2xl border border-haldi/25 bg-ink-2/95 p-6 text-center shadow-2xl backdrop-blur-md"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="mx-auto w-16"
            >
              <Diya className="h-16 w-16" />
            </motion.div>

            <h2 className="mt-3 font-display text-2xl font-bold text-paper sm:text-3xl">Time&apos;s Up! 🪔</h2>
            <p className="mt-1 text-sm text-paper/70">
              Your free 2-minute chat preview has ended.
            </p>

            {/* Perks card showing what ₹29 unlocks */}
            <div className="mt-4 rounded-xl border border-paper/10 bg-ink/60 p-3.5 text-left space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-haldi flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-haldi" />
                Unlock For ₹29:
              </p>

              <div className="flex items-start gap-2.5 text-xs text-paper/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7FB069]/20 text-[#9CC587]">
                  <InfinityIcon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <strong className="text-paper">Unlimited time to talk:</strong> No time limit. Keep chatting with no rush!
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-paper/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-haldi/20 text-haldi">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div>
                  <strong className="text-paper">Messages are saved:</strong> Your full conversation stays right here.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-paper/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kumkum/20 text-kumkum">
                  <UserCheck className="h-3.5 w-3.5" />
                </span>
                <div>
                  <strong className="text-paper">Real name revealed:</strong> See their real name and verified profile!
                </div>
              </div>
            </div>

            <Button
              variant="haldi"
              size="lg"
              className="mt-5 w-full text-sm font-bold shadow-lg shadow-haldi/20"
              onClick={onExtend}
            >
              Extend Chat ₹29 (Unlimited) →
            </Button>

            {/* Paying is optional: always offer a way out next to the offer. */}
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'ghost', className: 'mt-2.5 w-full text-xs text-paper/60 hover:text-paper' })}
            >
              Back to dancers
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
