import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, errorResponse, requireUserId } from '@/lib/server';
import { MAX_SUBSCRIPTIONS_PER_USER, getPushConfig, isAllowedPushEndpoint } from '@/lib/push';
import { isRecord } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Browser push keys are unpadded base64url: p256dh is 65 bytes, auth is 16.
const KEY = /^[A-Za-z0-9_-]{16,200}={0,2}$/;

/** Whether this server can send push, and the public key a browser needs to subscribe. */
export async function GET() {
  try {
    requireUserId();
    const config = getPushConfig();
    return Response.json({ enabled: config !== null, publicKey: config?.publicKey ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Stores this browser's subscription for the signed-in user. */
export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    if (!getPushConfig()) throw new HttpError(503, 'Notifications are not set up on this server');

    const body: unknown = await req.json().catch(() => null);
    const keys = isRecord(body) && isRecord(body.keys) ? body.keys : null;
    if (!isRecord(body) || !keys || !isAllowedPushEndpoint(body.endpoint)) throw new HttpError(400, 'Invalid subscription');
    const { p256dh, auth } = keys;
    if (typeof p256dh !== 'string' || typeof auth !== 'string' || !KEY.test(p256dh) || !KEY.test(auth)) {
      throw new HttpError(400, 'Invalid subscription');
    }

    const db = supabaseAdmin();
    // A browser has one subscription; whoever is signed in there now owns it.
    const { error } = await db
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint: body.endpoint, p256dh, auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
    // 23503: no users row yet, so there is nobody to notify.
    if (error?.code === '23503') throw new HttpError(409, 'Finish onboarding first');
    if (error) throw error;

    // Keep only the most recently used browsers.
    const { data: mine, error: listError } = await db
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (listError) throw listError;
    const extra = (mine ?? []).slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s.endpoint as string);
    if (extra.length > 0) await db.from('push_subscriptions').delete().eq('user_id', userId).in('endpoint', extra);

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Removes this browser's subscription. Only ever deletes the caller's own row. */
export async function DELETE(req: Request) {
  try {
    const userId = requireUserId();
    const body: unknown = await req.json().catch(() => null);
    const endpoint = isRecord(body) ? body.endpoint : null;
    if (typeof endpoint !== 'string' || endpoint.length > 1024) throw new HttpError(400, 'Invalid subscription');
    const { error } = await supabaseAdmin().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
