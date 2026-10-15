// SAFE-001 blocking. Route-level tests: Clerk and the database are mocked (tests/helpers/fakeDb.ts,
// which copies the users foreign keys of migration 0010); the routes, lib/blocks.ts and
// lib/server.ts are the real ones. Nothing here shows the SQL itself works: run 0010 in Postgres.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './helpers/fakeDb';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  supabaseAdmin: vi.fn(),
  notifyNewMessage: vi.fn(async () => {}),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('@/lib/push', () => ({ notifyNewMessage: mocks.notifyNewMessage }));

import { POST as block } from '@/app/api/blocks/route';
import { DELETE as unblock } from '@/app/api/blocks/[userId]/route';
import { GET as listUsers } from '@/app/api/users/route';
import { GET as getRoom } from '@/app/api/rooms/[roomId]/route';
import { POST as sendMessage } from '@/app/api/rooms/[roomId]/messages/route';

const ALICE = 'user_alice';
const BOB = 'user_bob';
const CAROL = 'user_carol';
const ROOM = 'user_alice_user_bob';

let db: FakeDb;
const as = (userId: string | null) => {
  mocks.userId = userId;
};
const post = (body: unknown) => new Request('http://localhost/', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const blockUser = (blockedUserId: unknown) => block(post({ blockedUserId }));
const unblockUser = (userId: string) => unblock(new Request('http://localhost/', { method: 'DELETE' }), { params: { userId } });
const dancerIds = async () => ((await (await listUsers()).json()) as { users: { clerk_id: string }[] }).users.map((u) => u.clerk_id).sort();
const send = () => sendMessage(post({ text: 'hello' }), { params: { roomId: ROOM } });
const openRoom = () => getRoom(new Request('http://localhost/'), { params: { roomId: ROOM } });
const blocks = () => db.rowsOf('blocks');

beforeEach(() => {
  db = createFakeDb();
  mocks.supabaseAdmin.mockImplementation(() => db.client);
  for (const [clerk_id, display_name] of [
    [ALICE, 'DiyaDancer_Avni_4821'],
    [BOB, 'GarbaKing_Arjun_7302'],
    [CAROL, 'Dandiya_Carol_1111'],
  ]) {
    db.seed('users', { clerk_id, display_name, gender: 'female', last_seen: new Date().toISOString() });
  }
  as(ALICE);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('POST /api/blocks', () => {
  it('records the block for the signed-in user and answers 201', async () => {
    const res = await blockUser(BOB);
    expect(res.status).toBe(201);
    expect(blocks()).toEqual([expect.objectContaining({ blocker_id: ALICE, blocked_id: BOB })]);
  });

  it('blocking twice keeps one row and still answers 201', async () => {
    expect((await blockUser(BOB)).status).toBe(201);
    expect((await blockUser(BOB)).status).toBe(201);
    expect(blocks()).toHaveLength(1);
  });

  it('needs a session', async () => {
    as(null);
    expect((await blockUser(BOB)).status).toBe(401);
    expect(blocks()).toEqual([]);
  });

  it.each([
    ['no body', undefined],
    ['a non-string id', 42],
    ['a malformed id', 'bob; drop table blocks'],
    ['a uuid instead of a Clerk id', '0f8fad5b-d9cb-469f-a165-70867728950e'],
  ])('refuses %s with 400 and writes nothing', async (_name, id) => {
    const res = id === undefined ? await block(post('')) : await blockUser(id);
    expect(res.status).toBe(400);
    expect(blocks()).toEqual([]);
  });

  it('refuses to block yourself', async () => {
    const res = await blockUser(ALICE);
    expect(res.status).toBe(400);
    expect(blocks()).toEqual([]);
  });

  it('answers 404 for a dancer who does not exist', async () => {
    expect((await blockUser('user_nobody')).status).toBe(404);
    expect(blocks()).toEqual([]);
  });

  it('allows 10 a minute per dancer, then 429', async () => {
    for (let i = 0; i < 10; i++) expect((await blockUser(BOB)).status).toBe(201);
    expect((await blockUser(CAROL)).status).toBe(429);
  });
});

describe('DELETE /api/blocks/[userId]', () => {
  it('removes the caller’s own block and answers 204', async () => {
    await blockUser(BOB);
    const res = await unblockUser(BOB);
    expect(res.status).toBe(204);
    expect(blocks()).toEqual([]);
  });

  it('never removes a block the other person placed', async () => {
    as(BOB);
    await blockUser(ALICE);
    as(ALICE);
    expect((await unblockUser(BOB)).status).toBe(204);
    expect(blocks()).toEqual([expect.objectContaining({ blocker_id: BOB, blocked_id: ALICE })]);
  });

  it('answers 204 when there was nothing to remove, 400 for a malformed id and 401 without a session', async () => {
    expect((await unblockUser(BOB)).status).toBe(204);
    expect((await unblockUser('not an id')).status).toBe(400);
    as(null);
    expect((await unblockUser(BOB)).status).toBe(401);
  });
});

describe('GET /api/users hides both sides of a block', () => {
  it('shows everyone else before any block', async () => {
    expect(await dancerIds()).toEqual([BOB, CAROL]);
  });

  it('hides the person I blocked', async () => {
    await blockUser(BOB);
    expect(await dancerIds()).toEqual([CAROL]);
  });

  it('hides me from the person I blocked, and them from me when they blocked me', async () => {
    await blockUser(BOB);
    as(BOB);
    expect(await dancerIds()).toEqual([CAROL]);
  });

  it('shows them again once I unblock', async () => {
    await blockUser(BOB);
    await unblockUser(BOB);
    expect(await dancerIds()).toEqual([BOB, CAROL]);
  });

  it('works before migration 0010 is applied: nobody is hidden', async () => {
    db.readErrors.blocks = { code: '42P01', message: 'relation "public.blocks" does not exist' };
    expect(await dancerIds()).toEqual([BOB, CAROL]);
  });
});

describe('the room between two dancers once either blocks the other', () => {
  beforeEach(() => {
    db.seed('rooms', { id: ROOM, participant_ids: [ALICE, BOB] });
  });

  it('a message from the blocked dancer is refused with 403 { error: "blocked" } and nothing is written or sent', async () => {
    await blockUser(BOB);
    as(BOB);
    const res = await send();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'blocked' });
    expect(db.rowsOf('messages')).toEqual([]);
    expect(mocks.notifyNewMessage).not.toHaveBeenCalled();
  });

  it('the blocker cannot message the person they blocked either', async () => {
    await blockUser(BOB);
    expect((await send()).status).toBe(403);
  });

  it('neither can open the room', async () => {
    await blockUser(BOB);
    expect((await openRoom()).status).toBe(403);
    as(BOB);
    expect((await openRoom()).status).toBe(403);
  });

  it('a third dancer is unaffected, and messaging works again after an unblock', async () => {
    await blockUser(CAROL);
    expect((await send()).status).toBe(200);
    await unblockUser(CAROL);
    await blockUser(BOB);
    await unblockUser(BOB);
    expect((await send()).status).toBe(200);
  });
});
