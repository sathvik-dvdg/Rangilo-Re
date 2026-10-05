import { errorResponse, loadRoom, requireUserId } from '@/lib/server';

/** Adds the current user to read_by on every message they haven't read. */
export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    const roomId = decodeURIComponent(params.roomId);
    const { db } = await loadRoom(roomId, userId);

    const { data, error } = await db
      .from('messages')
      .select('id, read_by')
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .not('read_by', 'cs', `{${userId}}`);
    if (error) throw error;

    await Promise.all(
      (data ?? []).map((m) =>
        db
          .from('messages')
          .update({ read_by: [...(m.read_by as string[]), userId] })
          .eq('id', m.id),
      ),
    );
    return Response.json({ updated: data?.length ?? 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
