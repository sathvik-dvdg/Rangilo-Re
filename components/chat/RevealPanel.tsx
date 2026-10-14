'use client';

import type { Gender, RevealState } from '@/lib/types';

/**
 * Pay-to-reveal banner (DEC-014).
 * Allows users to directly reveal the other dancer's real name and profile
 * by paying a small fee (₹29), without requiring a prior consent handshake.
 */
export function RevealPanel({
  partnerName,
  isRevealed = false,
  busy = false,
  error = null,
  onBuy,
  reveal,
}: {
  partnerName: string;
  isRevealed?: boolean;
  busy?: boolean;
  error?: string | null;
  onBuy: () => void;
  reveal?: RevealState;
  me?: { name: string; gender: Gender };
  canAsk?: boolean;
  onRequest?: () => void;
  onAnswer?: (allow: boolean) => void;
}) {
  if (isRevealed || reveal?.outgoing === 'revealed') return null;

  return (
    <div className="px-3 pb-3 sm:px-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-haldi/35 bg-gradient-to-r from-haldi/10 via-ink-2/95 to-kumkum/10 p-3 text-xs text-paper/90 shadow-sm">
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-xs leading-relaxed text-paper/85">
            Want to know who it really is?
          </p>
        </div>
        <button
          type="button"
          onClick={onBuy}
          disabled={busy}
          className="shrink-0 rounded-lg border border-haldi bg-haldi px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm transition-all hover:bg-haldi-dark hover:text-paper active:scale-95 disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'Reveal'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 px-1 text-xs text-[#E58A7F]">
          {error}
        </p>
      )}
    </div>
  );
}
