'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import type { Gender, RevealedIdentity } from '@/lib/types';

/**
 * Shown for both flows:
 * - Connect flow: shows real name + email (identity.email is set).
 * - Reveal flow: shows real name + profile photo (identity.image_url is set).
 */
export function RevealCard({ identity, nickname, gender }: { identity: RevealedIdentity | null; nickname?: string; gender?: Gender }) {
  if (!identity) return null;

  const isConnect = Boolean(identity.email);

  return (
    <AnimatePresence initial={false}>
      {identity && (
        <motion.div initial={{ opacity: 0, height: 0, scale: 0.98 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="overflow-hidden px-3 sm:px-4">
          <div className={`mb-3 rounded-xl border border-haldi/40 bg-gradient-to-r from-haldi/15 via-ink-2 to-kumkum/15 px-4 py-3 shadow-[0_0_25px_rgba(216,162,58,0.25)] ${nickname && identity.image_url !== undefined ? 'flex items-center gap-3.5' : ''}`}>
            {nickname && identity.image_url !== undefined && (
              <Avatar name={nickname} gender={gender ?? 'other'} imageUrl={identity.image_url} size={52} />
            )}
            <div className="min-w-0 flex-1">
              {isConnect ? (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-haldi">You&apos;re connected</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-paper/50">Name</dt>
                    <dd className="font-semibold text-paper">{identity.real_name || '—'}</dd>
                    <dt className="text-paper/50">Email</dt>
                    <dd className="truncate font-semibold text-paper">
                      {identity.email ? (
                        <a href={`mailto:${identity.email}`} className="underline decoration-haldi/50 underline-offset-2 transition-colors hover:text-haldi">
                          {identity.email}
                        </a>
                      ) : '—'}
                    </dd>
                  </dl>
                  <p className="mt-2 text-[11px] text-paper/50">They can see your real name and email too.</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-haldi">Shared with you</p>
                  <p className="truncate font-display text-lg leading-tight text-paper">{identity.real_name || '—'}</p>
                  {nickname && <p className="truncate text-xs text-paper/55">{nickname} agreed to share their name and photo</p>}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
