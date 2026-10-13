// CORE-003: once a chat's time is up the server refuses new messages, whatever the client does.
// Route-level test: Clerk and the database are mocked; the expiry check (isExpired) is the real one.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  timerStartedAt: null as string | null,
  extraSeconds: 0,
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_alice' }) }));
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => {
    throw new Error('unexpected database access');
  },
}));
vi.mock('@/lib/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server')>()),
  extraSecondsFor: async () => mocks.extraSeconds,
  loadRoom: async () => ({
    room: { id: 'user_alice_user_bob', timer_started_at: mocks.timerStartedAt },
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
  mocks.timerStartedAt = null;
  mocks.extraSeconds = 0;
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
  });

  it('honours granted extra time, then rejects again when that runs out', async () => {
    mocks.extraSeconds = 120;
    mocks.timerStartedAt = ago(121);
    expect((await send()).status).toBe(200);
    mocks.timerStartedAt = ago(241);
    expect((await send()).status).toBe(403);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
