export const FREE_CHAT_MS = 120_000;

export function roomIdFor(a: string, b: string) {
  return [a, b].sort().join('_');
}

/**
 * Clerk ids look like `user_2abc...`, which contains an underscore, so the
 * room id can't be naively split on '_'. Instead we check that it is exactly
 * the sorted join of the current user and one other id.
 */
export function partnerFromRoomId(roomId: string, me: string): string | null {
  if (roomId.startsWith(me + '_')) {
    const other = roomId.slice(me.length + 1);
    return other && roomIdFor(me, other) === roomId && other !== me ? other : null;
  }
  if (roomId.endsWith('_' + me)) {
    const other = roomId.slice(0, roomId.length - me.length - 1);
    return other && roomIdFor(me, other) === roomId && other !== me ? other : null;
  }
  return null;
}

/**
 * How many seconds the extensions add to a chat, counted from when its clock
 * started. An extension paid for while time remains simply lengthens the chat.
 * One paid for after the chat has closed starts when it was paid for, so the
 * buyer gets the full time they bought however long the chat sat closed (or
 * the checkout took); the closed gap is counted in so that "start + free time
 * + this" is still when the chat ends.
 */
export function effectiveExtraSeconds(timerStartedAt: string | null, extensions: { extra_seconds: number; paid_at: string }[]): number {
  const bought = extensions.reduce((sum, e) => sum + e.extra_seconds, 0);
  // The clock has not started, so nothing has run out: the time is simply added.
  if (!timerStartedAt) return bought;
  const start = new Date(timerStartedAt).getTime();
  let end = start + FREE_CHAT_MS;
  for (const e of [...extensions].sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime())) {
    end = Math.max(end, new Date(e.paid_at).getTime()) + e.extra_seconds * 1000;
  }
  return Math.round((end - start - FREE_CHAT_MS) / 1000);
}

export const PRICE_PAISE = 2900;
