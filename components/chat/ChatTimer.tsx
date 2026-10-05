'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Thin bar under the header. Haldi while there's time, then orange, then kumkum. */
export function ChatTimer({ started, remaining, fraction, waitingFor }: { started: boolean; remaining: number | null; fraction: number; waitingFor: string | null }) {
  const urgent = remaining !== null && remaining < 30_000;
  const color = !started ? 'bg-paper/20' : fraction > 0.5 ? 'bg-haldi' : fraction > 0.25 ? 'bg-[#D9732F]' : 'bg-kumkum';

  return (
    <div className="sticky top-0 z-20 bg-ink-2 px-4 pb-2.5 pt-2">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={cn('font-semibold', urgent ? 'text-[#E58A7F]' : 'text-paper/65')}>
          {!started ? waitingFor ?? 'Clock starts when you both say hi' : remaining === 0 ? 'Chat closed' : (
            <>
              Chat closes in <span className="tabular font-bold text-paper">{fmt(remaining!)}</span>
            </>
          )}
        </span>
        <span className="text-paper/40">2 min free</span>
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
