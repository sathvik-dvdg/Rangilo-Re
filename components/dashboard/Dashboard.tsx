'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { Search, Lock, Shield } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { CampusEnergyBattle } from './CampusEnergyBattle';
import { NotificationToggle } from './NotificationToggle';
import { OnboardingModal } from './OnboardingModal';
import { useLobbyPresence } from '@/hooks/useLobbyPresence';
import { useAppStore } from '@/store/useAppStore';
import { roomIdFor } from '@/lib/room';
import { cn, timeAgo } from '@/lib/utils';
import { VIBE_TAGS, type MyProfile, type PublicProfile, type RevealedIdentity } from '@/lib/types';

type Filter = 'all' | 'female' | 'male' | 'online';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'online', label: 'Online now' },
];

const BRANCH_OPTIONS = ['All Branches', 'CSE', 'ISE', 'AIML', 'ECE', 'MECH', 'CIVIL', 'AIDS'];
const YEAR_OPTIONS = ['All Years', '1st Year', '2nd Year', '3rd Year', '4th Year'];

// Phone: a flat list, one dancer per row. Laptop: bordered cards, two per row when there is room.
// Two-up cards are narrower, so their tags wrap onto a third line and the row is taller.
const ROW = 96;
/** How often the dancer list is refetched from the server while the tab is visible. */
const USERS_REFRESH_MS = 30_000;
const ROW_TWO_UP = 116;
const DESKTOP_QUERY = '(min-width: 1024px)';
const TWO_COLUMN_MIN_WIDTH = 680;

