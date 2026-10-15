import { z } from 'zod';
import { errorResponse, loadRoom, requireUserId } from '@/lib/server';
import { notifyNewMessage } from '@/lib/push';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseBody } from '@/lib/validation';

// Matches the messages.text check constraint (1–1000 characters).
const MessageBody = z.object({ text: z.string().trim().min(1).max(1000) });

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    enforceRateLimit('message', userId);
    const roomId = decodeURIComponent(params.roomId);
    const { text: clean } = await parseBody(req, MessageBody, 'A message must be 1 to 1000 characters');

    // Chats have no time limit (DEC-014); loadRoom still restricts the room to its two dancers.
    const { db, me, partnerId } = await loadRoom(roomId, userId);

    const { data, error } = await db
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, text: clean, read_by: [userId] })
      .select('id, room_id, sender_id, text, created_at, read_by')
      .single();
    if (error) throw error;
    // Reaches the partner even with the app in the background or closed. A no-op unless push
    // is configured, and it never throws: the message is already saved.
    await notifyNewMessage(partnerId, me.display_name, roomId);
    return Response.json({ message: data });
  } catch (e) {
    return errorResponse(e);
  }
}
