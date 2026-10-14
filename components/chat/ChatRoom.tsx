'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, SendHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { ChatTimer } from './ChatTimer';
import { MessageBubble } from './MessageBubble';
import { RevealCard } from './RevealCard';
import { RevealPanel } from './RevealPanel';
import { RoomSidebar } from './RoomSidebar';
import { TimerExpiredOverlay } from './TimerExpiredOverlay';
import { ExtendModal } from '@/components/modals/ExtendModal';
import { RevealModal } from '@/components/modals/RevealModal';
import { Toast } from '@/components/ui/Toast';
import { useRoomRealtime } from '@/hooks/useSupabaseRealtime';
import { useChatTimer } from '@/hooks/useChatTimer';
import { useRazorpay } from '@/hooks/useRazorpay';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fireCelebration } from '@/lib/confetti';
import type { Message, RoomState } from '@/lib/types';

// Openers offered in an empty room; tapping one fills the composer without sending.
const ICEBREAKERS = ['Hi! 👋', 'Where are you on the floor?', 'What are you wearing tonight?'];

export function ChatRoom({ initial, billingEnabled, renderedAt }: { initial: RoomState; billingEnabled: boolean; renderedAt?: number }) {
  const { roomId, me, partner } = initial;
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [timerStartedAt, setTimerStartedAt] = useState(initial.timerStartedAt);
  const [extraSeconds, setExtraSeconds] = useState(initial.extraSeconds);
  // Both come from the server only: what my partner agreed to show me, and where each request stands.
  const [revealed, setRevealed] = useState(initial.revealed);
  const [reveal, setReveal] = useState(initial.reveal);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<'extend' | 'reveal' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLInputElement>(null);

  const { pay, busy, error: payError, clearError } = useRazorpay();

  const timer = useChatTimer(timerStartedAt, extraSeconds, renderedAt);
  // An unlocked profile or room extension gives unlimited chat time with no time limit!
  const isUnlocked = Boolean(revealed) || extraSeconds >= 86400;
  const isExpired = isUnlocked ? false : timer.expired;
  // Free Mode has no extension, so a closed chat stays readable instead of blurring behind an overlay.
  const closedFree = isExpired && !billingEnabled;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) return;
    const s = (await res.json()) as RoomState;
    setTimerStartedAt(s.timerStartedAt);
    setExtraSeconds(s.extraSeconds);
    setRevealed(s.revealed);
    setReveal(s.reveal);
  }, [roomId]);

  // Ask to see my partner's name and photo, or answer their request to see mine (ID-001).
  const revealAction = async (action: 'request' | 'allow' | 'decline') => {
    setRevealBusy(true);
    setRevealError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { reveal?: RoomState['reveal']; error?: string };
      if (res.ok && data.reveal) setReveal(data.reveal);
      else setRevealError(data.error ?? 'That did not go through. Try again.');
    } catch {
      setRevealError('That did not go through. Check your connection.');
    } finally {
      setRevealBusy(false);
    }
  };

  const upsert = useCallback((m: Message) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev.map((x) => (x.id === m.id ? m : x));
      // Realtime can beat the POST response; swap out our optimistic copy.
      const pendingIdx = prev.findIndex((x) => x.pending && x.sender_id === m.sender_id && x.text === m.text);
      if (pendingIdx >= 0) {
        const next = [...prev];
        next[pendingIdx] = m;
        return next;
      }
      return [...prev, m];
    });
  }, []);

  const { presentIds } = useRoomRealtime(roomId, me.clerk_id, {
    onMessage: upsert,
    onMessageUpdate: upsert,
    onTimerStart: setTimerStartedAt,
    onExtension: () => {
      void refresh();
      fireCelebration();
    },
    onRevealChange: () => void refresh(),
  });

  // Start the clock once both have spoken and both are in the room.
  const partnerHere = presentIds.includes(partner.clerk_id);
  const bothSpoke =
    messages.some((m) => m.sender_id === me.clerk_id && !m.pending) && messages.some((m) => m.sender_id === partner.clerk_id);
  const startRequested = useRef(false);
  const [startRetry, setStartRetry] = useState(0);
  useEffect(() => {
    if (timerStartedAt || startRequested.current || !partnerHere || !bothSpoke) return;
    startRequested.current = true;
    // If the server isn't ready yet (e.g. 409 while a message is still committing), retry shortly.
    const retryLater = () => {
      startRequested.current = false;
      window.setTimeout(() => setStartRetry((n) => n + 1), 2000);
    };
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => (d.timerStartedAt ? setTimerStartedAt(d.timerStartedAt) : retryLater()))
      .catch(retryLater);
  }, [timerStartedAt, partnerHere, bothSpoke, roomId, startRetry]);

  // Read receipts: mark partner's messages read while the tab is visible.
  const unread = messages.some((m) => m.sender_id === partner.clerk_id && !m.read_by?.includes(me.clerk_id));
  useEffect(() => {
    if (!unread) return;
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/read`, { method: 'POST' }).catch(() => {});
      setMessages((prev) => prev.map((m) => (m.sender_id === partner.clerk_id && !m.read_by.includes(me.clerk_id) ? { ...m, read_by: [...m.read_by, me.clerk_id] } : m)));
    };
    const t = window.setTimeout(mark, 400);
    document.addEventListener('visibilitychange', mark);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', mark);
    };
  }, [unread, roomId, partner.clerk_id, me.clerk_id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || isExpired) return;
    setText('');
    setSendError(null);
    const temp: Message = {
      id: `temp-${Date.now()}`,
      room_id: roomId,
      sender_id: me.clerk_id,
      text: body,
      created_at: new Date().toISOString(),
      read_by: [me.clerk_id],
      pending: true,
    };
    setMessages((prev) => [...prev, temp]);

    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setSendError(data.error ?? 'Message not sent');
      setText(body);
      if (res.status === 403) void refresh();
      return;
    }
    setMessages((prev) => {
      const confirmed = data.message as Message;
      if (prev.some((m) => m.id === confirmed.id)) return prev.filter((m) => m.id !== temp.id);
      return prev.map((m) => (m.id === temp.id ? confirmed : m));
    });
  };

  const startPayment = async (type: 'extend' | 'reveal') => {
    if (!billingEnabled) return;
    if (!(await pay(roomId, type))) return;
    setSheet(null);
    // Whatever was bought shows up only because the server now reports it (PAY-014).
    await refresh();
    fireCelebration();
    setToast('Unlimited chat & real identity unlocked! 🎉');
  };

  const openSheet = (which: 'extend' | 'reveal') => {
    clearError();
    setSheet(which);
  };

  const waitingFor = !timer.started
    ? !partnerHere
      ? `Waiting for ${partner.display_name.split('_')[0]} to open the chat`
      : !bothSpoke
        ? 'Clock starts when you both say hi'
        : 'Starting the clock…'
    : null;

  const firstName = partner.display_name.split('_')[0];
  const campus = [partner.branch, partner.college_year?.replace(' Year', ' Yr')].filter(Boolean).join(' · ');

  const fillComposer = (line: string) => {
    setText(line);
    composer.current?.focus();
  };

  return (
    // Phone: the chat fills the screen. Laptop: a centred chat panel beside a partner and room panel.
    <main className="relative flex h-[100dvh] flex-col overflow-hidden bg-ink lg:flex-row lg:justify-center lg:gap-6 lg:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-kumkum/[0.12] blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-haldi/[0.08] blur-3xl" />
      </div>

      <section className="relative flex min-h-0 flex-1 flex-col bg-ink lg:max-w-3xl lg:overflow-hidden lg:rounded-2xl lg:border lg:border-paper/10 lg:shadow-2xl lg:shadow-black/50">
        <header className="z-30 border-b border-paper/[0.07] bg-ink-2">
          <div className="flex items-center gap-2.5 px-2 py-2.5 sm:gap-3 sm:px-3">
            <Link href="/dashboard" aria-label="Back to dancers" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper/70 transition-colors hover:bg-paper/5 hover:text-paper">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <Avatar name={partner.display_name} gender={partner.gender} imageUrl={revealed?.image_url} size={44} online={partnerHere} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-display text-[15px] text-paper sm:text-base">{revealed?.real_name ? revealed.real_name : partner.display_name}</p>
                {revealed && <span className="shrink-0 rounded bg-haldi/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-haldi">Shared</span>}
                <GenderBadge gender={partner.gender} className="shrink-0" />
                {partner.vibe_tag && (
                  <span className="hidden shrink-0 rounded-full border border-haldi/25 bg-haldi/10 px-2 py-0.5 text-[10px] font-medium text-haldi sm:inline-flex lg:hidden">
                    {partner.vibe_tag}
                  </span>
                )}
              </div>
              {/* The side panel carries the campus and outfit details on laptop screens. */}
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-paper/55">
                <span className={cn('shrink-0 font-semibold', partnerHere && 'text-[#9CC587]')}>{partnerHere ? 'In the room' : 'Away'}</span>
                {revealed?.real_name && <span className="truncate">· {partner.display_name}</span>}
                {campus && <span className="shrink-0 lg:hidden">· {campus}</span>}
                {partner.outfit_color && (
                  <span className="truncate lg:hidden">
                    · 👘 <span className="italic">{partner.outfit_color}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <RevealCard identity={revealed} nickname={partner.display_name} gender={partner.gender} />
          {billingEnabled && (
            <RevealPanel
              reveal={reveal}
              partnerName={firstName}
              me={{ name: me.display_name, gender: me.gender }}
              canAsk={bothSpoke}
              busy={revealBusy}
              error={revealError}
              onRequest={() => void revealAction('request')}
              onAnswer={(allow) => void revealAction(allow ? 'allow' : 'decline')}
              onBuy={() => openSheet('reveal')}
            />
          )}
          <ChatTimer started={timer.started} remaining={timer.remaining} total={timer.total} fraction={timer.fraction} waitingFor={waitingFor} isUnlocked={isUnlocked} />
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className={cn('bandhani h-full overflow-y-auto px-3 py-5 transition-[filter] duration-500 sm:px-5', isExpired && billingEnabled && 'pointer-events-none blur-[3px]')}>
            <div className="mx-auto flex min-h-full max-w-2xl flex-col">
              {messages.length === 0 ? (
                <div className="m-auto w-full max-w-sm py-6 text-center">
                  <div className="mx-auto w-fit rounded-full bg-ink p-1.5 ring-1 ring-haldi/40">
                    <Avatar name={partner.display_name} gender={partner.gender} size={72} />
                  </div>
                  <p className="mt-5 font-display text-2xl text-haldi">Say hi to {firstName} 👋</p>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-paper/60">The 2-minute clock starts once you&apos;ve both sent a message.</p>
                  {!isExpired && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {ICEBREAKERS.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() => fillComposer(line)}
                          className="rounded-full border border-paper/15 bg-ink-2 px-3.5 py-2 text-sm text-paper/80 transition-colors hover:border-haldi hover:text-haldi"
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mx-auto mb-4 w-fit rounded-full bg-ink-2/90 px-3 py-1 text-center text-[11px] font-semibold text-paper/45">
                  A room for just the two of you
                </p>
              )}
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={m.sender_id === me.clerk_id}
                  partnerId={partner.clerk_id}
                  groupStart={messages[i - 1]?.sender_id !== m.sender_id}
                  groupEnd={messages[i + 1]?.sender_id !== m.sender_id}
                />
              ))}
              <div ref={bottom} />
            </div>
          </div>
          {billingEnabled && <TimerExpiredOverlay show={isExpired && sheet === null} onExtend={() => openSheet('extend')} />}
        </div>

        {closedFree ? (
          <div role="status" className="border-t border-paper/10 bg-ink-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg text-paper">Time&apos;s up</p>
                <p className="text-sm text-paper/70">Your 2-minute chat has ended. Your messages are still here to read.</p>
              </div>
              <Link href="/dashboard" className={buttonVariants({ variant: 'haldi', className: 'w-full shrink-0 sm:w-auto' })}>
                Back to dancers
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={send}
            className={cn(
              'border-t border-paper/10 bg-ink-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-[filter,opacity] sm:px-5',
              isExpired && 'opacity-50 blur-[1px]',
            )}
          >
            {sendError && (
              <p role="alert" className="mx-auto mb-2 max-w-2xl px-2 text-xs text-[#E58A7F]">
                {sendError}
              </p>
            )}
            <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-paper/15 bg-ink p-1.5 pl-5 transition-colors focus-within:border-haldi">
              <input
                ref={composer}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isExpired}
                maxLength={1000}
                aria-label="Message"
                autoComplete="off"
                enterKeyHint="send"
                placeholder={isExpired ? 'Chat closed' : `Message ${firstName}…`}
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-paper placeholder:text-paper/35 focus:outline-none disabled:cursor-not-allowed"
              />
              {text.length > 900 && <span className="tabular shrink-0 text-[11px] text-paper/45">{1000 - text.length}</span>}
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={isExpired || !text.trim()}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumkum text-paper transition-colors hover:bg-kumkum-dark disabled:bg-paper/10 disabled:text-paper/35"
              >
                <SendHorizontal className="h-[18px] w-[18px]" />
              </motion.button>
            </div>
          </form>
        )}
      </section>

      <RoomSidebar
        partner={partner}
        partnerHere={partnerHere}
        bothSpoke={bothSpoke}
        started={timer.started}
        expired={timer.expired}
        revealed={revealed}
        className="relative hidden lg:flex"
      />

      {billingEnabled && (
        <>
          <ExtendModal open={sheet === 'extend'} onClose={() => setSheet(null)} onPay={() => void startPayment('extend')} busy={busy} error={payError} />
          <RevealModal open={sheet === 'reveal'} partnerName={firstName} onClose={() => setSheet(null)} onPay={() => void startPayment('reveal')} busy={busy} error={payError} />
        </>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
