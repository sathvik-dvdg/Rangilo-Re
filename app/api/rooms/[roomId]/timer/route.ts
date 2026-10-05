import { HttpError, errorResponse, loadRoom, requireUserId } from '@/lib/server';

/**
 * Starts the 2-minute clock. Clients call this once presence shows both
 * dancers in the room; the server independently checks that both have sent
 * at least one message. The `is null` guard makes concurrent calls safe.
 */
export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    const roomId = decodeURIComponent(params.roomId);
    const { db, room, partnerId } = await loadRoom(roomId, userId);
    if (room.timer_started_at) return Response.json({ timerStartedAt: room.timer_started_at });

    const { data: senders, error } = await db.from('messages').select('sender_id').eq('room_id', roomId);
    if (error) throw error;
    const ids = new Set((senders ?? []).map((s) => s.sender_id as string));
    if (!ids.has(userId) || !ids.has(partnerId)) throw new HttpError(409, 'Both dancers must send a message first');

    const now = new Date().toISOString();
    await db.from('rooms').update({ timer_started_at: now }).eq('id', roomId).is('timer_started_at', null);
    const { data } = await db.from('rooms').select('timer_started_at').eq('id', roomId).single();
    return Response.json({ timerStartedAt: data?.timer_started_at ?? now });
  } catch (e) {
    return errorResponse(e);
  }
}
