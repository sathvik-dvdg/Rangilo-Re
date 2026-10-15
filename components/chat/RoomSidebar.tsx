'use client';

import { Avatar } from '@/components/ui/Avatar';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { cn } from '@/lib/utils';
import type { PublicProfile, RevealedIdentity } from '@/lib/types';

/** Desktop-only companion to the chat: who you are talking to. */
export function RoomSidebar({
  partner,
  partnerHere,
  revealed,
  className,
}: {
  partner: PublicProfile;
  /** The partner's real name and photo, if they agreed to share them with this viewer (reveal flow). */
  revealed?: RevealedIdentity | null;
  partnerHere: boolean;
  className?: string;
}) {
  return (
    <aside className={cn('w-80 shrink-0 flex-col gap-4 overflow-y-auto', className)}>
      <section className="grain rounded-2xl border border-paper/10 bg-ink-2 p-6 text-center">
        <Avatar name={partner.display_name} gender={partner.gender} imageUrl={revealed?.image_url} size={88} className="mx-auto" />
        <h2 className="mt-4 break-words font-display text-lg leading-tight text-paper">{revealed?.real_name || partner.display_name}</h2>
        {revealed?.real_name && <p className="mt-0.5 break-words text-xs text-paper/50">{partner.display_name}</p>}
        <p className={cn('mt-1 text-xs font-semibold', partnerHere ? 'text-[#9CC587]' : 'text-paper/50')}>{partnerHere ? 'In the room' : 'Away'}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <GenderBadge gender={partner.gender} />
          {(partner.branch || partner.college_year) && (
            <span className="rounded bg-paper/10 px-2 py-0.5 text-[11px] font-semibold text-paper/75">
              {[partner.branch, partner.college_year].filter(Boolean).join(' · ')}
            </span>
          )}
          {partner.vibe_tag && (
            <span className="rounded-full border border-haldi/25 bg-haldi/10 px-2 py-0.5 text-[11px] font-medium text-haldi">{partner.vibe_tag}</span>
          )}
        </div>
        {partner.outfit_color && (
          <div className="mt-4 rounded-xl bg-ink/60 px-3 py-2.5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/45">Wearing tonight</p>
            <p className="mt-0.5 text-sm italic text-paper/85">{partner.outfit_color}</p>
          </div>
        )}
      </section>
    </aside>
  );
}
