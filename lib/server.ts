import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import { diagnoseDbError } from './dbDiagnosis';
import { getRevealedContact, getRoomConsent, isMissingSchema } from './consent';
import { partnerFromRoomId } from './room';
import { enforceRateLimit } from './rateLimit';
import { getRevealed } from './reveal';
import type { MyProfile, PublicProfile, RoomState } from './types';

export const PUBLIC_COLUMNS = 'clerk_id, display_name, gender, last_seen';
export const OWN_COLUMNS = 'clerk_id, display_name, gender, last_seen, real_name, email';

export const CAMPUS_PUBLIC_COLUMNS = 'clerk_id, display_name, gender, branch, college_year, vibe_tag, outfit_color, last_seen';
export const CAMPUS_OWN_COLUMNS = 'clerk_id, display_name, gender, branch, college_year, vibe_tag, outfit_color, last_seen, real_name, email, instagram_handle';

export class HttpError extends Error {
  constructor(public status: number, message: string, public headers?: Record<string, string>) {
    super(message);
  }
}

export function requireUserId() {
  const { userId } = auth();
  if (!userId) throw new HttpError(401, 'Sign in first');
  return userId;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status, headers: e.headers });
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
  const [me, partner] = await Promise.all([getProfile(userId), getProfile(partnerId)]);
  if (!me) throw new HttpError(409, 'Finish onboarding first');
  if (!partner) throw new HttpError(404, 'That dancer has left');

  const { data: senders, error: sErr } = await db.from('messages').select('sender_id').eq('room_id', roomId);
  if (sErr) throw sErr;
  const distinct = new Set((senders ?? []).map((r) => r.sender_id as string));
  distinct.add(userId);
  if (distinct.size > 2) throw new HttpError(403, 'Room is full');

  const room = await findOrCreateRoom(roomId, [userId, partnerId].sort(), userId);
  return { db, me, partner, partnerId, room };
}

type RoomRow = { id: string; unlimited: boolean };

const ROOM_COLUMNS = 'id, participant_ids, unlimited';
const ROOM_COLUMNS_BEFORE_0006 = 'id, participant_ids';

async function findOrCreateRoom(roomId: string, participantIds: string[], userId: string, columns = ROOM_COLUMNS): Promise<RoomRow> {
  const db = supabaseAdmin();
  const found = await db.from('rooms').select(columns).eq('id', roomId).maybeSingle();
  // Only creating a room counts against the limit (CHAT-007); reopening one never does.
  if (!found.error && !found.data) enforceRateLimit('roomCreate', userId);
  const result =
    found.error || found.data
      ? found
      : await db.from('rooms').upsert({ id: roomId, participant_ids: participantIds }, { onConflict: 'id' }).select(columns).single();
  if (result.error) {
    // rooms.unlimited arrives with migration 0006. Without it no room is unlimited.
    if (columns === ROOM_COLUMNS && isMissingSchema(result.error)) return findOrCreateRoom(roomId, participantIds, userId, ROOM_COLUMNS_BEFORE_0006);
    throw result.error;
  }
  const row = result.data as unknown as { id: string; unlimited?: boolean };
  return { id: row.id, unlimited: row.unlimited === true };
}

export async function getRoomState(roomId: string, userId: string): Promise<RoomState> {
  const { db, me, partner, partnerId, room } = await loadRoom(roomId, userId);
  // `revealed` (contact flow) comes only from a contact_reveals row for this pair.
  // Rows in the old payer-only `reveals` table are no longer read or shown (DEC-003).
  // `sharedWithMe` is a name-and-photo reveal granted before that flow was retired (DEC-013).
  const [{ data: messages, error }, consent, revealed, sharedWithMe] = await Promise.all([
    db
      .from('messages')
      .select('id, room_id, sender_id, text, created_at, read_by')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(500),
    getRoomConsent(roomId, userId),
    getRevealedContact(userId, partnerId),
    getRevealed(userId, partnerId),
  ]);
  if (error) throw error;
  return {
    roomId,
    me,
    partner,
    messages: messages ?? [],
    unlimited: room.unlimited,
    consent,
    revealed,
    sharedWithMe,
  };
}
