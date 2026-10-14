/**
 * TEST-007 Free Mode smoke test — IN-PROCESS, PROVIDERS MOCKED.
 *
 * Runs the real chat page, ChatRoom, billing module and payment routes with
 * BILLING_MODE absent. Only the external providers are replaced: Clerk's
 * server auth, the Supabase client factory, the Razorpay SDK constructor,
 * and global fetch (to catch any outbound request). The chat page is
 * server-rendered to HTML with react-dom/server.
 *
 * This is NOT a browser test and NOT a provider integration test: no
 * JavaScript runs in a browser, no clicks happen, and nothing talks to real
 * Clerk, Supabase or Razorpay. Sign-up, onboarding and discovery are not
 * covered.
 */
import crypto from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomState } from '@/lib/types';

const providers = vi.hoisted(() => ({
  createClient: vi.fn(),
  Razorpay: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_alice' }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: providers.createClient }));
vi.mock('razorpay', () => ({ default: providers.Razorpay }));
// Realtime needs a browser Supabase client and Clerk session; the smoke test renders without it.
vi.mock('@/hooks/useSupabaseRealtime', () => ({ useRoomRealtime: () => ({ presentIds: [] }) }));
// Room data comes from Supabase; supply a fixed room so the page renders without a database.
const room = vi.hoisted(() => ({ state: null as unknown as RoomState }));
vi.mock('@/lib/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server')>()),
  getRoomState: async () => room.state,
}));

import ChatPage from '@/app/(main)/chat/[roomId]/page';
import { POST as createOrder } from '@/app/api/payment/create-order/route';
import { POST as verify } from '@/app/api/payment/verify/route';
import { POST as webhook } from '@/app/api/webhooks/razorpay/route';
import { getBillingStatus } from '@/lib/billing';

