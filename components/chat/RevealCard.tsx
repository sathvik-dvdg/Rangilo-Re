'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { RevealedIdentity } from '@/lib/types';

export function RevealCard({ identity }: { identity: RevealedIdentity | null }) {
  const cleanInsta = identity?.instagram_handle?.replace(/^@+/, '');

  return (
    <AnimatePresence initial={false}>
      {identity && (
        <motion.div initial={{ opacity: 0, height: 0, scale: 0.98 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="overflow-hidden px-4">
          <div className="mb-3 rounded-xl border border-haldi/40 bg-gradient-to-r from-haldi/15 via-ink-2 to-kumkum/15 px-4 py-3 shadow-[0_0_25px_rgba(216,162,58,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-haldi flex items-center gap-1.5">
                🎉 🔓 Identity Unlocked! 🎊
              </p>
              <span className="text-xs animate-bounce">🪅</span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-paper/50">Name</dt>
              <dd className="font-semibold text-paper">{identity.real_name || '—'}</dd>
              <dt className="text-paper/50">Gmail</dt>
              <dd className="truncate font-semibold text-paper">
                <a href={`mailto:${identity.email}`} className="underline decoration-haldi/50 underline-offset-2 hover:text-haldi transition-colors">
                  {identity.email}
                </a>
              </dd>
              {cleanInsta && (
                <>
                  <dt className="text-paper/50">Instagram</dt>
                  <dd className="truncate font-semibold text-paper">
                    <a
                      href={`https://instagram.com/${cleanInsta}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-haldi underline decoration-haldi/50 underline-offset-2 hover:text-haldi-dark transition-colors"
                    >
                      @{cleanInsta} ↗
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
