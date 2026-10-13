// Unlimited chat at payment, contact exchange only with consent (ID-001, ID-002, PRIV-001;
// DEC-002 as revised 2026-10-14). A payment makes the room unlimited at once; the partner's
// answer decides only whether contact details are shared, and no answer leads to a refund.
//
// Route-level tests: Clerk and the database are mocked (tests/helpers/fakeDb.ts);
// the routes, lib/consent.ts, lib/server.ts and lib/payments.ts are the real ones.
// The three SQL functions the routes call are stood in for by the fake, so these
// tests show what the server asks the database to do and what it returns to the
// browser. They do not show that the SQL is atomic or that Realtime delivers a
// change: neither can be run here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './helpers/fakeDb';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  supabaseAdmin: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mocks.supabaseAdmin }));

import { GET as getConsent, POST as answerConsent } from '@/app/api/rooms/[roomId]/consent/route';
import { GET as getRoom } from '@/app/api/rooms/[roomId]/route';
import { POST as sendMessage } from '@/app/api/rooms/[roomId]/messages/route';
import { GET as getContact } from '@/app/api/users/[userId]/contact/route';
import { GET as getConnections } from '@/app/api/reveals/route';
import { fulfilOrder, getOrder } from '@/lib/payments';
import type { RoomState } from '@/lib/types';

const ALICE = 'user_alice';
const BOB = 'user_bob';
const CAROL = 'user_carol';
const ROOM = 'user_alice_user_bob';
const PRIVATE = ['Alice Patel', 'alice@example.com', 'Bob Sharma', 'bob@example.com', 'alice_insta', 'bob_insta'];

let db: FakeDb;

const as = (userId: string | null) => {
  mocks.userId = userId;
};
const room = { params: { roomId: ROOM } };
const get = () => new Request('http://localhost/');
const post = (body: unknown) => new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body) });
const answer = (action: unknown) => answerConsent(post({ action }), room);
const contactOf = (userId: string) => getContact(get(), { params: { userId } });
const roomState = async () => (await (await getRoom(get(), room)).json()) as RoomState;
const consents = () => db.rowsOf('contact_consents');
const reveals = () => db.rowsOf('contact_reveals');
const order = () => db.rowsOf('payment_orders')[0];
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

/** Alice pays for the room with Bob, through the real fulfilment code. */
async function alicePays() {
  db.seed('payment_orders', { id: 'po_1', user_id: ALICE, room_id: ROOM, order_id: 'order_1', status: 'created', amount: 2900, currency: 'INR' });
  const paid = await getOrder('order_1');
  expect(await fulfilOrder(paid!, 'pay_1')).toBe('fulfilled');
}

let warnLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  db = createFakeDb();
  mocks.supabaseAdmin.mockImplementation(() => db.client);
  for (const [clerk_id, display_name, real_name, email, instagram_handle] of [
    [ALICE, 'DiyaDancer_Avni_4821', 'Alice Patel', 'alice@example.com', 'alice_insta'],
    [BOB, 'GarbaKing_Arjun_7302', 'Bob Sharma', 'bob@example.com', 'bob_insta'],
    [CAROL, 'Dandiya_Carol_1111', 'Carol Shah', 'carol@example.com', 'carol_insta'],
  ]) {
    db.seed('users', { clerk_id, display_name, gender: 'female', last_seen: hoursAgo(0), real_name, email, instagram_handle });
  }
  db.seed('rooms', { id: ROOM, participant_ids: [ALICE, BOB] });
  as(ALICE);
  warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('before anyone has asked', () => {
  it('neither person can read the other’s contact details', async () => {
    expect((await contactOf(BOB)).status).toBe(404);
    as(BOB);
    expect((await contactOf(ALICE)).status).toBe(404);
  });

  it('the room state carries no private field of either person', async () => {
    const body = JSON.stringify(await roomState());
    for (const secret of PRIVATE) expect(body).not.toContain(secret);
    expect(await roomState()).toMatchObject({ unlimited: false, revealed: null, consent: { status: null, role: null, canRequest: true } });
  });
});

