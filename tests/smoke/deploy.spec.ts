/**
 * Deploy smoke test, Part A (TEST-007): run after every rollout against the live
 * environment, without signing in. See playwright.config.ts for how to run it.
 *
 * It shows the deployment answers, is in Free Mode, sends the security headers
 * and refuses what it should. It does not sign in, chat, or check the browser
 * console; Part B (a browser test with Clerk test users on staging) is not built yet.
 */
import { expect, test } from '@playwright/test';

const SECURITY_HEADERS = [
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'strict-transport-security',
  'content-security-policy',
];

test('GET /api/health answers 200 { ok: true }', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test('GET / answers 200 with a GarbaConnect title', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/<title>[^<]*GarbaConnect[^<]*<\/title>/);
});

test('all six security headers are sent', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  for (const name of SECURITY_HEADERS) expect(headers[name], `${name} header`).toBeTruthy();
});

test('plain HTTP redirects to HTTPS', async ({ request, baseURL }) => {
  test.skip(!baseURL?.startsWith('https://'), 'Only meaningful against an HTTPS deployment');
  const res = await request.get(baseURL!.replace(/^https:/, 'http:'), { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  expect(res.headers()['location']).toMatch(/^https:\/\//);
});

test('GET /api/users without a session answers 401', async ({ request }) => {
  expect((await request.get('/api/users')).status()).toBe(401);
});

test('a request with an empty User-Agent is refused with 403', async ({ request }) => {
  expect((await request.get('/', { headers: { 'user-agent': '' } })).status()).toBe(403);
});

test('the refund policy says there is nothing to refund (Free Mode)', async ({ request }) => {
  const res = await request.get('/refund-policy');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('nothing to refund');
});

test('the landing page HTML does not mention Razorpay (FREE-002, FREE-003)', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html.toLowerCase()).not.toContain('razorpay');
});
