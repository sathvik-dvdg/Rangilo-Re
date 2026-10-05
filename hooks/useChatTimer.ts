'use client';

import { useEffect, useState } from 'react';
import { FREE_CHAT_MS } from '@/lib/room';

/** Remaining ms of chat time, ticking 4x/s. null until the clock has started. */
export function useChatTimer(timerStart: string | null, extraSeconds: number) {
  const total = FREE_CHAT_MS + extraSeconds * 1000;
  const compute = () => (timerStart ? Math.max(0, total - (Date.now() - new Date(timerStart).getTime())) : null);
  const [remaining, setRemaining] = useState<number | null>(compute);

  useEffect(() => {
    setRemaining(compute());
    if (!timerStart) return;
    const id = window.setInterval(() => setRemaining(compute()), 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStart, total]);

  return {
    remaining,
    total,
    started: timerStart !== null,
    expired: remaining === 0,
    fraction: remaining === null ? 1 : remaining / total,
  };
}
