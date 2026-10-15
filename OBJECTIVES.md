# GarbaConnect — Objectives and Engineering Contract

| | |
|---|---|
| Status | Baseline v1 — established 2026-10-12 from a read-only review of commit `3b75369`. Updated 2026-10-13: decisions DEC-001/002/005; billing gate (CFG-001…003, FREE-004) and test runner (TEST-001). Updated 2026-10-14: payment ledger (PAY-003), Paid Mode test-key integration (PAY-002…009, PAY-015), paid reveal purchase path removed (ID-002, FU-003 in part). Later 2026-10-14: `verify` fetches the payment from Razorpay (PAY-006), `fulfilment_failed` state (PAY-010), webhook event ids recorded (PAY-008), migration `0003`. Later 2026-10-14: landing paid claims, invented stats and testimonials removed (DEC-008; FREE-003, PRIV-006). Updated 2026-10-15 (DEC-014): free, with no chat time limit; payment sections of the policy pages shown only in Paid Mode; per-user rate limits (CHAT-007), Zod body validation (SEC-004), security headers and middleware request checks (SEC-005). |
| Owner | Project owner (product decisions) · whoever edits code (keeping this file accurate) |
| Authority | This file is the authoritative specification for product behaviour, security boundaries and readiness gates. The source code is the authority on *current* behaviour. Where they disagree, the disagreement is recorded here as a gap, not silently resolved. |
| Agent rules | [`CLAUDE.md`](CLAUDE.md) requires every coding task to consult this file. |

**How to read this document.** Every statement is one of three kinds, and they are labelled:

- **Verified (source)** — observed directly in the repository at the commit above. This is *not* the same as "works correctly at runtime"; nothing in this repo has automated tests, and the app has not been run against live Clerk/Supabase/Razorpay as part of this review.
- **Proposed** — a requirement this document establishes. It is binding for future work once accepted, but it does not describe existing behaviour.
- **Decision required / Information Required** — something that cannot be settled from the repository or needs an owner's choice. Listed in §17.

---

## 1. Purpose and scope

This document:

1. Records the verified current architecture and capability status of GarbaConnect.
2. Establishes **Free Mode as the default and fully functional operating mode**.
3. Defines Paid Mode as an explicitly enabled, gated capability that must fail closed.
4. Sets security, privacy, consent and safety boundaries that no feature (paid or free) may cross.
5. Gives every objective an ID, a status, an acceptance criterion and the evidence required to claim it is done.

Out of scope: visual design, the landing-page animation stack, and marketing strategy (except where marketing copy makes claims about privacy or payments — see PRIV-006).

### Status vocabulary

| Status | Meaning |
|---|---|
| **Verified** | Implemented, and acceptance criterion demonstrated by an automated test or recorded manual evidence. |
| **Implemented — unverified** | Code exists that appears to satisfy the requirement; no test or recorded evidence. |
| **Partial** | Some of the requirement is implemented; named gaps remain. |
| **Conflicts** | Existing code does something the objective prohibits. Must be fixed or the objective formally changed. |
| **Missing** | Required, nothing implemented. |
| **Planned** | Future work, intentionally not started (usually gated by a phase or decision). |
| **Retired** | Withdrawn by a recorded decision (named in the entry); kept so its history stays traceable. |

At baseline **no objective is Verified**: the repository has no test suite and no CI.

---

## 2. Product vision and target users

**Vision.** During Navratri, people at the same garba can find someone to dance with: sign up, get a playful generated nickname, see who else is around, and have a short private chat. The two-minute clock keeps conversations purposeful. Real identity stays private unless the person themself chooses to share it.

**Target users.** Adults attending Navratri/garba events in India, on mobile, often in noisy, time-pressured settings. Many will be cautious about revealing their identity to strangers.

**Product principles (Proposed).**

1. A complete, coherent free experience is the default product, not a demo.
2. Identity disclosure is always the disclosed person's choice. Money never substitutes for consent.
3. The server decides what anyone can see or do; the browser only displays.
4. Paid features are optional extras that must never be required for safety or basic use.

---

## 3. Current architecture (verified against source)

### 3.1 Stack — Verified (source), from `package.json`

