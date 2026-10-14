'use client';

import { useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import type { Message } from '@/lib/types';

type Handlers = {
  onMessage: (m: Message) => void;
  onMessageUpdate: (m: Message) => void;
  onTimerStart: (iso: string) => void;
  onExtension: (extraSeconds: number) => void;
  /** A connect request in this room was created or answered. Carries no identity: refetch the room from the server. */
  onConsentChange: () => void;
  /** The room became unlimited (it was paid for). */
  onUnlimited: () => void;
  /** A request to see a name and photo was made or answered. Row-level security only delivers the user's own. */
  onRevealChange?: () => void;
};

/**
 * Subscribes to everything a chat room needs on one channel `room:<id>`:
 * message inserts/updates, the room row (timer start, unlimited), extensions,
 * connect requests, reveal requests, and presence so we know when both dancers
 * have the room open.
 */
export function useRoomRealtime(roomId: string, userId: string | null, handlers: Handlers) {
  const supabase = useSupabase();
  const h = useRef(handlers);
  h.current = handlers;
  const [presentIds, setPresentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: userId } } });

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) =>
        h.current.onMessage(p.new as Message),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) =>
        h.current.onMessageUpdate(p.new as Message),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p) => {
        const room = p.new as { timer_started_at: string | null; unlimited?: boolean };
        if (room.timer_started_at) h.current.onTimerStart(room.timer_started_at);
        if (room.unlimited) h.current.onUnlimited();
      })
      // RLS delivers these rows only to the requester and the person asked (contact-consent flow).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_consents', filter: `room_id=eq.${roomId}` }, () =>
        h.current.onConsentChange(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_extensions', filter: `room_id=eq.${roomId}` }, (p) =>
        h.current.onExtension((p.new as { extra_seconds: number }).extra_seconds),
      )
      // RLS delivers reveal_requests only to the two dancers involved (reveal flow).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reveal_requests' }, () => h.current.onRevealChange?.())
      .on('presence', { event: 'sync' }, () => setPresentIds(Object.keys(channel.presenceState())))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, userId]);

  return { presentIds };
}