const ROOM = 'user_alice_user_bob';
// Fake, well-formed values so Free Mode is shown to hold even when credentials exist (CFG-003).
const FAKE = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('clerk.example.com$').toString('base64')}`,
  CLERK_SECRET_KEY: 'sk_test_FakeClerkSecret0000000000',
  RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
  RAZORPAY_KEY_SECRET: 'fake_key_secret_0123456789',
  RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_0123',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_FakeKey12345678',
};

const PAYMENT_UI = [/₹/, /Razorpay/i, /Reveal Identity/i, /Extend Chat/i, /Unlock/i, /\bPay\b/];

function roomState(timerStartedAt: string | null): RoomState {
  const profile = (clerk_id: string, display_name: string) => ({ clerk_id, display_name, gender: 'female' as const, last_seen: new Date().toISOString() });
  return {
    roomId: ROOM,
    me: profile('user_alice', 'DiyaDancer_Avni_4821'),
    partner: profile('user_bob', 'GarbaKing_Arjun_7302'),
    messages: [],
    timerStartedAt,
    extraSeconds: 0,
    revealed: null,
    reveal: { outgoing: 'none', incoming: 'none', sharing: null },
  };
}

const bothSpoke = (at: string) => [
  { id: 'm1', room_id: ROOM, sender_id: 'user_alice', text: 'Hi', created_at: at, read_by: ['user_alice', 'user_bob'] },
  { id: 'm2', room_id: ROOM, sender_id: 'user_bob', text: 'Hello', created_at: at, read_by: ['user_bob'] },
];

async function renderChat() {
  const element = await ChatPage({ params: { roomId: encodeURIComponent(ROOM) } });
  expect(element).not.toBeNull();
  return renderToStaticMarkup(element!);
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });
const hmac = (secret: string, data: string) => crypto.createHmac('sha256', secret).update(data).digest('hex');

const savedBillingMode = process.env.BILLING_MODE;
beforeAll(() => {
  delete process.env.BILLING_MODE; // absent, not merely empty
});
afterAll(() => {
  if (savedBillingMode !== undefined) process.env.BILLING_MODE = savedBillingMode;
});

beforeEach(() => {
  for (const [k, v] of Object.entries(FAKE)) vi.stubEnv(k, v);
  vi.stubGlobal('fetch', providers.fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  // No provider was ever reached, in any Free Mode test.
  expect(providers.createClient).not.toHaveBeenCalled();
  expect(providers.Razorpay).not.toHaveBeenCalled();
  expect(providers.fetch).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Free Mode smoke (in-process, providers mocked)', () => {
  it('defaults to Free Mode when BILLING_MODE is absent, even with Razorpay credentials set', () => {
    expect('BILLING_MODE' in process.env).toBe(false);
    expect(getBillingStatus()).toEqual({ mode: 'free', requested: 'free', problems: [] });
  });

  it('chat page renders with no payment UI before the clock starts', async () => {
    room.state = roomState(null);
    const html = await renderChat();
    expect(html).toContain('GarbaKing_Arjun_7302');
    expect(html).toContain('aria-label="Message"'); // the composer is there while the chat is open
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it('expired chat offers no paid extension, only a way back', async () => {
    const started = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    room.state = {
      ...roomState(started),
      messages: [{ id: 'm1', room_id: ROOM, sender_id: 'user_bob', text: 'That is me', created_at: started, read_by: ['user_bob'] }],
    };
    const html = await renderChat();
    expect(html).toContain('Your 2-minute chat has ended');
    expect(html).toContain('Back to dancers');
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
    // Readable, not writable: the composer is gone, not merely disabled.
    expect(html).not.toContain('<form');
    expect(html).not.toContain('aria-label="Message"');
    expect(html).toContain('That is me'); // the thread itself is still rendered
  });

  // Asking to see a name and photo is part of the paid feature, so none of it appears with billing off,
  // whatever state a request is in.
  it.each(['none', 'pending', 'allowed'] as const)('chat shows no name-and-photo request or offer (request state: %s)', async (state) => {
    const now = new Date().toISOString();
    room.state = {
      ...roomState(now),
      messages: bothSpoke(now),
      reveal: { outgoing: state, incoming: state === 'none' ? 'none' : 'pending', sharing: state === 'none' ? null : { real_name: 'Avni Private', image_url: null } },
    };
    const html = await renderChat();
    expect(html).not.toMatch(/Ask to see name/i);
    expect(html).not.toMatch(/is asking to see your real name/i);
    expect(html).not.toContain('Avni Private');
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it('payment creation is refused before any database or Razorpay access', async () => {
    for (const body of [{ type: 'extend', roomId: ROOM }, { type: 'reveal', targetUserId: 'user_bob' }]) {
      const res = await createOrder(post('/api/payment/create-order', body));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'billing_disabled' });
    }
  });

  it('checkout verification is refused even with a correctly signed checkout response', async () => {
    const orderId = 'order_test_1';
    const paymentId = 'pay_test_1';
    const signature = hmac(FAKE.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
    const res = await verify(post('/api/payment/verify', { orderId, paymentId, signature }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'billing_disabled' });
  });

  it('a validly signed captured-payment webhook grants no entitlement', async () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test_1', order_id: 'order_test_1', amount: 2900 } } },
    });
    const res = await webhook(post('/api/webhooks/razorpay', body, { 'x-razorpay-signature': hmac(FAKE.RAZORPAY_WEBHOOK_SECRET, body) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: 'billing_disabled' });
    // Entitlements are database rows; afterEach asserts the Supabase client was never even created.
  });

  it.todo('landing page shows no ₹29 claims (FREE-003; blocked on DEC-008 copy decision)');
});

describe('control: the same render in Paid Mode does show payment UI', () => {
  // Proves the absence checks above can fail. Rendering only; no payment is attempted.
  it('the extend offer appears when Paid Mode is effective; reveal banner is shown when identity not yet revealed (DEC-014)', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    room.state = roomState(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const html = await renderChat();
    expect(html).toMatch(/>Reveal</);
    expect(html).toMatch(/Extend Chat ₹29/);
    // The offer is never a dead end: a visible way back sits next to it (not just the header icon's label).
    expect(html).toMatch(/>Back to dancers<\/a>/);
  });

  it('in Paid Mode a dancer sees the pay-to-reveal banner and once unlocked sees the real identity card (DEC-014)', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    const now = new Date().toISOString();
    const withReveal = (reveal: RoomState['reveal'], revealed: RoomState['revealed'] = null) => ({
      ...roomState(now),
      messages: bothSpoke(now),
      reveal,
      revealed,
    });

    room.state = withReveal({ outgoing: 'none', incoming: 'none', sharing: null });
    let html = await renderChat();
    expect(html).toMatch(/Want to know who it really is\?/);
    expect(html).toMatch(/>Reveal</);

    // Once revealed, the banner hides and RevealCard is displayed
    room.state = withReveal({ outgoing: 'none', incoming: 'none', sharing: null }, { real_name: 'Bob Sharma', image_url: null });
    html = await renderChat();
    expect(html).not.toMatch(/>Reveal</);
    expect(html).toContain('Bob Sharma');
    expect(html).toMatch(/Real Identity Revealed/);
  });

  it('in Paid Mode when 15 seconds remain, an urgency popup with "Get Unlimited Time" appears', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    // FREE_CHAT_MS is 120_000 ms. Started 108 seconds ago => 12 seconds remaining
    const startedAt = new Date(Date.now() - 108 * 1000).toISOString();
    room.state = {
      ...roomState(startedAt),
      messages: bothSpoke(startedAt),
    };
    const html = await renderChat();
    expect(html).toMatch(/Only 12 seconds remaining!/);
    expect(html).toMatch(/The window will close and you might miss your chance for a partner/);
    expect(html).toMatch(/Get Unlimited Time/);
  });
});