| Layer | Implementation |
|---|---|
| Framework | Next.js `^14.2.35` App Router, React 18, TypeScript `strict: true` |
| Styling / motion | Tailwind 3.4, Framer Motion 11, GSAP + ScrollTrigger, Lenis (landing only), `canvas-confetti` (celebration after a chat extension; added 2026-10-14) |
| 3D | `@react-three/fiber` 8, `@react-three/drei` 9, `three` 0.170 (landing hero) |
| Auth | `@clerk/nextjs` `^5.7.6` via `clerkMiddleware` |
| Database / realtime | `@supabase/supabase-js` `^2.117.2`; Postgres + Realtime (postgres_changes + presence) |
| Payments | `razorpay` `^2.9.8` server SDK + Checkout.js loaded from `checkout.razorpay.com` at click time |
| Notifications | `web-push` `^3.6.7` (server; signs and encrypts Web Push messages) + `public/sw.js` service worker; added 2026-10-14 |
| Client state | Zustand 5 (`store/useAppStore.ts`) |
| Validation | `zod` `^4.6.5` (added 2026-10-15): request bodies of API routes and the onboarding action (SEC-004) |
| Lists | `react-window` (dashboard) |
| Scripts | `dev`, `build`, `start`, `lint` (`next lint`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`, added 2026-10-13). |
| CI / deployment config | `.github/workflows/ci.yml` added 2026-10-13 (not yet run on GitHub). No deployment config (`vercel.json` etc.). README says "Push to Vercel" — hosting is *Information Required*. |

### 3.2 Request and data flow — Verified (source)

```
Browser ──(Clerk session)──► middleware.ts ──► pages (/dashboard, /chat/[roomId] protected)
   │                                       └─► app/api/* route handlers ── requireUserId() ──► supabaseAdmin() (service role, bypasses RLS)
   │                                                                                     └─► razorpay() (server SDK)
   ├─(Clerk JWT as Supabase third-party token)─► Supabase: SELECT under RLS + Realtime postgres_changes
   ├─► Supabase Realtime presence channels "lobby" and "room:<id>"  (public channels; see PRIV-005)
   └─► checkout.razorpay.com (only when a pay button is clicked)
Razorpay ──► POST /api/webhooks/razorpay (signature-checked, no Clerk auth)
```

- **All writes** go through route handlers or server actions using the service-role client (`lib/supabaseAdmin.ts`, `import 'server-only'`).
- **Browser reads** use the anon key plus the Clerk token (`lib/supabase.ts`), constrained by RLS.
- **Config validation** exists only for Clerk keys (`lib/clerkConfig.ts`, used by `middleware.ts` and `app/layout.tsx`). Supabase and Razorpay variables are read with non-null assertions (`process.env.X!`) and fail at first use.

### 3.3 Server surface — Verified (source)

| Route / action | Auth | Purpose |
|---|---|---|
| `app/(main)/dashboard/actions.ts` `rerollDisplayName`, `completeOnboarding` | Clerk `auth()` | Nickname generation; create/overwrite own `users` row (copies real name + email from Clerk) |
| `GET /api/users` | `requireUserId` | Up to 2000 other users, `PUBLIC_COLUMNS` = `clerk_id, display_name, gender, last_seen` |
| `POST /api/me/heartbeat` | `requireUserId` | Updates own `is_online`, `last_seen` |
| `GET /api/rooms/[roomId]` | `requireUserId` + `loadRoom` | Room state, last 500 messages, extensions, where each reveal request stands, and the partner's name and photo if they agreed and the caller paid |
| `POST /api/rooms/[roomId]/messages` | same | Insert message; rejects after expiry; then sends the partner a Web Push notification if push is configured (`lib/push.ts`) |
| ~~`POST /api/rooms/[roomId]/reveal`~~ | — | Removed 2026-10-14 (DEC-013): there is no free request; only a paying user may ask, through the connect payment |
| `GET /api/reveals` | `requireUserId` | Real name and photo of the dancers who agreed to share with the caller and whose reveal the caller paid for |
| `GET` / `POST` / `DELETE /api/push/subscribe` | `requireUserId` | Whether push is configured and its public key; store this browser's push subscription for the caller; remove the caller's subscription |
| `/admin`, `/admin/users`, `/admin/rooms` (pages) | `requireAdmin` (Clerk public metadata `role: "admin"`; 404 otherwise) | Counts and audit log; dancer roster including real name and email (each view recorded); room list without message text |
| `app/admin/actions.ts` `removeUser`, `removeRoom` | `requireAdmin` | Audit row first, then delete a dancer's profile, rooms and reveals (optionally banning the Clerk account), or delete one room |
| `POST /api/rooms/[roomId]/read` | same | Read receipts |
| ~~`POST /api/rooms/[roomId]/timer`~~ | — | Removed 2026-10-15 (DEC-014): chats have no time limit. `rooms.timer_started_at` stays in the schema and is no longer written |
| `POST /api/payment/create-order` | `requireUserId` | Creates a Razorpay order, ₹29 fixed server-side, and a `payment_orders` ledger row, for a chat extension or for a reveal the other dancer has already allowed (refused otherwise, PAY-017) |
| `POST /api/payment/verify` | `requireUserId` | HMAC check, ledger ownership check, payment fetched from Razorpay and checked (`captured`, order id, amount, currency), `fulfilOrder()`; returns `{ verified }` |
| `POST /api/webhooks/razorpay` | Signature only | Skips an event id already in `webhook_events`; `payment.captured` → `fulfilOrder()`; `payment.failed` → ledger `failed`; then records the event id and outcome |

### 3.4 Data model — Verified (source), `supabase/migrations/0001_init.sql`, `0002_payment_orders.sql`, `0003_fulfilment_failed_and_webhook_events.sql`, `0004_campus_branch.sql`, `0005_campus_vibe_outfit_instagram.sql`, `0006_contact_consent.sql`, `0006_push_subscriptions.sql`, `0007_admin_actions.sql`, `0008_reveal_requests.sql`, `0009_payment_product_connect.sql`, `0010_blocks_reports.sql`

| Table | Key columns | RLS read policy | Client writes |
|---|---|---|---|
| `users` | `clerk_id` unique, `display_name` unique, `gender`, `real_name`, `email`, `is_online`, `last_seen`; `branch`, `college_year` (0004); `vibe_tag`, `outfit_color`, `instagram_handle` (0005, all added 2026-10-14) | own row only | none (no write policies) |
| `rooms` | `id` = sorted Clerk ids joined by `_`, `participant_ids[2]`, `timer_started_at`, `unlimited` (0006) | participants | none |
| `messages` | `room_id` FK, `sender_id` (no FK), `text` 1–1000 chars, `read_by[]` | room participants | none |
| `reveals` | `payer_id`, `target_id`, `payment_id` unique, unique(`payer_id`,`target_id`). No longer read or written by the app since 2026-10-14 (DEC-003, DEC-012) | payer | none |
| `contact_consents` (0006, added 2026-10-14) | `room_id` FK, `requester_id`, `partner_id`, `status` (`pending`/`accepted`/`declined`/`expired`), `payment_order_id` unique FK, `requested_at`, `responded_at`; in Realtime publication | requester or partner | none |
| `contact_reveals` (0006, added 2026-10-14) | `room_id` FK, `user_a_id`, `user_b_id`, `consent_id` FK, `revealed_at`; unique(`user_a_id`, `user_b_id`) | pair only | none |
| `reveal_requests` (0008, added 2026-10-14) | `requester_id`, `target_id` (both FK → `users.clerk_id`, cascade), `status` (`pending`/`allowed`/`declined`/`revealed`), `responded_at`, `payment_id` unique, `revealed_at`; unique(`requester_id`,`target_id`); in the Realtime publication | requester or target | none |
| `chat_extensions` | `room_id` FK, `payment_id` unique, `extra_seconds` | room participants | none |
| `payment_orders` (0002, added 2026-10-14; product column in 0008/0009) | `user_id`, `room_id` (no FK), `order_id` unique, `payment_id` unique, `status` (`created`/`paid`/`failed`/`fulfilment_failed`/`refunded`), `amount`, `currency`, `product` (`connect`/`extend`/`reveal`) | none (service role only) | none |
| `webhook_events` (0003, added 2026-10-14) | `event_id` primary key (Razorpay event id), `event`, `order_id`, `payment_id` (no FKs), `outcome`, `received_at` | none (service role only) | none |
| `push_subscriptions` (0006, added 2026-10-14) | `user_id` FK → `users.clerk_id` (cascade delete), `endpoint` unique, `p256dh`, `auth`, `updated_at` | none (service role only) | none |
| `reports` (0010, added 2026-10-15) | `id`, `reporter_id`, `reported_id` (both FK → `users.clerk_id`, cascade), `reason` (≤ 500 characters), `created_at`; no self-report | none (service role only) | none |
| `blocks` (0010, added 2026-10-15) | `blocker_id`, `blocked_id` (both FK → `users.clerk_id`, cascade), `created_at`; primary key (`blocker_id`, `blocked_id`); no self-block | none (service role only) | none |
| `admin_actions` (0007, added 2026-10-14) | `admin_id`, `action` (`view_roster`/`remove_user`/`block_user`/`remove_room`), `target`, `created_at`; append-only | none (service role only) | none |

Realtime publication: `messages`, `rooms`, `chat_extensions`. `webhook_events` records the webhook events handled in Paid Mode; there is no fuller payment-event audit table and no blocks/reports tables. Whether this migration is what is actually applied to any live database is *Information Required*; the README instructs pasting it into the SQL editor, so there is no migration-version tracking.

### 3.5 Environment variables — Verified (source), names only

`.env.example` defines: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, four `NEXT_PUBLIC_CLERK_*_URL` vars, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`. `.env` and `.env*.local` are gitignored. `BILLING_MODE` (added 2026-10-13, documented in `.env.example`) is read only by `lib/billing.ts`. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (added 2026-10-14, optional, all server-only) are read only by `lib/push.ts`. The admin console needs no environment variable: admins are marked in Clerk (ADMIN-001).

---

## 4. Capability status

Classification of what exists today. "Implemented — unverified" means the code reads correctly but nothing has proven it works.

| Area | Status | Evidence / gap |
|---|---|---|
| Sign-up / sign-in (Clerk) | Implemented — unverified | `middleware.ts` protects `/dashboard`, `/chat`; API handlers call `requireUserId`. |
| Clerk misconfiguration screen | Implemented — unverified | `lib/clerkConfig.ts`, `components/layout/SetupNotice.tsx`; APIs return 503. |
| Onboarding + generated nickname | Implemented — unverified | Server validates generator pattern and uniqueness (`lib/displayNames.ts`, `actions.ts`). |
| Profile visibility (public fields only) | Implemented — unverified | `PUBLIC_COLUMNS` in `lib/server.ts:7`; exposes `clerk_id` and `last_seen` of every user. |
| Participant discovery | Implemented — unverified | `/api/users` + dashboard search/filter; no opt-out, no block filtering, 2000 cap. |
| Online presence | Partial | Public Realtime channel `lobby` with client-chosen keys (`hooks/useLobbyPresence.ts:18`). |
| One-to-one chat | Implemented — unverified | Room id derivation + `partnerFromRoomId` (`lib/room.ts`); writes via server. |
| Chat timer start / expiry | Retired (DEC-014, 2026-10-15) | Chats have no time limit; the timer route, countdown and expiry check were removed. |
| Realtime sync / reconnection | Partial | postgres_changes subscription; no resync of messages missed while disconnected. |
| Read receipts | Partial | Works in the normal case; read-modify-write race on `read_by[]`. |
| Blocking | Missing | — |
| Reporting / moderation | Partial — admin console can remove dancers and rooms and block sign-in (ADMIN-002); no way for users to report yet | `app/admin/*`, `lib/admin.ts` |
| Rate limiting / abuse prevention | Partial (2026-10-15) | Per-user, in-memory limits on room creation, messages, payment routes and account actions (CHAT-007); middleware turns away blank and scanner user agents (SEC-005). Not shared between server instances. |
| Age safeguards | Missing | — |
| Account deletion / retention | Missing | No Clerk deletion webhook; no retention policy. |
| Real name / email privacy from other browsers | Implemented — unverified | RLS own-row only; API selects public columns. |
| Identity sharing | **Conflicts** | Payer's ₹29 discloses target's real name + email with no consent from the target (`lib/server.ts:88-105`, `lib/payments.ts:37-49`). |
| Chat extension | Partial (paid only) | `chat_extensions`; no free path; purchasable before the timer starts, unlimited. |
| Billing mode (free/paid) | Partial | `lib/billing.ts`; payment routes and chat payment UI gated (tests pass). Landing copy advertised ₹29 until 2026-10-14 (FREE-003). |
| Payment order creation | Partial | Server-fixed amount/currency; no persisted order record. |
| Payment verification | Partial | Signature + order ownership; no authoritative payment-status fetch. |
| Webhook processing | Partial | Raw-body signature; `payment.captured` only; no event dedup, refund handling or failure state. |
| Payment audit / reconciliation | Missing | No payments table. |
| Automated tests / CI | Missing | No test files, no test script, no workflow. |

---

## 5. Core product requirements

### CORE-001 — Free Mode is the default product
- **Requirement:** With no billing configuration at all, every core feature (auth, onboarding, discovery, chat, safety tools) works, and nothing in the UI references payment.
- **Why:** Payment eligibility is unresolved (§8). The product must ship and be useful without it.
- **Files:** All of `app/`, `components/chat/*`, `components/modals/*`, `components/landing/*`.
- **Status:** Partial. Billing mode exists and chat/payment routes behave as Free Mode (in-process smoke test passes); landing payment claims removed 2026-10-14 (FREE-003); no deployment-level smoke test or network capture yet.
- **Depends on:** CFG-001, FREE-001…FREE-007.
- **Acceptance:** A deployment with zero `RAZORPAY_*` and no `BILLING_MODE` passes the Free Mode smoke test (TEST-007) with no payment UI, no request to any `razorpay.com` host, and no 5xx.
- **Evidence:** TEST-007 run log; network capture of a full session.
- **Risks:** Removing CTAs without deciding DEC-001/DEC-002 leaves dead ends (e.g. expired chat with no next step).

### CORE-002 — The server is authoritative
- **Requirement:** Billing mode, timer state, expiry, entitlements, identity disclosure and room membership are decided server-side. Client state is display only.
- **Why:** Anything decided in the browser can be forged.
- **Files:** `lib/server.ts`, `app/api/**`, `lib/payments.ts`.
- **Status:** Partial — true for writes, entitlements and expiry; timer-start presence condition is client-only (CHAT-003).
- **Depends on:** —
- **Acceptance:** For every route, a request crafted with arbitrary client state cannot change any of the above beyond what the server's own checks allow (TEST-003, TEST-004).
- **Evidence:** Authorization test suite.
- **Risks:** —

### CORE-003 — Two-minute conversation rule
- **Retired 2026-10-15 by DEC-014 (user instruction):** chats are free and have no time limit. The server accepts a message in a room at any time (`app/api/rooms/[roomId]/messages/route.ts`; `tests/chat-messages.test.ts`, `tests/smoke/free-mode.test.ts`). `FREE_CHAT_MS`, `isExpired`, `extraSecondsFor`, `effectiveExtraSeconds`, the timer route, `useChatTimer`, `ChatTimer` and `TimerExpiredOverlay` were removed. Messaging is limited per sender by CHAT-007 instead. The text below is the former requirement.
- **Requirement:** A room's clock starts once both participants have sent at least one message and both have the room open; after `120s + Σ granted extensions` the server rejects new messages. History remains readable to participants.
- **Why:** This is the product's defining mechanic.
- **Files:** Removed (see above).
- **Status:** Retired (DEC-014).
- **Depends on:** DEC-001 (what happens at expiry in Free Mode).
- **Acceptance:** See CHAT-003/CHAT-004.
- **Evidence:** See CHAT-003/CHAT-004. Expiry enforcement on send (403 after 120 s plus granted extensions, nothing written) is covered at route level by `tests/chat-expiry.test.ts` (database mocked), passing locally 2026-10-13.
- **Risks:** —

---

## 6. Free Mode objectives and acceptance criteria

### Billing configuration

#### CFG-001 — Billing mode resolution
- **Requirement:** A single server-only module (proposed `lib/billing.ts`, `import 'server-only'`) resolves the effective mode from `BILLING_MODE`. Rules: unset or empty → `free`; exactly `paid` (trimmed, case-insensitive) → *requested* paid; any other value → `free` **and** a logged configuration error. No other code reads `BILLING_MODE` directly.
- **Why:** Requirements 1–3 of the Free Mode decision: missing or invalid values must never enable Paid Mode.
- **Files:** `lib/billing.ts` (`resolveRequestedMode`, `getBillingStatus`; `import 'server-only'`). Not a `NEXT_PUBLIC_*` variable; a bundle scan found no `BILLING_MODE` in `.next/static`.
- **Status:** Verified (unit level).
- **Depends on:** —
- **Acceptance:** Unit test table: `undefined`, `""`, `"free"`, `"FREE"`, `"paid "`, `"Paid"`, `"true"`, `"1"`, `"premium"` resolve as specified; invalid values emit exactly one error log.
- **Evidence:** TEST-002 — `tests/billing.test.ts` "CFG-001" cases cover every input in the acceptance table plus extras; one-log-only and no-value-echo asserted. Evidence (2026-10-13, branch `feat/free-mode-billing-gate`): `npm test` 51/51 passed locally. Not yet run in CI (TEST-006).
- **Risks:** —

#### CFG-002 — Paid Mode fails closed
- **Requirement:** Effective mode is `paid` only if mode is requested as paid **and** a readiness check passes: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` present and well-formed, `NEXT_PUBLIC_RAZORPAY_KEY_ID` equals `RAZORPAY_KEY_ID`, and key prefix matches the environment (`rzp_live_` only in production, see DEP-001). If the check fails, paid features are unavailable (treated as free for UI, 503 for billing endpoints) and a configuration error is logged. Nothing is granted.
- **Why:** Requirement 4. A half-configured paid deployment must not take money it cannot verify.
- **Files:** `lib/billing.ts` (`checkPaidReadiness`, `billingDisabledResponse`); `lib/razorpay.ts` (`razorpay()` refuses to build a client unless effective mode is `paid`).
- **Status:** Partial. All readiness checks implemented and tested. Gap: "live keys only in production" is enforced by `NODE_ENV === 'production'`, which preview deployments also satisfy; a stricter environment check needs DEP-001.
- **Depends on:** CFG-001.
- **Acceptance:** Tests for each missing/malformed variable show effective mode ≠ `paid`, billing endpoints return 503 without constructing a Razorpay client.
- **Evidence:** TEST-002 — `tests/billing.test.ts` "CFG-002" (each missing/placeholder/malformed/mismatched variable, live key outside production, no values in logs); `tests/payment-routes.test.ts` "Paid Mode requested but not ready" (503, no Razorpay client, nothing granted). Evidence (2026-10-13, branch `feat/free-mode-billing-gate`): passed locally.
- **Risks:** —

#### CFG-003 — Credentials never imply Paid Mode
- **Requirement:** The presence of valid Razorpay credentials has no effect when `BILLING_MODE` is not `paid`.
- **Why:** Requirement 3. Test keys sitting in an `.env` must not switch on payments.
- **Files:** `lib/billing.ts`; gates in `app/api/payment/create-order/route.ts`, `verify/route.ts`, `app/api/webhooks/razorpay/route.ts`. (Before 2026-10-13 every payment route ran whenever called.)
- **Status:** Verified (route level). An in-process smoke test now also covers it; a browser/deployment-level check is still outstanding.
- **Depends on:** CFG-001, FREE-004.
- **Acceptance:** With full valid test credentials and `BILLING_MODE` unset, `create-order` returns the Free Mode response and no Razorpay API call is made.
- **Evidence:** `tests/billing.test.ts` "CFG-003"; `tests/payment-routes.test.ts` "Free Mode (BILLING_MODE unset, valid credentials present)" — `create-order` returns 403 with zero Razorpay or database calls. Evidence (2026-10-13, branch `feat/free-mode-billing-gate`): passed locally. Also `tests/smoke/free-mode.test.ts` (TEST-007, in-process, providers mocked; not a browser or provider test).
- **Risks:** —

#### CFG-004 — Mode reaches the client from the server
- **Requirement:** Client components learn the effective mode only from server-rendered props or an authenticated API response; the client never decides entitlement from it.
- **Why:** Requirement 6/7: the server is authoritative; the client only hides or shows UI.
- **Files:** `components/chat/ChatRoom.tsx`, landing components.
- **Status:** Partial. `app/(main)/chat/[roomId]/page.tsx` passes the server-decided `billingEnabled` to `ChatRoom`; the smoke test renders the real chat page and shows payment UI absent in Free Mode and present in effective Paid Mode (control case). Landing components are not yet mode-aware; no manual devtools check recorded.
- **Depends on:** CFG-001.
- **Acceptance:** Billing UI visibility is driven by a server-provided value; forcing it on in the browser yields only 403/503 from billing endpoints in Free Mode.
- **Evidence:** TEST-007 + manual devtools check recorded.
- **Risks:** —

#### CFG-005 — Validate core configuration
- **Requirement:** Missing or placeholder Supabase variables produce a clear setup error (like the existing Clerk screen), not stack traces from `createClient(undefined!)`.
- **Why:** Free Mode must be easy to stand up and must fail clearly.
- **Files:** `lib/supabase.ts`, `lib/supabaseAdmin.ts`, `lib/clerkConfig.ts` (pattern to follow).
- **Status:** Missing (Clerk-only validation exists).
- **Depends on:** —
- **Acceptance:** Each missing Supabase variable yields a named error on the setup screen and 503 from APIs.
- **Evidence:** Unit test of the validator; manual run recorded.
- **Risks:** —

### Free Mode behaviour

#### FREE-001 — Runs with no payment configuration
- **Requirement:** Build, start, sign-in, onboarding, discovery, chat, and safety features work with every `RAZORPAY_*` variable absent.
- **Why:** Requirement 8.
- **Files:** `lib/billing.ts`, payment routes (now 403 instead of 500 without credentials), `components/chat/ChatRoom.tsx`.
- **Status:** Partial.
- **Depends on:** CFG-001, FREE-003, FREE-004.
- **Acceptance:** TEST-007 passes; `next build` succeeds without Razorpay variables.
- **Evidence:** Evidence (2026-10-13, branch `feat/free-mode-billing-gate`): `next build` passed locally with all `RAZORPAY_*` and `BILLING_MODE` blanked. Also clean-worktree CI simulation 2026-10-13 (fresh `npm ci`, no `.env`, no provider variables): typecheck, lint, 58 tests and `next build` passed with no Clerk, Supabase or Razorpay variables at all. App not run in a browser; CI workflow not yet executed on GitHub.
- **Risks:** —

#### FREE-002 — No payment-gateway contact in Free Mode
- **Requirement:** In Free Mode the Checkout.js script is never loaded, the Razorpay SDK is never constructed, and no request goes to Razorpay.
- **Why:** Requirement 8; avoids leaking usage to a provider the product is not using.
- **Files:** `hooks/useRazorpay.ts` (loads `checkout.js` on click), `lib/razorpay.ts`.
- **Status:** Implemented — unverified. Checkout.js is loaded only by `useRazorpay().pay()`, which Free Mode UI no longer exposes; `razorpay()` throws unless effective mode is `paid` (tested). In-process smoke test asserts no Razorpay SDK construction and no `fetch` call across the Free Mode flow. No browser network capture recorded.
- **Depends on:** FREE-003, FREE-004.
- **Acceptance:** Network capture of a full Free Mode session shows zero `razorpay.com` requests, including after clicking every visible button.
- **Evidence:** TEST-007 network assertion.
- **Risks:** —

#### FREE-003 — No paid UI or paid claims in Free Mode
- **Requirement:** Free Mode shows no prices, checkout buttons, "Secured by Razorpay" text, or marketing copy about paid unlocks. Each removed affordance is replaced by the Free Mode behaviour decided in DEC-001/DEC-002, never by a broken button.
- **Why:** A coherent free experience; avoids advertising something that cannot be bought.
- **Files:** `components/chat/ChatRoom.tsx:184-188` (Reveal ₹29), `components/chat/TimerExpiredOverlay.tsx:36-38` (Extend ₹29), `components/modals/RevealModal.tsx`, `ExtendModal.tsx`, `BottomSheet.tsx` (`RazorpayButton`), `components/landing/*` (on 2026-10-14 the ₹29 feature card in `FeaturesReveal.tsx` was replaced, the "Payments by Razorpay" footer line in `ClosingCta.tsx` was removed, and `StatsCounter.tsx` and `Testimonials.tsx` were deleted; `HeroSection.tsx` no longer makes a paid claim since its copy was rewritten the same day).
- **Status:** Partial. Chat payment UI hidden (asserted by `tests/smoke/free-mode.test.ts` (TEST-007, in-process, providers mocked; not a browser or provider test)) in Free Mode (reveal button, reveal/extend sheets; the paid expiry button is replaced by "Back to dancers"). The reveal button and `RevealModal.tsx` were removed entirely on 2026-10-14 (DEC-002). The `FeaturesReveal` card "₹29 when it matters" was replaced on 2026-10-14 with one that makes no paid claim (`tests/refund-policy.test.ts`); later that day (DEC-008) `StatsCounter` and `Testimonials` were deleted and "Payments by Razorpay" was removed from the footer, so no landing component contains `₹`, `Razorpay`, `Pay` or `Unlock` (source search; rendered HTML not checked). Since 2026-10-15 (DEC-014) the policy pages follow the effective mode: in Free Mode the footer has no Refund Policy link, `/refund-policy` says nothing is charged, and Terms and Privacy name no payment, price or Razorpay (`tests/legal-pages.test.ts`); in Paid Mode the paid terms are published as GATE-004 requires.
- **Depends on:** CFG-004, DEC-001, DEC-002.
- **Acceptance:** Search of rendered HTML for every Free Mode page finds no `₹`, `Razorpay`, `Pay`, `Unlock` strings; expiry and identity flows reach a defined end state.
- **Evidence:** TEST-007 content assertions.
- **Risks:** Landing copy is not mode-aware: if Paid Mode is enabled later, the landing page will say nothing about the paid features.

#### FREE-004 — Billing endpoints are inert in Free Mode
- **Requirement:** In Free Mode, `create-order` and `verify` return a structured `403 {error:"billing_disabled"}` before touching Razorpay or the database. The webhook still verifies signatures, but in Free Mode it may fulfil **only** an order that satisfies all of:
  1. a ledger row (PAY-003) exists for the Razorpay order id;
  2. that row records that it was created while the effective mode was `paid` (e.g. `billing_mode_at_creation = 'paid'`);
  3. the row is still in a pre-fulfilment state (`created`/`paid`);
  4. full PAY-006 verification passes (payment fetched from Razorpay, order id, `captured` status, amount and currency match the ledger);
  5. PAY-011 preconditions still hold.

  Any other event is recorded and logged, and grants nothing. **Until PAY-003 exists, the webhook in Free Mode grants nothing at all.** It verifies the signature, logs the event for manual review or refund, and returns 200. Razorpay order notes alone are never sufficient to fulfil in Free Mode.
- **Why:** Requirements 6, 8 and 9. Customers who already paid must still be honoured after a rollback, but the webhook must not become a way to obtain entitlements while billing is disabled.
- **Files:** `app/api/payment/create-order/route.ts`, `verify/route.ts`, `app/api/webhooks/razorpay/route.ts` (Free Mode gate added 2026-10-13; since 2026-10-14 effective Paid Mode fulfils from the `payment_orders` ledger, not from order notes).
- **Status:** Partial. Done: `create-order`/`verify` return 403 `billing_disabled` (503 `billing_unavailable` if Paid Mode is requested but not ready) before any body parsing, database or Razorpay access; in any non-paid state the webhook still rejects bad signatures, and for valid ones grants nothing, logs event/payment/order ids (no personal data) and returns 200. Not done, by design: the rollback-continuity path (needs PAY-003/006/011), and *recording* ignored events (only logged until a ledger exists).
- **Depends on:** CFG-001; PAY-003, PAY-006, PAY-011 for the rollback-continuity path.
- **Acceptance:** Tests: Free Mode `create-order`/`verify` → 403 with no SDK call; Free Mode webhook with no ledger row → no grant, event logged, 200; ledger row created in Free Mode or already fulfilled → no grant; paid-era ledger row with a verified captured payment → fulfilled exactly once; paid-era row whose payment fetch fails verification → no grant, alert (OPS-003).
- **Evidence:** TEST-004 (Free Mode subset) — `tests/payment-routes.test.ts`. Evidence (2026-10-13, branch `feat/free-mode-billing-gate`): passed locally. Mutation check: removing either gate made 5 tests fail. Also `tests/smoke/free-mode.test.ts` (TEST-007, in-process, providers mocked; not a browser or provider test): correctly signed checkout response and captured-payment webhook grant nothing; Supabase client never created.
- **Risks:** Shipping the rollback-continuity path before the ledger exists would let signed-but-unexpected events grant entitlements. Building the Free Mode gate (no grants) does not depend on the ledger and should come first.

#### FREE-005 — Coherent chat expiry in Free Mode
- **Retired 2026-10-15 by DEC-014:** a chat no longer expires, so there is nothing to extend. The interim "Time's up" panel was removed.
- **Requirement (DEC-001 decided 2026-10-13):** When a Free Mode chat expires, the history stays readable and each participant may choose "keep talking". The server grants +2 minutes only once **both** participants have agreed for that expiry; either may decline, and a decline or no response leaves the chat closed. Extension requests and agreements are recorded server-side and are free.
- **Why:** The current overlay's only action is a ₹29 payment; extending a conversation with someone needs both people's agreement.
- **Files:** `components/chat/TimerExpiredOverlay.tsx`, `ChatRoom.tsx`; server grant should reuse `chat_extensions` with a non-payment source (new migration, DATA-001).
- **Status:** Retired (DEC-014). Before that: Missing (the mutual extension is not built). Interim closed state, 2026-10-13: when a Free Mode chat expires the thread stays readable and scrollable, the composer is replaced by a "Time's up" panel with "Back to dancers" (`components/chat/ChatRoom.tsx`), and the server refuses further messages (`tests/chat-expiry.test.ts`, `tests/smoke/free-mode.test.ts`).
- **Depends on:** FREE-003, DATA-001. Open: limit on the number of free extensions per room; whether a one-sided request expires.
- **Acceptance:** Tests: one agreement → no extra time; both agree → exactly +120 s, granted once even under concurrent requests; a request by a non-participant → 403; decline → chat remains closed; no paid affordance.
- **Evidence:** TEST-003, TEST-007.
- **Risks:** —

#### FREE-006 — Identity sharing in Free Mode follows the consent model
- **Requirement (DEC-002 decided 2026-10-13; revised by DEC-012 on 2026-10-14):** Free Mode offers no way to ask for, agree to or buy anyone's identity. A reveal already granted under ID-001 stays visible if the mode is switched off. The free, mutual exchange of ID-004 is not built.
- **Why:** Identity sharing is a safety feature first; it must not be gated by payment.
- **Files:** `app/api/payment/create-order/route.ts` (the only way to ask; refused with billing off), `components/chat/ChatRoom.tsx`.
- **Status:** Implemented. Since 2026-10-14 (DEC-013) there is no free request of any kind; asking means paying for `connect`, which is refused with billing off (`tests/smoke/free-mode.test.ts`, `tests/payment-routes.test.ts`). A name and photo shared before then still shows in either mode.
- **Depends on:** ID-001…ID-004.
- **Acceptance:** See ID-001.
- **Evidence:** See ID-001.
- **Risks:** —

#### FREE-007 — Mode switches are non-destructive
- **Requirement:** Changing `BILLING_MODE` in either direction deletes or rewrites no users, rooms, messages, payment records or entitlements. Previously granted extensions keep counting toward room time. Previously granted identity reveals are handled per DEC-003.
- **Why:** Requirement 9.
- **Files:** `lib/server.ts` (`extraSecondsFor` counts every extension irrespective of mode; since 2026-10-14 by when each was paid for, PAY-018; `rooms.unlimited`, `contact_consents` and `contact_reveals` are read in every mode).
- **Status:** Implemented — unverified for extensions (no mode code exists that could delete anything); reveals pending DEC-003. Since 2026-10-14 the same holds for connect requests: `rooms.unlimited`, `contact_consents` and `contact_reveals` are read in every mode, and `POST /api/rooms/[roomId]/consent` is not gated on the billing mode, so a request paid for in Paid Mode can be answered, and a connected room stays unlimited, after a switch to Free Mode (`tests/smoke/free-mode.test.ts` renders both with no payment UI; no mode-flip integration test). The server also runs on a database without migration 0006 (`tests/consent-flow.test.ts` "a database without migration 0006").
- **Depends on:** CFG-001, DEC-003.
- **Acceptance:** Integration test: seed data, flip mode free→paid→free, row counts and room remaining-time unchanged.
- **Evidence:** TEST-004 / TEST-005.
- **Risks:** —

#### FREE-008 — Configuration cannot bypass gates
- **Requirement:** Setting `BILLING_MODE=paid` in production is a release action that requires the §8 gates to be recorded as passed. Changing a variable is not approval.
- **Why:** Requirement 10.
- **Files:** process, not code; see §15 and §20.
- **Status:** Missing (process not yet adopted).
- **Depends on:** GATE-001…GATE-008.
- **Acceptance:** The production change record for enabling Paid Mode links to the completed §20 checklist.
- **Evidence:** Change record.
- **Risks:** —

### Core features under Free Mode

#### AUTH-001 — Authentication on every non-public surface
- **Requirement:** All pages except landing/auth and all API routes except the Razorpay webhook require a Clerk session; the webhook is authenticated by signature only.
- **Files:** `middleware.ts:6`, `lib/server.ts` (`requireUserId`), `actions.ts`.
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** Unauthenticated request to each route returns 401 (API) or redirect (page); webhook without valid signature returns 400.
- **Evidence:** TEST-003 route-by-route table.
- **Risks:** New routes added without `requireUserId` — mitigated by the route-table test failing on any unlisted route.

#### ONB-001 — Generated nicknames
- **Requirement:** Users choose only server-generated nicknames, unique across users.
- **Files:** `lib/displayNames.ts`, `app/(main)/dashboard/actions.ts`, `users.display_name unique`.
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** Non-pattern names rejected; concurrent claims of the same name produce one success and one user-visible retry message.
- **Evidence:** Unit test of `isGeneratedName`; integration test of uniqueness.
- **Risks:** `completeOnboarding` upserts, so a user can change nickname/gender at will by re-calling the action; this will let users evade blocks once SAFE-001 exists unless blocks key on `clerk_id` (they must).

#### ONB-002 — Data minimisation at onboarding
- **Requirement:** Collect only data with a stated purpose. Real name and email are copied from Clerk into `users` only if the identity-sharing feature (DEC-002) needs them, and the user is told why. Profile photos are not collected unless used.
- **Why:** DPDP-style purpose limitation; reduces breach impact.
- **Files:** `actions.ts:30-45` copies `real_name`, `email`; `components/dashboard/OnboardingModal.tsx:29-32` uploads a profile photo to Clerk that the app never displays (`components/ui/Avatar.tsx` is initials-only).
- **Status:** Conflicts. Since the 2026-10-14 merge of `origin/main`, onboarding also collects `branch`, `college_year`, `vibe_tag` and `outfit_color` (public, shown in discovery and the campus leaderboard) and `instagram_handle` (private). No code path shows `instagram_handle` to anyone, so it is collected with no current purpose (since DEC-012 the real name and the uploaded photo do have one: the consent-based reveal; the email is used only by the admin roster); whether to keep it for the ID-004 exchange or stop collecting it needs an owner decision.
- **Depends on:** DEC-002, PRIV-006.
- **Acceptance:** Every stored personal field maps to a documented purpose in the privacy notice; unused collection removed.
- **Evidence:** Data inventory in privacy notice; code review.
- **Risks:** —

#### DISC-001 — Discovery returns public fields only
- **Requirement:** Discovery responses contain only approved public fields, exclude blocked users in both directions, and exclude users who have opted out of discovery or deleted their account.
- **Files:** `app/api/users/route.ts`, `lib/server.ts:7`.
- **Status:** Partial — public columns only; no block/opt-out filtering; returns `clerk_id` and `last_seen` for up to 2000 users to any signed-in account. Since the 2026-10-14 merge of `origin/main` the response also carries `branch`, `college_year`, `vibe_tag` and `outfit_color`; these are not yet recorded as approved public fields by an owner decision (DEC-009). `tests/campus-privacy.test.ts` asserts that `real_name`, `email` and `instagram_handle` are never selected or returned (database mocked; passing locally 2026-10-14).
- **Depends on:** SAFE-001, DEC-009.
- **Acceptance:** Response schema test asserts exact key set; blocked users absent.
- **Evidence:** TEST-003.
- **Risks:** `last_seen` + presence lets any user track others' activity; whether that is acceptable is DEC-009.

#### DISC-002 — Presence
- **Requirement:** Online status is visible only to authenticated users, and a client cannot claim to be someone else.
- **Files:** `hooks/useLobbyPresence.ts:18`, `hooks/useSupabaseRealtime.ts:27`.
- **Status:** Partial — see PRIV-005.
- **Depends on:** PRIV-005.
- **Acceptance:** See PRIV-005.
- **Evidence:** See PRIV-005.
- **Risks:** —

#### CHAT-001 — One-to-one rooms
- **Requirement:** A room is accessible to exactly its two participants; any other user, or a malformed room id, gets 403 and no data.
- **Files:** `lib/room.ts` (`roomIdFor`, `partnerFromRoomId`), `lib/server.ts` (`loadRoom`).
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** Tests with third-party user, self-room (`a_a`), malformed ids, ids containing extra underscores, and URL-encoded variants all return 403 with no room row created.
- **Evidence:** TEST-003.
- **Risks:** `loadRoom` creates a room row on first GET for any onboarded pair — acceptable, but blocked pairs must be rejected once SAFE-001 exists.

#### CHAT-002 — Message integrity
- **Requirement:** Messages are written only by the server with `sender_id` = authenticated user, length-limited, and readable only by participants.
- **Files:** `app/api/rooms/[roomId]/messages/route.ts`, migration RLS on `messages`.
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** Direct anon/authenticated inserts via Supabase REST fail; non-participant SELECT returns zero rows.
- **Evidence:** TEST-005 (RLS).
- **Risks:** —

#### CHAT-003 — Timer start conditions enforced server-side
- **Retired 2026-10-15 by DEC-014:** there is no clock to start; `POST /api/rooms/[roomId]/timer` was deleted.
- **Requirement:** The server starts the clock only when both participants have sent a message **and** both are verifiably present, or the "both present" condition is formally dropped (DEC-001).
- **Files:** Removed.
- **Status:** Retired (DEC-014).
- **Depends on:** PRIV-005, DEC-001.
- **Acceptance:** A `POST /timer` while the partner is not present does not start the clock (or the requirement is amended).
- **Evidence:** TEST-003.
- **Risks:** —

#### CHAT-004 — The time limit cannot be sidestepped
- **Retired 2026-10-15 by DEC-014:** there is no time limit to sidestep. The harassment concern it raised (unlimited one-sided messaging) now applies to every chat and is held back only by CHAT-007's per-sender rate limit until SAFE-001/002 exist.
- **Requirement:** Define and enforce what limits messaging before the clock starts. Today, if the two participants are never in the room simultaneously, the timer never starts and they can exchange unlimited messages; a sender can also send unlimited messages to someone who never replies.
- **Files:** `messages/route.ts:12` (expiry only checked after start), `ChatRoom.tsx:71-83`.
- **Status:** Retired (DEC-014). Before that: Partial. By decision (DEC-002, second revision of 2026-10-14) a room that has been paid for has no time limit from the moment of payment: `rooms.unlimited` makes `isExpired` return false, whatever the partner later answers (`tests/chat-expiry.test.ts`, `tests/consent-flow.test.ts`). The other person is not asked about this and cannot undo it (R-13).
- **Depends on:** DEC-001, CHAT-007.
- **Acceptance:** Documented pre-start limit (e.g. N messages per sender before reply, or timer starts on first reply) enforced server-side and tested.
- **Evidence:** TEST-003.
- **Risks:** Unlimited one-sided messaging is also a harassment vector (SAFE-*).

#### CHAT-005 — Realtime sync and reconnection
- **Requirement:** After a network drop or tab resume, the client reconciles messages, timer and extensions from the server so no message is silently missing.
- **Files:** `hooks/useSupabaseRealtime.ts`, `ChatRoom.tsx` (`refresh` only fetches timer/extension/reveal, not messages).
- **Status:** Partial.
- **Depends on:** —
- **Acceptance:** Test: disconnect client, partner sends 3 messages, reconnect → all 3 appear in order without reload.
- **Evidence:** Manual or E2E test record.
- **Risks:** —

#### CHAT-006 — Read receipts consistent
- **Requirement:** Marking read never drops another reader's entry.
- **Files:** `app/api/rooms/[roomId]/read/route.ts` (read-modify-write of `read_by[]`).
- **Status:** Partial (benign in two-person rooms because each user only adds themself, but concurrent calls by the same user can race).
- **Depends on:** —
- **Acceptance:** Single SQL `array_append` guarded update, or documented acceptance of the race.
- **Evidence:** Code review.
- **Risks:** Low.

#### CHAT-007 — Rate limiting
- **Requirement:** Per-user limits on message sends, room creation, heartbeat, onboarding, and order creation.
- **Files:** `lib/rateLimit.ts` (`LIMITS`, `enforceRateLimit`, `hit`); `messages/route.ts`; `lib/server.ts` (`findOrCreateRoom`); `payment/create-order` and `payment/verify` (before the billing gate, with no database or Razorpay access); `consent/route.ts`; `me/heartbeat/route.ts`; `push/subscribe/route.ts`; `dashboard/actions.ts`.
- **Status:** Partial (2026-10-15). Limits per signed-in user, per minute: 5 new rooms, 30 messages, 10 payment calls, 10 account actions (onboarding, nickname reroll, push subscribe/unsubscribe, consent answer, heartbeat). Over the limit a route answers 429 with `Retry-After`; `completeOnboarding` returns an error and `rerollDisplayName` skips the database. The request asked for per-IP limits; they are per user because many phones at one venue share a Wi-Fi or carrier address. Counts live in each server process's memory (no new infrastructure), so several instances each allow the full amount and a restart resets them. Not limited: `GET` routes, `read`, the Razorpay webhook (signature-authenticated) and admin actions.
- **Depends on:** a shared store (e.g. Redis) for an exact cross-instance cap. That is new infrastructure and needs an owner decision.
- **Acceptance:** Exceeding the limit returns 429; limits documented.
- **Evidence:** `tests/rate-limit.test.ts` (limiter windows; the sixth new room is refused and not created, while reopening is allowed; payment routes answer 429 after 10 calls with no database or Razorpay access; heartbeat), `tests/chat-messages.test.ts` (the 31st message gets 429 with `Retry-After`, per user). Passed locally 2026-10-15 with a mocked database; not yet run in CI.
- **Risks:** Spam and harassment during peak event hours; per-instance counting weakens the cap on serverless hosting.

#### NOTIF-001 — In-app new-message notifications
- **Requirement (added 2026-10-14, maintainer instruction):** A signed-in user anywhere in the app is told when a message arrives in a chat they do not have open: a toast with the sender's nickname and the message, a short sound, a vibration, an unread count on that dancer's card and on the navbar, and a count in the tab title. It must use data the user is already allowed to read, and add no channel another user could listen on.
- **Files:** `components/layout/MessageNotifier.tsx` (mounted in `app/(main)/layout.tsx`), `store/useAppStore.ts` (`unread`), `components/dashboard/Dashboard.tsx`, `components/layout/Navbar.tsx`, `components/chat/ChatRoom.tsx`.
- **Status:** Implemented — unverified. Listens for `INSERT` on `messages` through Realtime postgres_changes, which row-level security limits to the user's own rooms; no broadcast channel was added (PRIV-005 is not made worse). Unread counts live in memory and reset on reload.
- **Depends on:** SEC-003 (the `messages` read policy is what scopes delivery).
- **Acceptance:** With two accounts: B on the dashboard receives a toast when A sends, and none for a chat B has open; a third account receives nothing.
- **Evidence:** Manual two-account run (not yet done); TEST-005 for the policy.
- **Risks:** Every signed-in tab holds an unfiltered postgres_changes subscription, so each inserted message costs one row-level-security check per online user. Fine for a single event; revisit before large audiences.

#### NOTIF-002 — Web Push notifications
- **Requirement (added 2026-10-14, maintainer instruction to use a service worker):** A user who has turned notifications on in a browser is notified of a new message when the app is in the background or closed. Push is optional: with no `VAPID_*` variables the app behaves as before. The notification carries the sender's public nickname and the room to open, never the message text, real name or email. The server posts only to known push-service hosts. A subscription belongs to whoever is signed in on that browser, and is dropped on sign-out, on turning notifications off, and when the push service reports it gone.
- **Files:** `lib/push.ts`, `app/api/push/subscribe/route.ts`, `app/api/rooms/[roomId]/messages/route.ts`, `public/sw.js`, `lib/pushClient.ts`, `components/dashboard/NotificationToggle.tsx`, `supabase/migrations/0006_push_subscriptions.sql`.
- **Status:** Implemented — unverified. Route and library behaviour is covered by tests with the push library and database mocked; nothing has been sent through a real push service, and migration 0006 has not been applied by this change.
- **Depends on:** DATA-001 (migration 0006), SEC-001, SEC-002, SEC-004, PRIV-003; PRIV-004 for deletion (the foreign key cascades).
- **Acceptance:** Tests: unauthenticated and malformed subscribe requests are refused; an endpoint outside the push services is refused and never posted to; a subscription is stored under the caller only; the payload has no message text; a 404/410 removes the subscription; a send failure never fails the message. Plus a two-device run: B, with the tab in the background, gets a system notification that opens the chat.
- **Evidence:** `tests/push.test.ts` (38 tests), `tests/chat-expiry.test.ts` "notifies the partner, by nickname and room only…". Passed locally 2026-10-14; not yet run in CI. Two-device run: not yet done.
- **Risks:** No per-user notification preferences beyond on/off, and no rate limit (CHAT-007), so a sender can trigger one notification per message (the same chat replaces its previous notification). iPhone Safari only delivers push to a site added to the home screen. Blocking (SAFE-001) does not exist yet, so a blocked sender cannot yet be silenced.

---

## 7. Paid Mode objectives and acceptance criteria

Everything in this section is **inactive until Paid Mode is effective** (CFG-002) and the §8 gates pass. The reported concept was ₹29 per optional digital feature (chat extension; identity sharing). Per DEC-002 (2026-10-13) identity sharing is free and is **not** a paid product. A paid chat extension and its price remain **proposals, not approved business decisions** (DEC-004, DEC-010), and must coexist with the free mutual extension (FREE-005). **DEC-002 was revised on 2026-10-14:** the stated paid product is now mutual-consent contact exchange plus unlimited chat for ₹29. It was built the same day, and corrected later that day: a captured payment makes the room unlimited at once and creates a pending request; only the partner's acceptance exchanges contact details (`lib/payments.ts`, `lib/consent.ts`, migration `0006_contact_consent.sql`). Where a PAY-* entry below still says "extension" or "grant", read it as that request; entries changed by this are marked.

**Payment verification ≠ entitlement fulfilment.** Verifying a payment proves money moved for a server-created order. Fulfilment is a separate step that re-checks whether the entitlement may still be granted (room exists, users not blocked, consent present). A verified payment that cannot be fulfilled goes to a recoverable state and, if necessary, a refund — it never forces the grant.

**A valid payment never authorises disclosure of another person's private information.** Identity disclosure is governed solely by ID-001…ID-004.

#### PAY-001 — Paid features gated by effective mode
- **Requirement:** Every billing endpoint and paid UI checks the effective mode (CFG-001/002) server-side.
- **Files:** `app/api/payment/*`.
- **Status:** Partial. All three billing endpoints and the chat payment UI check the effective mode server-side (tested); landing marketing copy is not mode-aware (FREE-003).
- **Depends on:** CFG-001, CFG-002.
- **Acceptance:** See FREE-004.
- **Evidence:** TEST-004.
- **Risks:** —

#### PAY-002 — Server-side catalogue, price and currency
- **Requirement:** Products, prices and currency come from a server-side catalogue keyed by product id. The client sends only the product id and context ids. Fulfilment checks paid amount **and** currency against the catalogue entry recorded on the order.
- **Files:** `lib/room.ts:24` (`PRICE_PAISE`), `create-order/route.ts` (amount and `'INR'` fixed server-side and written to the ledger row), `app/api/webhooks/razorpay/route.ts` (captured amount and currency compared with the ledger row).
- **Status:** Partial. The webhook refuses to fulfil when the captured amount or currency differs from the ledger row (tested). Since 2026-10-14 `verify` compares the amount and currency of the payment fetched from Razorpay with the ledger row (tested, PAY-006). No product catalogue; a mismatch is logged, not recorded.
- **Depends on:** PAY-003.
- **Acceptance:** Tests: amount mismatch and currency mismatch both refuse fulfilment and record the anomaly.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "a captured payment whose amount/currency differs from the ledger grants nothing" (passed locally 2026-10-14, mocked database).
- **Risks:** —

#### PAY-003 — Persisted order and payment ledger
- **Requirement:** A `payment_orders` (or similar) table records every order created: internal id, Razorpay order id (unique), owner `clerk_id`, product, context (room/target), amount, currency, status (`created → paid → fulfilled` / `failed` / `fulfilment_failed` / `refunded`), timestamps. Payment events append to an audit table.
- **Why:** Auditability, reconciliation, ownership checks that do not depend solely on provider-side notes, and recovery.
- **Files:** `supabase/migrations/0002_payment_orders.sql`, `0003_fulfilment_failed_and_webhook_events.sql`, `lib/payments.ts` (`recordOrder`, `getOrder`, `settlePayment`, `fulfilOrder`, `recordFailedPayment`, `recordEvent`).
- **Status:** Partial. **Decision 2026-10-14 (maintainer instruction):** a `payment_orders` table with columns `id`, `user_id`, `room_id`, `order_id`, `payment_id`, `status`, `amount`, `currency`, `created_at`; no payment columns on `users`. `create-order` writes one row per Razorpay order; `verify` and the webhook move it `created → paid` or `failed` (`paid` is final). Gaps against the requirement: no product column (one product today), no `fulfilled` / `refunded` states (`fulfilment_failed` was added 2026-10-14 by migration 0003, PAY-010), no transition timestamps or source, no full audit table of payment events (`webhook_events` records handled webhook events in Paid Mode, not `verify` transitions), no record of the billing mode at creation (FREE-004 continuity path). The migration has not been applied to any database from this repository, and 0003 must be applied with it; tests use a mocked database. Later on 2026-10-14 migration `0006_contact_consent.sql` added the state `refunded` (set by hand once a `fulfilment_failed` order has been refunded); `paid` and `refunded` are final for the payment handlers (tested). A `refund_due` state existed for a few hours and was removed when declines stopped being refunded. `contact_consents.payment_order_id` links a request to its order.
- **Depends on:** DATA-001 (new migration).
- **Acceptance:** Every Razorpay order created by the app has exactly one ledger row; every state transition is recorded with a timestamp and source (`verify`, `webhook`, `reconcile`, `admin`).
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "records the order in the ledger as created, owned by the caller" and the verify/webhook transition tests (passed locally 2026-10-14, mocked database); reconciliation report (PAY-013) outstanding.
- **Risks:** —

#### PAY-004 — Authenticated order ownership
- **Requirement:** Only the user who created an order can verify it; ownership is checked against the ledger.
- **Files:** `verify/route.ts` (ledger row `user_id === userId`; an order with no ledger row is refused).
- **Status:** Verified (unit, mocked database). Ownership is checked against the ledger since 2026-10-14.
- **Depends on:** PAY-003.
- **Acceptance:** Verifying another user's order returns 403 and grants nothing.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "refuses another user's order with 403 and grants nothing", "refuses a correctly signed order that is not in the ledger". Passed locally 2026-10-14; not yet run in CI.
- **Risks:** —

#### PAY-005 — Checkout signature verification
- **Requirement:** `HMAC_SHA256(order_id|payment_id, key_secret)` compared in constant time.
- **Files:** `lib/razorpay.ts` (`verifyCheckoutSignature`, constant-time compare).
- **Status:** Verified (unit).
- **Depends on:** CFG-002 (a missing secret now verifies nothing instead of throwing).
- **Acceptance:** Forged, truncated, wrong-order and empty signatures rejected.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "returns 400 { verified: false } for …" (forged, wrong secret, different order, truncated, empty, missing fields) and "returns 200 { verified: true } for a correct signature". Passed locally 2026-10-14; not yet run in CI.
- **Risks:** —

#### PAY-006 — Authoritative payment status
- **Requirement:** Before marking an order paid, the server fetches the payment from Razorpay and confirms `order_id` matches, `status` is `captured` (or `authorized` with an explicit capture step), and amount/currency match.
- **Files:** `verify/route.ts` (after the signature and ownership checks, fetches the payment with `razorpay().payments.fetch`), webhook (trusts the signed event payload, compared with the ledger amount and currency; does not fetch).
- **Status:** Partial. Since 2026-10-14 `verify` grants only when Razorpay reports the payment `captured`, for the same order id, at the ledger amount and currency. Otherwise it returns 400 `{ verified: false, reason }` with `payment_not_captured` or `amount_mismatch`, or 502 `payment_unconfirmed` when Razorpay cannot be asked. There is no explicit capture step: an `authorized` payment is refused and left for the `payment.captured` webhook. Gaps: the webhook does not fetch the payment; nothing here has been run against Razorpay (mocked SDK).
- **Depends on:** PAY-003.
- **Acceptance:** Tests with a mocked provider returning `failed`, `authorized`-then-not-captured, and mismatched order id all refuse fulfilment.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "refuses a correctly signed checkout when Razorpay says the payment …" (failed, authorized, created, different order), "refuses a captured payment whose amount/currency differs from the ledger", "grants nothing when the payment cannot be fetched from Razorpay" (passed locally 2026-10-14, mocked SDK and database; `verify` path only).
- **Risks:** —

#### PAY-007 — Webhook verification on the exact raw body
- **Requirement:** Signature over the unmodified raw body; reject before parsing; malformed JSON after a valid signature returns 400 and is logged, not a crash.
- **Files:** `app/api/webhooks/razorpay/route.ts` (raw body via `req.text()`, signature checked before `parseEvent`).
- **Status:** Verified (unit) for the Paid Mode path. In Free Mode a signed but unparseable body is still acknowledged with 200 and grants nothing (FREE-004).
- **Depends on:** CFG-002.
- **Acceptance:** Body re-serialised with different whitespace fails; malformed signed body → 400.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "rejects a body that was changed after signing", "returns 400 for a signed body that is not a Razorpay event". Passed locally 2026-10-14; not yet run in CI.
- **Risks:** —

#### PAY-008 — Idempotent, concurrency-safe processing
- **Requirement:** Each Razorpay payment id is processed at most once; each webhook event id is recorded; concurrent `verify` + webhook for the same payment produce one fulfilment. Every captured payment ends in a recorded state — never silently discarded.
- **Files:** `lib/payments.ts` (`settlePayment`: an order already `paid` is not written again; the grant is an upsert keyed on `chat_extensions.payment_id`; `hasProcessedEvent`, `recordEvent`), `app/api/webhooks/razorpay/route.ts`, `0003_fulfilment_failed_and_webhook_events.sql` (`webhook_events`).
- **Status:** Partial. The reveal double-payment defect went with the paid reveal path (2026-10-14). Repeated `verify`, repeated webhook delivery, and `verify` followed by the webhook grant once (tested, mocked database). Since later on 2026-10-14 the webhook records each handled event id with its outcome in `webhook_events` (Paid Mode only) and acknowledges a redelivered id without acting on it (tested). The event is recorded only after handling finishes, so an event that ended in a 5xx is processed again on redelivery. The lookup and the insert are not atomic: two simultaneous deliveries of one event can both be handled, which `settlePayment`'s own idempotency covers. An event with no `x-razorpay-event-id` header is handled but not recorded. Gaps: two different orders for the same room each grant +2 min rather than one becoming `duplicate_purchase`; truly concurrent requests are not tested against a real database (they rely on the `payment_id` unique constraint). Since later on 2026-10-14 a second paid order for a room that already has an open or accepted request, or from someone who has already asked there, creates nothing and is left `fulfilment_failed` with reason `duplicate_request` for refund (unique indexes in migration 0006; tested with the mocked database, and the indexes themselves exercised once in Postgres). `create-order` refuses those cases, and any room that is already unlimited, before any money is taken, so this only covers two checkouts opened at the same time.
- **Depends on:** PAY-003.
- **Acceptance:** Concurrency test: two orders for the same product/context both paid → one fulfilled, the other `duplicate_purchase` and queued for refund; duplicate webhook delivery is a no-op.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "replaying a verified payment grants nothing more", "a repeated payment.captured is acknowledged without writing again", "verify followed by the webhook for the same payment grants once", "records each handled event with its id and outcome", "a redelivered event id is skipped before anything is written", "a redelivered payment.failed cannot undo a retry that has since succeeded" (passed locally 2026-10-14, mocked database).
- **Risks:** A captured payment for an order with no ledger row is only logged.

#### PAY-009 — Event coverage and ordering
- **Requirement:** Handle `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` (and any others the gates require) in any arrival order; ledger transitions are monotonic.
- **Files:** webhook handles `payment.captured` and `payment.failed`; `lib/payments.ts` (`recordFailedPayment`).
- **Status:** Partial. `payment.failed` marks the order failed; a late `payment.failed` never downgrades a paid order, and a failed attempt can be followed by a successful one on the same order (tested). `order.paid` and `refund.processed` are acknowledged and ignored.
- **Depends on:** PAY-003.
- **Acceptance:** Tests deliver events out of order and duplicated; final state is correct.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "payment.failed marks the order failed and grants nothing", "a late payment.failed never downgrades a paid order" (passed locally 2026-10-14).
- **Risks:** —

#### PAY-010 — Recoverable fulfilment
- **Requirement:** Mark-paid and grant-entitlement happen in one database transaction (Postgres function), or the order is left in `fulfilment_failed` with retry. A webhook must not loop forever on a permanent failure.
- **Files:** `lib/payments.ts` — an extension for a room with no `rooms` row violates the FK, throws, and the webhook returns 500 indefinitely while the customer has paid. `create-order` checks only the room-id string shape (`partnerFromRoomId`), not that the room exists.
- **Status:** Partial. Since 2026-10-14 `settlePayment` grants first and marks the order paid second, so a crash between the two writes is repaired by the next delivery. Since later that day `fulfilOrder` treats two failures as permanent — a room id the buyer is not part of, and a missing `rooms` row (Postgres `23503`): the order is left `fulfilment_failed` with the payment id, `[billing] fulfilment_failed …` is logged with ids only, the webhook returns 200 and `verify` returns 409. Any other error is treated as temporary and still returns 5xx so the event is redelivered. A later delivery settles a `fulfilment_failed` order if the cause has gone, and a late `payment.failed` does not overwrite it. Gaps: no transaction (grant and mark-paid are still two writes); the alert is only a log line (OPS-003 missing); no refund queue (PAY-012); `create-order` still does not check that the room exists; migration 0003 is not applied to any database; mocked database only. Later on 2026-10-14 the grant became: upsert the `contact_consents` row keyed on the order, set `rooms.unlimited`, then mark the order paid. If the flag cannot be set the order is not marked paid: a database error returns 5xx for redelivery, and a missing room is `fulfilment_failed` (tested). `duplicate_request` is a third permanent failure. `create-order` now loads the room and both profiles first, so it no longer takes money for a room that does not exist. Still three writes, not one transaction; each is idempotent, so a redelivery completes a partial run. The partner's answer, by contrast, is one transaction (ID-001).
- **Depends on:** PAY-003.
- **Acceptance:** Forced fulfilment failure leaves a `fulfilment_failed` row, an alert (OPS-003), and returns 200 to the provider after recording.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "a captured payment for a room that no longer exists is recorded as fulfilment_failed and acknowledged", "… for a room the buyer is not in …", "a temporary database error returns 500 and the redelivery of the same event then fulfils", "an order left fulfilment_failed is settled by a later event once the cause is gone", "a late payment.failed never overwrites a fulfilment_failed order", and the `verify` case returning 409 (passed locally 2026-10-14, mocked database). No alert evidence.
- **Risks:** —

#### PAY-011 — Preconditions re-checked at fulfilment
- **Requirement:** At fulfilment time, re-verify the entitlement is still grantable: room exists, both users still exist, not blocked, product rules (DEC-004) allow it. Identity-related products additionally require ID-001 consent at disclosure time.
- **Files:** `lib/payments.ts`.
- **Status:** Partial. Since 2026-10-14 `create-order` refuses to take money unless the room exists, both dancers have a profile, the room has no open or accepted request and the buyer has not already asked there (`tests/payment-routes.test.ts`). At fulfilment the database refuses a request for a missing room or a duplicate (foreign key and unique indexes, migration 0006), leaving the order `fulfilment_failed`. Disclosure additionally needs the partner's acceptance (ID-001). Not done: blocking (SAFE-001 is not built), and no check that the partner still has a profile at fulfilment time.
- **Depends on:** SAFE-001, ID-001, DEC-004.
- **Acceptance:** Tests: block between order and payment → not granted, refund queued.
- **Evidence:** TEST-004.
- **Risks:** —

#### PAY-012 — Refunds and revocation
- **Requirement:** A defined refund policy (DEC-007); refunds recorded in the ledger; entitlement revocation rules specified.
- **Files:** `app/(main)/refund-policy/page.tsx` (policy text), `components/landing/ClosingCta.tsx` (footer link), `supabase/migrations/0006_contact_consent.sql` (`refunded` state), `lib/payments.ts` (`fulfilOrder`).
- **Status:** Partial. The policy is defined (DEC-007, as revised twice on 2026-10-14) and published at `/refund-policy`, and it matches what the code does (`tests/refund-policy.test.ts`, `tests/consent-flow.test.ts`): a payment that unlocks the chat is never refunded, whatever the partner answers, and neither a decline nor an expiry touches the order. The one refund case, a captured payment that did not unlock the chat, is an order left `fulfilment_failed`; that state is the refund queue. Gaps: refunds are made by hand and the order is set to `refunded` by hand; the only alert is a log line (OPS-003); `refund.processed` is still acknowledged and ignored (PAY-009); no revocation rules (ID-003); the page is not deployed or legally reviewed (GATE-004).
- **Depends on:** DEC-007, PAY-003, PAY-009.
- **Acceptance:** Refund event updates ledger; policy text published (GATE-004).
- **Evidence:** TEST-004; published policy. Policy text only: `tests/refund-policy.test.ts` (passed locally 2026-10-14); unauthenticated `GET /refund-policy` returned 200 with the policy text on a local dev server the same day. No live URL.
- **Risks:** —

#### PAY-013 — Reconciliation
- **Requirement:** A repeatable procedure (script or admin route) compares Razorpay orders/payments for a date range with the ledger and lists mismatches.
- **Files:** none.
- **Status:** Missing.
- **Depends on:** PAY-003.
- **Acceptance:** Run against test-mode data with seeded mismatches; all detected.
- **Evidence:** Reconciliation output.
- **Risks:** —

#### PAY-014 — The client never grants
- **Requirement:** The UI shows an entitlement only from a server response; a redirect, `razorpay_payment_id`, or client store value grants nothing.
- **Files:** `hooks/useRazorpay.ts` (`openCheckout` resolves `verified: true` only after `verify`), `components/chat/ChatRoom.tsx` (`startPayment` re-reads room state from the server).
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** Calling `verify` with a fabricated payment id and signature grants nothing; refreshing the page derives state from the server only.
- **Evidence:** TEST-004.
- **Risks:** —

#### PAY-015 — Replay and cross-user manipulation
- **Requirement:** A payment id/signature pair from user A cannot be replayed by user B or re-used for another order or product.
- **Files:** `verify/route.ts`.
- **Status:** Verified (unit, mocked database). The ledger owner check stops cross-user replay, the ledger `paid` state stops re-use, and the signature binds a payment to one order.
- **Depends on:** PAY-003, PAY-008.
- **Acceptance:** Replay tests in TEST-004.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts` "refuses another user's order with 403", "replaying a verified payment grants nothing more", "returns 400 … for a signature for a different order". Passed locally 2026-10-14; not yet run in CI.
- **Risks:** —

#### PAY-016 — Pre-checkout disclosure
- **Requirement:** Before checkout, show the product, price, what exactly is delivered, the refund policy, and links to Terms/Privacy.
- **Files:** `components/modals/ConnectModal.tsx`, `components/chat/TimerExpiredOverlay.tsx` (`RevealModal.tsx` removed 2026-10-14, DEC-013).
- **Status:** Partial. Since 2026-10-14 the connect sheet (`ConnectModal`) states the price, that the chat opens with no time limit as soon as the buyer pays, that the partner is asked to share contact details and nothing is shared unless they accept, that the buyer's own name and email are shared too, and that a decline or 24 hours of silence leaves the chat open with no refund; it links to `/refund-policy` in a new tab above the pay button. The reveal sheet (`RevealModal.tsx`, rebuilt 2026-10-14 for DEC-012) states what is and is not included (name/photo only, never email), and what happens if consent is withdrawn before the payment lands. No Terms or Privacy links; copy review pending. 2026-10-14: the sheet also links to the Terms of Service and the Privacy Policy, each in a new tab (`tests/legal-pages.test.ts`).
- **Depends on:** GATE-004, DEC-007.
- **Acceptance:** Disclosure copy reviewed against GATE-004 policies.
- **Evidence:** Screenshot + review record.
- **Risks:** —

#### PAY-017 — A paid reveal needs the other dancer's prior agreement
- **Requirement (DEC-012, 2026-10-14):** The ₹29 reveal product shows the buyer the other dancer's real name and account photo, and nothing else (never an email). It can be ordered only while that dancer's request row is `allowed`, and it is granted only if the row is still `allowed` when the verified payment arrives (PAY-011). The product an order buys is fixed on the ledger when the order is created. A reveal order adds no chat time, and an extension order never reveals anyone.
- **Files:** `app/api/payment/create-order/route.ts`, `lib/payments.ts` (`settlePayment`, `recordOrder`), `lib/reveal.ts`, `0008_reveal_requests.sql` (`payment_orders.product`).
- **Status:** Retired for new orders 2026-10-14 (DEC-013): `create-order` refuses `reveal` (`tests/payment-routes.test.ts`). The fulfilment half still applies to a reveal order created before then and remains Verified (unit, mocked database): granted only if the earlier `allowed` row still stands. Not run against a real database or Razorpay test mode.
- **Depends on:** ID-001, ID-002, PAY-003, PAY-008, PAY-010, DATA-001.
- **Acceptance:** Tests: order refused for no request, pending, declined, already revealed, the opposite direction, or an empty name; allowed → order recorded as `reveal` at the server price; verify and webhook each reveal, and together reveal once; consent gone at payment time → nothing revealed, order `fulfilment_failed`; a second payment for the same pair reveals nothing more; forged, uncaptured, foreign-user and billing-off payments reveal nothing.
- **Evidence:** `tests/payment-routes.test.ts` "Paid Mode: a name-and-photo order from before it was retired" (create-order refused in every request state; fulfilment cases unchanged). Passed locally 2026-10-14; not yet run in CI.
- **Risks:** No refund path for a `fulfilment_failed` reveal order (PAY-012, DEC-007). Razorpay's permission for this product is not established (GATE-003), and the legal review covers it (GATE-008).

#### PAY-018 — A paid extension delivers its full time
- **Retired 2026-10-15 by DEC-014:** chats have no time limit, so an extension changes nothing. `effectiveExtraSeconds`, `extraSecondsFor` and `tests/extension-time.test.ts` were removed. `lib/payments.ts` still inserts a `chat_extensions` row for an old `extend` order (Razorpay code left untouched); the row has no effect.
- **Requirement (added 2026-10-14 after a defect found in a Razorpay test-mode run):** An extension gives the chat the full time bought. Paid for while time remains, it lengthens the chat by that much. Paid for after the chat has closed, it runs from the moment it was paid for, so time the chat sat closed, or the checkout took, is not deducted. Later extensions stack from wherever the chat's end then stands. The server decides; the client only displays it.
- **Files:** `lib/room.ts` (`effectiveExtraSeconds`), `lib/server.ts` (`extraSecondsFor`, now reading `chat_extensions.paid_at`), `app/api/rooms/[roomId]/messages/route.ts`, `hooks/useChatTimer.ts` (progress bar measured against one free-chat window).
- **Status:** Retired (DEC-014). Before that: Verified (unit). The defect: extension seconds were added to the chat's length counted from the clock's first start, so a payment made more than two minutes after expiry was recorded as paid, showed "+2 minutes added", and left the chat closed. Not yet re-run in Razorpay test mode.
- **Depends on:** PAY-003, CORE-003.
- **Acceptance:** Tests: in-time extension adds exactly the bought time; late extension ends the chat that long after the payment; stacking and row order; before the clock starts; a message is accepted after a late payment and refused once that time has run out.
- **Evidence:** `tests/extension-time.test.ts` (12 tests). Passed locally 2026-10-14; not yet run in CI.
- **Risks:** `paid_at` is the server time at fulfilment, so the few seconds between the grant and the buyer's screen refreshing still count. An extension paid for before this fix is evaluated by the new rule from its own `paid_at`, which for old ones is long past.

---

## 8. Payment-provider eligibility and production-readiness gates

Razorpay onboarding and product eligibility are **unresolved**. The ability to create a Razorpay account or obtain test keys is not evidence that GarbaConnect's partner-finding / social-discovery product is permitted. Payment providers commonly classify dating, matchmaking and similar social-discovery services as restricted or higher-risk categories; whether that applies here is **Information Required** from Razorpay in writing. No mechanism may be built to disguise the product category, route payments through a different merchant, or otherwise work around provider restrictions.

| Gate | Requirement | Evidence required | Status |
|---|---|---|---|
| **GATE-001** | Written confirmation from Razorpay that the actual product (social discovery / partner-finding at events, with the specific paid features) is an eligible business category for this merchant account | Email/ticket from Razorpay, filed with the project owner | Information Required |
| **GATE-002** | Merchant onboarding and KYC approved; live mode activated | Razorpay dashboard activation status | Information Required |
| **GATE-003** | Each paid product (extension; any identity-related product) confirmed as a permitted use case | Same as GATE-001, per product | Information Required |
| **GATE-004** | Terms of Service, Privacy Policy, Refund & Cancellation Policy, Contact details, and digital-delivery description published on the site and linked from checkout | Live URLs; legal review | Partial. Since 2026-10-14 a Refund Policy page with the support contact and a digital-delivery description exists at `/refund-policy` (`app/(main)/refund-policy/page.tsx`), public and linked from the landing footer and from the checkout sheet (PAY-016). Its product description matches the code since the connect request was built later that day. Still missing: Terms of Service, Privacy Policy, cancellation terms, a live URL and legal review 2026-10-14: Terms of Service (`/terms`) and Privacy Policy (`/privacy`) published in the app on a shared layout with the Refund Policy, linked from the footer and from the checkout sheet (`tests/legal-pages.test.ts`). Still missing: cancellation terms, live URLs, and the legal review (GATE-008). |
| **GATE-005** | Live credentials stored only in the production environment; webhook configured for required events with its own secret; test keys elsewhere | Environment audit (names only), webhook config screenshot | Information Required |
| **GATE-006** | Payment security and flow testing complete: TEST-004 passing in CI, plus a recorded end-to-end run in Razorpay test mode covering success, failure, cancel, duplicate, refund | CI run + test record | Missing |
| **GATE-007** | Monitoring and incident handling: OPS-001…OPS-005 in place; an owner on call during launch | Runbook + alert test | Missing |
| **GATE-008** | Privacy and legal review of identity sharing, age policy and data handling under applicable Indian law (including the Digital Personal Data Protection Act, 2023 and rules in force) | Written sign-off from a qualified reviewer | Missing |

**Until every applicable gate is recorded as passed, the documented and deployed mode remains Free Mode.**

---

## 9. Security, authentication, authorization and data privacy

#### SEC-001 — Secrets stay server-side
- **Requirement:** `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY` are never in a `NEXT_PUBLIC_*` variable, never imported from a client module, never logged, never returned in a response. Modules that read them use `import 'server-only'`.
- **Files:** `lib/supabaseAdmin.ts`, `lib/razorpay.ts`, `lib/payments.ts`, `lib/server.ts` (all `server-only` ✓); `.env.example` (only key id and anon key public ✓).
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** CI step greps the production client bundle (`.next/static`) for secret variable names and known secret prefixes (`sk_`, service-role JWT pattern) — zero hits.
- **Evidence:** TEST-006 CI log.
- **Risks:** —

#### SEC-002 — Service-role access is always preceded by authorization
- **Requirement:** Every `supabaseAdmin()` query is reached only after authenticating the caller and checking they may act on the specific row(s).
- **Files:** all callers of `supabaseAdmin()` (`lib/server.ts`, `lib/payments.ts`, `app/api/**`, `actions.ts`).
- **Status:** Implemented — unverified (review found no missing check at baseline).
- **Depends on:** —
- **Acceptance:** TEST-003 covers each route; code review checklist item in Definition of Done.
- **Evidence:** TEST-003.
- **Risks:** Service role bypasses RLS — every new query is a potential leak.

#### SEC-003 — RLS is a second line of defence
- **Requirement:** RLS enabled on every table; no client write policies; read policies limited to own rows / participants. Verified against the live database, not just the migration file.
- **Files:** `supabase/migrations/0001_init.sql`.
- **Status:** Implemented — unverified (not checked against any live project; depends on Clerk third-party auth being configured as the README describes — *Information Required*).
- **Depends on:** TEST-005.
- **Acceptance:** RLS test suite against a local Supabase: anon and other-user tokens cannot read `users` rows of others, other rooms' messages, others' `reveals`, or write anything.
- **Evidence:** TEST-005.
- **Risks:** —

#### SEC-004 — Input validation
- **Requirement:** All route inputs validated for type and size; IDs validated for format before use.
- **Files:** `lib/validation.ts` (`parseBody`: Zod schema, fixed 400 message that never echoes the parser's description); schemas in `messages/route.ts`, `consent/route.ts`, `me/heartbeat/route.ts`, `push/subscribe/route.ts` (POST and DELETE), and `app/(main)/dashboard/actions.ts` (`OnboardingInput`).
- **Status:** Partial (2026-10-15). Every request body read by a non-payment route handler, and the onboarding action's argument, is parsed by a Zod schema before use. Not converted, per the instruction not to touch Razorpay code behind the billing gate: `create-order` and `verify` (they already narrow without casts) and the Razorpay webhook (raw body, signature checked first). Still open: allow-lists for `branch`, `collegeYear` and `vibeTag` (now only size-capped at 100, 100 and 200 characters before the existing trimming); route path ids are checked by `partnerFromRoomId`, not by a schema.
- **Depends on:** —
- **Acceptance:** Malformed-input tests return 400, never 500.
- **Evidence:** `tests/chat-messages.test.ts` (no body, malformed JSON, wrong types, blank text and over 1000 characters all get 400 with nothing written), `tests/rate-limit.test.ts` (consent and heartbeat bodies), `tests/push.test.ts` (subscription bodies, unchanged and passing). Passed locally 2026-10-15; not yet run in CI.
- **Risks:** —

#### SEC-005 — HTTP security headers and request screening
- **Requirement (added 2026-10-15, user instruction):** Every response carries a Content-Security-Policy limited to the app's own origin and its providers (Clerk, Supabase, Razorpay Checkout), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Middleware turns away requests with a blank or known-scanner User-Agent, adds any missing header to its own responses, and redirects plain-http requests to https in production.
- **Files:** `lib/securityHeaders.mjs` (+ `.d.mts`), `next.config.mjs` (`headers()`; Next 14 does not support `next.config.ts`), `middleware.ts`, `lib/requestGuards.ts`.
- **Status:** Implemented — unverified for signed-in pages. Clerk's Frontend API host is read from the publishable key and Supabase's from its URL, with wildcard fallbacks when unset; only a plain host name is ever copied into the header. Scripts need `'unsafe-inline'` because Next 14 inlines bootstrap scripts without a nonce. Webhooks under `/api/webhooks/` are exempt from the User-Agent check. The https redirect skips `localhost` and bare-IP hosts.
- **Depends on:** DEP-001 (the production domain: `includeSubDomains; preload` binds every subdomain of it).
- **Acceptance:** Unit tests of the header values and guards; the production build serves the headers; the app's pages load in a browser with no CSP violation.
- **Evidence:** `tests/security-headers.test.ts` (21 tests, passed locally 2026-10-15). Manual run 2026-10-15 against `next start` with this machine's development keys: all six headers on pages and static files, one CSP header per response; blank and `sqlmap` User-Agents got 403; a webhook with a blank User-Agent reached the route; no redirect for `localhost`. Headless Edge loaded `/`, `/sign-in` (Clerk's sign-in card rendered), `/terms` and `/refund-policy` with no CSP violation in the console. **Not checked:** signed-in pages (dashboard and chat: Supabase Realtime over `wss`, Clerk session token), Razorpay Checkout, push subscription, and the production Clerk domain.
- **Risks:** A provider adding a new origin breaks that feature until the policy is updated; HSTS preload is hard to undo once submitted.

#### PRIV-001 — Real name and email private by default
- **Requirement:** `real_name` and `email` are never returned to anyone except the user themself, and to another participant only via ID-001 consent. **Admin exception (DEC-011, 2026-10-14):** an admin (ADMIN-001) may see them in the admin roster for moderation; each view is recorded first (ADMIN-003), and they are never sent to any non-admin.
- **Files:** `lib/consent.ts` (`getRevealedContact`, `getConnections`), `lib/reveal.ts` (`getRevealed`, `listRevealed`), `app/api/users/[userId]/contact/route.ts`, `app/api/reveals/route.ts`, `lib/server.ts` (`getRoomState`), `app/admin/users/page.tsx`, `supabase/migrations/0001_init.sql`, `0006_contact_consent.sql`, `0008_reveal_requests.sql`.
- **Status:** Verified (unit, mocked database). The old `reveals` rows created by payment alone are no longer read (DEC-003). `real_name` and `email` of another person are read via `getRevealedContact` (`lib/consent.ts`) only when a `contact_reveals` row exists for that pair. In the reveal flow (`lib/reveal.ts`), only `real_name` and photo are revealed via an allowed `reveal_requests` row with verified payment, and email is never shared. Roster access for moderation is gated to admins and audited.
- **Depends on:** ID-001.
- **Acceptance:** Test: user B's `real_name`/`email` never appear in any response to user A unless B consented to share with A.
- **Evidence:** `tests/consent-flow.test.ts`, `tests/campus-privacy.test.ts`, `tests/reveal.test.ts`, `tests/admin.test.ts`.
- **Risks:** **Critical.** See §17 R-1.

#### PRIV-002 — No IDOR through room, user or payment ids
- **Requirement:** Tampering with `roomId`, `targetUserId`, `orderId`, `paymentId` in any request never exposes or modifies another user's data.
- **Files:** `lib/room.ts`, `loadRoom`, `create-order`, `verify`.
- **Status:** Implemented — unverified.
- **Depends on:** —
- **Acceptance:** TEST-003/TEST-004 tamper matrix.
- **Evidence:** TEST-003, TEST-004.
- **Risks:** —

#### PRIV-003 — Logs contain no personal data or secrets
- **Requirement:** Error logging records an error class, route and correlation id; not request bodies, emails, names, tokens or full provider responses.
- **Files:** `lib/server.ts:23` (`console.error(e)` logs whole error objects), webhook `console.error('razorpay webhook', e)`.
- **Status:** Partial.
- **Depends on:** OPS-001.
- **Acceptance:** Code review + log sample review.
- **Evidence:** Review record.
- **Risks:** —

#### PRIV-004 — Account deletion and retention
- **Requirement:** Users can delete their account; deletion removes or anonymises their profile and identity data; Clerk `user.deleted` is propagated; retention periods for messages and profiles after the season are defined (DEC-006). Payment ledger records are retained as legally required, minimised to what is needed.
- **Files:** none.
- **Status:** Missing. 2026-10-14: the Privacy Policy promises deletion on an emailed request. Known gap: `removeUser` (`app/admin/actions.ts`) deletes the dancer's rooms first, and a room with a `contact_consents` or `contact_reveals` row cannot be deleted (foreign keys without cascade, migration 0006), so for such a dancer the rooms and messages stay; the Clerk account is also not deleted unless the admin blocks. Needs a decision on what happens to consent rows tied to payment records.
- **Depends on:** DEC-006, GATE-008.
- **Acceptance:** Deleting a test user removes them from discovery and nulls identity fields within the stated time.
- **Evidence:** Integration test.
- **Risks:** —

#### PRIV-005 — Realtime channels are private
- **Requirement:** Presence and broadcast channels are Supabase *private* channels with `realtime.messages` RLS: only authenticated users may join `lobby`, only the two participants may join `room:<id>`, and presence keys are bound to the token's `sub`, not chosen by the client.
- **Files:** `hooks/useLobbyPresence.ts:18`, `hooks/useSupabaseRealtime.ts:27` (public channels; presence key is a client-supplied `userId`). postgres_changes subscriptions are RLS-filtered ✓.
- **Status:** Partial.
- **Depends on:** new migration (DATA-001).
- **Acceptance:** A client using only the public anon key cannot see lobby presence; a third user cannot join a room channel; a client cannot track presence under another user's id.
- **Evidence:** TEST-005.
- **Risks:** Today anyone holding the public anon key can see which Clerk ids are online and spoof presence that drives timer start.

#### PRIV-006 — Truthful privacy and payment claims
- **Requirement:** In-app and marketing copy must match actual behaviour. Fabricated statistics and testimonials must not be presented as real.
- **Files:** `OnboardingModal.tsx:90` ("Your real name stays private") vs paid reveal; `HeroSection.tsx` (said "until someone pays to ask for it"; that line was removed when the hero copy was rewritten on 2026-10-14); `Testimonials.tsx` (invented users, including a privacy claim the app does not honour) and `StatsCounter.tsx` ("5000+ Dancers", "200+ Events"), both deleted 2026-10-14 (DEC-008); `README.md` described the paid reveal as intended behaviour until it was rewritten on 2026-10-13 (it now states the Free Mode default and lists the reveal code as pending removal); the in-app and landing copy are unchanged.
- **Status:** Partial. In-app copy brought in line 2026-10-14: onboarding describes that names are shown only if asked and agreed, and paying alone never unlocks them. Refund policy, checkout sheets, and expiry overlay describe what the code does (`tests/refund-policy.test.ts`, `tests/smoke/free-mode.test.ts`). *Landing copy fixed later 2026-10-14 (DEC-008):* the invented statistics and testimonials were deleted (the "Unlock their real name and Gmail" card had already been replaced the same day). *Still open:* no copy review sign-off; the meta description ("Meet dancers at your Navratri garba tonight") and the hero imply dancers at the reader's own event, but the app has no event or venue model, so discovery lists every onboarded dancer (DEC-009).
- **Depends on:** DEC-002, DEC-012, DEC-008.
- **Acceptance:** Copy review sign-off; every factual claim has a source or is removed.
- **Evidence:** Review record.
- **Risks:** Consumer-protection and misleading-advertising exposure; user trust.

---

## 10. Identity-sharing consent and user safety

#### ID-001 — Disclosure only with the disclosed person's explicit consent
- **Requirement:** A participant's identity/contact details are shown to another participant only after the disclosed person explicitly, specifically, and freely consents to share *those fields* with *that participant*. The request and the consent are separate actions by different people. Default is no sharing.
- **Why:** Core safety and privacy commitment; likely a legal requirement (GATE-008).
- **Files:** `lib/consent.ts`, `app/api/rooms/[roomId]/consent/route.ts`, `components/chat/ConsentBanner.tsx`, `components/chat/RevealCard.tsx`, `0006_contact_consent.sql`; `lib/reveal.ts` (read-only since DEC-013), `components/chat/RevealPanel.tsx`, `0008_reveal_requests.sql`.
- **Status:** Verified (unit, mocked database). Both flows enforce explicit consent:
  - **Connect Flow (DEC-002):** A request (`contact_consents`, created only by payment) and consent (partner's answer via `accept_contact_consent`) are separate actions by different people. Acceptance discloses real name and email to the pair.
  - **Reveal Flow (DEC-012):** One `reveal_requests` row per ordered pair: requester asks for free, only the partner can allow or decline, and requester sees partner's name and photo only once allowed and completed by verified payment. Email is never shared.
  The old payer-only `reveals` table is no longer read by any code (DEC-003).
- **Depends on:** DEC-002, DEC-012, DEC-003, DATA-001.
- **Acceptance:** Tests: request without consent → nothing disclosed; consent by A for B → only B sees A's chosen fields; consent cannot be created by the requester or by the payment flow alone.
- **Evidence:** `tests/consent-flow.test.ts`, `tests/reveal.test.ts`, `tests/payment-routes.test.ts`.
- **Risks:** —

#### ID-002 — Consent independent of payment
- **Requirement:** No payment, entitlement, or webhook can create, imply or substitute for consent. A payment can only complete a disclosure the disclosed person has already agreed to, or unlock chat time while leaving consent pending with the partner.
- **Files:** `lib/payments.ts` (`settlePayment`), `lib/reveal.ts` (`grantReveal`, `isRevealAllowed`), `lib/consent.ts`, `create-order/route.ts`, `verify/route.ts`.
- **Status:** Verified (unit). In the connect flow, payment makes the chat unlimited but discloses nothing without partner acceptance (`contact_consents` is pending; no `contact_reveals` row). In the reveal flow, `create-order` refuses a reveal order unless the partner already allowed it; fulfilment re-checks that at payment time and reveals nothing if consent was withdrawn. In both flows, `verify` returns only `{ verified }`.
- **Depends on:** DEC-002, DEC-012.
- **Acceptance:** Test: completed payment with no consent → no identity in any response.
- **Evidence:** TEST-004 — `tests/payment-routes.test.ts`, `tests/consent-flow.test.ts`, `tests/reveal.test.ts`, `tests/smoke/free-mode.test.ts`.
- **Risks:** —

#### ID-003 — Informed, scoped, revocable consent
- **Requirement:** The consent screen states exactly which fields, to whom, and that it cannot be un-seen once shown; the user can choose what to share (e.g. a contact handle instead of email); future access can be revoked; consent events are recorded.
- **Files:** `components/chat/ConsentBanner.tsx`, `lib/reveal.ts`, `0006_contact_consent.sql`, `0008_reveal_requests.sql`.
- **Status:** Partial. The connect banner states fields (real name and email) and timestamps are recorded. The reveal panel states who is asking, exactly what would be shared (real name and photo), that email is not shared, and allows or declines. Gaps: no field-level picking, and revocation after reveal not yet implemented.
- **Depends on:** DEC-002, DEC-012.
- **Acceptance:** UX review + data model holds field-level consent with timestamps.
- **Evidence:** Review record; `tests/reveal.test.ts`; `tests/smoke/free-mode.test.ts`.
- **Risks:** —

#### ID-004 — Mutual-exchange option
- **Requirement (DEC-002 decided 2026-10-13):** Each participant chooses which fields to share. Nothing is shown to either side until both have opted in; then each sees only what the other chose.
- **Files:** `lib/consent.ts`, `components/chat/ConsentBanner.tsx`, `components/chat/RevealCard.tsx`.
- **Status:** Partial. Under the connect flow (DEC-002 revision), the exchange is mutual in effect: on acceptance, each participant sees the other's real name and email, and neither sees anything before that. Alongside it, the one-way paid name-and-photo reveal (DEC-012) exists.
- **Depends on:** ID-001, ID-003, DATA-001; DEC-003 for existing `reveals` rows.
- **Acceptance:** Tests: A opts in, B has not → neither sees anything; both opt in → each sees only the other's chosen fields; a third user and the payment flow cannot create or read an opt-in.
- **Evidence:** `tests/consent-flow.test.ts`.
- **Depends on:** ID-001, ID-003, DATA-001; DEC-003 for existing `reveals` rows.
- **Acceptance:** Tests: A opts in, B has not → neither sees anything; both opt in → each sees only the other's chosen fields; a third user and the payment flow cannot create or read an opt-in.
- **Evidence:** TEST-003.
- **Risks:** —

#### SAFE-001 — Blocking
- **Requirement:** A user can block another; blocks are keyed on `clerk_id`, bidirectional in effect (hidden from each other's discovery, cannot open or message the room, cannot be presented as a paid target), and enforced server-side.
- **Files:** `supabase/migrations/0010_blocks_reports.sql` (`blocks`, keyed on `users.clerk_id`, service role only); `lib/blocks.ts`; `app/api/blocks/route.ts` (POST), `app/api/blocks/[userId]/route.ts` (DELETE); `app/api/users/route.ts` (list filter); `lib/server.ts` (`loadRoom`); `components/dashboard/Dashboard.tsx` (Block on each card).
- **Status:** Implemented — unverified against a real database (2026-10-15, user instruction). The request asked for uuid columns and a uuid in the body; they are Clerk ids because every other table and the browser identify dancers by `clerk_id`, and this objective requires it. Either person blocking the other hides each from the other's list and makes `loadRoom` answer 403 `blocked` to both, so the room cannot be opened, written to, marked read or paid for. The chat page says "This chat is not available" without saying who blocked whom. Only the blocker can lift their own block (DELETE); there is no unblock screen yet. Rate limit: 10 block or unblock calls a minute per user. Before migration 0010 is applied nobody is blocked and POST answers 503. Not done: hiding a blocked dancer's existing unread badge, filtering `/api/reveals`, and an unblock list.
- **Depends on:** DATA-001 (apply migration 0010).
- **Acceptance:** TEST-003 block matrix.
- **Evidence:** `tests/blocks.test.ts` (22 tests: 201 and one row, idempotent, 401, malformed or uuid id 400, self 400, unknown 404, 429 after 10; DELETE removes only the caller's own block; list hides both directions and works before 0010; messages 403 `blocked` both ways with nothing written or sent; room 403 both ways; unaffected third party). Mutation check: disabling the `loadRoom` check and the list filter failed 5 tests. Passed locally 2026-10-15 with the mocked database; migration 0010 not run in Postgres; dashboard control not exercised in a browser.
- **Risks:** Without reporting (SAFE-002) a block hides a problem rather than surfacing it.

#### SAFE-002 — Reporting and response
- **Requirement:** A user can report a participant/conversation; reports are stored with the relevant messages; an owner reviews them; actions (warn, suspend, remove) exist and are recorded.
- **Files:** `supabase/migrations/0010_blocks_reports.sql` (`reports`, keyed on `users.clerk_id`, service role only); `app/api/reports/route.ts`; `components/dashboard/Dashboard.tsx` (Report on each card, with a reason of up to 500 characters); `app/admin/*`, `lib/admin.ts` (removal actions).
- **Status:** Partial. Since 2026-10-14 an admin can remove a dancer, remove and block one, or remove a room, and each is recorded (ADMIN-002, ADMIN-003). Since 2026-10-15 a dancer can report another from the dancer list: `POST /api/reports` (Zod-validated, 201, 5 a minute per user, 400 for yourself or a malformed body, 404 for an unknown dancer, 503 before migration 0010; the reason is never logged). The request asked for uuid columns; they are Clerk ids, as for blocks (SAFE-001). Reports are not stored with the conversation's messages, and deleting either dancer's profile deletes their reports (DEC-006 open). Still missing: reporting from inside a chat, a review queue (reports are read in the SQL editor for now), warn/suspend, and a response-time target.
- **Evidence (2026-10-15):** `tests/reports.test.ts` (route level, mocked database; passed locally). Migration 0010 not run in Postgres; the dashboard form not exercised in a browser.
- **Depends on:** DATA-001, DEC-006 (retention of reported content).
- **Acceptance:** Report flow end-to-end; documented response time target.
- **Evidence:** Test + runbook.
- **Risks:** —

#### SAFE-003 — Age safeguards
- **Requirement (DEC-005 decided 2026-10-13):** GarbaConnect is 18+ only. Onboarding requires an explicit self-declaration that the user is 18 or older, with a clear statement of the policy; the server rejects onboarding without it and records the declaration time. No date of birth is collected. The policy is subject to confirmation by the GATE-008 legal review.
- **Files:** `components/dashboard/OnboardingModal.tsx`, `app/(main)/dashboard/actions.ts` (`completeOnboarding`); new column via migration (DATA-001).
- **Status:** Missing. 2026-10-14: the Terms of Service state the 18+ rule; onboarding still does not ask for the declaration.
- **Depends on:** DATA-001; GATE-008 confirmation.
- **Acceptance:** Calling `completeOnboarding` without the declaration fails server-side; the UI cannot proceed without it; Terms state the 18+ policy.
- **Evidence:** TEST-007; legal sign-off.
- **Risks:** Social discovery between strangers with no age gate is a significant safety and legal risk.

#### SAFE-004 — Abuse prevention
- **Requirement:** Rate limits (CHAT-007), pre-reply message cap (CHAT-004), suspension ability (SAFE-002), and nickname changes not usable to evade blocks (ONB-001 risk).
- **Status:** Missing.
- **Depends on:** CHAT-004, CHAT-007, SAFE-001, SAFE-002.
- **Acceptance:** Covered by referenced objectives.
- **Evidence:** Referenced tests.
- **Risks:** —

#### ADMIN-001 — Admin console access
- **Requirement (DEC-011, 2026-10-14):** The admin console at `/admin` is reachable only by a Clerk account whose **public metadata** has `role: "admin"`, set in the Clerk dashboard. Public metadata can be written only from the dashboard or the Backend API; `unsafeMetadata`, which a user can edit, must never be consulted. No account has the role by default, so nobody is an admin until one is marked. The check runs on the server in the layout, in every admin page and in every admin action. A signed-in non-admin gets a 404; no admin data or admin markup is ever sent to a non-admin.
- **Files:** `lib/admin.ts` (`requireAdmin`, `isAdminUser`), `app/admin/layout.tsx`, `app/admin/**/page.tsx`, `app/admin/actions.ts`, `middleware.ts`.
- **Status:** Implemented — unverified. Unit and action tests pass; a signed-out request to `/admin`, `/admin/users` and `/admin/rooms` returned 404 with no admin content against a local dev server on 2026-10-14. Not exercised with a real admin sign-in.
- **Depends on:** AUTH-001; access to the Clerk dashboard being limited to people who may appoint admins.
- **Acceptance:** Tests: only the exact role `admin` in public metadata is accepted; a role in `unsafeMetadata` is ignored; each page and action refuses a non-admin before any database or Clerk call. Plus a signed-in run as admin and as a normal user.
- **Evidence:** `tests/admin.test.ts` ("who is an admin", "requireAdmin", "admin actions refuse everyone else…"). Passed locally 2026-10-14; not yet run in CI. Signed-in run: not yet done.
- **Risks:** Anyone with access to the Clerk dashboard or the Clerk secret key can make an admin. There is one role: every admin can do everything the console offers. Public metadata is readable in that user's own browser, so an admin's role is visible to that admin (not to other users).

#### ADMIN-002 — Admin removal actions
- **Requirement (DEC-011, 2026-10-14):** An admin can remove a dancer (profile, every room they are in with its messages and extensions, reveals involving them, push subscriptions), remove and block a dancer (the same, and the Clerk account is banned so they cannot sign in), and remove a single room. Payment ledger rows are never deleted (PRIV-004). An admin cannot remove their own account. Inputs are validated before use, and each action asks for confirmation in the UI.
- **Files:** `app/admin/actions.ts`, `app/admin/users/page.tsx`, `app/admin/rooms/page.tsx`, `components/admin/*`.
- **Status:** Implemented — unverified. Tested with Clerk and the database mocked; nothing has been run against a real database or Clerk instance.
- **Depends on:** ADMIN-001, ADMIN-003, SEC-004.
- **Acceptance:** Tests: deletes happen in order and only for the target; the ledger is untouched; a failed Clerk ban deletes nothing; malformed ids change nothing; self-removal is refused. Plus a run against a test database.
- **Evidence:** `tests/admin.test.ts` ("removeUser", "removeRoom"). Passed locally 2026-10-14; not yet run in CI.
- **Risks:** Removal is immediate and cannot be undone. Without the block, a removed dancer can sign in and onboard again. Unblocking is done in the Clerk dashboard; the console has no unblock. Removing a room also clears its clock, so the pair get a fresh two minutes (CHAT-004). The deletes are separate statements, not one transaction, so a failure part-way leaves a partial removal (the action then reports an error). The other dancer in a removed chat loses that conversation too.

#### ADMIN-003 — Admin audit log
- **Requirement (DEC-011, 2026-10-14):** Every opening of the dancer roster and every removal is recorded in `admin_actions` (admin, action, target, time) *before* it happens. If the record cannot be written, the roster is not shown and the removal does not run. The log holds ids only, never names, emails or message text.
- **Files:** `lib/admin.ts` (`recordAdminAction`), `supabase/migrations/0007_admin_actions.sql`, `app/admin/page.tsx` (recent activity).
- **Status:** Implemented — unverified. Migration 0007 has not been applied by this change.
- **Depends on:** DATA-001.
- **Acceptance:** Tests: the audit row is the first database operation of every action; with the table missing nothing is deleted and no Clerk call is made.
- **Evidence:** `tests/admin.test.ts` ("records the action first…", "does nothing at all if the audit row cannot be written", "does not delete if the audit row cannot be written"). Passed locally 2026-10-14.
- **Risks:** The row records that an action was started; if a later step fails the row remains. Anyone with the service-role key or database access can still edit the log. No retention period is set (DEC-006).

---

## 11. Database integrity and entitlement consistency

#### DATA-001 — Migrations are the only schema source
- **Requirement:** Schema changes are new numbered files in `supabase/migrations/`; applied migrations are never edited; migrations are applied with a tool that records versions (e.g. Supabase CLI), not by pasting into the SQL editor.
- **Files:** `supabase/migrations/0001_init.sql`, `0002_payment_orders.sql`, `0003_fulfilment_failed_and_webhook_events.sql` (both 2026-10-14), `0004_campus_branch.sql`, `0005_campus_vibe_outfit_instagram.sql` (merged 2026-10-14), `0006_contact_consent.sql` (2026-10-14); README setup steps.
- **Status:** Partial. The two campus migrations arrived from `origin/main` numbered 0002 and 0003, colliding with the payment migrations; the merge renumbered them to 0004 and 0005 with their SQL unchanged (`add column if not exists`, so re-running them is harmless). Whether they were already pasted into a live database under the old names is *Information Required*. The README setup steps do not mention them yet, and the server tolerates their absence by retrying with fewer columns. `0006_contact_consent.sql` (2026-10-14) has not been applied to any database from this repository; it was executed once locally in PGlite (ID-001 evidence). The server tolerates its absence (`tests/consent-flow.test.ts`), but Paid Mode cannot work without it.
- **Depends on:** DEP-002.
- **Acceptance:** Fresh local database built only from migrations matches production schema diff = empty.
- **Evidence:** Schema diff output.
- **Risks:** Unknown drift between the file and any live database (*Information Required*).

#### DATA-002 — Entitlement uniqueness and linkage
- **Requirement:** Every entitlement row references exactly one ledger row (PAY-003); one ledger row yields at most one entitlement; uniqueness constraints enforce it in the database.
- **Files:** `reveals.payment_id unique`, `chat_extensions.payment_id unique` ✓; no cross-table linkage: `chat_extensions` and `payment_orders` share a `payment_id` value but no foreign key.
- **Status:** Partial.
- **Depends on:** PAY-003.
- **Acceptance:** Constraint tests: duplicate insert fails at the database.
- **Evidence:** TEST-005.
- **Risks:** —

#### DATA-003 — Referential integrity for users
- **Requirement:** Foreign keys or documented handling for `messages.sender_id`, `reveals.payer_id/target_id`, `rooms.participant_ids` when a user is deleted (PRIV-004).
- **Files:** migration (no FKs on Clerk-id columns).
- **Status:** Partial.
- **Depends on:** PRIV-004.
- **Acceptance:** Deleting a user leaves no row that later throws or leaks.
- **Evidence:** Integration test.
- **Risks:** —

#### DATA-004 — Timer state monotonic
- **Retired 2026-10-15 by DEC-014:** nothing writes `timer_started_at` any more.
- **Requirement:** `timer_started_at` is set once and never moved; extensions only add.
- **Files:** Removed (`timer/route.ts`).
- **Status:** Retired (DEC-014).
- **Depends on:** —
- **Acceptance:** Concurrent `POST /timer` test yields one value.
- **Evidence:** TEST-003.
- **Risks:** —

---

## 12. API contracts and frontend/backend responsibilities

**Server owns:** authentication, authorization, billing mode, prices, order creation, payment verification, entitlement grants, timer start and expiry, consent records, identity disclosure, blocking and rate limits.

**Client owns:** rendering, optimistic UI for its own messages (reconciled with server), countdown display derived from server timestamps, loading Checkout.js only in effective Paid Mode.

#### API-001 — Consistent contracts
- **Requirement:** Every route returns JSON; errors use `{ error: string }` with a stable machine-readable code for billing/consent errors (e.g. `billing_disabled`, `consent_required`); status codes: 400 invalid input, 401 unauthenticated, 403 forbidden/disabled, 404 missing, 409 state conflict, 429 rate limited, 503 misconfigured. Response shapes are TypeScript types in `lib/types.ts`.
- **Files:** `lib/server.ts` (`HttpError`, `errorResponse` ✓), `lib/types.ts`.
- **Status:** Partial.
- **Depends on:** —
- **Acceptance:** Route table in TEST-003 asserts status codes.
- **Evidence:** TEST-003.
- **Risks:** —

#### API-002 — Route inventory
- **Requirement:** The table in §3.3 is kept current; adding a route requires adding it there and to the TEST-003 route table.
- **Status:** Implemented — unverified (table written at baseline).
- **Depends on:** —
- **Acceptance:** Test enumerates `app/api/**/route.ts` and fails on unlisted routes.
- **Evidence:** TEST-003.
- **Risks:** —

---

## 13. Reliability, monitoring, logging and recovery

| ID | Requirement | Files | Status | Acceptance / evidence |
|---|---|---|---|---|
| **OPS-001** | Structured server logs with route, status, correlation id, no PII (PRIV-003) | `lib/server.ts` `errorResponse` | Partial | Log sample review |
| **OPS-002** | Effective billing mode and config problems visible to operators (startup log + authenticated status check) without exposing values | none | Missing | Log line present on boot in each environment |
| **OPS-003** | Alerts on: webhook signature failures spike, webhook 5xx, any `fulfilment_failed` or `paid` not `fulfilled` after N minutes, error-rate spike | none | Missing | Alert fired in a test |
| **OPS-004** | Database backup and restore procedure known and tested | Supabase plan — *Information Required* | Information Required | Restore drill record |
| **OPS-005** | Rollback to Free Mode: set `BILLING_MODE=free`, redeploy; webhook fulfils only verified paid-era ledger orders under the FREE-004 conditions (nothing without a ledger); unfulfillable payments are listed for refund; no data changes (FREE-007) | process | Missing | Rollback rehearsal record |
| **OPS-006** | Error handling never shows stack traces to users; Realtime disconnect shows a reconnecting state | `ChatRoom.tsx` | Partial | Manual test record |

---

## 14. Testing strategy and measurable quality gates

At baseline there was **no test framework, no test file and no CI**. Vitest was added on 2026-10-13 (`vitest.config.ts`, tests in `tests/`, `npm test`). A CI workflow (`.github/workflows/ci.yml`) was added on 2026-10-13 but has not yet run on GitHub. Choosing a framework is part of TEST-001; it should be the smallest viable addition (for example Vitest for unit/route tests, the Supabase CLI local stack for RLS, and a single E2E tool only if justified).

| ID | Scope | Status | Gate |
|---|---|---|---|
| **TEST-001** | Test runner + `npm test` script | Partial — Vitest, `npm test`, `npm run test:smoke` pass locally; CI workflow defined but not yet run on GitHub | Exists and runs in CI |
| **TEST-002** | Billing-mode resolution and readiness (CFG-001/002/003) | Implemented — `tests/billing.test.ts`, passing locally; not in CI | 100% of the specified input table |
| **TEST-003** | Authorization/IDOR/route table: every API route × {unauthenticated, participant, non-participant, blocked}; consent; timer; rate limits | Missing | Every route listed; all cases pass |
| **TEST-004** | Payments: forged/missing signature, foreign order, replay, amount/currency mismatch, payment status not captured, duplicate verify+webhook, duplicate/out-of-order webhooks, fulfilment failure, refund, Free Mode rejection; **unverified payments grant nothing** | Partial — `tests/payment-routes.test.ts` (Razorpay SDK and database mocked; passing locally 2026-10-14, not in CI): Free Mode / not-ready rejection; forged, truncated, wrong-order, empty and missing signatures; foreign and unknown orders; replay; webhook amount/currency mismatch; duplicate verify + webhook; duplicate and out-of-order webhooks. Not covered: payment status not captured (PAY-006), fulfilment failure (PAY-010), refund (PAY-012), a real database or Razorpay test mode | All pass; required before any Paid Mode work merges |
| **TEST-005** | RLS + Realtime channel policies against local Supabase | Missing | All pass |
| **TEST-006** | CI on every PR: `typecheck`, `lint`, tests, `next build` with no Razorpay env, client-bundle secret scan | Implemented — unverified. `.github/workflows/ci.yml` runs on pull requests and pushes to `main`, Node 22, no credentials. Every step passed in a clean-worktree CI simulation 2026-10-13 (fresh `npm ci`, no `.env`, no provider variables). Not yet executed on GitHub Actions; not yet a required check (repository setting). | Required check on `main` |
| **TEST-007** | Free Mode smoke: no `RAZORPAY_*`, no `BILLING_MODE`; sign-up → onboarding → discovery → chat → expiry; asserts no payment UI/requests | Partial — `tests/smoke/free-mode.test.ts` (TEST-007, in-process, providers mocked; not a browser or provider test) covers default mode, chat render (open and expired), payment creation, checkout verification and signed webhook, with no provider or network access. Not covered: browser execution and clicks, sign-up, onboarding, discovery, landing page (todo; DEC-008 decided 2026-10-14), real providers. | Passes on every PR touching app code |

**Quality gates.** A PR touching billing cannot merge unless TEST-004 passes. A PR touching data access cannot merge unless TEST-003 and TEST-005 pass. No PR may merge with `typecheck` or `lint` failing. Untested changes must say so in the PR description.

---

## 15. Deployment, environment separation and rollback

| ID | Requirement | Status |
|---|---|---|
| **DEP-001** | Separate Clerk instances, Supabase projects and Razorpay modes for development, preview and production. Live Razorpay keys (`rzp_live_`) exist only in production; CFG-002 rejects live keys elsewhere. `BILLING_MODE` is unset (free) in every environment until §20 is complete. | Information Required (hosting and environment layout not in repo) |
| **DEP-002** | Migrations applied by a recorded process before the code that needs them is deployed; destructive migrations need a written rollback | Missing |
| **DEP-003** | Rollback: previous deployment can be restored; Free Mode rollback per OPS-005 | Information Required |
| **DEP-004** | Enabling Paid Mode in production is a recorded change linked to the completed §20 checklist (FREE-008) | Missing |

---

## 16. Development phases and dependencies

A phase is complete only when its exit criteria have **evidence**; planning or documentation alone does not complete a phase.

**Phase 0 — Baseline and verification** *(in progress: this document)*
- Exit: TEST-001, TEST-006 (typecheck/lint/build), TEST-005 skeleton; live database schema compared with `0001_init.sql` (DATA-001); DEC-001, DEC-002, DEC-005 decided (done 2026-10-13); DEC-003 decided.

**Phase 1 — Free Mode stabilisation** *(depends on Phase 0)*
- CFG-001…005, FREE-001…005, FREE-007; remove the payer-only reveal path (PRIV-001, ID-002) and fix copy (PRIV-006, ONB-002); SAFE-001, SAFE-002, SAFE-003, CHAT-003, CHAT-004, CHAT-007, PRIV-005; FREE-006/ID-001…004 (mutual opt-in identity sharing, per DEC-002); TEST-002, TEST-003, TEST-005, TEST-007.
- Exit: Free Mode smoke and authorization suites pass in CI; no Conflicts status remains.

**Phase 2 — Billing architecture in test mode** *(depends on Phase 1; real payment acceptance stays disabled)*
- PAY-001…016, DATA-002, OPS-001…003, TEST-004, against Razorpay test mode only.
- Exit: TEST-004 passes; reconciliation run on test data.

**Phase 3 — Eligibility and production readiness** *(can start in parallel with Phase 2 for GATE-001…004, GATE-008)*
- GATE-001…008, PRIV-004, OPS-004, OPS-005, DEP-001…004.
- Exit: every gate has recorded evidence.

**Phase 4 — Controlled Paid Mode release** *(depends on Phases 2 and 3)*
- Enable in production per DEP-004; live end-to-end checks of success, failure, duplicate, refund; monitor; rollback rehearsed.
- Exit: §20 complete and signed off by the project owner.

---

## 17. Known risks, unresolved decisions and technical debt

### Risks

| ID | Risk | Severity | Objective |
|---|---|---|---|
| **R-1** | Paying ₹29 discloses another user's real name and email without their consent, while onboarding promises the name stays private. *Closed in code 2026-10-14 (DEC-012):* a name and photo are shown only after the named person allowed that requester, email is never shown, and the onboarding text says so. Old `reveals` rows are no longer read. Remaining: whether live payments were ever taken for them (DEC-003). | Critical → Low | PRIV-001, ID-001, ID-002, PRIV-006 |
| **R-2** | A second paid reveal for the same pair is captured but leaves no record (`ignoreDuplicates`). *Resolved 2026-10-14: the paid reveal path is removed.* | High | PAY-008 |
| **R-3** | Fulfilment failure (e.g. extension for a room with no row) leaves a paid customer unfulfilled with the webhook retrying indefinitely. | High | PAY-010 |
| **R-4** | No payment ledger: no audit trail, no reconciliation, no failed/refunded state. *Partly mitigated 2026-10-14: `payment_orders` records created/paid/failed; still no event audit trail, reconciliation or refunded state.* | High | PAY-003, PAY-013 |
| **R-5** | No block, report, age gate or rate limit in a stranger-chat product. | High | SAFE-001…004, CHAT-007 |
| **R-6** | Public Realtime presence channels leak online Clerk ids and allow presence spoofing. | Medium | PRIV-005 |
| **R-7** | The 2-minute limit can be sidestepped by never being co-present; unlimited one-sided messages. *Superseded 2026-10-15 (DEC-014): there is no time limit. Unlimited messaging now applies to every chat, capped only at 30 messages a minute per sender (CHAT-007); see R-5.* | Medium | CHAT-007, SAFE-001 |
| **R-8** | Fabricated stats/testimonials and inaccurate privacy copy. *Landing stats, testimonials and the reveal claim removed 2026-10-14 (DEC-008).* Remaining: copy review; event-scoped wording without an event model. | Medium → Low | PRIV-006 |
| **R-9** | Payment routes always active; missing keys → 500s; credentials effectively enable payments. *Mitigated 2026-10-13 for routes and chat UI; landing copy and preview-environment live-key detection remain.* | Low | CFG-001…004, FREE-003 |
| **R-10** | No tests or CI; every status above is unverified. *Partly mitigated 2026-10-13: unit, route and in-process smoke tests exist; CI is defined but has not run on GitHub; no browser or provider tests.* | Medium | TEST-* |
| **R-11** | Possible schema drift between migration file and live database. | Medium | DATA-001 |
| **R-12** | Merchant eligibility unknown; seasonal timing pressure could encourage launching payments before gates pass. | High | §8 |
| **R-13** | Since the second DEC-002 revision (2026-10-14), ₹29 gives the buyer a chat with no time limit with a specific person without that person's agreement, and they cannot end it: there is no blocking (SAFE-001) or reporting (SAFE-002), and the room is unlimited for good. The earlier free design required both people to agree before extending a chat (FREE-005). | High | SAFE-001, SAFE-002, CHAT-004, GATE-008 |

### Tracked follow-ups from the billing-gate phase (2026-10-13)

Known limitations of the Free Mode gate, tracked here so they are not mistaken for resolved. Each blocks Paid Mode (§20) until closed.

| ID | Issue | Priority | Resolution required | Objectives |
|---|---|---|---|---|
| **FU-001** | **Webhook event loss.** In any non-paid state a correctly signed webhook is acknowledged with 200 and only logged, not persisted, so Razorpay will not retry it. A genuine payment from an earlier Paid Mode period that needs fulfilment after a rollback could be missed; until a ledger exists the only trace is the server log line (subject to the host's log retention). | Highest | Durable payment ledger (PAY-003), persisted webhook events, and reconciliation against Razorpay (PAY-013) that can recover missed events, all before any paid transaction is accepted. The Paid Mode rollback rehearsal (OPS-005) must show no lost payment. *Progress 2026-10-14, still open:* the ledger exists (PAY-003) and webhook events handled in Paid Mode are persisted in `webhook_events` (PAY-008); an event received while billing is off is still only logged, and there is no reconciliation or rehearsal. | FREE-004, PAY-003, PAY-008, PAY-013, OPS-005 |
| **FU-002** | **Environment detection.** The live-key rule uses `NODE_ENV === 'production'`, which is also true for preview deployments, so a preview could accept `rzp_live_` keys. | High | An explicit, trusted deployment-environment signal (e.g. a platform-set variable, once hosting is confirmed) that allows live keys only on the production deployment, with tests. | CFG-002, DEP-001 |
| **FU-003** | **Identity disclosure.** *Done 2026-10-14:* the paid reveal purchase path without prior consent is removed. Legacy `reveals` rows are no longer read or displayed by any code (DEC-003). *Contact consent (DEC-002 revision):* one person pays ₹29 for unlimited chat and requests contact exchange; only if the partner accepts are real name and email shared (`contact_reveals`). *Reveal flow (DEC-012):* a paid reveal of name and photo exists, but only after the other dancer allows the request; email is never shared via this flow. Still open: whether live payments were ever taken for the old rows. | High | Remove any unconsented reveal paths. Separately, first establish whether any live Razorpay payments were ever taken, then decide DEC-003 and handle historical records. | PRIV-001, ID-002, DEC-003 |

### Decisions required

| ID | Decision | Notes / recommendation |
|---|---|---|
| **DEC-001** | Free Mode chat expiry | **Decided 2026-10-13 (project owner):** free mutual extension, both must agree, +2 min (FREE-005). Still open: cap on free extensions per room; whether "both present" stays a timer-start condition (CHAT-003). |
| **DEC-002** | Identity-sharing model | **Decided 2026-10-13 (project owner):** free, mutual, opt-in, field-level choice; never paid (FREE-006, ID-004). **Revised 2026-10-14 (user instruction):** paid connect flow for ₹29 unlocks unlimited chat and requests mutual contact exchange (real name and email); partner acceptance required. Superceded "never paid". Does not relax consent (ID-001, ID-002). **DEC-012 (2026-10-14):** one-way name-and-photo reveal for ₹29 after recipient allows. Both flows coexist. |
| **DEC-003** | Treatment of existing `reveals` rows created without consent | **Decided 2026-10-14 (user instruction), display half:** stop displaying them and leave the table untouched. No code reads the legacy `reveals` table. Still open: whether any **live** payments were taken for them, refunds if so, and whether to delete rows. |
| **DEC-004** | Extension rules: who may buy, before/after timer start, how many, does the partner need to agree | Connect flow: one payment per room unlocks unlimited chat. Paid extensions: delivery measured from when paid (PAY-018). 2026-10-14 (DEC-013): the paid extension is retired again; `create-order` sells `connect` only (it had been re-enabled by the merge of PR #9). |
| **DEC-005** | Age policy | **Decided 2026-10-13 (project owner):** 18+ only, self-declaration at onboarding, no date of birth collected (SAFE-003). Subject to GATE-008 confirmation. |
| **DEC-006** | Retention periods for messages, profiles and reports after the season | — **Decided 2026-10-14 (user instruction, published in the Privacy Policy):** profiles and messages are kept while the account is active and deleted on an emailed request; payment records are kept for accounting. Not yet true for everyone: the admin removal fails for a dancer with a connect request (see PRIV-004). |
| **DEC-007** | Refund policy | **Decided 2026-10-14 (maintainer instruction):** no refunds once the paid chat extension has been delivered (digital, instant delivery); a full refund when a payment was deducted but the extension was not granted, on an email to `teamgarbaconnect@gmail.com` within 48 hours; payments are one-time, with no recurring charges. Published at `/refund-policy`. Revised later that day with the product (DEC-002): a full refund, made by the team within 48 hours without the buyer asking, when the partner declines or does not answer within 24 hours; no refund once the partner has accepted; a full refund on an email within 48 hours when the payment was taken but the request was not sent or accepted details were not shown; one-time payments only. The page and the checkout sheet state the same terms (`tests/refund-policy.test.ts`). Refunds are manual: orders in `refund_due` or `fulfilment_failed` (migration 0006 has the query). Not legally reviewed (GATE-004, GATE-008). Still open: recording a completed refund automatically (`refund.processed`, PAY-009). **Revised again 2026-10-14 (user instruction), superseding the terms above:** no refund once the unlimited chat is unlocked, including when the partner declines to share contact details or does not answer within 24 hours; a full refund, on an email within 48 hours, only when payment was deducted but the chat did not unlock. The page, the checkout sheet and the expiry overlay state this (`tests/refund-policy.test.ts`, `tests/smoke/free-mode.test.ts`). The refund queue is `payment_orders` in `fulfilment_failed`; there is no `refund_due` state any more. |
| **DEC-008** | Landing stats and testimonials: replace with real data or remove | **Decided 2026-10-14 (maintainer):** remove. The stats section and the testimonials were deleted, the "Payments by Razorpay" footer line was removed (the ₹29 "real name and Gmail" feature card had already been replaced the same day), and the meta description was changed to "Meet dancers at your Navratri garba tonight. Chat privately and find your Garba partner." The maintainer also declined to add a "not a social network or dating platform" disclaimer, and chose to ask Razorpay in writing about eligibility (GATE-001/003) instead of rewording the product's category. |
| **DEC-009** | Discovery scope: global list vs event-scoped; exposure of `last_seen`; gender filter | — |
| **DEC-010** | Approved price and products (₹29 is a proposal) | Business decision after GATE-001/003. Products: ₹29 Connect (unlimited chat + mutual contact consent), ₹29 Reveal (name and photo reveal upon recipient allow). |
| **DEC-011** | Admin access to user data | **Decided 2026-10-14 (maintainer instruction):** admins marked by `role: "admin"` in Clerk public metadata may see real names and emails in the roster and remove dancers and rooms; every view and action is audited (`ADMIN-001..003`). |
| **DEC-012** | Paid name-and-photo reveal | **Decided 2026-10-14 (maintainer):** requester asks for free, partner allows or declines, and only after an allow can requester pay ₹29 to see name and photo. Email is never shared. (`PAY-017`, `ID-001`). **Superseded 2026-10-14 by DEC-013:** no new request, allow or purchase is possible. |
| **DEC-014** | Free, with no chat time limit | **Decided 2026-10-15 (user instruction):** `BILLING_MODE` set to `free` in the developer's `.env.local` (each deployment's own setting is the owner's to change), and the two-minute chat limit removed from the code in every mode: no timer, countdown, expiry or extension. The payment sections of Terms and Privacy, the Refund Policy's paid terms and the footer's Refund Policy link appear only in effective Paid Mode. Razorpay code behind the billing gate is left untouched. Retires CORE-003, CHAT-003, CHAT-004, FREE-005, PAY-018 and DATA-004. **Conflict left open:** the paid `connect` product (DEC-002) sells "unlimited chat" plus a contact request. With no time limit the unlimited half is worth nothing, yet the checkout sheet, Terms and Refund Policy (Paid Mode only) still describe it. Paid Mode must not be enabled until DEC-002 and DEC-010 are revisited. |
| **DEC-013** | Who may request identity | **Decided 2026-10-14 (user instruction):** only a paying user may request. The ₹29 connect payment is the only way to ask the other dancer for anything: it unlocks unlimited chat and sends the request for real name and email (DEC-002). Removed the same day: the free "Ask to see name & photo" request, the partner's allow/decline for it, the separate ₹29 name-and-photo purchase (`POST /api/rooms/[roomId]/reveal`, `RevealPanel`, `RevealModal`, `notifyRevealRequest`), and `create-order` now refuses `reveal` and `extend`. Kept: reveals already granted still show (chat `sharedWithMe`, dancer list), and a `reveal` or `extend` order created before the change is still fulfilled if its payment lands. `reveal_requests` is left untouched. Supersedes DEC-012 for anything new. |

### Information required

- Hosting platform and environment layout (README says Vercel; nothing in repo confirms).
- Whether `0001_init.sql` matches any live database; whether Clerk ↔ Supabase third-party auth is configured.
- Whether any live Razorpay payments have ever been taken.
- Razorpay written eligibility response (GATE-001/003).
- Target launch date relative to the Navratri season.

### Technical debt

- `process.env.X!` non-null assertions for Supabase config (CFG-005). Removed from `lib/razorpay.ts` 2026-10-14.
- Ad-hoc request-body casts instead of validation (SEC-004). The three billing routes narrow the body without casts since 2026-10-14; other routes still cast.
- `read_by[]` read-modify-write (CHAT-006).
- `PRICE_PAISE` lives in `lib/room.ts` (a client-importable module) — fine for display, but the authoritative catalogue must be server-side (PAY-002).

---

## 18. Objective traceability and change management

### 18.1 Traceability matrix

Status abbreviations: **V** Verified (scope in brackets, e.g. unit/route level) · **IU** Implemented — unverified · **P** Partial · **C** Conflicts · **M** Missing · **Pl** Planned · **IR** Information Required.

| ID | Requirement (short) | Implementation location | Status | Evidence / test | Next action | Depends / blockers |
|---|---|---|---|---|---|---|
| CORE-001 | Free Mode default, fully functional | app-wide | P | in-process smoke | Browser-level smoke | FREE-003 |
| CORE-002 | Server authoritative | `lib/server.ts`, `app/api/**` | P | TEST-003 | Fix CHAT-003 | PRIV-005 |
| CORE-003 | Two-minute rule | removed | Retired (DEC-014) | `tests/chat-messages.test.ts`, smoke (no limit) | — | DEC-014 |
| CFG-001 | `BILLING_MODE` resolution | `lib/billing.ts` | V (unit) | `tests/billing.test.ts` | Run in CI | TEST-006 |
| CFG-002 | Paid fails closed | `lib/billing.ts`, `lib/razorpay.ts` | P | `tests/billing.test.ts`, `tests/payment-routes.test.ts` | Stricter live-key environment check | DEP-001 |
| CFG-003 | Credentials ≠ paid | `lib/billing.ts`, payment routes | V (route) | `tests/payment-routes.test.ts`, `tests/smoke/free-mode.test.ts` | Browser-level check | — |
| CFG-004 | Mode from server | chat page → `ChatRoom.tsx` | P | smoke render + Paid Mode control | Landing; devtools check | FREE-003 |
| CFG-005 | Supabase config validation | `lib/supabase*.ts` | M | unit test | Add validator | — |
| FREE-001 | Runs without Razorpay env | app-wide | P | clean-worktree build and tests with no provider env | Run CI on GitHub; browser smoke | TEST-006 |
| FREE-002 | No gateway contact | `useRazorpay.ts`, `lib/razorpay.ts` | IU | `razorpay()` refusal; smoke asserts no SDK/fetch | Browser network capture | — |
| FREE-003 | No paid UI/claims | chat, landing (2026-10-14), policy pages and footer (2026-10-15) | P | smoke (chat); `tests/refund-policy.test.ts` (`FeaturesReveal`); `tests/legal-pages.test.ts` (Free Mode pages and footer); source search (landing) | Rendered-HTML assertion for the landing page (TEST-007) | PRIV-006 |
| FREE-004 | Billing endpoints inert; webhook grants only verified paid-era ledger orders | `app/api/payment/*`, webhook | P | `tests/payment-routes.test.ts`, smoke | Continuity path after ledger (FU-001) | PAY-003/006/011 |
| FREE-005 | Free mutual +2 min extension at expiry | removed | Retired (DEC-014) | — | — | DEC-014 |
| FREE-006 | No identity sharing offered in Free Mode; free exchange unbuilt | `create-order`, `ChatRoom.tsx` | IU / Retired | `tests/reveal.test.ts`, smoke | Reveal flow gated to Paid Mode; free contact exchange retired | DEC-002, DEC-012 |
| FREE-007 | Non-destructive switching | `extraSecondsFor`, `lib/consent.ts`, consent route | IU | `tests/smoke/free-mode.test.ts` (render only) | Mode-flip integration test | DEC-003 |
| FREE-008 | Config ≠ approval | process | M | change record | Adopt §20 | GATE-* |
| AUTH-001 | Auth on all surfaces | `middleware.ts`, `requireUserId` | IU | TEST-003 | Route-table test | — |
| ONB-001 | Generated nicknames | `displayNames.ts`, `actions.ts` | IU | unit test | Write tests | — |
| ONB-002 | Data minimisation | `actions.ts` (`completeOnboarding`), `OnboardingModal.tsx` | C | review | Remove unused collection; decide `instagram_handle` | DEC-002 |
| DISC-001 | Public fields, filtered | `api/users/route.ts` | P | TEST-003; `tests/campus-privacy.test.ts` (private fields never selected) | Add block/opt-out filter; approve campus fields | SAFE-001, DEC-009 |
| DISC-002 | Presence integrity | `useLobbyPresence.ts` | P | TEST-005 | See PRIV-005 | PRIV-005 |
| CHAT-001 | 1:1 room access | `lib/room.ts`, `loadRoom` | IU | TEST-003 | Write tests | — |
| CHAT-002 | Message integrity | `messages/route.ts`, RLS | IU | TEST-005 | Write tests | — |
| CHAT-003 | Timer start server-enforced | removed | Retired (DEC-014) | — | — | DEC-014 |
| CHAT-004 | Limit not sidestepped | removed | Retired (DEC-014) | — | Harassment risk moves to CHAT-007, SAFE-001 | DEC-014 |
| CHAT-005 | Reconnect resync | `useSupabaseRealtime.ts` | P | E2E/manual | Refetch on resubscribe | — |
| CHAT-006 | Read receipts consistent | `read/route.ts` | P | review | Atomic append | — |
| CHAT-007 | Rate limiting | `lib/rateLimit.ts`, routes, `actions.ts` | P | `tests/rate-limit.test.ts`, `tests/chat-messages.test.ts` | Shared store for a cross-instance cap (owner decision) | — |
| NOTIF-001 | In-app message notifications | `MessageNotifier.tsx`, `useAppStore.ts` | IU | manual two-account run | Do the run; persist unread | SEC-003 |
| NOTIF-002 | Web Push via service worker | `lib/push.ts`, `api/push/subscribe`, `public/sw.js`, `0006_push_subscriptions.sql` | IU | `tests/push.test.ts`, `tests/chat-expiry.test.ts` | Apply 0006, set `VAPID_*`, two-device run | DATA-001, CHAT-007, SAFE-001 |
| PAY-001 | Mode-gated billing | payment routes, `ChatRoom.tsx` | P | `tests/payment-routes.test.ts` | Landing copy | FREE-003 |
| PAY-002 | Server catalogue, amount+currency | `lib/room.ts:24`, `create-order`, `verify`, webhook | P | `tests/payment-routes.test.ts` (webhook and verify mismatch) | Catalogue; record anomalies | PAY-003 |
| PAY-003 | Order/payment ledger | `0002_payment_orders.sql`, `0003_…webhook_events.sql`, `0006_contact_consent.sql`, `lib/payments.ts` | P | `tests/payment-routes.test.ts` | `fulfilled` state, automatic `refunded`, full audit table, apply migrations | DATA-001 |
| PAY-004 | Order ownership | `verify/route.ts` (ledger) | V (unit) | `tests/payment-routes.test.ts` | Run in CI | PAY-003 |
| PAY-005 | Checkout signature | `lib/razorpay.ts` | V (unit) | `tests/payment-routes.test.ts` | Run in CI | CFG-002 |
| PAY-006 | Authoritative payment status | `verify/route.ts` | P | `tests/payment-routes.test.ts` | Fetch in the webhook too; run against Razorpay test mode | PAY-003 |
| PAY-007 | Raw-body webhook | `webhooks/razorpay/route.ts` | V (unit, paid path) | `tests/payment-routes.test.ts` | Run in CI | — |
| PAY-008 | Idempotency/concurrency | `lib/payments.ts` (`settlePayment`, `recordEvent`), webhook, `webhook_events`, 0006 unique indexes | P | `tests/payment-routes.test.ts` | Atomic event claim; real-database concurrency test | PAY-003 |
| PAY-009 | Event coverage/ordering | webhook | P | `tests/payment-routes.test.ts` | `order.paid`, `refund.processed` | PAY-003 |
| PAY-010 | Recoverable fulfilment | `lib/payments.ts` (`fulfilOrder`), `0003_…webhook_events.sql`, `0006_contact_consent.sql` | P | `tests/payment-routes.test.ts` | Request + unlock + mark-paid in one transaction; alert (OPS-003) | PAY-003 |
| PAY-011 | Preconditions at fulfilment | `create-order/route.ts`, `lib/payments.ts`, 0006 constraints | P | `tests/payment-routes.test.ts` | Blocking; partner still exists at fulfilment | SAFE-001, ID-001 |
| PAY-012 | Refunds | `app/(main)/refund-policy/page.tsx`, `lib/payments.ts`, `0006_contact_consent.sql` | P | `tests/refund-policy.test.ts`, `tests/consent-flow.test.ts` (decline and expiry are not refunded), `tests/payment-routes.test.ts` (unlock failure) | Manual refunds; `refund.processed`; alert | PAY-003, PAY-009 |
| PAY-013 | Reconciliation | — | M | report | Script | PAY-003 |
| PAY-014 | Client never grants | `useRazorpay.ts`, `ChatRoom.tsx` | IU | TEST-004 | Write tests | — |
| PAY-015 | Replay protection | `verify/route.ts`, ledger | V (unit) | `tests/payment-routes.test.ts` | Run in CI | PAY-003 |
| PAY-016 | Pre-checkout disclosure | `ConnectModal.tsx`, `TimerExpiredOverlay.tsx` | P | `tests/refund-policy.test.ts`; review outstanding | Terms/Privacy links; copy review | GATE-004 Terms/Privacy links added 2026-10-14. |
| PAY-017 | Paid reveal needs prior agreement | `create-order/route.ts`, `lib/payments.ts`, `lib/reveal.ts`, `0008_reveal_requests.sql` | V (unit) | `tests/payment-routes.test.ts` | Apply 0008; Razorpay test-mode run; refunds | ID-001/002, PAY-012, GATE-003 Retired for new orders (DEC-013); fulfilment of earlier orders only. |
| PAY-018 | Extension delivers its full time | removed | Retired (DEC-014) | — | — | DEC-014 |
| GATE-001…003 | Razorpay eligibility, KYC, use case | external | IR | written confirmation | Contact Razorpay | — |
| GATE-004 | Policies published | `app/(main)/refund-policy/page.tsx` | P | live URLs (none yet); `tests/refund-policy.test.ts` | Terms, Privacy, cancellation; deploy; legal review | GATE-008 Terms + Privacy pages added 2026-10-14. |
| GATE-005 | Live creds/webhook config | external | IR | env audit | — | GATE-002 |
| GATE-006 | Payment testing | — | M | CI + test record | — | TEST-004 |
| GATE-007 | Monitoring/incident | — | M | runbook | — | OPS-* |
| GATE-008 | Legal/privacy review | — | M | sign-off | Engage reviewer | DEC-002/005/006 |
| SEC-001 | Secrets server-side | `lib/*` `server-only` | IU | bundle-name scan step in CI workflow; clean in local simulation (Clerk SDK's own `CLERK_SECRET_KEY` lookup excluded) | Run on GitHub | TEST-006 |
| SEC-002 | AuthZ before service role | all `supabaseAdmin()` callers | IU | TEST-003 | Write tests | — |
| SEC-003 | RLS correct | migration | IU | TEST-005 | Local Supabase tests | IR: live config |
| SEC-004 | Input validation | `lib/validation.ts`, route handlers, `actions.ts` | P | `tests/chat-messages.test.ts`, `tests/rate-limit.test.ts`, `tests/push.test.ts` | Allow-list `branch`/`collegeYear`/`vibeTag`; payment routes when Paid Mode is revisited | — |
| SEC-005 | Security headers, request screening | `lib/securityHeaders.mjs`, `next.config.mjs`, `middleware.ts`, `lib/requestGuards.ts` | IU (unit + manual, public pages) | `tests/security-headers.test.ts`; headless-Edge run 2026-10-15 | Browser check of signed-in pages and the production Clerk domain | DEP-001 |
| PRIV-001 | Name/email private (admin roster excepted, DEC-011) | `lib/consent.ts` (`getRevealedContact`), `lib/reveal.ts` (`getRevealed`, `listRevealed`), `app/admin/users/page.tsx` | V (unit) | `tests/consent-flow.test.ts`, `tests/campus-privacy.test.ts`, `tests/reveal.test.ts`, `tests/admin.test.ts` | Real-database RLS test | ID-001, DEC-011 |
| PRIV-002 | No IDOR | `room.ts`, routes | IU | TEST-003/004 | Write tests | — |
| PRIV-003 | No PII in logs | `lib/server.ts:23` | P | review | Sanitise | OPS-001 |
| PRIV-004 | Deletion/retention | — | M | integration test | Design | DEC-006 |
| PRIV-005 | Private Realtime channels | `useLobbyPresence.ts`, `useSupabaseRealtime.ts` | P | TEST-005 | Private channels + policy | DATA-001 |
| PRIV-006 | Truthful claims | landing, onboarding, README | P | review | Copy review sign-off; event wording vs no event model | — |
| ID-001 | Consent before disclosure | `0006_contact_consent.sql`, `lib/consent.ts`, `lib/reveal.ts`, `0008_reveal_requests.sql` | V (unit) | `tests/consent-flow.test.ts`, `tests/reveal.test.ts`, `tests/payment-routes.test.ts` | Real-database test in CI; apply migrations | DEC-002, DEC-012 |
| ID-002 | Consent ≠ payment | payment routes, `lib/payments.ts`, `lib/reveal.ts` | V (unit) | `tests/payment-routes.test.ts`, `tests/consent-flow.test.ts`, `tests/reveal.test.ts`, smoke | Run in CI | DEC-002, DEC-012 |
| ID-003 | Informed, scoped, revocable | `ConsentBanner.tsx`, 0006/0008 timestamps | P | review; smoke | Revocation (open gap); field choice | DEC-002, DEC-012 |
| ID-004 | Mutual-exchange option | `lib/consent.ts` | P | `tests/consent-flow.test.ts` | Field choice; decide on ID-004 free mutual scope | ID-001, DEC-002 |
| SAFE-001 | Blocking | `lib/blocks.ts`, `app/api/blocks/**`, `loadRoom`, `/api/users`, `Dashboard.tsx`, migration 0010 | IU (route, mocked DB) | `tests/blocks.test.ts` | Apply 0010; unblock screen; browser check | DATA-001 |
| SAFE-002 | Reporting | `app/api/reports/route.ts`, `Dashboard.tsx`, migration 0010, `app/admin/*` (removal) | P | `tests/reports.test.ts` | Apply 0010; review queue; report from chat with messages | DATA-001, DEC-006 |
| SAFE-003 | 18+ self-declaration at onboarding | `OnboardingModal.tsx`, `actions.ts` | M | TEST-003, TEST-007 | Build | DATA-001; GATE-008 |
| SAFE-004 | Abuse prevention | — | M | refs | — | CHAT-004/007 |
| ADMIN-001 | Admin console access | `lib/admin.ts`, `app/admin/*`, `middleware.ts` | IU | `tests/admin.test.ts`; signed-out 404 probe | Signed-in run as admin and non-admin | AUTH-001, DEC-011 |
| ADMIN-002 | Admin removal actions | `app/admin/actions.ts` | IU | `tests/admin.test.ts` | Run against a test database; unblock path | ADMIN-001/003, PRIV-004 |
| ADMIN-003 | Admin audit log | `lib/admin.ts`, `0007_admin_actions.sql` | IU | `tests/admin.test.ts` | Apply 0007; set retention | DATA-001, DEC-006 |
| DATA-001 | Migrations only | `supabase/migrations/` (0001–0010) | P | schema diff | Adopt CLI; apply 0006-0010; README lists all migrations | IR: live DB |
| DATA-002 | Entitlement linkage | migration | P | TEST-005 | With PAY-003 | PAY-003 |
| DATA-003 | User referential integrity | migration | P | integration | With PRIV-004 | PRIV-004 |
| DATA-004 | Timer monotonic | removed | Retired (DEC-014) | — | — | DEC-014 |
| API-001 | Consistent contracts | `lib/server.ts` | P | TEST-003 | Error codes | — |
| API-002 | Route inventory | §3.3 | IU | TEST-003 | Route-table test | TEST-001 |
| OPS-001…006 | Ops | see §13 | M/P | see §13 | see §13 | — |
| TEST-001 | Test runner | `vitest.config.ts`, `tests/` | P | `npm test` local + CI simulation | Run CI on GitHub | TEST-006 |
| TEST-002 | Billing config tests | `tests/billing.test.ts` | IU (passing locally) | local run | Run in CI | TEST-006 |
| TEST-004 | Payment tests | `tests/payment-routes.test.ts`, `tests/consent-flow.test.ts` | P | local run | PAY-006, PAY-012 automatic refunds; real database | PAY-003 |
| TEST-006 | CI | `.github/workflows/ci.yml` | IU | local clean-worktree simulation | First GitHub run; make required check on `main` | push (owner) |
| TEST-007 | Free Mode smoke | `tests/smoke/free-mode.test.ts` | P (in-process, mocked) | `npm run test:smoke` | Browser-level flow incl. sign-up/onboarding/discovery | test Clerk/Supabase projects or browser tooling |
| TEST-003, TEST-005 | Testing | — | M | — | Phase 0/1 | — |
| DEP-001…004 | Deployment | — | IR/M | see §15 | see §15 | — |

### 18.2 Change-management rules

1. **IDs are permanent.** Never renumber or reuse an ID. Retired objectives stay listed with status `Retired` and a reason.
2. **Status changes need evidence.** Moving to *Verified* requires a link to the test or recorded evidence in the same change. Moving to *Implemented — unverified* requires naming the file(s).
3. **Update both places.** When an objective's status changes, update its entry and its matrix row in the same commit.
4. **Product decisions change objectives deliberately.** When an owner decides a DEC-* item or changes a requirement, record the decision (date, who, what) in the relevant objective and move the DEC entry to a "Decided" note. Objectives are not immutable; silent drift is what is prohibited.
5. **Security boundaries and gates** (SEC-*, PRIV-*, ID-*, CFG-002/003, FREE-008, GATE-*) may only be relaxed with explicit written approval from the project owner, recorded here.
6. **Code is the source of truth for current state.** If code and this document disagree, fix whichever is wrong and record which.

---

## 19. Definition of Done (for every engineering task)

A task is done only when **all** of the following hold:

1. The requested behaviour is implemented, and existing behaviour outside the request is preserved.
2. The objective IDs the change affects are identified, and their acceptance criteria are met — or the gap is explicitly reported.
3. Relevant automated tests are added or updated and pass. Any test that was not run is disclosed with the reason.
4. `npm run typecheck` and `npm run lint` pass.
5. Security and authorization impact is evaluated: every new or changed `supabaseAdmin()` query is preceded by an authorization check; no secret reaches the client; no new public field is exposed.
6. Free Mode still works with no Razorpay configuration.
7. Configuration and migration impacts are documented (new env vars in `.env.example` without values; new migrations as new files).
8. Objective statuses and the matrix are updated where the change warrants, with evidence.
9. Known limitations and remaining work are reported.
10. Production readiness is not claimed without the evidence required by §8 and §20.

**Additional requirements for billing changes:**

11. Payment-state transitions are consistent with PAY-003 and recorded.
12. Webhook processing is idempotent (PAY-008) and tested with duplicate and out-of-order delivery.
13. Authorization is server-side for every billing endpoint.
14. Tests demonstrate that an unverified, forged, foreign, replayed or non-captured payment grants no entitlement.
15. Tests demonstrate that no payment path discloses identity without ID-001 consent.

---

## 20. Final launch-readiness checklist

### Free Mode public launch

- [ ] CFG-001…005, FREE-001…005, FREE-007 at *Verified*
- [ ] PRIV-001, PRIV-006, ID-002, ONB-002 no longer *Conflicts*
- [ ] SAFE-001, SAFE-002, SAFE-003, CHAT-007 at *Verified*
- [ ] PRIV-005 at *Verified*
- [ ] TEST-003, TEST-005, TEST-006, TEST-007 green in CI
- [ ] Terms and Privacy Policy published (subset of GATE-004); GATE-008 review of identity/age/data handling complete
- [ ] DATA-001 schema diff empty against production
- [ ] OPS-001, OPS-004 in place; owner on call during event hours
- [ ] `BILLING_MODE` unset in production; no `RAZORPAY_*` live keys present

### Paid Mode enablement (additionally)

- [ ] GATE-001…008 all recorded as passed, with evidence filed
- [ ] FU-001, FU-002, FU-003 closed with evidence
- [ ] PAY-001…016 at *Verified*; TEST-004 green
- [ ] OPS-002, OPS-003, OPS-005 in place; Free Mode rollback rehearsed
- [ ] DEC-002, DEC-004, DEC-007, DEC-010 decided and reflected in objectives
- [ ] Live end-to-end checks in production: success, failure, cancel, duplicate, refund
- [ ] DEP-004 change record created and linked to this checklist
- [ ] Project owner sign-off: name, date
