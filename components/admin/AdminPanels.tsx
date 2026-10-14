/** Fixed texts only: the code comes from the URL, so nothing from it is ever shown. */
const NOTICES: Record<string, { text: string; tone: 'ok' | 'warn' }> = {
  removed: { text: 'Dancer removed. They can sign in and join again unless you block them.', tone: 'ok' },
  blocked: { text: 'Dancer removed and blocked from signing in. Unblock from the Clerk dashboard if needed.', tone: 'ok' },
  'room-removed': { text: 'Room removed, with its messages.', tone: 'ok' },
  self: { text: 'You cannot remove your own account from here.', tone: 'warn' },
  invalid: { text: 'That request was not valid, so nothing was changed.', tone: 'warn' },
};

export function AdminNotice({ code }: { code?: string }) {
  const notice = code ? NOTICES[code] : undefined;
  if (!notice) return null;
  return (
    <p
      role="status"
      className={
        notice.tone === 'ok'
          ? 'rounded-lg border border-[#7FB069]/40 bg-[#7FB069]/10 px-4 py-2.5 text-sm text-paper/90'
          : 'rounded-lg border border-kumkum/50 bg-kumkum/15 px-4 py-2.5 text-sm text-paper/90'
      }
    >
      {notice.text}
    </p>
  );
}

/** Shown instead of admin data while the audit log table does not exist. */
export function AdminSetup() {
  return (
    <div className="rounded-xl border border-haldi/40 bg-haldi/10 p-5 text-sm text-paper/85">
      <p className="font-display text-lg text-haldi">One setup step left</p>
      <p className="mt-2 leading-relaxed">
        The admin console records what admins do, and that log table does not exist yet. Open Supabase → SQL Editor, paste{' '}
        <code className="rounded bg-ink px-1.5 py-0.5 text-haldi">supabase/migrations/0007_admin_actions.sql</code> and run it, then reload this page.
      </p>
    </div>
  );
}

export function PageHeading({ title, note, count }: { title: string; note: string; count?: number | null }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl text-haldi">{title}</h2>
        <p className="mt-1 text-sm text-paper/60">{note}</p>
      </div>
      {typeof count === 'number' && <span className="tabular rounded-full bg-haldi/15 px-3 py-1 text-xs font-bold text-haldi">Total: {count}</span>}
    </div>
  );
}
