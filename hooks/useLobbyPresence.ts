'use client';

import { useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { useAppStore } from '@/store/useAppStore';

/**
 * Everyone on the dashboard joins one presence channel. That gives a live
 * "N dancers tonight" count and the green dots, without polling. A slow
 * heartbeat keeps last_seen fresh for people who are offline later.
 */
export function useLobbyPresence(userId: string | null) {
  const supabase = useSupabase();
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('lobby', { config: { presence: { key: userId } } });
    channel
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState())))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() });
      });

    const beat = () => fetch('/api/me/heartbeat', { method: 'POST', body: JSON.stringify({ online: true }) }).catch(() => {});
    beat();
    const id = window.setInterval(beat, 60_000);
    const bye = () => navigator.sendBeacon?.('/api/me/heartbeat', JSON.stringify({ online: false }));
    window.addEventListener('pagehide', bye);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', bye);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, setOnline]);
}
