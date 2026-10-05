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
import { TimerExpiredOverlay } from './TimerExpiredOverlay';
import { RevealModal } from '@/components/modals/RevealModal';
import { ExtendModal } from '@/components/modals/ExtendModal';
import { Toast } from '@/components/ui/Toast';
import { useRoomRealtime } from '@/hooks/useSupabaseRealtime';
import { useChatTimer } from '@/hooks/useChatTimer';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { Message, RoomState } from '@/lib/types';

export function ChatRoom({ initial }: { initial: RoomState }) {
  const { roomId, me, partner } = initial;
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [timerStartedAt, setTimerStartedAt] = useState(initial.timerStartedAt);
  const [extraSeconds, setExtraSeconds] = useState(initial.extraSeconds);
  const storedReveal = useAppStore((s) => s.revealed[partner.clerk_id]);
  const setRevealedInStore = useAppStore((s) => s.setRevealed);
  const revealed = storedReveal ?? initial.revealed;

  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<'reveal' | 'extend' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const { pay, busy, error: payError, clearError } = useRazorpay();

  const timer = useChatTimer(timerStartedAt, extraSeconds);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) return;
    const s = (await res.json()) as RoomState;
    setTimerStartedAt(s.timerStartedAt);
    setExtraSeconds(s.extraSeconds);
    if (s.revealed) setRevealedInStore(partner.clerk_id, s.revealed);
  }, [roomId, partner.clerk_id, setRevealedInStore]);

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
    onExtension: () => void refresh(),
  });

  // Start the clock once both have spoken and both are in the room.
  const partnerHere = presentIds.includes(partner.clerk_id);
  const bothSpoke =
    messages.some((m) => m.sender_id === me.clerk_id && !m.pending) && messages.some((m) => m.sender_id === partner.clerk_id);
  const startRequested = useRef(false);
  useEffect(() => {
    if (timerStartedAt || startRequested.current || !partnerHere || !bothSpoke) return;
    startRequested.current = true;
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => d.timerStartedAt && setTimerStartedAt(d.timerStartedAt))
      .catch(() => (startRequested.current = false));
  }, [timerStartedAt, partnerHere, bothSpoke, roomId]);

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
    if (!body || timer.expired) return;
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

  const startPayment = async (type: 'reveal' | 'extend') => {
    const result = await pay(type, { targetUserId: partner.clerk_id, roomId });
    if (!result) return;
    setSheet(null);
    if (result.type === 'reveal') {
      setRevealedInStore(partner.clerk_id, result.identity);
      setToast('Identity unlocked');
    } else {
      await refresh();
      setToast('+2 minutes added');
    }
  };

  const openSheet = (s: 'reveal' | 'extend') => {
    clearError();
    setSheet(s);
  };

  const waitingFor = !timer.started
    ? !partnerHere
      ? `Waiting for ${partner.display_name.split('_')[0]} to open the chat`
      : !bothSpoke
        ? 'Clock starts when you both say hi'
        : 'Starting the clock…'
    : null;

  return (
    <main className="flex h-[100dvh] flex-col bg-ink">
      <header className="z-30 bg-ink-2">
        <div className="flex items-center gap-3 px-2 py-3 sm:px-4">
          <Link href="/dashboard" aria-label="Back to dancers" className="rounded-full p-2 text-paper/70 hover:bg-paper/5 hover:text-paper">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <Avatar name={partner.display_name} size={40} online={partnerHere} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] text-paper">{partner.display_name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <GenderBadge gender={partner.gender} />
              <span className="text-xs text-paper/45">{partnerHere ? 'in the room' : 'away'}</span>
            </div>
          </div>
          {!revealed && (
            <button onClick={() => openSheet('reveal')} className="shrink-0 rounded-md bg-haldi px-3 py-2 text-xs font-extrabold text-ink transition-colors hover:bg-haldi-dark hover:text-paper sm:text-sm">
              Reveal Identity ₹29 →
            </button>
          )}
        </div>
        <RevealCard identity={revealed} />
        <ChatTimer started={timer.started} remaining={timer.remaining} fraction={timer.fraction} waitingFor={waitingFor} />
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className={cn('bandhani h-full overflow-y-auto px-4 py-5 transition-[filter] duration-500', timer.expired && 'pointer-events-none blur-[3px]')}>
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {messages.length === 0 && (
              <div className="mx-auto my-10 max-w-xs rounded-lg stitch bg-ink-2 p-5 text-center">
                <p className="font-display text-lg text-haldi">Say hi 👋</p>
                <p className="mt-1 text-sm text-paper/60">The 2-minute clock starts once you&apos;ve both sent a message.</p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} mine={m.sender_id === me.clerk_id} partnerId={partner.clerk_id} />
            ))}
            <div ref={bottom} />
          </div>
        </div>
        <TimerExpiredOverlay show={timer.expired && sheet === null} onExtend={() => openSheet('extend')} />
      </div>

      <form onSubmit={send} className={cn('border-t border-paper/10 bg-ink-2 px-3 py-3 transition-[filter,opacity]', timer.expired && 'opacity-50 blur-[1px]')}>
        {sendError && <p className="mx-auto mb-2 max-w-2xl px-2 text-xs text-[#E58A7F]">{sendError}</p>}
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={timer.expired}
            maxLength={1000}
            placeholder={timer.expired ? 'Chat closed' : 'Message'}
            className="h-12 flex-1 rounded-full border border-paper/15 bg-ink px-5 text-[15px] text-paper placeholder:text-paper/35 focus:border-haldi focus:outline-none disabled:cursor-not-allowed"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={timer.expired || !text.trim()}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-kumkum text-paper transition-colors hover:bg-kumkum-dark disabled:opacity-40"
          >
            <SendHorizontal className="h-5 w-5" />
          </motion.button>
        </div>
      </form>

      <RevealModal open={sheet === 'reveal'} onClose={() => setSheet(null)} onPay={() => startPayment('reveal')} busy={busy} error={payError} partnerName={partner.display_name} />
      <ExtendModal open={sheet === 'extend'} onClose={() => setSheet(null)} onPay={() => startPayment('extend')} busy={busy} error={payError} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
