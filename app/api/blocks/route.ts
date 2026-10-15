import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isMissingSchema } from '@/lib/consent';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { ClerkUserId, parseBody } from '@/lib/validation';

const BlockBody = z.object({ blockedUserId: ClerkUserId });

/**
 * Blocks another dancer (SAFE-001). From then on neither sees the other in the
 * dancer list, and their room is closed to both. Blocking someone already
 * blocked succeeds without a second row.
 */
export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    enforceRateLimit('block', userId);
    const { blockedUserId } = await parseBody(req, BlockBody, 'Invalid dancer');
    if (blockedUserId === userId) throw new HttpError(400, 'You cannot block yourself');

    const { error } = await supabaseAdmin()
      .from('blocks')
      .upsert({ blocker_id: userId, blocked_id: blockedUserId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    // 23503: one of the two has no users row (the target left, or the caller has not onboarded).
    if (error?.code === '23503') throw new HttpError(404, 'That dancer has left');
    if (isMissingSchema(error)) throw new HttpError(503, 'Blocking is not available yet');
    if (error) throw error;
    return Response.json({ blocked: blockedUserId }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
