import { AdminSetupError, recordAdminAction, requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { removeUser } from '../actions';
import { ConfirmSubmit, LocalTime } from '@/components/admin/AdminBits';
import { AdminNotice, AdminSetup, PageHeading } from '@/components/admin/AdminPanels';

export const dynamic = 'force-dynamic';

const LIMIT = 200;
const COLUMNS = 'clerk_id, display_name, real_name, email, gender, last_seen';
const CAMPUS_COLUMNS = `${COLUMNS}, branch, college_year, outfit_color`;

type Row = {
  clerk_id: string;
  display_name: string;
  real_name: string | null;
  email: string | null;
  gender: string;
  last_seen: string;
  branch?: string | null;
  college_year?: string | null;
  outfit_color?: string | null;
};

/** The search text goes into a filter expression, so keep only characters that cannot change its meaning. */
const cleanSearch = (q: unknown) => (typeof q === 'string' ? q.replace(/[^A-Za-z0-9 _@.+-]/g, '').trim().slice(0, 60) : '');

/**
 * The only place real names and emails are shown to anyone but their owner
 * (PRIV-001 admin exception). Opening it is recorded first, and nothing is
 * shown if that record cannot be written.
 */
export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string; notice?: string } }) {
  const admin = await requireAdmin();
  try {
    await recordAdminAction(admin.id, 'view_roster');
  } catch (e) {
    if (e instanceof AdminSetupError) return <AdminSetup />;
    throw e;
  }

  const q = cleanSearch(searchParams.q);
  const query = (columns: string) => {
    let builder = supabaseAdmin().from('users').select(columns, { count: 'exact' }).order('last_seen', { ascending: false }).limit(LIMIT);
    if (q) builder = builder.or(`display_name.ilike.%${q}%,real_name.ilike.%${q}%,email.ilike.%${q}%`);
    return builder;
  };
  let result = await query(CAMPUS_COLUMNS);
  // The campus columns come from migrations 0004 and 0005; without them, show the rest.
  if (result.error) result = await query(COLUMNS);
  if (result.error) throw result.error;
  const users = (result.data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeading title="Dancers" note="Confidential. Real names and emails are shown to admins only, and each visit to this page is recorded." count={result.count} />
      <AdminNotice code={searchParams.notice} />

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search dancers"
          placeholder="Search nickname, real name or email"
          className="h-10 w-full max-w-sm rounded-lg border border-paper/15 bg-ink-2 px-3 text-sm text-paper placeholder:text-paper/35 focus:border-haldi focus:outline-none"
        />
        <button type="submit" className="h-10 rounded-lg border border-paper/20 px-4 text-sm font-semibold text-paper transition-colors hover:border-haldi hover:text-haldi">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-paper/10 bg-ink-2">
        <table className="w-full text-left text-sm text-paper/80">
          <thead className="border-b border-paper/10 text-xs uppercase tracking-wider text-paper/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Nickname</th>
              <th className="px-4 py-3 font-semibold">Real name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Branch · Year</th>
              <th className="px-4 py-3 font-semibold">Wearing</th>
              <th className="px-4 py-3 font-semibold">Last seen</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper/5">
            {users.map((u) => (
              <tr key={u.clerk_id} className="hover:bg-paper/[0.02]">
                <td className="px-4 py-3 font-semibold text-haldi">{u.display_name}</td>
                <td className="px-4 py-3 text-paper">{u.real_name || '—'}</td>
                <td className="px-4 py-3 text-paper/65">{u.email || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{[u.branch, u.college_year].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-4 py-3 italic text-paper/65">{u.outfit_color || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-paper/50">
                  <LocalTime iso={u.last_seen} />
                </td>
                <td className="px-4 py-3">
                  {u.clerk_id === admin.id ? (
                    <span className="text-xs text-paper/40">This is you</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <form action={removeUser}>
                        <input type="hidden" name="userId" value={u.clerk_id} />
                        <ConfirmSubmit
                          message={`Remove ${u.display_name}? This deletes their profile and every chat they are in. They will be able to join again.`}
                          className="border-paper/25 text-paper hover:border-haldi hover:text-haldi"
                        >
                          Remove
                        </ConfirmSubmit>
                      </form>
                      <form action={removeUser}>
                        <input type="hidden" name="userId" value={u.clerk_id} />
                        <input type="hidden" name="block" value="1" />
                        <ConfirmSubmit
                          message={`Remove AND BLOCK ${u.display_name}? This deletes their profile and chats and stops them signing in again. Unblocking is done from the Clerk dashboard.`}
                          className="border-kumkum/60 bg-kumkum/15 text-[#F0A69C] hover:bg-kumkum hover:text-paper"
                        >
                          Remove &amp; block
                        </ConfirmSubmit>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="px-4 py-8 text-center text-sm text-paper/55">{q ? 'No dancers match that search.' : 'No dancers yet.'}</p>}
      </div>
      {typeof result.count === 'number' && result.count > users.length && (
        <p className="text-xs text-paper/50">
          Showing the {users.length} most recently seen of {result.count}. Search to narrow the list.
        </p>
      )}
    </>
  );
}
