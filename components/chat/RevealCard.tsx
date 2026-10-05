'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { RevealedIdentity } from '@/lib/types';

export function RevealCard({ identity }: { identity: RevealedIdentity | null }) {
  return (
    <AnimatePresence initial={false}>
      {identity && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-4">
          <div className="thread-border mb-3 rounded-lg px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-haldi">🔓 Identity Unlocked</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-paper/50">Name</dt>
              <dd className="font-semibold text-paper">{identity.real_name || '—'}</dd>
              <dt className="text-paper/50">Gmail</dt>
              <dd className="truncate font-semibold text-paper">
                <a href={`mailto:${identity.email}`} className="underline decoration-haldi/50 underline-offset-2">
                  {identity.email}
                </a>
              </dd>
            </dl>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
