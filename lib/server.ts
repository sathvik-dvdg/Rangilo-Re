import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import { FREE_CHAT_MS, partnerFromRoomId } from './room';
import type { PublicProfile, RoomState } from './types';

export const PUBLIC_COLUMNS = 'clerk_id, display_name, gender, last_seen';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function requireUserId() {
  const { userId } = auth();
  if (!userId) throw new HttpError(401, 'Sign in first');
  return userId;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function getProfile(clerkId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from('users')
    .select(PUBLIC_COLUMNS)
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw error;
  return data as PublicProfile | null;
}

/**
 * Resolves and validates a room for the current user. A room id is the
 * sorted pair of both clerk ids, so only those two people can ever open it;
 * the "room is full" check below additionally guards against any third
 * sender_id having been written by a bug or a manual insert.
 */
export async function loadRoom(roomId: string, userId: string) {
  const partnerId = partnerFromRoomId(roomId, userId);
  if (!partnerId) throw new HttpError(403, 'Room is full');

  const db = supabaseAdmin();
  const [me, partner] = await Promise.all([getProfile(userId), getProfile(partnerId)]);
  if (!me) throw new HttpError(409, 'Finish onboarding first');
  if (!partner) throw new HttpError(404, 'That dancer has left');

  const { data: senders, error: sErr } = await db.from('messages').select('sender_id').eq('room_id', roomId);
  if (sErr) throw sErr;
  const distinct = new Set((senders ?? []).map((r) => r.sender_id as string));
  distinct.add(userId);
  if (distinct.size > 2) throw new HttpError(403, 'Room is full');

  let { data: room, error: rErr } = await db
    .from('rooms')
    .select('id, participant_ids, timer_started_at')
    .eq('id', roomId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!room) {
    const ins = await db
      .from('rooms')
      .upsert({ id: roomId, participant_ids: [userId, partnerId].sort() }, { onConflict: 'id' })
      .select('id, participant_ids, timer_started_at')
      .single();
    if (ins.error) throw ins.error;
    room = ins.data;
  }

  return { db, me, partner, partnerId, room: room as { id: string; timer_started_at: string | null } };
}

export async function extraSecondsFor(roomId: string) {
  const { data, error } = await supabaseAdmin().from('chat_extensions').select('extra_seconds').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + (r.extra_seconds as number), 0);
}

export function isExpired(timerStartedAt: string | null, extraSeconds: number) {
  if (!timerStartedAt) return false;
  return Date.now() - new Date(timerStartedAt).getTime() >= FREE_CHAT_MS + extraSeconds * 1000;
}

export async function getRevealed(payerId: string, targetId: string) {
  const db = supabaseAdmin();
  const { data: reveal, error } = await db
    .from('reveals')
    .select('id')
    .eq('payer_id', payerId)
    .eq('target_id', targetId)
    .maybeSingle();
  if (error) throw error;
  if (!reveal) return null;
  const { data: user, error: uErr } = await db
    .from('users')
    .select('real_name, email')
    .eq('clerk_id', targetId)
    .single();
  if (uErr) throw uErr;
  return user as { real_name: string; email: string };
}

export async function getRoomState(roomId: string, userId: string): Promise<RoomState> {
  const { db, me, partner, partnerId, room } = await loadRoom(roomId, userId);
  const [{ data: messages, error }, extraSeconds, revealed] = await Promise.all([
    db
      .from('messages')
      .select('id, room_id, sender_id, text, created_at, read_by')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(500),
    extraSecondsFor(roomId),
    getRevealed(userId, partnerId),
  ]);
  if (error) throw error;
  return {
    roomId,
    me,
    partner,
    messages: messages ?? [],
    timerStartedAt: room.timer_started_at,
    extraSeconds,
    revealed,
  };
}