type RowData = {
  rows: PublicProfile[][];
  cols: number;
  onlineIds: Set<string>;
  /** Dancers who agreed to share their name (and optionally photo) with this viewer. */
  revealed: Record<string, RevealedIdentity>;
  /** Dancers whose connect request is waiting for this user's answer. */
  incoming: Set<string>;
  /** Unread message counts by sender clerk_id (NOTIF-001). */
  unread: Record<string, number>;
  open: (u: PublicProfile) => void;
};

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  return (
    <div style={{ ...style, gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))` }} className="grid gap-x-3 px-1 lg:px-0">
      {data.rows[index].map((u) => (
        <DancerCard key={u.clerk_id} u={u} index={index} data={data} />
      ))}
    </div>
  );
}

function DancerCard({ u, index, data }: { u: PublicProfile; index: number; data: RowData }) {
  const online = data.onlineIds.has(u.clerk_id);
  const shared = data.revealed[u.clerk_id];
  const wantsToConnect = data.incoming.has(u.clerk_id);
  const unread = data.unread[u.clerk_id] ?? 0;
  return (
    <div className="min-w-0">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index, 15) * 0.04 }}
        onClick={() => data.open(u)}
        className={cn(
          'flex h-[88px] w-full items-center gap-3.5 overflow-hidden rounded-lg px-3 text-left transition-colors hover:bg-paper/[0.04] lg:rounded-xl lg:border lg:border-paper/10 lg:bg-ink-2 lg:px-4 lg:hover:border-haldi/50 lg:hover:bg-ink-3',
          data.cols === 2 ? 'lg:h-[104px]' : 'lg:h-[84px]',
        )}
      >
        <div className="relative shrink-0">
          <Avatar name={u.display_name} gender={u.gender} imageUrl={shared?.image_url} online={online} />
          {!shared && (
            <span
              title="Identity Locked (Real identity hidden)"
              className={cn(
                'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border bg-kumkum text-paper shadow-sm',
                online ? 'border-[#7FB069] ring-1 ring-[#7FB069]/60' : 'border-ink',
              )}
            >
              <Lock className="h-2.5 w-2.5" />
            </span>
          )}
          {unread > 0 && (
            <span
              aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
              className="tabular absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ink bg-haldi px-1 text-[11px] font-bold text-ink"
            >
              {unread}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 border-b border-paper/[0.07] pb-2 pt-2 lg:border-b-0 lg:py-0">
          {/* Top line: real name if they shared it (else nickname), request badge, Gender, Branch, Vibe */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate font-display text-[15px] font-semibold text-paper" title={shared?.real_name ? u.display_name : undefined}>
              {shared?.real_name ? shared.real_name : u.display_name}
            </p>
            {wantsToConnect && (
              <span className="rounded border border-haldi/50 bg-haldi/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-haldi">
                Wants to connect
              </span>
            )}
            <GenderBadge gender={u.gender} />
            {(u.branch || u.college_year) && (
              <span className="rounded bg-paper/10 px-1.5 py-0.5 text-[10px] font-semibold text-paper/70">
                {u.branch || 'CSE'} · {u.college_year ? u.college_year.replace(' Year', ' Yr') : '1st Yr'}
              </span>
            )}
            {u.vibe_tag && (
              <span className="rounded-full bg-haldi/10 border border-haldi/25 px-2 py-0.5 text-[10px] font-medium text-haldi truncate max-w-[170px]">
                {u.vibe_tag}
              </span>
            )}
          </div>

          {/* Bottom line: outfit hint & online/seen status */}
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex-1 truncate">
              {u.outfit_color ? (
                <span className="truncate text-paper/75">
                  👘 <span className="italic">{u.outfit_color}</span>
                </span>
              ) : (
                <span className={cn('truncate', online ? 'text-[#9CC587]' : 'text-paper/45')}>
                  {online ? 'On the floor now' : `Seen ${timeAgo(u.last_seen)}`}
                </span>
              )}
            </div>
            {u.outfit_color && (
              <span className={cn('shrink-0 text-[11px]', online ? 'text-[#9CC587]' : 'text-paper/40')}>
                {online ? 'Online' : timeAgo(u.last_seen)}
              </span>
            )}
            {shared?.real_name && <span className="hidden shrink-0 truncate text-[11px] text-paper/45 sm:inline">{u.display_name}</span>}
          </div>
        </div>
      </motion.button>
    </div>
  );
}

export function Dashboard({ me, suggestedName }: { me: MyProfile | null; suggestedName: string | null }) {
  const { userId } = useAuth();
  const router = useRouter();
  const onlineIds = useAppStore((s) => s.onlineIds);
  const unread = useAppStore((s) => s.unread);
  // Held in memory only and refetched from the server on every load; never written to browser storage.
  const [incoming, setIncoming] = useState<Set<string>>(() => new Set());
  const [users, setUsers] = useState<PublicProfile[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, RevealedIdentity>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedVibe, setSelectedVibe] = useState<string>('all');
  const [attempt, setAttempt] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  useLobbyPresence(me ? userId ?? null : null);

  useEffect(() => {
    if (!me) return;
    setError(null);
    setUsers(null);

    // Fetch dancers
    fetch('/api/users')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? 'Could not load dancers. Try again in a moment.');
        setUsers(d.users);
      })
      .catch((e: Error) => setError(e.message || 'Could not load dancers. Try again in a moment.'));

    // Connections (connect flow) and name-photos (reveal flow) the server says I can see.
    fetch('/api/reveals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { revealed?: Record<string, RevealedIdentity>; incoming?: string[] } | null) => {
        setRevealed(d?.revealed ?? {});
        setIncoming(new Set(d?.incoming ?? []));
      })
      .catch(() => {});
  }, [me, attempt]);

  // Keep the list current (new dancers, profile edits, last seen) by refetching it from the
  // server every few seconds. Skipped while the tab is hidden or a refetch is still running;
  // a failed refetch keeps the list already on screen.
  useEffect(() => {
    if (!me) return;
    let inFlight = false;
    const id = window.setInterval(() => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      fetch('/api/users', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { users?: PublicProfile[] } | null) => {
          if (!d?.users) return;
          setUsers(d.users);
          setError(null);
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    }, USERS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [me]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => {
        if (!q) return true;
        const matchesName = u.display_name.toLowerCase().includes(q);
        const matchesRealName = revealed[u.clerk_id]?.real_name
          ? revealed[u.clerk_id].real_name.toLowerCase().includes(q)
          : false;
        const matchesOutfit = u.outfit_color ? u.outfit_color.toLowerCase().includes(q) : false;
        return matchesName || matchesRealName || matchesOutfit;
      })
      .filter((u) => {
        if (filter === 'online') return onlineIds.has(u.clerk_id);
        if (filter === 'all') return true;
        return u.gender === filter;
      })
      .filter((u) => {
        if (selectedBranch !== 'all' && (u.branch || 'CSE') !== selectedBranch) return false;
        if (selectedYear !== 'all' && (u.college_year || '1st Year') !== selectedYear) return false;
        if (selectedVibe !== 'all' && u.vibe_tag !== selectedVibe) return false;
        return true;
      })
      // Pending connect requests first, then unread messages, then online status.
      .sort(
        (a, b) =>
          Number(incoming.has(b.clerk_id)) - Number(incoming.has(a.clerk_id)) ||
          Number(Boolean(unread[b.clerk_id])) - Number(Boolean(unread[a.clerk_id])) ||
          Number(onlineIds.has(b.clerk_id)) - Number(onlineIds.has(a.clerk_id)),
      );
  }, [users, query, filter, selectedBranch, selectedYear, selectedVibe, onlineIds, revealed, incoming, unread]);

  // Others online (presence includes me).
  const onlineCount = Math.max(0, onlineIds.size - (userId && onlineIds.has(userId) ? 1 : 0));

  // react-window needs pixel sizes; measure the space the list has.
  const listWrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 500 });
  useEffect(() => {
    const el = listWrap.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [users]);

  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const cols = desktop && size.width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;

  const itemData = useMemo<RowData>(() => {
    const rows: PublicProfile[][] = [];
    for (let i = 0; i < visible.length; i += cols) rows.push(visible.slice(i, i + cols));
    return {
      rows,
      cols,
      onlineIds,
      revealed,
      incoming,
      unread,
      open: (u) => userId && router.push(`/chat/${encodeURIComponent(roomIdFor(userId, u.clerk_id))}`),
    };
  }, [visible, cols, onlineIds, revealed, incoming, unread, userId, router]);

  const lobbyNotice = (
    <div className="flex items-center gap-2 rounded-xl border border-haldi/20 bg-ink-2/80 px-3.5 py-2 text-xs text-paper/75 shadow-sm lg:bg-ink/60">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-haldi/15 text-haldi">
        <Lock className="h-3 w-3" />
      </span>
      <p className="leading-snug">
        <strong className="text-haldi font-bold">Anonymous Lobby:</strong> All dancer profiles are locked. Tap anyone to start a private chat.
      </p>
    </div>
  );

  return (
    <main className="flex h-[100dvh] flex-col bg-ink pt-16">
      {me && (
        // Phone: profile, filters and list stacked. Laptop: profile panel on the left, dancers on the right.
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col lg:max-w-6xl lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
          <aside className="stitch-b shrink-0 bg-ink-2 lg:w-[300px] lg:self-start lg:rounded-2xl lg:border lg:border-solid lg:border-paper/10 xl:w-[340px]">
            <div className="relative mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:max-w-none lg:p-5">
              {/* On laptop the panel is narrow, so the edit button sits beside the avatar instead of among the tags. */}
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="absolute right-5 top-5 hidden rounded border border-paper/15 px-2.5 py-1 text-xs font-semibold text-paper/70 transition-colors hover:border-haldi hover:text-haldi lg:block"
              >
                Edit Profile
              </button>
              <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
                <Avatar name={me.display_name} gender={me.gender} size={48} />
                <div className="min-w-0 flex-1 lg:w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate font-display text-lg text-haldi lg:w-full">{me.display_name}</p>
                    <GenderBadge gender={me.gender} />
                    {(me.branch || me.college_year) && (
                      <span className="rounded bg-paper/10 px-2 py-0.5 text-[11px] font-bold text-paper/80">
                        {me.branch || 'CSE'} · {me.college_year ? me.college_year.replace(' Year', ' Yr') : '1st Yr'}
                      </span>
                    )}
                    {me.vibe_tag && (
                      <span className="rounded-full bg-haldi/15 border border-haldi/30 px-2 py-0.5 text-[11px] font-medium text-haldi">
                        {me.vibe_tag}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="ml-auto rounded border border-paper/15 px-2.5 py-1 text-xs font-semibold text-paper/70 hover:border-haldi hover:text-haldi transition-colors lg:hidden"
                    >
                      Edit Profile
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper/60">
                    {/* The laptop panel shows this count as a tile below. */}
                    <p className="lg:hidden">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#7FB069] align-middle" />
                      Online: <span className="tabular font-bold text-paper">{onlineCount}</span> dancers tonight
                    </p>
                    {me.outfit_color && (
                      <span className="text-paper/75">
                        Wearing: <span className="italic text-paper">{me.outfit_color}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <NotificationToggle className="mt-3" />

              <dl className="mt-3 hidden grid-cols-2 gap-3 lg:grid">
                <div className="rounded-xl bg-ink/60 px-3.5 py-3">
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-paper/45">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7FB069]" />
                    Online now
                  </dt>
                  <dd className="tabular mt-1 font-display text-2xl text-paper">{onlineCount}</dd>
                </div>
                <div className="rounded-xl bg-ink/60 px-3.5 py-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/45">Dancers</dt>
                  <dd className="tabular mt-1 font-display text-2xl text-paper">{users ? users.length : '–'}</dd>
                </div>
              </dl>
              <div className="mt-3 hidden lg:block">{lobbyNotice}</div>
            </div>
          </aside>

          <CampusEnergyBattle users={users} onlineIds={onlineIds} me={me} />

          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6 lg:max-w-none lg:px-0 lg:pt-0">
            <div className="mb-4 hidden items-baseline justify-between gap-4 lg:flex">
              <h1 className="font-display text-2xl text-paper">On the floor tonight</h1>
              {users && (
                <p className="text-sm text-paper/50">
                  <span className="tabular font-bold text-paper/80">{visible.length}</span> {visible.length === 1 ? 'dancer' : 'dancers'}
                </p>
              )}
            </div>
            <div className="lg:flex lg:items-center lg:gap-3">
            <label className="flex h-11 items-center gap-3 rounded-full border border-paper/15 bg-ink-2 px-4 focus-within:border-haldi lg:min-w-0 lg:flex-1">
              <Search className="h-4 w-4 text-paper/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by nickname or outfit"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Search by nickname or outfit hint..."
                className="w-full bg-transparent text-[15px] text-paper placeholder:text-paper/35 focus:outline-none"
              />
            </label>

            {/* Main quick filters */}
            <div role="group" aria-label="Filter dancers" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-0 lg:shrink-0 lg:pb-0">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cn(
                    'h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors',
                    filter === f.id ? 'border-haldi bg-haldi text-ink' : 'border-paper/15 text-paper/70 hover:border-paper/40',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            </div>

            {/* Department, Year & Vibe filters */}
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                aria-label="Filter by Branch"
                className="h-8 rounded-lg border border-paper/15 bg-ink-2 px-2.5 text-paper/80 focus:border-haldi focus:outline-none"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b === 'All Branches' ? 'all' : b} className="bg-ink-2 text-paper">
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Filter by Year"
                className="h-8 rounded-lg border border-paper/15 bg-ink-2 px-2.5 text-paper/80 focus:border-haldi focus:outline-none"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y === 'All Years' ? 'all' : y} className="bg-ink-2 text-paper">
                    {y}
                  </option>
                ))}
              </select>

              <select
                value={selectedVibe}
                onChange={(e) => setSelectedVibe(e.target.value)}
                aria-label="Filter by Vibe"
                className="h-8 rounded-lg border border-paper/15 bg-ink-2 px-2.5 text-paper/80 focus:border-haldi focus:outline-none"
              >
                <option value="all" className="bg-ink-2 text-paper">All Vibes</option>
                {VIBE_TAGS.map((v) => (
                  <option key={v} value={v} className="bg-ink-2 text-paper">
                    {v}
                  </option>
                ))}
              </select>

              {(selectedBranch !== 'all' || selectedYear !== 'all' || selectedVibe !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranch('all');
                    setSelectedYear('all');
                    setSelectedVibe('all');
                  }}
                  className="rounded px-2 py-1 text-[11px] font-bold text-haldi hover:underline shrink-0"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Lobby Locked Profiles Notice (in the side panel on laptop screens) */}
          <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6 lg:hidden">{lobbyNotice}</div>

          <div ref={listWrap} className="mx-auto mt-2 min-h-0 w-full max-w-3xl flex-1 overflow-hidden px-3 sm:px-5 lg:mt-3 lg:max-w-none lg:px-0">
            {error ? (
              <div role="alert" className="flex flex-col items-start gap-4 p-6 text-paper/75">
                <p>{error}</p>
                <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              </div>
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
              <FixedSizeList
                height={size.height}
                width="100%"
                itemCount={itemData.rows.length}
                itemSize={cols === 2 ? ROW_TWO_UP : ROW}
                itemData={itemData}
                itemKey={(i, d) => d.rows[i][0].clerk_id}
              >
                {Row}
              </FixedSizeList>
            )}
          </div>
          </section>
        </div>
      )}

      <OnboardingModal
        open={!me || editOpen}
        suggestedName={me?.display_name ?? suggestedName ?? ''}
        initialGender={me?.gender}
        initialRealName={me?.real_name ?? ''}
        initialEmail={me?.email ?? ''}
        initialBranch={me?.branch}
        initialCollegeYear={me?.college_year}
        initialVibeTag={me?.vibe_tag}
        initialOutfitColor={me?.outfit_color}
        initialInstagramHandle={me?.instagram_handle}
        onDone={() => {
          setEditOpen(false);
          router.refresh();
        }}
        onClose={() => setEditOpen(false)}
      />
    </main>
  );
}
