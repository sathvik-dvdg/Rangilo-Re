'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { useSupabase } from '@/hooks/useSupabase';
import { totalUnread, useAppStore } from '@/store/useAppStore';
import { dropLocalPush, syncPush } from '@/lib/pushClient';
import type { Message, RoomState } from '@/lib/types';

type Incoming = { roomId: string; senderName: string; text: string };

const TOAST_MS = 6000;
const chatPath = (roomId: string) => `/chat/${encodeURIComponent(roomId)}`;

/** Two short taps, like dandiya sticks. Silent if the browser has not yet allowed audio. */
function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.14].forEach((at, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = i === 0 ? 880 : 1320;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.13);
    });
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // No Web Audio: the toast and vibration still happen.
  }
}

/**
 * New-message notifications for the whole signed-in app (NOTIF-001). Listens for
 * inserts on `messages`; row-level security only delivers rows from the user's
 * own rooms. While the app is visible it shows a toast with a sound and a
 * vibration; while it is hidden it counts unread in the tab title, and the
 * service worker shows the system notification (NOTIF-002).
 */
export function MessageNotifier() {
  const { userId, isLoaded } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname);
  path.current = pathname;

  const addUnread = useAppStore((s) => s.addUnread);
  const unreadCount = useAppStore(totalUnread);
  const [toast, setToast] = useState<Incoming | null>(null);
  const names = useRef(new Map<string, string>());

  // A message row has the sender's id, not their nickname; the room endpoint knows the partner.
  const senderName = useCallback(async (m: Message) => {
    const known = names.current.get(m.sender_id);
    if (known) return known;
    const res = await fetch(`/api/rooms/${encodeURIComponent(m.room_id)}`).catch(() => null);
    const room = res?.ok ? ((await res.json().catch(() => null)) as RoomState | null) : null;
    const name = room?.partner?.display_name ?? 'A dancer';
    if (room?.partner) names.current.set(m.sender_id, name);
    return name;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const onMessage = async (m: Message) => {
      if (m.sender_id === userId) return;
      // Already looking at this chat: ChatRoom shows the message itself.
      if (path.current === chatPath(m.room_id) && document.visibilityState === 'visible') return;
      addUnread(m.sender_id);
      if (document.visibilityState !== 'visible') return;
      setToast({ roomId: m.room_id, senderName: await senderName(m), text: m.text });
      chime();
      navigator.vibrate?.([100, 50, 100]);
    };

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => void onMessage(p.new as Message))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, addUnread, senderName]);

  // Keep the push subscription tied to whoever is signed in on this browser.
  useEffect(() => {
    if (!isLoaded) return;
    void (userId ? syncPush() : dropLocalPush());
  }, [isLoaded, userId]);

  // Tapping a system notification asks the open page to go to that chat.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onWorkerMessage = (e: MessageEvent) => {
      const { type, url } = (e.data ?? {}) as { type?: string; url?: string };
      if (type === 'open-chat' && typeof url === 'string' && url.startsWith('/chat/')) router.push(url);
    };
    navigator.serviceWorker.addEventListener('message', onWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onWorkerMessage);
  }, [router]);

  // Unread count in the tab title while there is something waiting.
  useEffect(() => {
    if (unreadCount === 0) return;
    const original = document.title;
    document.title = `(${unreadCount}) New message | GarbaConnect`;
    return () => {
      document.title = original;
    };
  }, [unreadCount, pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const open = () => {
    if (!toast) return;
    router.push(chatPath(toast.roomId));
    setToast(null);
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="fixed inset-x-0 top-3 z-[90] flex justify-center px-3"
        >
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-haldi/40 bg-ink-2 p-3 shadow-2xl shadow-black/50">
            <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumkum text-paper">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm text-haldi">{toast.senderName}</span>
                <span className="block truncate text-sm text-paper/80">{toast.text}</span>
              </span>
              <span className="shrink-0 rounded-full bg-haldi px-3 py-1.5 text-xs font-bold text-ink">Reply</span>
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/50 transition-colors hover:bg-paper/5 hover:text-paper"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