describe('a paid request that is waiting for an answer', () => {
  beforeEach(alicePays);

  it('payment set rooms.unlimited = true at once and created a pending request; nothing is revealed', () => {
    expect(db.rowsOf('rooms')[0]).toMatchObject({ unlimited: true });
    expect(db.writesTo('rooms')).toEqual([{ table: 'rooms', op: 'update', row: { unlimited: true } }]);
    expect(consents()).toEqual([expect.objectContaining({ room_id: ROOM, requester_id: ALICE, partner_id: BOB, status: 'pending', payment_order_id: 'po_1' })]);
    expect(reveals()).toEqual([]);
    expect(db.rpcCalls).toEqual([]); // no answer was involved
    expect(db.writesTo('chat_extensions')).toEqual([]);
    expect(order()).toMatchObject({ status: 'paid' });
  });

  it('paying does not reveal anything: contact details are still a 404 for both', async () => {
    expect((await contactOf(BOB)).status).toBe(404);
    as(BOB);
    expect((await contactOf(ALICE)).status).toBe(404);
  });

  it('each side sees the request in its own role, with no private field in the room state', async () => {
    const mine = await roomState();
    expect(mine).toMatchObject({ unlimited: true, revealed: null, consent: { status: 'pending', role: 'requester', canRequest: false } });
    as(BOB);
    const theirs = await roomState();
    expect(theirs).toMatchObject({ unlimited: true, revealed: null, consent: { status: 'pending', role: 'partner', canRequest: false } });
    for (const secret of PRIVATE) expect(JSON.stringify([mine, theirs])).not.toContain(secret);
    expect(await (await getConsent(get(), room)).json()).toEqual({ status: 'pending', role: 'partner', canRequest: false });
  });

  it('the person who paid cannot accept their own request', async () => {
    const res = await answer('accept');
    expect(res.status).toBe(403);
    expect(db.rpcCalls).toEqual([]);
    expect(consents()[0]).toMatchObject({ status: 'pending' });
    expect(reveals()).toEqual([]);
  });

  it('someone outside the room cannot answer or read it', async () => {
    as(CAROL);
    expect((await answer('accept')).status).toBe(403);
    expect((await getConsent(get(), room)).status).toBe(403);
    expect(db.rpcCalls).toEqual([]);
    expect(consents()[0]).toMatchObject({ status: 'pending' });
  });

  it('a signed-out caller gets 401 everywhere', async () => {
    as(null);
    expect((await answer('accept')).status).toBe(401);
    expect((await getConsent(get(), room)).status).toBe(401);
    expect((await contactOf(BOB)).status).toBe(401);
    expect((await getConnections()).status).toBe(401);
    expect(db.rpcCalls).toEqual([]);
  });

  it('an unknown action is refused', async () => {
    as(BOB);
    expect((await answer('approve')).status).toBe(400);
    expect((await answer(undefined)).status).toBe(400);
    expect(db.rpcCalls).toEqual([]);
  });

  it('the dancer list shows Bob that Alice is waiting, and reveals nobody', async () => {
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
    as(BOB);
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [ALICE] });
    as(CAROL);
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
  });

  it('the chat is open at once: a message is accepted long past the two minutes while the request is still pending', async () => {
    db.rowsOf('rooms')[0].timer_started_at = hoursAgo(1);
    const res = await sendMessage(post({ text: 'hello' }), room);
    expect(res.status).toBe(200);
    as(BOB);
    expect((await sendMessage(post({ text: 'hi back' }), room)).status).toBe(200);
  });
});

