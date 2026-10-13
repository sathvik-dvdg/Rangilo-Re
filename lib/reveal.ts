import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import type { RevealState, RevealStatus, RevealedIdentity } from './types';

/**
 * Consent-based name and photo sharing (ID-001..003, PAY-017). One
 * `reveal_requests` row per ordered pair: the requester asks, the target
 * allows or declines, and only then can the requester pay. Every function uses
 * the service role client, so callers authorise first and pass ids they have
 * already checked (SEC-002).
 *
 * The old `reveals` table is never read here: rows in it were created by
 * payment alone, with no consent, so they disclose nothing (DEC-003).
 */

type Row = { status: Exclude<RevealStatus, 'none'>; payment_id: string | null };

/** Migration 0008 not applied: there are no requests, so nothing is shared. */
const isMissingTable = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42P01';

async function findRequest(requesterId: string, targetId: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin()
    .from('reveal_requests')
    .select('status, payment_id')
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return data as Row | null;
}

/** The photo a dancer uploaded to their account. Null if they have none or Clerk cannot be reached. */
async function profileImage(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient().users.getUser(userId);
    return user.hasImage ? user.imageUrl : null;
  } catch {
    return null;
  }
}

async function realName(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().from('users').select('real_name').eq('clerk_id', userId).maybeSingle();
  if (error) throw error;
  return typeof data?.real_name === 'string' ? data.real_name.trim() : '';
}

/**
 * The target's real name and photo, only if they agreed to share with this
 * viewer and the viewer's payment was verified. Never an email or any other field.
 */
export async function getRevealed(viewerId: string, targetId: string): Promise<RevealedIdentity | null> {
  const request = await findRequest(viewerId, targetId);
  if (request?.status !== 'revealed') return null;
  const [real_name, image_url] = await Promise.all([realName(targetId), profileImage(targetId)]);
  return { real_name, image_url };
}

/** Both directions between two dancers, for the chat. */
export async function getRevealState(meId: string, partnerId: string): Promise<RevealState> {
  const [outgoing, incoming] = await Promise.all([findRequest(meId, partnerId), findRequest(partnerId, meId)]);
  // While deciding, the person asked sees exactly what they would be sharing (ID-003).
  const sharing =
    incoming?.status === 'pending' ? await Promise.all([realName(meId), profileImage(meId)]).then(([real_name, image_url]) => ({ real_name, image_url })) : null;
  return { outgoing: outgoing?.status ?? 'none', incoming: incoming?.status ?? 'none', sharing };
}

const LIST_LIMIT = 100;

/** Everyone whose name and photo this viewer may see, for the dancer list. */
export async function listRevealed(viewerId: string): Promise<({ clerk_id: string } & RevealedIdentity)[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('reveal_requests').select('target_id').eq('requester_id', viewerId).eq('status', 'revealed').limit(LIST_LIMIT);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const ids = (data ?? []).map((r) => r.target_id as string);
  if (ids.length === 0) return [];

  const people = await db.from('users').select('clerk_id, real_name').in('clerk_id', ids);
  if (people.error) throw people.error;
  const images = new Map<string, string>();
  try {
    const { data: accounts } = await clerkClient().users.getUserList({ userId: ids, limit: ids.length });
    for (const account of accounts) if (account.hasImage) images.set(account.id, account.imageUrl);
  } catch {
    // Names without photos are better than nothing if Clerk cannot be reached.
  }
  return (people.data ?? []).map((p) => ({
    clerk_id: p.clerk_id as string,
    real_name: typeof p.real_name === 'string' ? p.real_name.trim() : '',
    image_url: images.get(p.clerk_id as string) ?? null,
  }));
}

/** Asks. Does nothing if this requester has asked this target before, whatever the answer was. */
export async function requestReveal(requesterId: string, targetId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('reveal_requests')
    .upsert({ requester_id: requesterId, target_id: targetId }, { onConflict: 'requester_id,target_id', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * The target's answer to the requester. Allowing needs a pending request;
 * declining also withdraws an earlier yes, as long as nothing has been paid.
 * Returns false when there was nothing to answer.
 */
export async function respondToReveal(targetId: string, requesterId: string, allow: boolean): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('reveal_requests')
    .update({ status: allow ? 'allowed' : 'declined', responded_at: new Date().toISOString() })
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .in('status', allow ? ['pending'] : ['pending', 'allowed'])
    .select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** True only while the target's yes stands and nothing has been paid yet. */
export async function isRevealAllowed(requesterId: string, targetId: string): Promise<boolean> {
  return (await findRequest(requesterId, targetId))?.status === 'allowed';
}

/** Whether the target has a real name to share. An empty one is not worth asking anyone to pay for. */
export async function hasRealName(userId: string): Promise<boolean> {
  return (await realName(userId)) !== '';
}

/**
 * Called by payment fulfilment only, after the payment is verified. Moves an
 * 'allowed' request to 'revealed'. 'no_consent' means the target's yes is not
 * there (never given, declined, withdrawn, or already used by another payment):
 * nothing is disclosed, whatever was paid.
 */
export async function grantReveal(requesterId: string, targetId: string, paymentId: string): Promise<'granted' | 'already_granted' | 'no_consent'> {
  const { data, error } = await supabaseAdmin()
    .from('reveal_requests')
    .update({ status: 'revealed', payment_id: paymentId, revealed_at: new Date().toISOString() })
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .eq('status', 'allowed')
    .select('id');
  if (error) throw error;
  if ((data ?? []).length > 0) return 'granted';
  // A redelivery after a crash between this grant and marking the order paid.
  const existing = await findRequest(requesterId, targetId);
  return existing?.status === 'revealed' && existing.payment_id === paymentId ? 'already_granted' : 'no_consent';
}
