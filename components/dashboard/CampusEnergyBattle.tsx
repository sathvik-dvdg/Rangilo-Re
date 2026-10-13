'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Share2, ChevronDown, ChevronUp, Trophy, Users, Zap, Check } from 'lucide-react';
import type { MyProfile, PublicProfile } from '@/lib/types';

export function CampusEnergyBattle({
  users,
  onlineIds,
  me,
}: {
  users: PublicProfile[] | null;
  onlineIds: Set<string>;
  me: MyProfile | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-calculate energy battle scores per department / year from real-time online status
  const departments = useMemo(() => {
    const list = users ?? [];
    const allUsersWithMe = me ? [...list, me] : list;
    // Map to prevent duplicates
    const uniqueMap = new Map<string, PublicProfile>();
    allUsersWithMe.forEach((u) => uniqueMap.set(u.clerk_id, u));

    const scores: Record<
      string,
      {
        name: string;
        branch: string;
        year: string;
        online: number;
        total: number;
      }
    > = {};

    uniqueMap.forEach((u) => {
      const branch = u.branch || 'CSE';
      const year = u.college_year || '3rd Year';
      const key = `${branch} · ${year}`;

      if (!scores[key]) {
        scores[key] = {
          name: key,
          branch,
          year,
          online: 0,
          total: 0,
        };
      }
      scores[key].total += 1;
      if (onlineIds.has(u.clerk_id)) {
        scores[key].online += 1;
      }
    });

    // Sort descending by online count, then total members
    return Object.values(scores).sort((a, b) => b.online - a.online || b.total - a.total);
  }, [users, onlineIds, me]);

  const leader = departments[0] || {
    name: 'CSE · 3rd Year',
    branch: 'CSE',
    year: '3rd Year',
    online: 0,
    total: 0,
  };

  const maxOnline = Math.max(1, ...departments.map((d) => d.online));

  const shareToWhatsApp = () => {
    const host = typeof window !== 'undefined' ? window.location.host : 'garbaconnect.app';
    const text = encodeURIComponent(
      `🔥 Canara Engineering College Garba Battle!\n\n🏆 ${leader.name} is leading the floor with ${leader.online} dancers online right now!\n\nRep your branch and find your dance partner tonight:\nhttps://${host}/dashboard`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const copyInvite = () => {
    const host = typeof window !== 'undefined' ? window.location.origin : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${host}/dashboard`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-haldi/40 bg-gradient-to-br from-ink-2 via-ink to-ink-3 p-4 shadow-lg sm:p-5"
      >
        {/* Glow backdrop accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-kumkum/20 blur-2xl"
        />

        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kumkum/20 text-kumkum">
              <Flame className="h-4 w-4 animate-bounce text-[#FF8A7A]" />
            </span>
            <span className="font-display text-xs font-bold tracking-wider uppercase text-haldi">
              Department Energy Battle
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-[#7FB069]/40 bg-[#7FB069]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#A7D894]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FB069] animate-pulse" />
              Live Online
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-paper/70 hover:text-paper hover:bg-paper/10 transition-colors"
            >
              {expanded ? 'Hide Ranks' : 'Leaderboard'}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Leading Message Banner */}
        <div className="mt-3">
          <p className="font-display text-base sm:text-lg font-semibold text-paper leading-snug">
            🔥{' '}
            <span className="text-haldi font-bold underline decoration-haldi/40 underline-offset-2">
              {leader.name}
            </span>{' '}
            is leading the lobby with{' '}
            <span className="tabular font-extrabold text-kumkum bg-kumkum/15 px-1.5 py-0.5 rounded">
              {leader.online} dancers online!
            </span>
          </p>
          <p className="mt-1 text-xs text-paper/60">
            Share the battle link in your class group to bring more dancers and take #1 spot.
          </p>
        </div>

        {/* Action Buttons: WhatsApp Rally + Copy Link */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={shareToWhatsApp}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-xs font-extrabold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] shadow"
          >
            <Share2 className="h-3.5 w-3.5" />
            Rally on WhatsApp
          </button>
          <button
            type="button"
            onClick={copyInvite}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-paper/20 bg-ink-3 px-3 text-xs font-semibold text-paper/80 hover:border-haldi hover:text-haldi transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#7FB069]" /> : <Zap className="h-3.5 w-3.5 text-haldi" />}
            {copied ? 'Link Copied!' : 'Copy Invite Link'}
          </button>

          {me && (
            <span className="ml-auto hidden sm:inline-flex text-[11px] text-paper/50 font-medium">
              Your Branch:{' '}
              <span className="ml-1 text-haldi font-semibold">
                {me.branch || 'CSE'} {me.college_year || '3rd Year'}
              </span>
            </span>
          )}
        </div>

        {/* Expandable Mini Leaderboard */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 overflow-hidden border-t border-paper/10 pt-3"
            >
              <div className="space-y-2.5">
                {departments.slice(0, 5).map((dept, index) => {
                  const percent = Math.round((dept.online / maxOnline) * 100);
                  const isMine =
                    me &&
                    (me.branch || 'CSE') === dept.branch &&
                    (me.college_year || '3rd Year') === dept.year;

                  return (
                    <div
                      key={dept.name}
                      className={`rounded-lg p-2.5 transition-colors ${
                        isMine ? 'bg-haldi/10 border border-haldi/30' : 'bg-ink/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold font-display">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          <span className="font-semibold text-paper">
                            {dept.name}
                            {isMine && (
                              <span className="ml-1.5 rounded bg-haldi/20 px-1 py-0.2 text-[9px] font-bold text-haldi">
                                You
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold tabular text-haldi">{dept.online} online</span>
                          <span className="text-paper/40">({dept.total} dancers)</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-haldi to-kumkum transition-all duration-500"
                          style={{ width: `${Math.max(8, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
