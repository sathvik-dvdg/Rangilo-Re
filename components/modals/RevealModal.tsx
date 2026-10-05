'use client';

import { BottomSheet, Perks, RazorpayButton } from './BottomSheet';

export function RevealModal({ open, onClose, onPay, busy, error, partnerName }: { open: boolean; onClose: () => void; onPay: () => void; busy: boolean; error: string | null; partnerName: string }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display text-2xl text-paper">Unlock Their Identity</h2>
      <p className="mt-1 text-sm text-paper/60">See who {partnerName} really is.</p>

      <div className="relative mt-5 overflow-hidden rounded-lg border border-haldi/40 bg-ink px-4 py-4">
        <div className="space-y-2 blur-[6px]" aria-hidden>
          <p className="font-semibold text-paper">Name: Aarohi Mehta</p>
          <p className="font-semibold text-paper">Gmail: aarohi.m••••@gmail.com</p>
        </div>
        <div className="shimmer absolute inset-0" />
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl text-haldi">₹29</span>
        <span className="text-sm text-paper/55">one-time</span>
      </div>
      <Perks items={['Real name', 'Gmail address', 'Permanent unlock']} />
      {error && <p className="mt-4 text-sm text-[#E58A7F]">{error}</p>}
      <RazorpayButton busy={busy} onClick={onPay} label="Pay ₹29 with Razorpay" />
    </BottomSheet>
  );
}
