'use client';

import { Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { cn } from '@/lib/utils';
import type { PublicProfile } from '@/lib/types';

type StepState = 'done' | 'now' | 'next';

/** Desktop-only companion to the chat: who you are talking to and where the room is in its two minutes. */
export function RoomSidebar({
  partner,
  partnerHere,
  bothSpoke,
  started,
  expired,
  unlimited = false,
  connected = false,
  className,
}: {
  partner: PublicProfile;
  partnerHere: boolean;
  bothSpoke: boolean;
  started: boolean;
  expired: boolean;
  unlimited?: boolean;
  connected?: boolean;
  className?: string;
}) {
  const steps: { title: string; body: string; state: StepState }[] = [
    {
      title: 'Both say hi',
      body: 'The clock waits until you have each sent a message and are both in the room.',
      state: started ? 'done' : bothSpoke ? 'done' : 'now',
    },
    {
      title: 'The clock runs',
      body: 'Use it to find each other on the floor.',
      state: expired || unlimited ? 'done' : started ? 'now' : 'next',
    },
    unlimited
      ? {
          title: connected ? 'Connected' : 'Unlimited chat',
          body: connected ? 'You both agreed to share contact details. This chat stays open.' : 'This chat has no time limit. It stays open.',
          state: 'now',
        }
      : {
          title: 'Back to the garba',
          body: 'The chat closes when the clock runs out.',
          state: expired ? 'now' : 'next',
        },
  ];

  return (
    <aside className={cn('w-80 shrink-0 flex-col gap-4 overflow-y-auto', className)}>
      <section className="grain rounded-2xl border border-paper/10 bg-ink-2 p-6 text-center">
        <Avatar name={partner.display_name} gender={partner.gender} size={88} className="mx-auto" />
        <h2 className="mt-4 break-words font-display text-lg leading-tight text-paper">{partner.display_name}</h2>
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

      <section className="rounded-2xl border border-paper/10 bg-ink-2 p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-haldi">How this room works</h3>
        <ol className="mt-4 space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  step.state === 'done' && 'bg-[#7FB069]/20 text-[#9CC587]',
                  step.state === 'now' && 'bg-haldi text-ink',
                  step.state === 'next' && 'border border-paper/15 text-paper/40',
                )}
              >
                {step.state === 'done' ? <Check className="h-3.5 w-3.5" aria-label="Done" /> : i + 1}
              </span>
              <div>
                <p className={cn('text-sm font-semibold', step.state === 'next' ? 'text-paper/50' : 'text-paper')}>{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-paper/55">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
