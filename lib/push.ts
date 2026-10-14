import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * Web Push (NOTIF-002). Optional: with no VAPID_* variables the app runs
 * exactly as before and only the in-app notifications work.
 */

export const MAX_SUBSCRIPTIONS_PER_USER = 5;
const SEND_TIMEOUT_MS = 2500;

/**
 * The push services browsers hand out endpoints for. A subscription's endpoint
 * comes from the client and the server posts to it, so anything else would let
 * a caller aim server requests at an arbitrary host.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export type PushConfig = { subject: string; publicKey: string; privateKey: string };

/** null unless all three VAPID variables are set. The private key never leaves the server (SEC-001). */
export function getPushConfig(): PushConfig | null {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * Sends one notification to every browser the user has subscribed. Callers must
 * already have authorised the event that triggers it (SEC-002). Never throws: a
 * failed notification must not fail the message that caused it.
 */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  const config = getPushConfig();
  if (!config) return;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_SUBSCRIPTIONS_PER_USER);
    if (error) throw error;

    const gone: string[] = [];
    await Promise.all(
      (data ?? []).map(async (s) => {
        if (!isAllowedPushEndpoint(s.endpoint)) return;
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, JSON.stringify(message), {
            vapidDetails: config,
            // A chat lasts two minutes, so a notification that arrives later than that is noise.
            TTL: 120,
            urgency: 'high',
            timeout: SEND_TIMEOUT_MS,
          });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // The browser unsubscribed or the subscription expired.
          if (status === 404 || status === 410) gone.push(s.endpoint);
          // Status only: endpoints and payloads stay out of the logs (PRIV-003).
          else console.error('[push] send failed', status ?? 'no response');
        }
      }),
    );
    if (gone.length > 0) await db.from('push_subscriptions').delete().in('endpoint', gone);
  } catch (e) {
    console.error('[push] could not notify', e instanceof Error ? e.name : 'unknown error');
  }
}

/**
 * Tells the recipient that someone messaged them. Carries the sender's public
 * nickname and the room to open; never the message text, which would otherwise
 * sit on a lock screen.
 */
export function notifyNewMessage(recipientId: string, senderDisplayName: string, roomId: string): Promise<void> {
  return sendPushToUser(recipientId, {
    title: 'GarbaConnect',
    body: `${senderDisplayName} sent you a message`,
    url: `/chat/${encodeURIComponent(roomId)}`,
    tag: roomId,
  });
}
