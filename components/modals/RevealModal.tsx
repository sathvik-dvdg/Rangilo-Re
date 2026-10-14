'use client';

import { BottomSheet, Perks, RazorpayButton } from './BottomSheet';

/**
 * What ₹29 buys before the buyer pays (PAY-016). Opened only once the other
 * dancer has agreed; the server checks that again when the order is created
 * and when the payment arrives.
 */
export function RevealModal({
  open,
  partnerName,
  onClose,
  onPay,
  busy,
  error,
}: {
  open: boolean;
  partnerName: string;
  onClose: () => void;
  onPay: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="mt-1 font-display text-2xl text-paper">See who {partnerName} is</h2>
      <p className="mt-1 text-sm text-paper/60">{partnerName} agreed to share these with you.</p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl text-haldi">₹29</span>
        <span className="text-xs text-paper/50">one time</span>
      </div>
      <Perks items={['Their real name', 'Their profile photo, if they have one', 'Shown in this chat and in your dancer list']} />
      <p className="mt-4 text-xs leading-relaxed text-paper/50">
        Not included: their email or any other contact detail, and no extra chat time. If they change their mind before your payment goes through, nothing is shown and the
        payment is recorded for review.
      </p>
      {error && <p className="mt-4 text-sm text-[#E58A7F]">{error}</p>}
      <RazorpayButton busy={busy} onClick={onPay} label="Pay ₹29 with Razorpay" />
    </BottomSheet>
  );
}
