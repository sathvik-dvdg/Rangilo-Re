'use client';

import { useEffect, useState } from 'react';
import { FREE_CHAT_MS } from '@/lib/room';

/**
 * Remaining ms of chat time, ticking 4x/s. null until the clock has started.
 * The first render uses `renderedAt` (the server's clock, passed down as a
 * prop) instead of reading Date.now(), so server and browser produce the same
 * markup; reading the clock during render broke hydration of the chat page.
 */
export function useChatTimer(timerStart: string | null, extraSeconds: number, renderedAt?: number) {
  const total = FREE_CHAT_MS + extraSeconds * 1000;
  const [now, setNow] = useState<number | null>(renderedAt ?? null);

  useEffect(() => {
    setNow(Date.now());
    if (!timerStart) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timerStart, total]);

  const remaining = timerStart && now !== null ? Math.max(0, total - (now - new Date(timerStart).getTime())) : null;
  return {
    remaining,
    total,
    started: timerStart !== null,
    expired: remaining === 0,
    // Against one free-chat window, not the whole chat: an extension bought after a long gap makes
    // `total` large, and the bar should still read as two minutes left, not as nearly empty.
    fraction: remaining === null ? 1 : Math.min(1, remaining / FREE_CHAT_MS),
  };
}