describe('the partner accepts', () => {
  beforeEach(async () => {
    await alicePays();
    as(BOB);
    const res = await answer('accept');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'accepted' });
  });

  it('asks the database for one atomic accept, as the person who was asked', () => {
    expect(db.rpcCalls).toEqual([{ fn: 'accept_contact_consent', args: { p_consent_id: consents()[0].id, p_partner_id: BOB } }]);
    // The server makes no writes of its own when answering: the status and the reveal are the function's job,
    // and the only write to the room is still the one the payment made.
    expect(db.writesTo('contact_reveals')).toEqual([]);
    expect(db.writesTo('rooms')).toEqual([{ table: 'rooms', op: 'update', row: { unlimited: true } }]);
  });

  it('leaves an accepted request and one contact_reveals row for the pair; the room is still unlimited', () => {
    expect(consents()[0]).toMatchObject({ status: 'accepted' });
    expect(reveals()).toEqual([expect.objectContaining({ room_id: ROOM, user_a_id: ALICE, user_b_id: BOB, consent_id: consents()[0].id })]);
    expect(db.rowsOf('rooms')[0]).toMatchObject({ unlimited: true });
    expect(order()).toMatchObject({ status: 'paid' });
  });

  it('each of the two now gets the other’s real name and email, and nothing more', async () => {
    const alice = await contactOf(ALICE);
    expect(alice.status).toBe(200);
    expect(await alice.json()).toEqual({ real_name: 'Alice Patel', email: 'alice@example.com' });
    as(ALICE);
    expect(await (await contactOf(BOB)).json()).toEqual({ real_name: 'Bob Sharma', email: 'bob@example.com' });
    for (const columns of db.selected.users ?? []) {
      if (columns.includes('real_name')) expect(columns).not.toContain('instagram_handle');
    }
  });

  it('nobody else gets them, and the pair get nobody else’s', async () => {
    as(CAROL);
    expect((await contactOf(ALICE)).status).toBe(404);
    expect((await contactOf(BOB)).status).toBe(404);
    as(ALICE);
    expect((await contactOf(CAROL)).status).toBe(404);
    expect((await contactOf(ALICE)).status).toBe(404); // not a way to read your own row either
    expect((await contactOf('nobody')).status).toBe(404);
  });

  it('the room state shows the partner’s details to each side, and the room as unlimited', async () => {
    expect(await roomState()).toMatchObject({
      unlimited: true,
      revealed: { real_name: 'Alice Patel', email: 'alice@example.com' },
      consent: { status: 'accepted', role: 'partner', canRequest: false },
    });
    as(ALICE);
    const mine = await roomState();
    expect(mine).toMatchObject({ unlimited: true, revealed: { real_name: 'Bob Sharma', email: 'bob@example.com' } });
    expect(JSON.stringify(mine)).not.toContain('bob_insta');
  });

  it('the chat no longer expires: a message is accepted long after the two minutes', async () => {
    db.rowsOf('rooms')[0].timer_started_at = hoursAgo(5);
    const res = await sendMessage(post({ text: 'still here' }), room);
    expect(res.status).toBe(200);
  });

  it('the dancer list shows the connection to both and to nobody else', async () => {
    expect(await (await getConnections()).json()).toEqual({ revealed: { [ALICE]: { real_name: 'Alice Patel', email: 'alice@example.com' } }, incoming: [] });
    as(ALICE);
    expect(await (await getConnections()).json()).toEqual({ revealed: { [BOB]: { real_name: 'Bob Sharma', email: 'bob@example.com' } }, incoming: [] });
    as(CAROL);
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
  });

  it('cannot be answered a second time', async () => {
    expect((await answer('decline')).status).toBe(404);
    expect((await answer('accept')).status).toBe(404);
    expect(consents()[0]).toMatchObject({ status: 'accepted' });
    expect(reveals()).toHaveLength(1);
  });
});

describe('the partner declines', () => {
  beforeEach(async () => {
    await alicePays();
    as(BOB);
    const res = await answer('decline');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'declined' });
  });

  it('marks the request declined and creates no reveal', () => {
    expect(db.rpcCalls).toEqual([{ fn: 'decline_contact_consent', args: { p_consent_id: consents()[0].id, p_partner_id: BOB } }]);
    expect(consents()[0]).toMatchObject({ status: 'declined' });
    expect(reveals()).toEqual([]);
  });

  it('rooms.unlimited is still true: the buyer keeps the chat they paid for', () => {
    expect(db.rowsOf('rooms')[0]).toMatchObject({ unlimited: true });
  });

  it('does not trigger a refund: the order stays paid and nothing is queued or logged', () => {
    expect(order()).toMatchObject({ status: 'paid', payment_id: 'pay_1' });
    expect(db.writesTo('payment_orders').filter((w) => w.row.status !== 'paid')).toEqual([]);
    expect(warnLog).not.toHaveBeenCalled();
  });

  it('shows nobody’s contact details to anyone', async () => {
    expect((await contactOf(ALICE)).status).toBe(404);
    as(ALICE);
    expect((await contactOf(BOB)).status).toBe(404);
    expect(await roomState()).toMatchObject({ unlimited: true, revealed: null });
  });

  it('tells the buyer, who cannot ask again in this room; the person who declined still can', async () => {
    expect(await (await getConsent(get(), room)).json()).toEqual({ status: 'declined', role: 'partner', canRequest: true });
    as(ALICE);
    expect(await (await getConsent(get(), room)).json()).toEqual({ status: 'declined', role: 'requester', canRequest: false });
  });

  it('the chat stays open for both', async () => {
    db.rowsOf('rooms')[0].timer_started_at = hoursAgo(1);
    expect((await sendMessage(post({ text: 'ok, no problem' }), room)).status).toBe(200);
    as(ALICE);
    expect((await sendMessage(post({ text: 'still here' }), room)).status).toBe(200);
  });

  it('accepting afterwards is not possible', async () => {
    expect((await answer('accept')).status).toBe(404);
    expect(reveals()).toEqual([]);
  });
});

