import { HttpError, errorResponse, extraSecondsFor, isExpired, loadRoom, requireUserId } from '@/lib/server';

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    const roomId = decodeURIComponent(params.roomId);
    const { text } = (await req.json().catch(() => ({}))) as { text?: string };
    const clean = (text ?? '').trim().slice(0, 1000);
    if (!clean) throw new HttpError(400, 'Empty message');

    const { db, room } = await loadRoom(roomId, userId);
    if (isExpired(room.timer_started_at, await extraSecondsFor(roomId))) {
      throw new HttpError(403, 'Chat time is up');
    }

    const { data, error } = await db
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, text: clean, read_by: [userId] })
      .select('id, room_id, sender_id, text, created_at, read_by')
      .single();
    if (error) throw error;
    return Response.json({ message: data });
  } catch (e) {
    return errorResponse(e);
  }
}
