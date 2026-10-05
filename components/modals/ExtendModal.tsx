'use client';

import { BottomSheet, Perks, RazorpayButton } from './BottomSheet';

function Hourglass() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14 animate-hourglass" aria-hidden>
      <path d="M12 6h24M12 42h24" stroke="#D8A23A" strokeWidth="3" strokeLinecap="round" />
      <path d="M15 6c0 10 18 12 18 18S15 32 15 42h18c0-10-18-12-18-18S33 14 33 6Z" fill="none" stroke="#F3EADB" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 38c2-4 10-4 12 0Z" fill="#B23A2E" />
      <path d="M19 12h10c-1 3-4 5-5 6-1-1-4-3-5-6Z" fill="#B23A2E" />
    </svg>
  );
}

export function ExtendModal({ open, onClose, onPay, busy, error }: { open: boolean; onClose: () => void; onPay: () => void; busy: boolean; error: string | null }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Hourglass />
      <h2 className="mt-3 font-display text-2xl text-paper">Keep the Connection Going</h2>
      <p className="mt-1 text-sm text-paper/60">Get 2 more minutes of private chat.</p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl text-haldi">₹29</span>
      </div>
      <Perks items={['+2 min added instantly', 'Chat history preserved']} />
      {error && <p className="mt-4 text-sm text-[#E58A7F]">{error}</p>}
      <RazorpayButton busy={busy} onClick={onPay} label="Pay ₹29 with Razorpay" />
    </BottomSheet>
  );
}