describe('no answer within 24 hours', () => {
  beforeEach(async () => {
    await alicePays();
    consents()[0].requested_at = hoursAgo(25);
  });

  it('reading the room closes the request as expired; the chat stays unlimited and nothing is refunded', async () => {
    expect(await (await getConsent(get(), room)).json()).toEqual({ status: 'expired', role: 'requester', canRequest: false });
    expect(db.rpcCalls).toEqual([{ fn: 'expire_contact_consents', args: { p_room_id: ROOM } }]);
    expect(consents()[0]).toMatchObject({ status: 'expired' });
    expect(db.rowsOf('rooms')[0]).toMatchObject({ unlimited: true });
    expect(order()).toMatchObject({ status: 'paid' });
  });

  it('it can no longer be accepted, and nothing is revealed', async () => {
    as(BOB);
    expect((await answer('accept')).status).toBe(404);
    expect(reveals()).toEqual([]);
    expect((await contactOf(ALICE)).status).toBe(404);
  });

  it('it no longer shows as waiting in the dancer list', async () => {
    as(BOB);
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
  });

  it('a request still inside its 24 hours is left alone', async () => {
    consents()[0].requested_at = hoursAgo(23);
    expect(await (await getConsent(get(), room)).json()).toMatchObject({ status: 'pending' });
    expect(db.rpcCalls).toEqual([]);
  });
});

describe('an answer that loses a race', () => {
  it('returns 409 and reveals nothing when the database says the request is no longer pending', async () => {
    await alicePays();
    as(BOB);
    // What accept_contact_consent returns when the request was answered or expired a moment earlier.
    const realRpc = db.client.rpc;
    db.client.rpc = async (fn, args) => (fn === 'accept_contact_consent' ? { data: false, error: null } : realRpc(fn, args));
    const res = await answer('accept');
    expect(res.status).toBe(409);
    expect(reveals()).toEqual([]);
  });

  it('a database error while accepting is a 5xx and reveals nothing', async () => {
    await alicePays();
    as(BOB);
    db.rpcErrors.accept_contact_consent = { code: '08006', message: 'connection failure' };
    const res = await answer('accept');
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(reveals()).toEqual([]);
    expect((await contactOf(ALICE)).status).toBe(404);
  });
});

describe('old payer-only reveals rows (DEC-003)', () => {
  beforeEach(() => {
    // Written by the withdrawn product: Alice paid, Bob never agreed to anything.
    db.seed('reveals', { payer_id: ALICE, target_id: BOB, payment_id: 'pay_old' });
  });

  it('are not shown in the chat, the dancer list or the contact route, and the table is never read', async () => {
    expect(await roomState()).toMatchObject({ revealed: null, unlimited: false });
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
    expect((await contactOf(BOB)).status).toBe(404);
    expect(db.selected.reveals).toBeUndefined();
    expect(db.rowsOf('reveals')).toHaveLength(1); // and left in place
  });
});

describe('a database without migration 0006', () => {
  const MISSING_TABLE = { code: 'PGRST205', message: "Could not find the table 'public.contact_consents' in the schema cache" };

  beforeEach(() => {
    db.readErrors.contact_consents = MISSING_TABLE;
    db.readErrors.contact_reveals = MISSING_TABLE;
    db.readErrors.rooms = (columns) => (columns.includes('unlimited') ? { code: '42703', message: 'column rooms.unlimited does not exist' } : null);
  });

  it('still serves the chat: nothing is unlimited and nothing is revealed', async () => {
    const res = await getRoom(get(), room);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ unlimited: false, revealed: null, consent: { status: null, role: null } });
  });

  it('still serves the dancer list and refuses contact details', async () => {
    expect(await (await getConnections()).json()).toEqual({ revealed: {}, incoming: [] });
    expect((await contactOf(BOB)).status).toBe(404);
  });

  it('still enforces the two-minute limit', async () => {
    db.rowsOf('rooms')[0].timer_started_at = hoursAgo(1);
    expect((await sendMessage(post({ text: 'hello' }), room)).status).toBe(403);
  });
});
