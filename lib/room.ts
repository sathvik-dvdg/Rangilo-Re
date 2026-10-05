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

export const PRICE_PAISE = 2900;
