'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { OnboardingModal } from './OnboardingModal';
import { useLobbyPresence } from '@/hooks/useLobbyPresence';
import { useAppStore } from '@/store/useAppStore';
import { roomIdFor } from '@/lib/room';
import { cn, timeAgo } from '@/lib/utils';
import type { PublicProfile } from '@/lib/types';

type Filter = 'all' | 'female' | 'male' | 'online';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'online', label: 'Online now' },
];

const ROW = 84;

type RowData = { items: PublicProfile[]; onlineIds: Set<string>; open: (u: PublicProfile) => void };

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const u = data.items[index];
  const online = data.onlineIds.has(u.clerk_id);
  return (
    <div style={style} className="px-1">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index, 15) * 0.04 }}
        onClick={() => data.open(u)}
        className="flex h-[76px] w-full items-center gap-4 rounded-md px-3 text-left transition-colors hover:bg-paper/[0.04]"
      >
        <Avatar name={u.display_name} online={online} />
        <div className="min-w-0 flex-1 border-b border-paper/[0.07] pb-3 pt-3">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-[15px] text-paper">{u.display_name}</p>
            <GenderBadge gender={u.gender} />
          </div>
          <p className={cn('mt-1 text-xs', online ? 'text-[#9CC587]' : 'text-paper/45')}>
            {online ? 'On the floor now' : `Last seen ${timeAgo(u.last_seen)}`}
          </p>
        </div>
      </motion.button>
    </div>
  );
}

export function Dashboard({ me, suggestedName }: { me: PublicProfile | null; suggestedName: string | null }) {
  const { userId } = useAuth();
  const router = useRouter();
  const onlineIds = useAppStore((s) => s.onlineIds);
  const [users, setUsers] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useLobbyPresence(me ? userId ?? null : null);

  useEffect(() => {
    if (!me) return;
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setUsers(d.users))
      .catch(() => setError('Could not load dancers. Pull to refresh or try again in a moment.'));
  }, [me]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => !q || u.display_name.toLowerCase().includes(q))
      .filter((u) => {
        if (filter === 'online') return onlineIds.has(u.clerk_id);
        if (filter === 'all') return true;
        return u.gender === filter;
      })
      .sort((a, b) => Number(onlineIds.has(b.clerk_id)) - Number(onlineIds.has(a.clerk_id)));
  }, [users, query, filter, onlineIds]);

  // Others online (presence includes me).
  const onlineCount = Math.max(0, onlineIds.size - (userId && onlineIds.has(userId) ? 1 : 0));

  // react-window needs a pixel height; measure the remaining viewport.
  const listWrap = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(500);
  useEffect(() => {
    const el = listWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [users]);

  const itemData = useMemo<RowData>(
    () => ({
      items: visible,
      onlineIds,
      open: (u) => userId && router.push(`/chat/${encodeURIComponent(roomIdFor(userId, u.clerk_id))}`),
    }),
    [visible, onlineIds, userId, router],
  );

  return (
    <main className="flex h-[100dvh] flex-col bg-ink pt-16">
      {me && (
        <>
          <div className="stitch-b bg-ink-2">
            <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
              <Avatar name={me.display_name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-lg text-haldi">{me.display_name}</p>
                  <GenderBadge gender={me.gender} />
                </div>
                <p className="mt-0.5 text-sm text-paper/60">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#7FB069] align-middle" />
                  Online: <span className="tabular font-bold text-paper">{onlineCount}</span> dancers tonight
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
            <label className="flex h-11 items-center gap-3 rounded-full border border-paper/15 bg-ink-2 px-4 focus-within:border-haldi">
              <Search className="h-4 w-4 text-paper/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by nickname"
                className="w-full bg-transparent text-[15px] text-paper placeholder:text-paper/35 focus:outline-none"
              />
            </label>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
                    filter === f.id ? 'border-haldi bg-haldi text-ink' : 'border-paper/15 text-paper/70 hover:border-paper/40',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={listWrap} className="mx-auto mt-3 w-full max-w-3xl flex-1 overflow-hidden px-3 sm:px-5">
            {error ? (
              <p className="p-6 text-paper/60">{error}</p>
            ) : users === null ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-2">
                    <div className="h-12 w-12 rounded-full bg-paper/[0.06]" />
                    <div className="h-4 w-48 rounded bg-paper/[0.06]" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="p-10 text-center text-paper/55">
                <p className="font-display text-xl text-paper/80">Nobody here yet</p>
                <p className="mt-2 text-sm">Try a different filter, or wait — the night is young.</p>
              </div>
            ) : (
              <FixedSizeList height={height} width="100%" itemCount={visible.length} itemSize={ROW} itemData={itemData} itemKey={(i, d) => d.items[i].clerk_id}>
                {Row}
              </FixedSizeList>
            )}
          </div>
        </>
      )}

      <OnboardingModal open={!me} suggestedName={suggestedName ?? ''} onDone={() => router.refresh()} />
    </main>
  );
}
