# GarbaConnect

A Navratri / Garba partner-finding app. Dancers sign up, get a generated nickname, browse who else is at the garba, and chat one-to-one. The two-minute clock starts once both people have spoken. ₹29 (Razorpay) reveals someone's real name and Gmail, or adds two more minutes.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind v3 · Framer Motion 11 · React Three Fiber + drei · GSAP ScrollTrigger · Lenis · Clerk · Supabase (Postgres + Realtime) · Razorpay · Zustand · react-window

## Palette

The colours come from things you'd actually see at a garba, not from a screen: soot-black wood, khadi cotton, kumkum, turmeric, indigo dye, henna leaf and gulal pink. Everything uses flat fills with a light paper grain, dashed "running stitch" borders and a bandhani dot texture. There's no neon, no glassmorphism and no gradient text.

| Token    | Hex       | Use                                   |
| -------- | --------- | ------------------------------------- |
| `ink`    | `#1A1410` | page background                       |
| `ink-2`  | `#231B15` | surfaces, headers                     |
| `paper`  | `#F3EADB` | text on dark, light sections          |
| `kumkum` | `#B23A2E` | primary action, sent bubbles          |
| `haldi`  | `#D8A23A` | accents, prices, timer                |
| `neel`   | `#2F4B6E` | male badge, secondary blocks          |
| `gulal`  | `#C2566B` | female badge                          |
| `mehndi` | `#6B7A3A` | "other" badge, checkmarks             |

Typography is Cinzel for display and Nunito for UI, both self-hosted through Fontsource.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev
```

### 1. Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and copy the publishable and secret keys into `.env.local`.
2. If the keys are missing or still placeholders, every page shows a "Clerk isn't set up yet" screen listing what's wrong, and API routes return `503`. Values in `.env.local` override `.env`, and you need to restart `npm run dev` after editing either one.
3. Turn on the **Supabase integration** (Clerk Dashboard → Integrations → Supabase). This adds the `role: authenticated` claim that Supabase needs.

### 2. Supabase

1. Create a project and copy the URL, the anon key and the service-role key.
2. Under **Authentication → Sign In / Providers → Third-party auth**, add **Clerk** and paste your Clerk domain. Browser requests then carry the Clerk session token, and RLS reads the Clerk user id from `auth.jwt()->>'sub'`.
3. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the tables, RLS policies and the Realtime publication.

### 3. Razorpay

1. Copy the key id and secret from Razorpay Dashboard → Settings → API Keys (use test mode first).
2. Add a webhook at `https://<your-domain>/api/webhooks/razorpay` for the `payment.captured` event, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.

## How it fits together

```
app/
  (auth)/sign-in, sign-up          Clerk screens
  (main)/layout.tsx                Lenis (landing only), custom cursor, navbar
  (main)/page.tsx                  landing: R3F mandala hero + scroll sections
  (main)/dashboard                 dancer list, onboarding modal, server actions
  (main)/chat/[roomId]             chat room
  api/users                        public profile list (no name/email)
  api/rooms/[roomId]               room state; /messages, /read, /timer
  api/payment/create-order|verify  Razorpay order + signature check
  api/webhooks/razorpay            fallback fulfilment
components/3d | landing | dashboard | chat | modals | ui
hooks/  useLenis, useChatTimer, useRazorpay, useSupabaseRealtime, useLobbyPresence
lib/    supabase (browser), supabaseAdmin, razorpay, payments, server, displayNames, room
store/  useAppStore (zustand)
```

### Privacy and payment safety

- The browser can't read `real_name` or `email`. The only RLS policy on `users` lets you read your own row. The dashboard list comes from `/api/users`, which selects public columns only, and identities are returned only after the server finds a matching `reveals` row.
- All writes (messages, timer start, read receipts, unlocks) go through route handlers that use the service-role key. The browser client only reads what RLS allows and listens on Realtime.
- `create-order` sets the amount (₹29 = 2900 paise) and records in the order notes what the payment unlocks. `verify` checks the HMAC signature with a timing-safe compare, fetches the order from Razorpay, confirms it belongs to the caller, and then unlocks based on those notes, not on anything the client sends. Fulfilment is idempotent (`payment_id` is unique), so the webhook and the checkout handler can both run safely.
- Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` reaches the browser. `.env*.local` is gitignored.

### Chat rules

- A room id is the sorted pair of both Clerk ids, so only those two people can open it. The server also rejects any room that has more than two distinct senders ("Room is full").
- The timer starts only when both dancers have sent a message and both have the room open (Supabase presence). The server sets `rooms.timer_started_at` once, using an `is null` guard.
- Remaining time is `120s + Σ extensions − elapsed`. When it runs out, the server refuses new messages, and the UI blurs the thread and offers an extension.

## Notes on the original prompt

- Clerk v5 deprecated `authMiddleware`, so `middleware.ts` uses `clerkMiddleware` with a route matcher instead.
- The R3F canvas uses `frameloop="always"` while the hero is on screen and `"never"` once it scrolls away. `"demand"` would freeze the mandala animation.
- The extensions table is named `chat_extensions`, matching the payment code.

## Deploy

Push to Vercel, add every variable from `.env.example` in Project Settings → Environment Variables, and update the Razorpay webhook URL to your production domain.
