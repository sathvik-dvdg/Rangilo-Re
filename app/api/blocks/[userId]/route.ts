import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isMissingSchema } from '@/lib/consent';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { ClerkUserId } from '@/lib/validation';

/**
 * Removes the caller's own block on a dancer. Only ever deletes a row the caller
 * created; a block the other person placed stays. 204 whether or not a block existed.
 */
export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    enforceRateLimit('block', userId);
    const parsed = ClerkUserId.safeParse(decodeURIComponent(params.userId));
    if (!parsed.success) throw new HttpError(400, 'Invalid dancer');

    const { error } = await supabaseAdmin().from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', parsed.data);
    if (error && !isMissingSchema(error)) throw error;
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
