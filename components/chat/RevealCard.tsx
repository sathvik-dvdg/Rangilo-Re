'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import type { Gender, RevealedIdentity } from '@/lib/types';

/** The other dancer's real name and photo, shown only once they agreed and the payment was verified. */
export function RevealCard({ identity, nickname, gender }: { identity: RevealedIdentity | null; nickname: string; gender: Gender }) {
  return (
    <AnimatePresence initial={false}>
      {identity && (
        <motion.div initial={{ opacity: 0, height: 0, scale: 0.98 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="overflow-hidden px-3 sm:px-4">
          <div className="mb-3 flex items-center gap-3.5 rounded-xl border border-haldi/40 bg-gradient-to-r from-haldi/15 via-ink-2 to-kumkum/15 px-4 py-3">
            <Avatar name={nickname} gender={gender} imageUrl={identity.image_url} size={52} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-haldi">Real Identity Revealed</p>
              <p className="truncate font-display text-lg leading-tight text-paper">{identity.real_name || '—'}</p>
              <p className="truncate text-xs text-paper/55">Real name &amp; photo unlocked</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
