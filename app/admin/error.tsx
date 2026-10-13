'use client';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-kumkum/50 bg-kumkum/15 p-5 text-sm text-paper/85">
      <p className="font-display text-lg text-paper">That did not work</p>
      <p className="mt-2 leading-relaxed">
        The admin console could not finish that request. If you were removing something, it may have been partly carried out: check the server log for the cause before trying again.
      </p>
      <button type="button" onClick={reset} className="mt-4 rounded border border-paper/25 px-3 py-1.5 text-xs font-semibold text-paper transition-colors hover:border-haldi hover:text-haldi">
        Try again
      </button>
    </div>
  );
}
