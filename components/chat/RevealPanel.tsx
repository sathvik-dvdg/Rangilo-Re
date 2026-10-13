'use client';

import { Avatar } from '@/components/ui/Avatar';
import type { Gender, RevealState } from '@/lib/types';

/**
 * Asking to see the other dancer's real name and photo, and answering when they
 * ask to see yours (ID-001..003). Paid Mode only. The two halves are separate:
 * the top is what I asked of them, the bottom is what they asked of me.
 * `error` is the last failed action's message.
 */
export function RevealPanel({
  reveal,
  partnerName,
  me,
  canAsk,
  busy,
  error,
  onRequest,
  onAnswer,
  onBuy,
}: {
  reveal: RevealState;
  partnerName: string;
  me: { name: string; gender: Gender };
  /** Both dancers have written in this chat. */
  canAsk: boolean;
  busy: boolean;
  error: string | null;
  onRequest: () => void;
  onAnswer: (allow: boolean) => void;
  onBuy: () => void;
}) {
  const { outgoing, incoming, sharing } = reveal;
  const quiet = 'rounded-lg bg-paper/[0.05] px-3 py-2 text-xs text-paper/65';
  const small = 'shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50';

  const mine =
    outgoing === 'none' && canAsk ? (
      <div className={`${quiet} flex items-center justify-between gap-3`}>
        <span>Want to know who {partnerName} is? You can ask. They decide.</span>
        <button type="button" onClick={onRequest} disabled={busy} className={`${small} border-haldi/50 text-haldi hover:bg-haldi hover:text-ink`}>
          Ask to see name &amp; photo
        </button>
      </div>
    ) : outgoing === 'pending' ? (
      <p className={quiet}>You asked to see {partnerName}&apos;s name and photo. Waiting for their answer.</p>
    ) : outgoing === 'declined' ? (
      <p className={quiet}>{partnerName} chose not to share their name and photo.</p>
    ) : outgoing === 'allowed' ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-haldi/40 bg-haldi/10 px-3 py-2 text-xs text-paper/85">
        <span>
          <strong className="text-haldi">{partnerName} said yes.</strong> You can now see their real name and photo.
        </span>
        <button type="button" onClick={onBuy} disabled={busy} className={`${small} border-haldi bg-haldi text-ink hover:bg-haldi-dark hover:text-paper`}>
          See them ₹29
        </button>
      </div>
    ) : null;

  const theirs =
    incoming === 'pending' ? (
      <div role="group" aria-label="Request to see your name and photo" className="rounded-xl border border-kumkum/50 bg-kumkum/10 p-3.5">
        <p className="text-sm font-semibold text-paper">{partnerName} is asking to see your real name and photo.</p>
        <div className="mt-2.5 flex items-center gap-3 rounded-lg bg-ink/60 px-3 py-2">
          <Avatar name={me.name} gender={me.gender} imageUrl={sharing?.image_url} size={40} />
          <div className="min-w-0 text-xs">
            <p className="text-paper/50">If you allow, this is what they will see:</p>
            <p className="truncate text-sm font-semibold text-paper">{sharing?.real_name || 'No real name on your profile yet'}</p>
            {!sharing?.image_url && <p className="text-paper/50">No photo: you have not uploaded one.</p>}
          </div>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-paper/65">
          It is your choice, and saying no costs you nothing. If you allow, they still have to pay before they see anything. You can change your mind until they do; after
          that it cannot be taken back. Your email is never shared.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onAnswer(false)} disabled={busy} className={`${small} flex-1 border-paper/25 py-2 text-paper hover:border-paper/60`}>
            Decline
          </button>
          <button type="button" onClick={() => onAnswer(true)} disabled={busy} className={`${small} flex-1 border-haldi bg-haldi py-2 text-ink hover:bg-haldi-dark hover:text-paper`}>
            Allow
          </button>
        </div>
      </div>
    ) : incoming === 'allowed' ? (
      <div className={`${quiet} flex items-center justify-between gap-3`}>
        <span>You agreed to share your name and photo with {partnerName}. They have not seen them yet.</span>
        <button type="button" onClick={() => onAnswer(false)} disabled={busy} className={`${small} border-paper/25 text-paper hover:border-paper/60`}>
          Change to no
        </button>
      </div>
    ) : incoming === 'revealed' ? (
      <p className={quiet}>{partnerName} can see your real name and photo, because you agreed to share them.</p>
    ) : null;

  if (!mine && !theirs && !error) return null;
  return (
    <div className="space-y-2 px-3 pb-3 sm:px-4">
      {theirs}
      {mine}
      {error && (
        <p role="alert" className="px-1 text-xs text-[#E58A7F]">
          {error}
        </p>
      )}
    </div>
  );
}
