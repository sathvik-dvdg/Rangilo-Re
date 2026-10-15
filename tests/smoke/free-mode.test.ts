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
import type { RoomConsent, RoomState } from '@/lib/types';

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

const PAYMENT_UI = [/₹/, /Razorpay/i, /Reveal Identity/i, /Extend Chat/i, /Unlock/i, /\bPay\b/, /Connect ₹/];
const NO_REQUEST: RoomConsent = { status: null, role: null, canRequest: true };

function roomState(): RoomState {
  const profile = (clerk_id: string, display_name: string) => ({ clerk_id, display_name, gender: 'female' as const, last_seen: new Date().toISOString() });
  return {
    roomId: ROOM,
    me: profile('user_alice', 'DiyaDancer_Avni_4821'),
    partner: profile('user_bob', 'GarbaKing_Arjun_7302'),
    messages: [],
    unlimited: false,
    consent: NO_REQUEST,
    revealed: null,
    sharedWithMe: null,
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

  it('chat page renders with no payment UI and no countdown', async () => {
    room.state = roomState();
    const html = await renderChat();
    expect(html).toContain('GarbaKing_Arjun_7302');
    // A textarea, so long messages wrap onto new lines instead of scrolling sideways.
    expect(html).toMatch(/<textarea[^>]*aria-label="Message"/);
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
    expect(html).not.toMatch(/2-minute|Chat closes in|Clock starts/);
  });

  it('a chat that began an hour ago is still open: no time limit (DEC-014)', async () => {
    const started = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    room.state = { ...roomState(), messages: bothSpoke(started) };
    const html = await renderChat();
    expect(html).toContain('aria-label="Message"');
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Message"|aria-label="Message"[^>]*disabled=""/);
    expect(html).not.toMatch(/Time&#x27;s up|Chat closed|has ended/);
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it('a name and photo shared before the free ask was retired still shows, with no payment UI', async () => {
    room.state = { ...roomState(), sharedWithMe: { real_name: 'Arjun Mehta', image_url: null } };
    const html = await renderChat();
    expect(html).toContain('Arjun Mehta');
    expect(html).toContain('Shared with you');
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it('payment creation is refused before any database or Razorpay access', async () => {
    for (const body of [{ type: 'connect', roomId: ROOM }, { type: 'extend', roomId: ROOM }, { type: 'reveal', targetUserId: 'user_bob' }]) {
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

  it('a request paid for before a rollback can still be answered, in a chat that stays open, with no payment UI (FREE-007)', async () => {
    room.state = {
      ...roomState(),
      unlimited: true,
      consent: { status: 'pending', role: 'partner', canRequest: false },
    };
    const html = await renderChat();
    expect(html).toContain('wants to share contact details');
    expect(html).toContain('aria-label="Message"');
    expect(html).toMatch(/>Accept<\/button>/);
    expect(html).toMatch(/>Decline<\/button>/);
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it('a connected room renders with the partner’s details, no countdown and no payment UI', async () => {
    room.state = {
      ...roomState(),
      unlimited: true,
      consent: { status: 'accepted', role: 'requester', canRequest: false },
      revealed: { real_name: 'Arjun Mehta', email: 'arjun@example.com' },
    };
    const html = await renderChat();
    expect(html).toContain('Arjun Mehta');
    expect(html).toContain('arjun@example.com');
    expect(html).toContain('Connected');
    expect(html).toContain('aria-label="Message"');
    for (const pattern of PAYMENT_UI) expect(html).not.toMatch(pattern);
  });

  it.todo('landing page shows no ₹29 claims (FREE-003; blocked on DEC-008 copy decision)');
});

describe('control: the same render in Paid Mode does show payment UI', () => {
  // Proves the absence checks above can fail. Rendering only; no payment is attempted.
  // The terms of the offer are in the checkout sheet, rendered open in tests/legal-pages.test.ts (PAY-016).
  it('the offer appears when Paid Mode is effective, and nothing retired comes back', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    room.state = roomState();
    const html = await renderChat();
    expect(html).not.toMatch(/Reveal Identity/i);
    expect(html).not.toMatch(/Extend Chat/i);
    expect(html).not.toMatch(/See them ₹29/);
    expect(html).toMatch(/Connect ₹29/);
  });

  it('after payment the chat is open with no offer, whatever the partner answers', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    for (const status of ['pending', 'declined', 'expired'] as const) {
      room.state = { ...roomState(), unlimited: true, consent: { status, role: 'requester', canRequest: false } };
      const html = await renderChat();
      expect(html).not.toMatch(/₹/);
      expect(html).not.toMatch(/Time&#x27;s Up|Time's Up|refund/i);
      expect(html).toContain('aria-label="Message"');
      expect(html).toContain(
        status === 'pending'
          ? 'to answer your request to share contact details'
          : status === 'declined'
            ? 'Partner chose not to share details. Your chat remains open.'
            : 'so no details were shared. Your chat remains open.',
      );
    }
  });

  it('in Paid Mode the only way to ask is to pay: no free request for a name and photo (DEC-013)', async () => {
    vi.stubEnv('BILLING_MODE', 'paid');
    const now = new Date().toISOString();
    room.state = { ...roomState(), messages: bothSpoke(now) };
    const html = await renderChat();
    expect(html).toMatch(/Connect ₹29/);
    expect(html).not.toMatch(/Ask to see name|You can ask|See them ₹29|is asking to see your/i);
  });
});
