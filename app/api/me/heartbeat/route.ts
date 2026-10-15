import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { errorResponse, requireUserId } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseBody } from '@/lib/validation';

// No body means "still here" (the client beats once a minute; sendBeacon reports leaving).
const HeartbeatBody = z.object({ online: z.boolean().optional() }).optional();

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    enforceRateLimit('account', userId);
    const online = (await parseBody(req, HeartbeatBody, 'Invalid heartbeat'))?.online;
    const { error } = await supabaseAdmin()
      .from('users')
      .update({ is_online: online !== false, last_seen: new Date().toISOString() })
      .eq('clerk_id', userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
