// SEC-002 / CORE-002: loadRoom is the authorization step in front of every room route. Its reads
// run in parallel; these tests pin that every refusal still happens and nothing leaks on refusal.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  upserts: [] as { table: string; row: Row }[],
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_alice' }), clerkClient: () => ({}) }));

// A small in-memory stand-in for the PostgREST builder: select/eq filters, maybeSingle, upsert.
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      const rows = () => (mocks.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const query = {
        select: () => query,
        eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), query),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
        upsert: (row: Row) => {
          mocks.upserts.push({ table, row });
          (mocks.tables[table] ??= []).push({ timer_started_at: null, ...row });
          return { select: () => ({ single: async () => ({ data: { timer_started_at: null, ...row }, error: null }) }) };
        },
      };
      return query;
    },
  }),
}));

import { HttpError, loadRoom } from '@/lib/server';

const ROOM = 'user_alice_user_bob';
const person = (clerk_id: string) => ({ clerk_id, display_name: `${clerk_id}_nick`, gender: 'female', last_seen: '2026-10-14T00:00:00Z' });

async function refusal(roomId: string) {
  const e = await loadRoom(roomId, 'user_alice').catch((err: unknown) => err);
  expect(e).toBeInstanceOf(HttpError);
  return (e as HttpError).status;
}

beforeEach(() => {
  mocks.tables = { users: [person('user_alice'), person('user_bob')], messages: [], rooms: [] };
  mocks.upserts = [];
});

describe('loadRoom', () => {
  it('refuses a room id that does not contain the caller, before any database read', async () => {
    mocks.tables = {};
    expect(await refusal('user_bob_user_carol')).toBe(403);
    expect(mocks.upserts).toEqual([]);
  });

  it('sends the caller back to onboarding when they have no profile', async () => {
    mocks.tables.users = [person('user_bob')];
    expect(await refusal(ROOM)).toBe(409);
    expect(mocks.upserts).toEqual([]);
  });

  it('reports a partner who has left', async () => {
    mocks.tables.users = [person('user_alice')];
    expect(await refusal(ROOM)).toBe(404);
    expect(mocks.upserts).toEqual([]);
  });

  it('refuses a room in which a third person has written', async () => {
    mocks.tables.messages = [
      { room_id: ROOM, sender_id: 'user_bob' },
      { room_id: ROOM, sender_id: 'user_carol' },
    ];
    expect(await refusal(ROOM)).toBe(403);
    expect(mocks.upserts).toEqual([]);
  });

  it('returns an existing room without writing', async () => {
    mocks.tables.rooms = [{ id: ROOM, participant_ids: ['user_alice', 'user_bob'], timer_started_at: '2026-10-14T10:00:00Z' }];
    const { room, me, partner, partnerId } = await loadRoom(ROOM, 'user_alice');
    expect(room).toMatchObject({ id: ROOM, timer_started_at: '2026-10-14T10:00:00Z' });
    expect([me.clerk_id, partner.clerk_id, partnerId]).toEqual(['user_alice', 'user_bob', 'user_bob']);
    expect(mocks.upserts).toEqual([]);
  });

  it('creates the room for exactly the two participants when it does not exist yet', async () => {
    const { room } = await loadRoom(ROOM, 'user_alice');
    expect(room).toMatchObject({ id: ROOM, timer_started_at: null });
    expect(mocks.upserts).toEqual([{ table: 'rooms', row: { id: ROOM, participant_ids: ['user_alice', 'user_bob'] } }]);
  });
});
