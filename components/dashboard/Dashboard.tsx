'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { Search, Lock, Unlock, Shield } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { CampusEnergyBattle } from './CampusEnergyBattle';
import { OnboardingModal } from './OnboardingModal';
import { useLobbyPresence } from '@/hooks/useLobbyPresence';
import { useAppStore } from '@/store/useAppStore';
import { roomIdFor } from '@/lib/room';
import { cn, timeAgo } from '@/lib/utils';
import { VIBE_TAGS, type MyProfile, type PublicProfile } from '@/lib/types';

type Filter = 'all' | 'female' | 'male' | 'online';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'online', label: 'Online now' },
];

const BRANCH_OPTIONS = ['All Branches', 'CSE', 'ISE', 'AIML', 'ECE', 'MECH', 'CIVIL', 'AIDS'];
const YEAR_OPTIONS = ['All Years', '1st Year', '2nd Year', '3rd Year', '4th Year'];

const ROW = 96;

type RowData = {
  items: PublicProfile[];
  onlineIds: Set<string>;
  revealed: Record<string, { real_name: string; email: string }>;
  open: (u: PublicProfile) => void;
};

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const u = data.items[index];
  const online = data.onlineIds.has(u.clerk_id);
  const unlocked = data.revealed[u.clerk_id];
  return (
    <div style={style} className="px-1">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index, 15) * 0.04 }}
        onClick={() => data.open(u)}
        className="flex h-[88px] w-full items-center gap-3.5 rounded-lg px-3 text-left transition-colors hover:bg-paper/[0.04]"
      >
        <Avatar name={u.display_name} gender={u.gender} online={online} />

        <div className="min-w-0 flex-1 border-b border-paper/[0.07] pb-2 pt-2">
          {/* Top line: Name, Unlocked badge (if revealed), Gender, Branch, Vibe */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate font-display text-[15px] font-semibold text-paper">
              {unlocked?.real_name ? unlocked.real_name : u.display_name}
            </p>
            {unlocked && (
              <span className="flex items-center gap-1 rounded bg-[#7FB069]/20 border border-[#7FB069]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9CC587]">
                <Unlock className="h-2.5 w-2.5" />
                Unlocked
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
            {unlocked?.email && (
              <span className="shrink-0 text-[11px] text-paper/50">
                {unlocked.email}
              </span>
            )}
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
  const revealed = useAppStore((s) => s.revealed);
  const [users, setUsers] = useState<PublicProfile[] | null>(null);
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
    fetch('/api/users')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? 'Could not load dancers. Try again in a moment.');
        setUsers(d.users);
      })
      .catch((e: Error) => setError(e.message || 'Could not load dancers. Try again in a moment.'));
  }, [me, attempt]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => {
        if (!q) return true;
        const matchesName = u.display_name.toLowerCase().includes(q);
        const matchesOutfit = u.outfit_color ? u.outfit_color.toLowerCase().includes(q) : false;
        return matchesName || matchesOutfit;
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
      .sort((a, b) => Number(onlineIds.has(b.clerk_id)) - Number(onlineIds.has(a.clerk_id)));
  }, [users, query, filter, selectedBranch, selectedYear, selectedVibe, onlineIds]);

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
      revealed,
      open: (u) => userId && router.push(`/chat/${encodeURIComponent(roomIdFor(userId, u.clerk_id))}`),
    }),
    [visible, onlineIds, revealed, userId, router],
  );

  return (
    <main className="flex h-[100dvh] flex-col bg-ink pt-16">
      {me && (
        <>
          <div className="stitch-b bg-ink-2">
            <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar name={me.display_name} gender={me.gender} size={48} />
                  <span
                    title="Profile Locked"
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink-2 bg-kumkum text-paper shadow"
                  >
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate font-display text-lg text-haldi">{me.display_name}</p>
                    <GenderBadge gender={me.gender} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-kumkum/40 bg-kumkum/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#FF9E94] shadow-sm">
                      <Lock className="h-2.5 w-2.5 text-kumkum animate-pulse" />
                      Locked Profile
                    </span>
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
                      className="ml-auto rounded border border-paper/15 px-2.5 py-1 text-xs font-semibold text-paper/70 hover:border-haldi hover:text-haldi transition-colors"
                    >
                      Edit Profile
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper/60">
                    <p>
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

              {/* Eye-catching Profile Locked reminder banner */}
              <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 rounded-xl border border-kumkum/30 bg-gradient-to-r from-kumkum/20 via-ink to-ink-3 px-3.5 py-2.5 text-xs shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kumkum/25 text-[#FF9E94]">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 text-paper/80 text-[11.5px] leading-snug">
                    <span className="font-extrabold text-paper">🔒 Profile Locked & Protected:</span>{' '}
                    <span>
                      Your Real Name, Gmail & Instagram are hidden from other dancers. Paying never unlocks them.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="shrink-0 font-bold text-haldi hover:underline text-[11px] whitespace-nowrap ml-auto sm:ml-0"
                >
                  Edit Details →
                </button>
              </div>
            </div>
          </div>

          <CampusEnergyBattle users={users} onlineIds={onlineIds} me={me} />

          <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
            <label className="flex h-11 items-center gap-3 rounded-full border border-paper/15 bg-ink-2 px-4 focus-within:border-haldi">
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
            <div role="group" aria-label="Filter dancers" className="mt-4 flex gap-2 overflow-x-auto pb-1">
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

          {/* Lobby Locked Profiles Notice */}
          <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6">
            <div className="flex items-center justify-between gap-2.5 rounded-xl border border-haldi/20 bg-ink-2/80 px-3.5 py-2 text-xs text-paper/75 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-haldi/15 text-haldi">
                  <Lock className="h-3 w-3" />
                </span>
                <p className="leading-snug">
                  <strong className="text-haldi font-bold">Anonymous Lobby:</strong> All dancer profiles are locked. Tap anyone to start a 2-min chat.
                </p>
              </div>
            </div>
          </div>

          <div ref={listWrap} className="mx-auto mt-2 w-full max-w-3xl flex-1 overflow-hidden px-3 sm:px-5">
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
              <FixedSizeList height={height} width="100%" itemCount={visible.length} itemSize={ROW} itemData={itemData} itemKey={(i, d) => d.items[i].clerk_id}>
                {Row}
              </FixedSizeList>
            )}
          </div>
        </>
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
