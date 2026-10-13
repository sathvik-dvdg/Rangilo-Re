'use server';

import { clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isId, recordAdminAction, requireAdmin } from '@/lib/admin';

/**
 * Admin console actions (ADMIN-002). Each one is a public endpoint, so each
 * checks the caller itself, validates its input, and writes the audit row
 * before touching anything.
 */

/**
 * Removes a dancer: their profile, every room they are in (with its messages
 * and extensions), any reveals involving them, and their push subscriptions.
 * Payment ledger rows are kept (PRIV-004). With `block`, the Clerk account is
 * banned first, which ends their sessions and stops them signing in again;
 * without it they can sign in and onboard afresh.
 */
export async function removeUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = formData.get('userId');
  const block = formData.get('block') === '1';
  if (!isId(userId)) redirect('/admin/users?notice=invalid');
  if (userId === admin.id) redirect('/admin/users?notice=self');

  await recordAdminAction(admin.id, block ? 'block_user' : 'remove_user', userId);
  if (block) await clerkClient().users.banUser(userId);

  const db = supabaseAdmin();
  const steps = [
    await db.from('rooms').delete().contains('participant_ids', [userId]),
    await db.from('reveals').delete().eq('payer_id', userId),
    await db.from('reveals').delete().eq('target_id', userId),
    await db.from('users').delete().eq('clerk_id', userId),
  ];
  const failed = steps.find((s) => s.error);
  if (failed?.error) throw failed.error;

  revalidatePath('/admin', 'layout');
  redirect(`/admin/users?notice=${block ? 'blocked' : 'removed'}`);
}

/** Deletes a room with its messages and extensions. The two dancers can start a new chat afterwards. */
export async function removeRoom(formData: FormData) {
  const admin = await requireAdmin();
  const roomId = formData.get('roomId');
  if (!isId(roomId)) redirect('/admin/rooms?notice=invalid');

  await recordAdminAction(admin.id, 'remove_room', roomId);
  const { error } = await supabaseAdmin().from('rooms').delete().eq('id', roomId);
  if (error) throw error;

  revalidatePath('/admin', 'layout');
  redirect('/admin/rooms?notice=room-removed');
}
