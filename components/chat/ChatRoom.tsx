'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, SendHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { GenderBadge } from '@/components/ui/GenderBadge';
import { ConsentBanner } from './ConsentBanner';
import { MessageBubble } from './MessageBubble';
import { RevealCard } from './RevealCard';
import { RoomSidebar } from './RoomSidebar';
import { ConnectModal } from '@/components/modals/ConnectModal';
import { Toast } from '@/components/ui/Toast';
import { useRoomRealtime } from '@/hooks/useSupabaseRealtime';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fireCelebration } from '@/lib/confetti';
import type { Message, RoomState } from '@/lib/types';

// Openers offered in an empty room; tapping one fills the composer without sending.
const ICEBREAKERS = ['Hi! 👋', 'Where are you on the floor?', 'What are you wearing tonight?'];

export function ChatRoom({ initial, billingEnabled }: { initial: RoomState; billingEnabled: boolean }) {
  const { roomId, me, partner } = initial;
  const [messages, setMessages] = useState<Message[]>(initial.messages);

  // Connection state always comes from the server (initial render, then refresh); nothing is kept in browser storage.
  const [unlimited, setUnlimited] = useState(initial.unlimited);
  const [consent, setConsent] = useState(initial.consent);
  // Contact-flow reveal (name + email): from contact_reveals row.
  const [revealed, setRevealed] = useState(initial.revealed);
  // A name-and-photo reveal granted before only paying users could request (DEC-013).
  const [sharedWithMe, setSharedWithMe] = useState(initial.sharedWithMe);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<'connect' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLInputElement>(null);

  // Opening the chat clears this partner's unread badge (NOTIF-001), once the tab is actually on screen.
  const clearUnread = useAppStore((s) => s.clearUnread);
  const partnerUnread = useAppStore((s) => s.unread[partner.clerk_id] ?? 0);
  useEffect(() => {
    if (!partnerUnread) return;
    const clear = () => {
      if (document.visibilityState === 'visible') clearUnread(partner.clerk_id);
    };
    clear();
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, [partnerUnread, partner.clerk_id, clearUnread]);
  const { pay, busy, error: payError, clearError } = useRazorpay();

  // The connect offer is Paid Mode only, and only for a room nobody has paid for yet. Chats have no time limit (DEC-014).
  const canOffer = billingEnabled && consent.canRequest && !unlimited;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) return;
    const s = (await res.json()) as RoomState;
    setUnlimited(s.unlimited);
    setConsent(s.consent);
    setRevealed(s.revealed);
    setSharedWithMe(s.sharedWithMe);
  }, [roomId]);

  // Celebrate the moment contact details are exchanged (connect flow), on both screens.
  const wasConnected = useRef(initial.revealed !== null);
  useEffect(() => {
    if (revealed && !wasConnected.current) fireCelebration();
    wasConnected.current = revealed !== null;
  }, [revealed]);

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
    // These events say only that something changed; actual data comes from the server on refresh.
    onConsentChange: () => void refresh(),
    onUnlimited: () => void refresh(),
    onRevealChange: () => void refresh(),
  });

  const partnerHere = presentIds.includes(partner.clerk_id);

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
    if (!body) return;
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

  const startPayment = async () => {
    if (!billingEnabled) return;
    if (!(await pay(roomId))) return;
    setSheet(null);
    // Whatever was bought shows up only because the server now reports it (PAY-014).
    await refresh();
    fireCelebration();
    setToast('Chat unlocked. Request sent.');
  };

  // Paying is the only way to ask the partner for anything: no free request exists (DEC-013).
  const openSheet = () => {
    clearError();
    setSheet('connect');
  };

  const answer = async (action: 'accept' | 'decline') => {
    setAnswering(true);
    setAnswerError(null);
    const failMsg = 'Could not send your answer. Try again.';
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) setAnswerError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? failMsg);
    } catch {
      setAnswerError(failMsg);
    }
    await refresh();
    setAnswering(false);
  };

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
                {revealed && (
                  <span className="shrink-0 rounded bg-haldi/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-haldi">
                    {revealed.email ? 'Connected' : 'Shared'}
                  </span>
                )}
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
            {canOffer && (
              <Button variant="haldi" size="sm" className="shrink-0" onClick={openSheet}>
                Connect ₹29
              </Button>
            )}
          </div>
          {/* The partner's real name + email once they agreed; otherwise a name-and-photo reveal granted earlier. */}
          <RevealCard identity={revealed ?? sharedWithMe} nickname={partner.display_name} gender={partner.gender} />
          {/* Consent banner: shown to the partner when they have a pending connect request. */}
          <ConsentBanner consent={consent} partnerName={firstName} busy={answering} error={answerError} onAnswer={answer} />
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="bandhani h-full overflow-y-auto px-3 py-5 sm:px-5">
            <div className="mx-auto flex min-h-full max-w-2xl flex-col">
              {messages.length === 0 ? (
                <div className="m-auto w-full max-w-sm py-6 text-center">
                  <div className="mx-auto w-fit rounded-full bg-ink p-1.5 ring-1 ring-haldi/40">
                    <Avatar name={partner.display_name} gender={partner.gender} size={72} />
                  </div>
                  <p className="mt-5 font-display text-2xl text-haldi">Say hi to {firstName} 👋</p>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-paper/60">Pick an opener or write your own. Only the two of you can see this chat.</p>
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
        </div>

          <form onSubmit={send} className="border-t border-paper/10 bg-ink-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
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
                maxLength={1000}
                aria-label="Message"
                autoComplete="off"
                enterKeyHint="send"
                placeholder={`Message ${firstName}…`}
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-paper placeholder:text-paper/35 focus:outline-none disabled:cursor-not-allowed"
              />
              {text.length > 900 && <span className="tabular shrink-0 text-[11px] text-paper/45">{1000 - text.length}</span>}
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={!text.trim()}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumkum text-paper transition-colors hover:bg-kumkum-dark disabled:bg-paper/10 disabled:text-paper/35"
              >
                <SendHorizontal className="h-[18px] w-[18px]" />
              </motion.button>
            </div>
          </form>
      </section>

      <RoomSidebar partner={partner} partnerHere={partnerHere} className="relative hidden lg:flex" />

      {billingEnabled && (
        <ConnectModal open={sheet === 'connect'} onClose={() => setSheet(null)} onPay={() => void startPayment()} busy={busy} error={payError} partnerName={firstName} />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
