// GarbaConnect service worker (NOTIF-002): shows the new-message notifications the
// server sends by Web Push. It caches nothing and does not handle fetches.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Only ever open pages of this app, whatever a payload says.
function safePath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: fall through to the generic text below.
  }
  const title = typeof data.title === 'string' ? data.title : 'GarbaConnect';
  const body = typeof data.body === 'string' ? data.body : 'You have a new message';
  const tag = typeof data.tag === 'string' ? data.tag : 'garbaconnect';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Someone is looking at the app, which shows its own in-app notification.
      if (windows.some((client) => client.visibilityState === 'visible')) return;
      // One notification per chat: a newer message replaces the older one.
      await self.registration.showNotification(title, { body, tag, renotify: true, data: { url: safePath(data.url) } });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        // The page does the navigation (MessageNotifier), so it stays a client-side route change.
        // Sent before focusing, so the chat still opens if the browser refuses the focus.
        open.postMessage({ type: 'open-chat', url });
        await open.focus().catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
