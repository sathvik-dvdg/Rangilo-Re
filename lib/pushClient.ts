/**
 * Browser side of Web Push (NOTIF-002): registers the service worker and keeps
 * this browser's subscription in step with the server.
 *
 * - unsupported: this browser has no service worker, push or notification API
 *   (for example iPhone Safari outside a home-screen app).
 * - unavailable: the server has no VAPID keys, so nothing can be sent.
 */
export type PushState = 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on';

const SUBSCRIBE_URL = '/api/push/subscribe';

function supported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The VAPID public key, or null when the server cannot send push. */
async function serverKey(): Promise<string | null> {
  const res = await fetch(SUBSCRIBE_URL).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { enabled?: boolean; publicKey?: string | null };
  return data.enabled && data.publicKey ? data.publicKey : null;
}

function toBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function existing() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

const save = (subscription: PushSubscription) =>
  fetch(SUBSCRIBE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (!(await serverKey())) return 'unavailable';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && (await existing()) ? 'on' : 'off';
}

/** Call from a click: browsers only show the permission prompt in response to one. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  // Ask first, before anything else is awaited, so the prompt still counts as part of the click.
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';

  const publicKey = await serverKey();
  if (!publicKey) return 'unavailable';
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) }));
  const res = await save(subscription);
  if (!res.ok) {
    await subscription.unsubscribe().catch(() => {});
    return 'off';
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const subscription = await existing();
  if (subscription) {
    await fetch(SUBSCRIBE_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  return 'off';
}

/** On load while signed in: re-save an existing subscription so the server row belongs to whoever is signed in now. */
export async function syncPush(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const subscription = await existing();
  if (subscription) await save(subscription).catch(() => {});
}

/** On sign-out: stop this browser receiving the previous account's notifications. */
export async function dropLocalPush(): Promise<void> {
  if (!supported()) return;
  const subscription = await existing();
  await subscription?.unsubscribe().catch(() => {});
}
