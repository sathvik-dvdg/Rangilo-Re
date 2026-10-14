// CORE-003: once a chat's time is up the server refuses new messages, whatever the client does.
// Route-level test: Clerk and the database are mocked; the expiry check (isExpired) is the real one.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  notifyNewMessage: vi.fn(async () => {}),
  timerStartedAt: null as string | null,
  extraSeconds: 0,
  unlimited: false,
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_alice' }) }));
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => {
    throw new Error('unexpected database access');
  },
}));
vi.mock('@/lib/push', () => ({ notifyNewMessage: mocks.notifyNewMessage }));
vi.mock('@/lib/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server')>()),
  extraSecondsFor: async () => mocks.extraSeconds,
  loadRoom: async () => ({
    me: { clerk_id: 'user_alice', display_name: 'DiyaDancer_Avni_4821' },
    partnerId: 'user_bob',
    room: { id: 'user_alice_user_bob', timer_started_at: mocks.timerStartedAt, unlimited: mocks.unlimited },
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

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
const send = () =>
  POST(new Request('http://localhost/api/rooms/x/messages', { method: 'POST', body: JSON.stringify({ text: 'hello' }) }), {
    params: { roomId: 'user_alice_user_bob' },
  });

beforeEach(() => {
  mocks.insert.mockClear();
  mocks.notifyNewMessage.mockClear();
  mocks.timerStartedAt = null;
  mocks.extraSeconds = 0;
  mocks.unlimited = false;
});

describe('POST /api/rooms/[roomId]/messages and chat expiry', () => {
  it('accepts a message before the clock has started', async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ sender_id: 'user_alice', text: 'hello' }));
  });

  it('accepts a message while time remains', async () => {
    mocks.timerStartedAt = ago(30);
    expect((await send()).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('rejects a message after the two minutes are up and writes nothing', async () => {
    mocks.timerStartedAt = ago(121);
    const res = await send();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Chat time is up' });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.notifyNewMessage).not.toHaveBeenCalled();
  });

  // NOTIF-002: the partner is told who wrote and where, never what was written.
  it('notifies the partner, by nickname and room only, once the message is saved', async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.notifyNewMessage).toHaveBeenCalledTimes(1);
    expect(mocks.notifyNewMessage).toHaveBeenCalledWith('user_bob', 'DiyaDancer_Avni_4821', 'user_alice_user_bob');
    expect(JSON.stringify(mocks.notifyNewMessage.mock.calls)).not.toContain('hello');
  });

  it('honours granted extra time, then rejects again when that runs out', async () => {
    mocks.extraSeconds = 120;
    mocks.timerStartedAt = ago(121);
    expect((await send()).status).toBe(200);
    mocks.timerStartedAt = ago(241);
    expect((await send()).status).toBe(403);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('never expires a room that has been paid for (rooms.unlimited)', async () => {
    mocks.unlimited = true;
    mocks.timerStartedAt = ago(24 * 60 * 60);
    expect((await send()).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
