// PAY-018: a paid extension gives its full two minutes even when it is paid for after the
// chat has closed. Regression test for "paid, toast said +2 minutes, chat still closed".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FREE_CHAT_MS, effectiveExtraSeconds } from '@/lib/room';

const mocks = vi.hoisted(() => ({
  timerStartedAt: null as string | null,
  extensions: [] as { extra_seconds: number; paid_at: string }[],
  selected: '',
  insert: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_alice' }) }));
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      expect(table).toBe('chat_extensions');
      return {
        select: (columns: string) => {
          mocks.selected = columns;
          return { eq: async () => ({ data: mocks.extensions, error: null }) };
        },
      };
    },
  }),
}));
vi.mock('@/lib/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server')>()),
  getRevealed: async () => null,
  loadRoom: async () => ({
    me: { clerk_id: 'user_alice', display_name: 'DiyaDancer_Avni_4821' },
    partnerId: 'user_bob',
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
import { extraSecondsFor, isExpired } from '@/lib/server';

const FREE = FREE_CHAT_MS / 1000; // 120
const T0 = Date.parse('2026-10-14T20:00:00.000Z');
const at = (secondsAfterStart: number) => new Date(T0 + secondsAfterStart * 1000).toISOString();
const ext = (paidSecondsAfterStart: number, extra_seconds = 120) => ({ extra_seconds, paid_at: at(paidSecondsAfterStart) });
/** When the chat ends, in seconds after its clock started. */
const endsAt = (extensions: { extra_seconds: number; paid_at: string }[]) => FREE + effectiveExtraSeconds(at(0), extensions);

describe('effectiveExtraSeconds', () => {
  it('adds nothing when nothing was bought', () => {
    expect(effectiveExtraSeconds(at(0), [])).toBe(0);
    expect(effectiveExtraSeconds(null, [])).toBe(0);
  });

  it('an extension paid for while time remains lengthens the chat by exactly what was bought', () => {
    expect(effectiveExtraSeconds(at(0), [ext(90)])).toBe(120);
    expect(endsAt([ext(90)])).toBe(240);
  });

  it('an extension paid for after the chat closed runs from the payment, not from when the chat closed', () => {
    // Closed at 120s, paid ten minutes later: the old sum ended the chat at 240s, long before the payment.
    expect(endsAt([ext(720)])).toBe(840); // 720 + 120
    // Even a short checkout after expiry must not eat into the two minutes.
    expect(endsAt([ext(150)])).toBe(270);
  });

  it('paid at the very moment the chat closes is the same as paid in time', () => {
    expect(endsAt([ext(120)])).toBe(240);
  });

  it('stacks: each extension starts where the chat stood when it was paid for', () => {
    // First one late (ends 720 + 120 = 840), second bought with time still on that one.
    expect(endsAt([ext(720), ext(800)])).toBe(960);
    // Second one bought after the first had run out as well.
    expect(endsAt([ext(720), ext(1000)])).toBe(1120);
    // Two bought in time simply add up.
    expect(endsAt([ext(30), ext(60)])).toBe(360);
  });

  it('does not depend on the order the rows come back in', () => {
    expect(endsAt([ext(1000), ext(720)])).toBe(endsAt([ext(720), ext(1000)]));
  });

  it('before the clock has started, bought time is simply added', () => {
    expect(effectiveExtraSeconds(null, [ext(-500), ext(-100)])).toBe(240);
    // Bought before the start, clock starts later: still exactly the time bought.
    expect(effectiveExtraSeconds(at(0), [ext(-500)])).toBe(120);
  });

  it('respects the size of each extension', () => {
    expect(endsAt([ext(720, 300)])).toBe(1020);
  });
});

describe('extraSecondsFor reads when each extension was paid for', () => {
  beforeEach(() => {
    mocks.extensions = [];
    mocks.selected = '';
  });

  it('selects paid_at and applies it', async () => {
    mocks.extensions = [ext(720)];
    expect(await extraSecondsFor('user_alice_user_bob', at(0))).toBe(720);
    expect(mocks.selected).toContain('paid_at');
    expect(mocks.selected).toContain('extra_seconds');
  });
});

describe('sending a message after buying an extension late', () => {
  const send = () =>
    POST(new Request('http://localhost/api/rooms/x/messages', { method: 'POST', body: JSON.stringify({ text: 'still here' }) }), {
      params: { roomId: 'user_alice_user_bob' },
    });
  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

  beforeEach(() => {
    mocks.insert.mockClear();
    mocks.extensions = [];
  });

  it('is refused when the chat closed long ago and nothing was bought', async () => {
    mocks.timerStartedAt = ago(900);
    expect((await send()).status).toBe(403);
  });

  it('is accepted for two minutes after a payment made long after the chat closed', async () => {
    mocks.timerStartedAt = ago(900); // closed 13 minutes ago
    mocks.extensions = [{ extra_seconds: 120, paid_at: ago(10) }]; // paid ten seconds ago
    expect((await send()).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(isExpired(mocks.timerStartedAt, await extraSecondsFor('user_alice_user_bob', mocks.timerStartedAt))).toBe(false);
  });

  it('is refused again once that bought time has run out', async () => {
    mocks.timerStartedAt = ago(900);
    mocks.extensions = [{ extra_seconds: 120, paid_at: ago(121) }];
    expect((await send()).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
