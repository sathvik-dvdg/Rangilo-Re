import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LocalTime } from '@/components/admin/AdminBits';
import { AdminSetup, PageHeading } from '@/components/admin/AdminPanels';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  view_roster: 'Opened the dancer roster',
  remove_user: 'Removed a dancer',
  block_user: 'Removed and blocked a dancer',
  remove_room: 'Removed a room',
};

/** Counts and the recent audit log. No personal data on this page. */
export default async function AdminOverviewPage() {
  await requireAdmin();
  const db = supabaseAdmin();
  const recently = new Date(Date.now() - 5 * 60_000).toISOString();

  const [users, active, rooms, messages, log] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('users').select('id', { count: 'exact', head: true }).gte('last_seen', recently),
    db.from('rooms').select('id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
    db.from('admin_actions').select('id, admin_id, action, target, created_at').order('created_at', { ascending: false }).limit(15),
  ]);
  for (const result of [users, active, rooms, messages]) if (result.error) throw result.error;
  const logMissing = log.error?.code === 'PGRST205' || log.error?.code === '42P01';
  if (log.error && !logMissing) throw log.error;

  const tiles = [
    { label: 'Dancers', value: users.count },
    { label: 'Seen in the last 5 minutes', value: active.count },
    { label: 'Rooms', value: rooms.count },
    { label: 'Messages', value: messages.count },
  ];

  return (
    <>
      <PageHeading title="Overview" note="How the night is going, and what admins have done." />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-paper/10 bg-ink-2 px-4 py-4">
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-paper/50">{tile.label}</dt>
            <dd className="tabular mt-1.5 font-display text-3xl text-paper">{tile.value ?? '–'}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-paper">Recent admin activity</h3>
        {logMissing ? (
          <AdminSetup />
        ) : (log.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-paper/10 bg-ink-2 px-4 py-6 text-sm text-paper/55">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-paper/10 bg-ink-2">
            <table className="w-full text-left text-sm text-paper/80">
              <thead className="border-b border-paper/10 text-xs uppercase tracking-wider text-paper/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">What</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper/5">
                {(log.data ?? []).map((row) => (
                  <tr key={row.id as string}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-paper/60">
                      <LocalTime iso={row.created_at as string} />
                    </td>
                    <td className="px-4 py-2.5">{ACTION_LABELS[row.action as string] ?? (row.action as string)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-paper/55">{(row.target as string | null) ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-paper/55">{row.admin_id as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
