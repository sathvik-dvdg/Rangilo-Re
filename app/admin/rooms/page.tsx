import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { removeRoom } from '../actions';
import { ConfirmSubmit, LocalTime } from '@/components/admin/AdminBits';
import { AdminNotice, PageHeading } from '@/components/admin/AdminPanels';

export const dynamic = 'force-dynamic';

const LIMIT = 200;

type RoomRow = { id: string; participant_ids: string[]; timer_started_at: string | null; created_at: string; messages: { count: number }[] };

/** Who is talking to whom, and how much. Message text is deliberately not loaded here. */
export default async function AdminRoomsPage({ searchParams }: { searchParams: { notice?: string } }) {
  await requireAdmin();
  const db = supabaseAdmin();

  const { data, count, error } = await db
    .from('rooms')
    .select('id, participant_ids, timer_started_at, created_at, messages(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  const rooms = (data ?? []) as unknown as RoomRow[];

  const ids = Array.from(new Set(rooms.flatMap((r) => r.participant_ids)));
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const people = await db.from('users').select('clerk_id, display_name').in('clerk_id', ids);
    if (people.error) throw people.error;
    for (const p of people.data ?? []) names.set(p.clerk_id as string, p.display_name as string);
  }
  const label = (id: string) => names.get(id) ?? 'Removed dancer';

  return (
    <>
      <PageHeading title="Rooms" note="Each room is one private chat between two dancers. Message text is not shown here." count={count} />
      <AdminNotice code={searchParams.notice} />

      <div className="overflow-x-auto rounded-xl border border-paper/10 bg-ink-2">
        <table className="w-full text-left text-sm text-paper/80">
          <thead className="border-b border-paper/10 text-xs uppercase tracking-wider text-paper/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Dancers</th>
              <th className="px-4 py-3 font-semibold">Messages</th>
              <th className="px-4 py-3 font-semibold">Clock started</th>
              <th className="px-4 py-3 font-semibold">Opened</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper/5">
            {rooms.map((room) => {
              const pair = room.participant_ids.map(label).join(' and ');
              return (
                <tr key={room.id} className="hover:bg-paper/[0.02]">
                  <td className="px-4 py-3">
                    {room.participant_ids.map((id, i) => (
                      <span key={id}>
                        {i > 0 && <span className="px-1.5 text-paper/35">↔</span>}
                        <span className={names.has(id) ? 'font-semibold text-haldi' : 'italic text-paper/45'}>{label(id)}</span>
                      </span>
                    ))}
                  </td>
                  <td className="tabular px-4 py-3">{room.messages?.[0]?.count ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-paper/50">
                    <LocalTime iso={room.timer_started_at} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-paper/50">
                    <LocalTime iso={room.created_at} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={removeRoom}>
                      <input type="hidden" name="roomId" value={room.id} />
                      <ConfirmSubmit
                        message={`Remove the chat between ${pair}? Its messages are deleted for both of them. They will be able to start a new chat.`}
                        className="border-kumkum/60 bg-kumkum/15 text-[#F0A69C] hover:bg-kumkum hover:text-paper"
                      >
                        Remove room
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rooms.length === 0 && <p className="px-4 py-8 text-center text-sm text-paper/55">No rooms yet.</p>}
      </div>
      {typeof count === 'number' && count > rooms.length && (
        <p className="text-xs text-paper/50">
          Showing the {rooms.length} newest of {count}.
        </p>
      )}
    </>
  );
}
