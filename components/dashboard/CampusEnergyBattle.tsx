'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Share2, Trophy, Zap, Check, X } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-calculate energy battle scores per department / year from real-time online status
  const departments = useMemo(() => {
    const list = users ?? [];
    const allUsersWithMe = me ? [...list, me] : list;
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
      const year = u.college_year || '1st Year';
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

    return Object.values(scores).sort((a, b) => b.online - a.online || b.total - a.total);
  }, [users, onlineIds, me]);

  const leader = departments[0] || {
    name: 'CSE · 1st Year',
    branch: 'CSE',
    year: '1st Year',
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
    <>
      {/* Floating Draggable Fire Icon Button */}
      <motion.div
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-5 z-40 cursor-grab active:cursor-grabbing select-none"
        title="Department Energy Battle (Drag anywhere on screen)"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Department Energy Battle Leaderboard"
          className="relative flex items-center gap-2.5 rounded-full border border-haldi/60 bg-gradient-to-r from-kumkum via-[#FF5722] to-haldi p-2 pr-3.5 text-ink shadow-[0_0_22px_rgba(245,166,35,0.45)] backdrop-blur-md transition-shadow hover:shadow-[0_0_32px_rgba(245,166,35,0.7)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/35 text-paper shadow-inner">
            <Flame className="h-5 w-5 animate-bounce text-[#FFE600]" />
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink/85">
              Energy Battle
            </span>
            <span className="text-xs font-black text-ink drop-shadow-sm flex items-center gap-1">
              🔥 {leader.branch} #{1}
            </span>
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7FB069] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#7FB069] border border-ink" />
          </span>
        </button>
      </motion.div>

      {/* Pop-up Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md">
            {/* Click backdrop to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-haldi/40 bg-gradient-to-br from-ink-2 via-ink to-ink-3 p-5 sm:p-6 shadow-2xl z-10"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-1.5 text-paper/60 hover:bg-paper/10 hover:text-paper transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Glow backdrop accent */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-kumkum/20 blur-2xl"
              />

              {/* Header */}
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kumkum/20 text-kumkum">
                  <Flame className="h-5 w-5 animate-bounce text-[#FF8A7A]" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold tracking-wider uppercase text-haldi">
                    Department Energy Battle
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold text-[#A7D894]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7FB069] animate-pulse" />
                    Live Presence Online
                  </span>
                </div>
              </div>

              {/* Leader Headline */}
              <div className="mt-4 rounded-xl border border-haldi/25 bg-ink/70 p-4">
                <p className="font-display text-lg font-bold text-paper leading-snug">
                  🔥{' '}
                  <span className="text-haldi underline decoration-haldi/40 underline-offset-2">
                    {leader.name}
                  </span>{' '}
                  is leading the lobby with{' '}
                  <span className="tabular font-black text-kumkum bg-kumkum/15 px-2 py-0.5 rounded">
                    {leader.online} dancers online!
                  </span>
                </p>
                <p className="mt-1 text-xs text-paper/60">
                  Rally your branch classmates to jump on GarbaConnect and claim the #1 spot tonight.
                </p>

                {/* Rally & Copy Buttons */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={shareToWhatsApp}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-xs font-black text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] shadow"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Rally on WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-paper/20 bg-ink-2 px-3 text-xs font-semibold text-paper/80 hover:border-haldi hover:text-haldi transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[#7FB069]" /> : <Zap className="h-3.5 w-3.5 text-haldi" />}
                    {copied ? 'Link Copied!' : 'Copy Invite Link'}
                  </button>
                  {me && (
                    <span className="ml-auto text-[11px] text-paper/50 font-medium">
                      Your Branch: <strong className="text-haldi">{me.branch || 'CSE'} {me.college_year || '1st Year'}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Ranked Leaderboard */}
              <div className="mt-5">
                <div className="flex items-center justify-between pb-2">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-paper/70 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-haldi" />
                    Campus Department Rankings
                  </span>
                  <span className="text-[11px] text-paper/40">Real-time sync</span>
                </div>

                <div className="space-y-2 mt-1">
                  {departments.slice(0, 7).map((dept, index) => {
                    const percent = Math.round((dept.online / maxOnline) * 100);
                    const isMine =
                      me &&
                      (me.branch || 'CSE') === dept.branch &&
                      (me.college_year || '1st Year') === dept.year;

                    return (
                      <div
                        key={dept.name}
                        className={`rounded-xl p-3 transition-colors ${
                          isMine ? 'bg-haldi/10 border border-haldi/40' : 'bg-ink/60 border border-paper/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-display">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <span className="font-bold text-paper text-[13px]">
                              {dept.name}
                              {isMine && (
                                <span className="ml-1.5 rounded bg-haldi/20 px-1.5 py-0.5 text-[9px] font-bold text-haldi uppercase">
                                  Your Branch
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black tabular text-haldi text-xs">{dept.online} online</span>
                            <span className="text-paper/40 text-[11px]">({dept.total} dancers)</span>
                          </div>
                        </div>

                        {/* Animated progress bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-haldi to-kumkum transition-all duration-500"
                            style={{ width: `${Math.max(6, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
