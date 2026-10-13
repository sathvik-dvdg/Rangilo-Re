'use client';

import { useEffect, useState } from 'react';
import { FREE_CHAT_MS } from '@/lib/room';

/**
 * Remaining ms of chat time, ticking 4x/s. null until the clock has started.
 * The first render uses `renderedAt` (the server's clock, passed down as a
 * prop) instead of reading Date.now(), so server and browser produce the same
 * markup; reading the clock during render broke hydration of the chat page.
 *
 * An unlimited room (one that has been paid for) never expires and does not
 * tick. This only drives the display: the server decides whether a message is
 * still allowed.
 */
export function useChatTimer(timerStart: string | null, extraSeconds: number, renderedAt?: number, unlimited = false) {
  const total = FREE_CHAT_MS + extraSeconds * 1000;
  const [now, setNow] = useState<number | null>(renderedAt ?? null);

  useEffect(() => {
    setNow(Date.now());
    if (!timerStart || unlimited) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timerStart, total, unlimited]);

  const remaining = !unlimited && timerStart && now !== null ? Math.max(0, total - (now - new Date(timerStart).getTime())) : null;
  return {
    remaining,
    total,
    started: timerStart !== null,
    expired: remaining === 0,
    fraction: remaining === null ? 1 : remaining / total,
  };
}
