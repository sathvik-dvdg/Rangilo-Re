'use client';

import { motion } from 'framer-motion';
import { Hourglass, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Status line, countdown and a thin bar under the header. Haldi while there's time, then orange, then kumkum. */
export function ChatTimer({
  started,
  remaining,
  total,
  fraction,
  waitingFor,
  isUnlocked,
}: {
  started: boolean;
  remaining: number | null;
  total: number;
  fraction: number;
  waitingFor: string | null;
  isUnlocked?: boolean;
}) {
  if (isUnlocked) {
    return (
      <div className="px-4 pb-3 pt-0.5 sm:px-5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-[#9CC587]">
            <Sparkles className="h-3.5 w-3.5 text-haldi animate-pulse" />
            Unlimited Chat Unlocked
          </span>
          <span className="rounded bg-haldi/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-haldi">
            No Time Limit ♾️
          </span>
        </div>
      </div>
    );
  }

  const closed = remaining === 0;
  const urgent = remaining !== null && !closed && remaining < 30_000;
  const color = !started ? 'bg-paper/20' : fraction > 0.5 ? 'bg-haldi' : fraction > 0.25 ? 'bg-[#D9732F]' : 'bg-kumkum';

  return (
    <div className="px-4 pb-3 pt-0.5 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={cn('flex min-w-0 items-center gap-1.5 text-xs font-semibold', urgent ? 'text-[#E58A7F]' : 'text-paper/65')}>
          <Hourglass className={cn('h-3.5 w-3.5 shrink-0', started && !closed && 'animate-hourglass')} aria-hidden />
          <span className="truncate">{!started ? waitingFor ?? 'Clock starts when you both say hi' : closed ? 'Chat closed' : 'Chat closes in'}</span>
        </span>
        <span
          className={cn(
            'tabular shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold',
            !started || closed
              ? 'border-paper/10 text-paper/45'
              : urgent
                ? 'border-kumkum/60 bg-kumkum/15 text-[#F0A69C]'
                : 'border-haldi/40 bg-haldi/10 text-haldi',
          )}
        >
          {!started ? fmt(total) : remaining === null ? '–:––' : fmt(remaining)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper/[0.08]">
        <motion.div
          className={cn('h-full rounded-full transition-[width,background-color] duration-300 ease-linear', color)}
          style={{ width: `${(started ? fraction : 1) * 100}%` }}
          animate={urgent ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={urgent ? { repeat: Infinity, duration: 0.6 } : undefined}
        />
      </div>
    </div>
  );
}
