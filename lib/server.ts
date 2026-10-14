import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import { diagnoseDbError } from './dbDiagnosis';
import { FREE_CHAT_MS, effectiveExtraSeconds, partnerFromRoomId } from './room';
import { getRevealState, getRevealed } from './reveal';
export { getRevealed };
import type { MyProfile, PublicProfile, RoomState } from './types';

export const PUBLIC_COLUMNS = 'clerk_id, display_name, gender, last_seen';
export const OWN_COLUMNS = 'clerk_id, display_name, gender, last_seen, real_name, email';

export const CAMPUS_PUBLIC_COLUMNS = 'clerk_id, display_name, gender, branch, college_year, vibe_tag, outfit_color, last_seen';
export const CAMPUS_OWN_COLUMNS = 'clerk_id, display_name, gender, branch, college_year, vibe_tag, outfit_color, last_seen, real_name, email, instagram_handle';

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
  const d = diagnoseDbError(e);
  if (d) {
    const problems = d.problems.map((p) => `${p.variable} ${p.reason}`);
    return Response.json({ error: `${d.title}. ${d.hint}`, problems }, { status: 503 });
  }
  return Response.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function getProfile(clerkId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from('users')
    .select(CAMPUS_PUBLIC_COLUMNS)
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) {
    const fallback = await supabaseAdmin()
      .from('users')
      .select('clerk_id, display_name, gender, branch, college_year, last_seen')
      .eq('clerk_id', clerkId)
      .maybeSingle();
    if (fallback.error) {
      const basic = await supabaseAdmin()
        .from('users')
        .select(PUBLIC_COLUMNS)
        .eq('clerk_id', clerkId)
        .maybeSingle();
      if (basic.error) throw basic.error;
      return basic.data as PublicProfile | null;
    }
    return fallback.data as PublicProfile | null;
  }
  return data as PublicProfile | null;
}

export async function getMyProfile(clerkId: string): Promise<MyProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from('users')
    .select(CAMPUS_OWN_COLUMNS)
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) {
    const fallback = await supabaseAdmin()
      .from('users')
      .select('clerk_id, display_name, gender, branch, college_year, last_seen, real_name, email')
      .eq('clerk_id', clerkId)
      .maybeSingle();
    if (fallback.error) {
      const basic = await supabaseAdmin()
        .from('users')
        .select(OWN_COLUMNS)
        .eq('clerk_id', clerkId)
        .maybeSingle();
      if (basic.error) throw basic.error;
      return basic.data as MyProfile | null;
    }
    return fallback.data as MyProfile | null;
  }
  return data as MyProfile | null;
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
  // Independent reads, so one round trip instead of three. Nothing is returned before every check below passes.
  const [me, partner, { data: senders, error: sErr }, roomRead] = await Promise.all([
    getProfile(userId),
    getProfile(partnerId),
    db.from('messages').select('sender_id').eq('room_id', roomId),
    db.from('rooms').select('id, participant_ids, timer_started_at').eq('id', roomId).maybeSingle(),
  ]);
  if (!me) throw new HttpError(409, 'Finish onboarding first');
  if (!partner) throw new HttpError(404, 'That dancer has left');

  if (sErr) throw sErr;
  const distinct = new Set((senders ?? []).map((r) => r.sender_id as string));
  distinct.add(userId);
  if (distinct.size > 2) throw new HttpError(403, 'Room is full');

  let { data: room, error: rErr } = roomRead;
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

/** Seconds the room's extensions add beyond the free time, measured from the clock's start (see effectiveExtraSeconds). */
export async function extraSecondsFor(roomId: string, timerStartedAt: string | null) {
  const { data, error } = await supabaseAdmin().from('chat_extensions').select('extra_seconds, paid_at').eq('room_id', roomId);
  if (error) throw error;
  return effectiveExtraSeconds(timerStartedAt, (data ?? []) as { extra_seconds: number; paid_at: string }[]);
}

export function isExpired(timerStartedAt: string | null, extraSeconds: number) {
  if (!timerStartedAt) return false;
  if (extraSeconds >= 86400) return false;
  return Date.now() - new Date(timerStartedAt).getTime() >= FREE_CHAT_MS + extraSeconds * 1000;
}

export async function getRoomState(roomId: string, userId: string): Promise<RoomState> {
  const { db, me, partner, partnerId, room } = await loadRoom(roomId, userId);
  const [{ data: messages, error }, extraSeconds, revealed, reveal] = await Promise.all([
    db
      .from('messages')
      .select('id, room_id, sender_id, text, created_at, read_by')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(500),
    extraSecondsFor(roomId, room.timer_started_at),
    getRevealed(userId, partnerId),
    getRevealState(userId, partnerId),
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
    reveal,
  };
}
