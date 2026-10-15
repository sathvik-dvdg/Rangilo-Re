// POST /api/rooms/[roomId]/messages: chats have no time limit (DEC-014), the body is parsed by a
// schema before use (SEC-004), and each dancer may send 30 messages a minute (CHAT-007).
// Route-level test: Clerk and the database are mocked; validation and the limiter are the real ones.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  notifyNewMessage: vi.fn(async () => {}),
  userId: 'user_alice',
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: mocks.userId }) }));
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => {
    throw new Error('unexpected database access');
  },
}));
vi.mock('@/lib/push', () => ({ notifyNewMessage: mocks.notifyNewMessage }));
vi.mock('@/lib/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server')>()),
  loadRoom: async () => ({
    me: { clerk_id: 'user_alice', display_name: 'DiyaDancer_Avni_4821' },
    partnerId: 'user_bob',
    room: { id: 'user_alice_user_bob', unlimited: false },
    db: {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          mocks.insert(row);
          return { select: () => ({ single: async () => ({ data: { id: 'm1', ...row }, error: null }) }) };
        },
      }),
    },
  }),
}));

import { POST } from '@/app/api/rooms/[roomId]/messages/route';

const send = (body: unknown = { text: 'hello' }) =>
  POST(new Request('http://localhost/api/rooms/x/messages', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), {
    params: { roomId: 'user_alice_user_bob' },
  });

beforeEach(() => {
  mocks.insert.mockClear();
  mocks.notifyNewMessage.mockClear();
  mocks.userId = 'user_alice';
});

describe('POST /api/rooms/[roomId]/messages', () => {
  it('accepts a message, with no clock to start or run out (DEC-014)', async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ sender_id: 'user_alice', text: 'hello' }));
  });

  // NOTIF-002: the partner is told who wrote and where, never what was written.
  it('notifies the partner, by nickname and room only, once the message is saved', async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.notifyNewMessage).toHaveBeenCalledTimes(1);
    expect(mocks.notifyNewMessage).toHaveBeenCalledWith('user_bob', 'DiyaDancer_Avni_4821', 'user_alice_user_bob');
    expect(JSON.stringify(mocks.notifyNewMessage.mock.calls)).not.toContain('hello');
  });

  it('trims the text before saving it', async () => {
    expect((await send({ text: '  hi there  ' })).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi there' }));
  });

  it.each([
    ['no body', ''],
    ['malformed JSON', '{"text":'],
    ['a non-object body', '"hello"'],
    ['a missing text field', { message: 'hello' }],
    ['a non-string text', { text: 42 }],
    ['blank text', { text: '   ' }],
    ['text over 1000 characters', { text: 'a'.repeat(1001) }],
  ])('refuses %s with a 400 and writes nothing (SEC-004)', async (_name, body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'A message must be 1 to 1000 characters' });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.notifyNewMessage).not.toHaveBeenCalled();
  });

  it('accepts exactly 1000 characters', async () => {
    expect((await send({ text: 'a'.repeat(1000) })).status).toBe(200);
  });

  it('allows 30 messages a minute per dancer, then answers 429 with Retry-After and writes nothing (CHAT-007)', async () => {
    for (let i = 0; i < 30; i++) expect((await send()).status).toBe(200);
    const res = await send();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(mocks.insert).toHaveBeenCalledTimes(30);
    // The limit is per dancer: someone else is unaffected.
    mocks.userId = 'user_bob';
    expect((await send()).status).toBe(200);
  });
});
