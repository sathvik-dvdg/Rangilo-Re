'use client';

import { useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import type { Message } from '@/lib/types';

type Handlers = {
  onMessage: (m: Message) => void;
  onMessageUpdate: (m: Message) => void;
  onTimerStart: (iso: string) => void;
  onExtension: (extraSeconds: number) => void;
};

/**
 * Subscribes to everything a chat room needs on one channel `room:<id>`:
 * message inserts/updates, the room row (timer start), extensions, and
 * presence so we know when both dancers have the room open.
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
        const iso = (p.new as { timer_started_at: string | null }).timer_started_at;
        if (iso) h.current.onTimerStart(iso);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_extensions', filter: `room_id=eq.${roomId}` }, (p) =>
        h.current.onExtension((p.new as { extra_seconds: number }).extra_seconds),
      )
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
