'use client';

import Link from 'next/link';
import { BottomSheet, Perks, RazorpayButton } from './BottomSheet';

function Handshake() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
      <circle cx="17" cy="24" r="11" fill="none" stroke="#D8A23A" strokeWidth="2.5" />
      <circle cx="31" cy="24" r="11" fill="none" stroke="#F3EADB" strokeWidth="2.5" />
      <path d="M24 15.5a11 11 0 0 1 0 17a11 11 0 0 1 0-17Z" fill="#B23A2E" />
    </svg>
  );
}

/**
 * Paid Mode only. What is listed here must match what the server does with a
 * payment (lib/payments.ts, lib/consent.ts): the chat becomes unlimited at
 * once, and contact details are shared only if the partner accepts.
 */
export function ConnectModal({
  open,
  onClose,
  onPay,
  busy,
  error,
  partnerName,
}: {
  open: boolean;
  onClose: () => void;
  onPay: () => void;
  busy: boolean;
  error: string | null;
  partnerName: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Handshake />
      <h2 className="mt-3 font-display text-2xl text-paper">Connect with {partnerName}</h2>
      <p className="mt-1 text-sm text-paper/60">Unlimited chat right away, and a request to share contact details.</p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl text-haldi">₹29</span>
        <span className="text-sm text-paper/50">one-time</span>
      </div>
      <Perks
        items={[
          'This chat opens with no time limit as soon as you pay',
          `${partnerName} is asked to share contact details`,
          'If they accept, you each see the other’s real name and email',
        ]}
      />
      <p className="mt-4 rounded-lg border border-paper/10 bg-ink/60 px-3 py-2 text-xs leading-relaxed text-paper/70">
        Sharing is their choice, and nothing is shared unless they accept. If they do, your own real name and email are shared with them too. If
        they decline or don&apos;t answer within 24 hours, the chat stays open and there is no refund.
      </p>
      {error && <p className="mt-4 text-sm text-[#E58A7F]">{error}</p>}
      <p className="mt-5 text-xs text-paper/50">
        By paying you agree to our{' '}
        <Link href="/refund-policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-paper">
          Refund Policy
        </Link>
      </p>
      <RazorpayButton busy={busy} onClick={onPay} label="Pay ₹29 with Razorpay" />
    </BottomSheet>
  );
}
