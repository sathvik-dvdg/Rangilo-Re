import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';
import { isMissingSchema } from './consent';

/**
 * Blocks (SAFE-001). Either person blocking the other hides each from the
 * other's dancer list and closes their room to both. Until migration 0010 is
 * applied the table does not exist, and nobody is blocked.
 */

/** Ids of everyone this user has blocked or been blocked by. */
export async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const db = supabaseAdmin();
  const [mine, theirs] = await Promise.all([
    db.from('blocks').select('blocked_id').eq('blocker_id', userId),
    db.from('blocks').select('blocker_id').eq('blocked_id', userId),
  ]);
  for (const result of [mine, theirs]) {
    if (isMissingSchema(result.error)) return new Set();
    if (result.error) throw result.error;
  }
  return new Set([
    ...(mine.data ?? []).map((r) => r.blocked_id as string),
    ...(theirs.data ?? []).map((r) => r.blocker_id as string),
  ]);
}

/** Whether either of the two has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  // A self-block is refused by the table's check constraint, so any row among these two ids is a block between them.
  const { data, error } = await supabaseAdmin().from('blocks').select('blocker_id').in('blocker_id', [a, b]).in('blocked_id', [a, b]).limit(1);
  if (isMissingSchema(error)) return false;
  if (error) throw error;
  return (data ?? []).length > 0;
}
