# GarbaConnect

A Navratri / Garba partner-finding app. Dancers sign up, get a generated nickname, browse who else is at the garba, and chat one-to-one. It is free, and chats have no time limit.

**The app is free by default.** It runs with no payment setup at all. Payments are an optional mode that is switched off unless explicitly configured, and are not approved for production use yet (see [Billing modes](#billing-modes)).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind v3 · Framer Motion 11 · React Three Fiber + drei · GSAP ScrollTrigger · Lenis · Clerk · Supabase (Postgres + Realtime) · Zustand · react-window · Razorpay (optional) · Vitest

## Project status

Pre-launch. Nothing here has been tested against real providers end to end or on real phones.

- [`OBJECTIVES.md`](OBJECTIVES.md) is the product and engineering contract: what the app must do, what is built, what is missing, and the gates before launch. Read it before changing behaviour.
- [`CLAUDE.md`](CLAUDE.md) holds the rules coding agents follow in this repo.
- [`docs/ui-ux-audit.md`](docs/ui-ux-audit.md) records the mobile and accessibility audit and what was and wasn't verified.

Known gaps that block a public launch (details and IDs in `OBJECTIVES.md` §17 and §20):

- No blocking, reporting or age confirmation yet. Rate limits exist but are counted per server instance (CHAT-007).
- The landing page still shows placeholder statistics, testimonials and ₹29 claims that need replacing.
- Only a paying user can ask for anyone's identity: the ₹29 connect payment is the only request there is, and the other dancer must accept it (`OBJECTIVES.md` DEC-002, DEC-013). Rows in the old payer-only `reveals` table are not shown; what to do with them is undecided (DEC-003).
- Realtime presence channels are public.
- Payment provider eligibility, a payment ledger and reconciliation are unresolved.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Clerk and Supabase keys below
npm run dev
```

### 1. Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and copy the publishable and secret keys into `.env.local`.
2. If the keys are missing or still placeholders, every page shows a "Clerk isn't set up yet" screen listing what's wrong, and API routes return `503`. Values in `.env.local` override `.env`, and you need to restart `npm run dev` after editing either one.
3. Turn on the **Supabase integration** (Clerk Dashboard → Integrations → Supabase). This adds the `role: authenticated` claim that Supabase needs.

The name shown on the sign-in screen ("Sign in to …") is the application name in the Clerk dashboard, not something in this repo.

### 2. Supabase

1. Create a project and copy the URL, the anon key and the service-role key.
2. Under **Authentication → Sign In / Providers → Third-party auth**, add **Clerk** and paste your Clerk domain. Browser requests then carry the Clerk session token, and RLS reads the Clerk user id from `auth.jwt()->>'sub'`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` to the **Project URL** only (`https://<ref>.supabase.co`). Don't add `/rest/v1` and don't use the dashboard link. If the URL or keys are wrong, or the tables are missing, `/dashboard` and `/chat` show a screen saying exactly which one, and API routes return `503`.
4. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the tables, RLS policies and the Realtime publication. Then run `0004_campus_branch.sql` and `0005_campus_vibe_outfit_instagram.sql`, which add the campus profile fields (branch, year, vibe, outfit, Instagram handle), and `0010_blocks_reports.sql` for blocking and reporting. The other migrations belong to optional features and are named in the sections below: `0006_push_subscriptions.sql` for notifications, `0007_admin_actions.sql` for the admin console, and `0002_payment_orders.sql`, `0003_fulfilment_failed_and_webhook_events.sql`, `0006_contact_consent.sql`, `0008_reveal_requests.sql`, and `0009_payment_product_connect.sql` for Paid Mode. Schema changes go in new numbered migration files; never edit one that has been applied.

### 3. Notifications (optional)

In-app notifications for new messages need no setup. To also notify people when the app is in the background or closed (Web Push):

1. Run `supabase/migrations/0006_push_subscriptions.sql` in the SQL editor.
2. Generate a key pair with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` or `https:` contact URL). Use a different pair per environment and keep the private key server-side.
3. Each dancer turns notifications on from the dashboard. Notifications show the sender's nickname only, never the message. On iPhone, Safari delivers push only to a site added to the home screen.

### 4. Admin console (optional)

`/admin` lets an admin see the dancer roster (including real names and emails), remove a dancer, remove and block a dancer, and remove a chat room. It is a 404 for everyone else.

1. Run `supabase/migrations/0007_admin_actions.sql` in the SQL editor. It creates the audit log; the console refuses to show the roster or remove anything without it.
2. Make an account an admin in Clerk: [dashboard.clerk.com](https://dashboard.clerk.com) → **Users** → the user → **Metadata** → **Public** → set `{ "role": "admin" }`. Use Public metadata, not Unsafe: users can edit their own unsafe metadata. Nobody is an admin until you do this.
3. Sign in with that account and open `/admin`. The role is read from Clerk on each request, so adding or removing it takes effect straight away.

Every roster view and removal is recorded. "Remove & block" bans the account in Clerk; unblock it from the Clerk dashboard. The console does not show message text.

### 5. Razorpay (optional, off by default)

Skip this unless you are working on Paid Mode. See [Billing modes](#billing-modes).

## Billing modes

The server decides the mode in one place, [`lib/billing.ts`](lib/billing.ts), from the `BILLING_MODE` variable.

| `BILLING_MODE` | Result |
| --- | --- |
| unset, empty or `free` | **Free Mode.** No payment UI; payment routes return `403 billing_disabled`. |
| `paid` and every Razorpay setting valid | **Paid Mode.** |
| `paid` but a Razorpay setting is missing or malformed | Billing stays off; payment routes return `503 billing_unavailable`; the problem is logged by variable name. |
| anything else | Free Mode, with a logged configuration error. |

- Razorpay credentials on their own never turn payments on.
- In any non-paid state the webhook still rejects bad signatures, and for valid ones grants nothing, logs the ids and replies 200.
- The readiness check wants a well-formed key id, key and webhook secrets of at least 16 characters, `NEXT_PUBLIC_RAZORPAY_KEY_ID` equal to `RAZORPAY_KEY_ID`, and live keys only in production builds.

**Do not enable Paid Mode in production.** The gates in `OBJECTIVES.md` §8 (written provider eligibility, policies, payment testing, monitoring, legal review) and follow-ups FU-001 to FU-003 are not met.

To work on Paid Mode with test keys: copy the key id and secret from Razorpay Dashboard → Settings → API Keys (test mode), add a webhook at `https://<your-domain>/api/webhooks/razorpay` for `payment.captured` and `payment.failed`, put its secret in `RAZORPAY_WEBHOOK_SECRET`, run `supabase/migrations/0002_payment_orders.sql`, `0003_fulfilment_failed_and_webhook_events.sql`, `0006_contact_consent.sql`, `0008_reveal_requests.sql`, and `0009_payment_product_connect.sql` in the SQL editor, and set `BILLING_MODE=paid`.

There is one thing to buy in Paid Mode, and buying it is the only way to ask the other dancer for anything (DEC-013):
- **Connect (₹29):** Bought once per room. A confirmed payment removes the time limit on that chat at once (`rooms.unlimited`), and asks the other dancer to share contact details. If they accept, each sees the other's real name and email. If they decline or do not answer within 24 hours, nothing is shared, the chat stays unlimited, and there is no refund.
- The free "ask to see name & photo" request and its separate ₹29 purchase were removed on 2026-10-14, as was the paid 2-minute extension. Name-and-photo reveals granted before then still show, and an order for either that was created before then is still honoured if its payment arrives. `0008_reveal_requests.sql` is still needed for those.

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # Vitest: billing config, payment routes, consent flow, chat expiry, Free Mode smoke
npm run test:smoke   # only the Free Mode smoke test
npm run build
```

- Tests live in `tests/`. They mock Clerk, Supabase and Razorpay; none of them talk to a real provider or run in a browser.
- `.github/workflows/ci.yml` runs typecheck, lint, tests, a production build and a scan of the browser bundle for server-only variable names, on pull requests and pushes to `main`, with no credentials.

## How it fits together

```
app/
  (auth)/sign-in, sign-up          Clerk screens
  (main)/layout.tsx                Lenis (landing only), custom cursor, navbar
  (main)/page.tsx                  landing: R3F mandala hero + scroll sections
  (main)/dashboard                 dancer list, onboarding sheet, server actions
  (main)/chat/[roomId]             chat room
  api/users                        public profile list (no name/email)
  api/rooms/[roomId]               room state; /messages, /read, /consent (answer a request to share contact details)
  api/users/[userId]/contact       real name + email, only after both agreed (404 otherwise)
  api/reveals                      who you are connected with, and who is waiting for your answer
  api/payment/create-order|verify  Razorpay order + signature check (Paid Mode only)
  api/webhooks/razorpay            signature-checked webhook (grants only in Paid Mode)
components/3d | landing | dashboard | chat | modals | layout | ui
hooks/  useFocusTrap, useLenis, useLobbyPresence, useRazorpay, useSupabase, useSupabaseRealtime
lib/    billing, supabase (browser), supabaseAdmin, razorpay, payments, consent, server, displayNames, room
store/  useAppStore (zustand)
tests/  billing, payment-routes, consent-flow, chat-expiry, campus-privacy, refund-policy, smoke/free-mode
docs/   ui-ux-audit.md
```

### Privacy and data access

- The browser can't read another user's `real_name` or `email` from the database. The only RLS policy on `users` lets you read your own row, and the dancer list comes from `/api/users`, which selects public columns only.
- Two people see each other's real name and email only after one has paid and the other has accepted the request to share them. The server returns those two fields, and nothing else, when a `contact_reveals` row exists for the pair (`lib/consent.ts`). A payment on its own never reveals anything.
- Nothing about identity or payments is kept in `localStorage`, `sessionStorage` or cookies; it comes from the server on every load.
- All writes (messages, read receipts) go through route handlers that use the service-role key after checking who is calling. The browser client only reads what RLS allows and listens on Realtime.
- Secrets stay server-side: modules that read them import `server-only`, and the only `NEXT_PUBLIC_*` values are public identifiers: the Clerk publishable key and route URLs, the Supabase URL and anon key, and the Razorpay key id.
- Not yet true, and tracked in `OBJECTIVES.md`: revoking a contact exchange and choosing which fields to share (ID-003), private Realtime channels (PRIV-005), account deletion and retention (PRIV-004).

### Chat rules

- A room id is the sorted pair of both Clerk ids, so only those two people can open it.
- Chats have no time limit (DEC-014, 2026-10-15). `rooms.timer_started_at` and `chat_extensions` are still in the schema but nothing uses them.
- Each dancer may open 5 new rooms and send 30 messages a minute (`lib/rateLimit.ts`); past that the server answers 429.

## Design

The colours come from things you'd actually see at a garba, not from a screen: soot-black wood, khadi cotton, kumkum, turmeric, indigo dye, henna leaf and gulal pink. Everything uses flat fills with a light paper grain, dashed "running stitch" borders and a bandhani dot texture. There's no neon, no glassmorphism and no gradient text.

| Token    | Hex       | Use                                   |
| -------- | --------- | ------------------------------------- |
| `ink`    | `#1A1410` | page background                       |
| `ink-2`  | `#231B15` | surfaces, headers                     |
| `paper`  | `#F3EADB` | text on dark, light sections          |
| `kumkum` | `#B23A2E` | primary action, sent bubbles          |
| `haldi`  | `#D8A23A` | accents, timer, focus outline         |
| `neel`   | `#2F4B6E` | male badge, secondary blocks          |
| `gulal`  | `#C2566B` | female badge                          |
| `mehndi` | `#6B7A3A` | "other" badge, checkmarks             |

Typography is Cinzel for display and Nunito for UI, both self-hosted through Fontsource.

- **Mobile first.** Primary controls are at least 44px tall on phones, and layouts are checked from 320px up.
- **Cursor.** On devices with a mouse, the pointer is a single Dandiya stick ([`components/ui/DandiyaSticks.tsx`](components/ui/DandiyaSticks.tsx)): a kumkum body with two haldi bands and a hairline ink edge, drawn as inline SVG at 18px with its tip on the click point. It tracks the mouse with no easing, grows slightly over links and buttons, shrinks on press, and throws a brief haldi spark from the tip when it clicks one. Touch devices keep native behaviour, and text fields keep the system I-beam.
- **Accessibility.** Sheets are labelled dialogs that trap focus and return it on close, every control has a visible focus outline, and animations, smooth scrolling and the cursor's motion respect `prefers-reduced-motion`.

## Implementation notes

- Clerk v5 deprecated `authMiddleware`, so `middleware.ts` uses `clerkMiddleware` with a route matcher instead.
- The R3F canvas uses `frameloop="always"` while the hero is on screen and `"never"` once it scrolls away. `"demand"` would freeze the mandala animation.
- Message times are formatted in the browser, so server and browser markup match.
- Security headers (CSP, HSTS, framing, referrer, permissions) are defined once in `lib/securityHeaders.mjs`, sent by `next.config.mjs` on every response and added by `middleware.ts` to its own. The CSP reads the Clerk and Supabase hosts from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`; a new third-party origin must be added there.
- `middleware.ts` answers 403 to a blank or known-scanner User-Agent (except `/api/webhooks/*`) and, in production, redirects plain http to https.
- Request bodies are parsed with Zod (`lib/validation.ts`) before use.

## Deploy

Not ready for production; see [Project status](#project-status).

For a preview deployment (for example on Vercel), add the Clerk and Supabase variables from `.env.example` and leave `BILLING_MODE` and the `RAZORPAY_*` variables unset so the app runs in Free Mode. Hosting and environment separation are not yet documented (DEP-001).
