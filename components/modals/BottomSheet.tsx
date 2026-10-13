'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  useFocusTrap(sheet, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" className="absolute inset-0 bg-ink/75" onClick={onClose} />
          <motion.div
            ref={sheet}
            tabIndex={-1}
            role="dialog"
            aria-modal
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="grain relative max-h-[90dvh] w-full outline-none max-w-lg overflow-y-auto rounded-t-2xl border border-b-0 border-haldi/25 bg-ink-2 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-paper/20" />
            <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-paper/60 hover:bg-paper/5 hover:text-paper">
              <X className="h-5 w-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RazorpayButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={busy}
        className="mt-6 flex h-[52px] w-full items-center justify-center gap-3 rounded-md bg-[#072654] font-bold text-white transition-colors hover:bg-[#0b3470] disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M9.6 3 7.4 11h4.8L8.4 21 18 8.6h-5.4L15 3H9.6Z" fill="#3395FF" />
        </svg>
        {busy ? 'Opening Razorpay…' : label}
      </button>
      <p className="mt-3 text-center text-xs text-paper/45">🔒 Secured by Razorpay • SSL encrypted</p>
    </>
  );
}

export function Perks({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-3 text-[15px] text-paper/85">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mehndi/30 text-xs text-[#C3CC94]">✓</span>
          {t}
        </li>
      ))}
    </ul>
  );
}
