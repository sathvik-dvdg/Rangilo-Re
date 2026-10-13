'use client';

import { Button } from '@/components/ui/button';
import type { RoomConsent } from '@/lib/types';

/**
 * Where the request to share contact details stands, under the chat header.
 * The chat itself is already unlimited by the time any of this shows: the
 * answer decides only whether details are shared. The person who was asked
 * gets the only two buttons; the answer is sent to the server, which checks
 * it really is them (lib/consent.ts). Shows nothing once connected:
 * RevealCard takes over.
 */
export function ConsentBanner({
  consent,
  partnerName,
  busy,
  error,
  onAnswer,
}: {
  consent: RoomConsent;
  partnerName: string;
  busy: boolean;
  error: string | null;
  onAnswer: (action: 'accept' | 'decline') => void;
}) {
  const { status, role } = consent;
  if (!status || status === 'accepted') return null;
  // The person who said no, or never answered, needs no reminder of it.
  if (role === 'partner' && status !== 'pending') return null;

  if (role === 'partner') {
    return (
      <div role="group" aria-label="Request to share contact details" className="mx-4 mb-3 rounded-xl border border-haldi/40 bg-haldi/10 px-4 py-3">
        <p className="text-sm font-semibold text-paper">{partnerName} wants to share contact details.</p>
        <p className="mt-1 text-xs leading-relaxed text-paper/70">
          If you accept, they will see your real name and email and you will see theirs. If you decline, nothing is shared. Either way this chat
          stays open.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-[#E58A7F]">
            {error}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant="haldi" disabled={busy} onClick={() => onAnswer('accept')}>
            Accept
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onAnswer('decline')}>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  const message =
    status === 'pending'
      ? `Waiting for ${partnerName} to answer your request to share contact details. Your chat is open either way.`
      : status === 'declined'
        ? 'Partner chose not to share details. Your chat remains open.'
        : `${partnerName} didn't answer within 24 hours, so no details were shared. Your chat remains open.`;

  return (
    <p role="status" className="mx-4 mb-3 rounded-xl border border-paper/15 bg-ink/60 px-4 py-2.5 text-xs leading-relaxed text-paper/75">
      {message}
    </p>
  );
}
