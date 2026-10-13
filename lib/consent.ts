import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';
import { partnerFromRoomId, roomIdFor } from './room';
import { HttpError } from './server';
import type { ConsentStatus, RevealedIdentity, RoomConsent } from './types';

/**
 * Contact exchange with consent (ID-001, ID-002; DEC-002 as revised 2026-10-14).
 *
 * A payment makes the room unlimited straight away (lib/payments.ts) and
 * leaves a request here, a `contact_consents` row. Only the other person in
 * the room can answer it, and only an accepted request creates the
 * `contact_reveals` row that lets each of the two see the other's real name
 * and email. A payment on its own never does. Whatever the answer, the chat
 * stays unlimited and no refund is due.
 *
 * Every function here uses the service role client, so callers must first
 * establish who is signed in and pass that id; each function then checks that
 * id against the room or the rows it reads.
 */

/** A request with no answer after this long is closed. Must match the interval in migration 0006. */
export const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

type ConsentRow = { id: string; room_id: string; requester_id: string; partner_id: string; status: ConsentStatus; requested_at: string };

const CONSENT_COLUMNS = 'id, room_id, requester_id, partner_id, status, requested_at';

/** Migration 0006 has not been applied: the consent tables, or rooms.unlimited, do not exist. */
export function isMissingSchema(error: { code?: string } | null | undefined) {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
}

const isStale = (row: ConsentRow) => row.status === 'pending' && Date.now() - new Date(row.requested_at).getTime() >= REQUEST_TTL_MS;

/**
 * Every request made in a room, oldest first, after closing any that went
 * unanswered for 24 hours. Empty on a database without migration 0006, so
 * Free Mode keeps working there.
 */
async function roomConsents(roomId: string): Promise<ConsentRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('contact_consents').select(CONSENT_COLUMNS).eq('room_id', roomId).order('requested_at', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as ConsentRow[];
  if (rows.some(isStale)) {
    // Closes the request. The chat it paid for stays unlimited.
    const expired = await db.rpc('expire_contact_consents', { p_room_id: roomId });
    if (expired.error) throw expired.error;
    return rows.map((row) => (isStale(row) ? { ...row, status: 'expired' } : row));
  }
  return rows;
}

function consentFor(rows: ConsentRow[], userId: string): RoomConsent {
  const latest = rows[rows.length - 1];
  const open = rows.some((row) => row.status === 'pending' || row.status === 'accepted');
  const asked = rows.some((row) => row.requester_id === userId);
  return {
    status: latest?.status ?? null,
    role: latest ? (latest.requester_id === userId ? 'requester' : 'partner') : null,
    canRequest: !open && !asked,
  };
}

/** Where the room's connect request stands for this participant. */
export async function getRoomConsent(roomId: string, userId: string): Promise<RoomConsent> {
  if (!partnerFromRoomId(roomId, userId)) throw new HttpError(403, 'Not your room');
  return consentFor(await roomConsents(roomId), userId);
}

/**
 * The partner's answer to the pending request in a room. Accepting marks the
 * request accepted and writes the reveal in one transaction; declining only
 * marks it declined. Neither touches the room, which the payment already made
 * unlimited, or the order. Only the person who was asked can do either.
 */
export async function respondToConsent(roomId: string, userId: string, action: 'accept' | 'decline'): Promise<'accepted' | 'declined'> {
  if (!partnerFromRoomId(roomId, userId)) throw new HttpError(403, 'Not your room');

  const pending = (await roomConsents(roomId)).find((row) => row.status === 'pending');
  if (!pending) throw new HttpError(404, 'There is no connect request to answer');
  if (pending.partner_id !== userId) throw new HttpError(403, 'Only the person who was asked can answer');

  const fn = action === 'accept' ? 'accept_contact_consent' : 'decline_contact_consent';
  const { data, error } = await supabaseAdmin().rpc(fn, { p_consent_id: pending.id, p_partner_id: userId });
  if (error) throw error;
  // False: it was answered or expired between the read above and this call.
  if (data !== true) throw new HttpError(409, 'That request has already been answered');

  return action === 'accept' ? 'accepted' : 'declined';
}

/**
 * The target's real name and email, or null unless a `contact_reveals` row
 * exists for exactly this pair. This is the only place those two columns are
 * read for someone other than their owner (PRIV-001).
 */
export async function getRevealedContact(userId: string, targetId: string): Promise<RevealedIdentity | null> {
  if (!targetId || targetId === userId) return null;
  const db = supabaseAdmin();
  const { data: reveal, error } = await db
    .from('contact_reveals')
    .select('user_a_id, user_b_id')
    .eq('room_id', roomIdFor(userId, targetId))
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
  if (!reveal) return null;
  const pair = [reveal.user_a_id, reveal.user_b_id];
  if (!pair.includes(userId) || !pair.includes(targetId)) return null;

  const { data: user, error: uErr } = await db.from('users').select('real_name, email').eq('clerk_id', targetId).maybeSingle();
  if (uErr) throw uErr;
  return user ? { real_name: user.real_name as string, email: user.email as string } : null;
}

/**
 * For the dancer list: everyone this user is connected with, and everyone
 * whose request is waiting for this user's answer.
 */
export async function getConnections(userId: string): Promise<{ revealed: Record<string, RevealedIdentity>; incoming: string[] }> {
  const db = supabaseAdmin();
  const [asA, asB, asked] = await Promise.all([
    db.from('contact_reveals').select('user_b_id').eq('user_a_id', userId),
    db.from('contact_reveals').select('user_a_id').eq('user_b_id', userId),
    db.from('contact_consents').select(CONSENT_COLUMNS).eq('partner_id', userId).eq('status', 'pending'),
  ]);
  for (const { error } of [asA, asB, asked]) {
    if (!error) continue;
    if (isMissingSchema(error)) return { revealed: {}, incoming: [] };
    throw error;
  }

  const ids = [...(asA.data ?? []).map((r) => r.user_b_id as string), ...(asB.data ?? []).map((r) => r.user_a_id as string)];
  const revealed: Record<string, RevealedIdentity> = {};
  if (ids.length > 0) {
    const { data: users, error } = await db.from('users').select('clerk_id, real_name, email').in('clerk_id', ids);
    if (error) throw error;
    for (const u of users ?? []) revealed[u.clerk_id as string] = { real_name: u.real_name as string, email: u.email as string };
  }
  // A request past its 24 hours is no longer answerable; it is closed the next time its room is read.
  const incoming = ((asked.data ?? []) as ConsentRow[]).filter((row) => !isStale(row)).map((row) => row.requester_id);
  return { revealed, incoming };
}
