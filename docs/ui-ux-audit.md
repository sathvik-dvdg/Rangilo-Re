# UI/UX audit and mobile-first fixes — 2026-10-13

Record of a code-plus-rendering audit of GarbaConnect's user-facing screens and the fixes made from it. Findings marked **rendered** were confirmed in headless Chrome against the dev server; **code** findings come from reading the source only.

## 1. Architecture overview

- **Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS 3 with a project palette (`ink`, `paper`, `kumkum`, `haldi`, `neel`, `mehndi`, `gulal` in `tailwind.config.ts`), Cinzel (display) and Nunito (UI) via Fontsource, Framer Motion, GSAP ScrollTrigger and Lenis (landing only), React Three Fiber (hero mandala), Clerk for auth screens.
- **Routes:** `/` (landing), `/sign-in`, `/sign-up` (Clerk components inside `app/(auth)/layout.tsx`), `/dashboard` (dancer list + onboarding sheet), `/chat/[roomId]` (one-to-one chat). `/dashboard` and `/chat` require a Clerk session.
- **Shared UI:** `components/ui/button.tsx` (cva variants), `Avatar`, `GenderBadge`, `Toast`, `components/modals/BottomSheet.tsx`, `components/layout/Navbar.tsx`, `CustomCursor`.
- **Existing conventions kept:** flat palette, dashed "stitch" borders, bandhani dot texture, paper grain, Cinzel headings. No new visual style or token system was introduced; the existing Tailwind tokens already cover colour and type.
- **Tooling:** `npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run build`. No visual-regression or accessibility tooling in the repo. For this audit, Chrome was driven with `puppeteer-core` installed in a scratch folder outside the repo (not a project dependency).

### How the signed-in screens were rendered

No test Clerk account was available, so a temporary development-only route (`app/ui-preview-tmp`, now deleted) mounted the real `Dashboard`, `OnboardingModal` and `ChatRoom` components with fixture data; the browser's `/api/*` calls were intercepted by the test script. The real `/dashboard` and `/chat/[roomId]` pages wrap these same components, but the server-side parts of those pages (auth, Supabase queries) were not exercised.

## 2. Initial audit

Viewports: 320×640, 360×740, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, for landing (scrolled through every section at 320, 390, 768, 1280), sign-in, dashboard, onboarding, active chat and expired chat. **No horizontal overflow at any width** (rendered).

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| P1 | Chat page hydration failure. The timer bar width was computed from `Date.now()` during render, and message times used `toLocaleTimeString` on the server (different locale/time zone than the reader). React discarded the server HTML and re-rendered the whole page client-side; on a UTC server, message times would also be wrong for Indian users. | Rendered: 9 console errors per chat view ("Prop `style` did not match… width:83.31% vs 82.64%", "1:51 am vs 1:51 AM"). Code: `hooks/useChatTimer.ts`, `components/chat/MessageBubble.tsx`. | Timer's first render uses the server's render time passed as a prop (`renderedAt`); times are formatted in the browser after mount. |
| P2 | Landing: on phones the primary "Join Navratri" call to action was below the first screen (mandala took 50vh). | Rendered: 390×844 first screen shows mandala + heading only. | Mandala 30vh (190–340px) below `md`; body copy 16px on phones. |
| P2 | Returning users on phones had no visible "Sign in" (hidden below 640px in the navbar). | Code: `Navbar.tsx` `hidden sm:inline-flex`. | Phone-only "Sign in" link next to the hero call to action (signed-out users only); navbar unchanged on wider screens. |
| P2 | Expired Free Mode chat said "your messages are still here to read" but blurred the thread and blocked interaction. | Rendered: chat-expired at 320–1440. | Free Mode: thread stays readable; a "Time's up" panel replaces the composer. Paid Mode overlay unchanged. |
| P2 | Touch targets under 44px: navbar buttons 36px, dashboard filter chips 34px, chat back button 40px, hero "How it works" 20px, onboarding reroll 32px, Clerk Google button 30px, sheet close button ~32px. | Rendered measurements. | 44px on phones (navbar keeps 36px at ≥640px for mouse use). Clerk buttons/inputs via `lib/clerkAppearance.ts`. |
| P2 | Navbar wordmark touched the "Join Navratri" button at 320px. | Rendered: landing-320. | Smaller wordmark and gaps below 360px. |
| P2 | Dashboard error state told users to "pull to refresh", which does not exist; no retry. | Code: `Dashboard.tsx`. | `role="alert"` message with a working "Try again" button. |
| P2 | Onboarding sheet had no dialog semantics; selected gender conveyed by colour only; photo input was `display:none` (unreachable by keyboard). | Code: `OnboardingModal.tsx`. | `role="dialog"`, `aria-modal`, `aria-labelledby`; `aria-pressed` on choices; `sr-only` file input with a visible focus ring on its label. |
| P2 | Animations ignored `prefers-reduced-motion` (Framer Motion, CSS marquee/shimmer/thread/hourglass, Lenis smooth scroll). | Code. | `MotionConfig reducedMotion="user"` at the root; CSS loops stopped under reduced motion; Lenis not started. |
| P3 | Search and chat inputs had no accessible name beyond the placeholder; filter chips didn't expose selected state. | Code. | `aria-label`s, `aria-pressed`, `enterKeyHint`, `autoComplete="off"`. |
| P3 | Focus styles inconsistent: raw buttons/links relied on browser defaults. | Code. | One global `:focus-visible` outline in haldi; components with their own ring keep it. |
| P2 | Onboarding and bottom sheets let keyboard focus move to the page behind them, and did not return focus on close. | Code. | `hooks/useFocusTrap.ts`: focus moves into the dialog on open, Tab and Shift+Tab stay inside, focus returns to the opener on close. |
| P3 | Bottom sheets (Paid Mode only): no Escape to close, no max height, close button small. | Code. | Escape closes, `max-h-[90dvh]` with internal scroll, 44px close button. |
| P3 | Some secondary text below comfortable contrast (`paper/45` on ink). | Code. | Raised to `paper/60` for chat partner status and message times. |
| P3 | Android keyboard could cover the chat composer (layout viewport didn't resize). | Code (not reproducible headless). | Viewport `interactive-widget=resizes-content`; composer pads for the bottom safe area. |

Not changed (outside this audit's scope or needs a decision): landing copy, fabricated stats and testimonials (`DEC-008` in `OBJECTIVES.md`); the Clerk application name "Rangilo Re" shown on sign-in (set in the Clerk dashboard, not in code).

## 3. Design decisions

- **Direction:** keep the existing restrained, festive identity; fix hierarchy and ergonomics rather than restyle. No new colours, shadows or effects.
- **Responsive strategy:** existing Tailwind breakpoints; phones get compositional changes only where content priority demanded it (hero visual size, phone-only Sign in, closed-chat panel layout).
- **Touch targets:** 44px for primary controls on phones; mouse-sized (36px) navbar buttons kept at ≥640px.
- **Navigation:** no drawer or bottom navigation — the app has two signed-in screens and two signed-out links, so a menu would add a tap without adding reach.
- **Motion:** honour `prefers-reduced-motion` globally rather than per component.

## 4. Implementation record

| File | Change |
|---|---|
| `hooks/useChatTimer.ts`, `components/chat/ChatTimer.tsx`, `app/(main)/chat/[roomId]/page.tsx` | Hydration-safe timer (`renderedAt` from the server). |
| `components/chat/MessageBubble.tsx` | Client-side time formatting in a `<time>` element; fixed-height meta row (no layout shift); higher contrast. |
| `components/chat/ChatRoom.tsx` | Free Mode closed-chat panel; 44px back button; labelled composer; safe-area padding. |
| `components/chat/TimerExpiredOverlay.tsx` | Back to Paid-Mode-only (the Free Mode branch moved into `ChatRoom`). |
| `components/landing/HeroSection.tsx` | Phone hero sizing; phone-only Sign in; 44px secondary links. |
| `components/layout/Navbar.tsx` | 44px controls on phones; narrow-screen wordmark spacing. |
| `components/dashboard/Dashboard.tsx` | Retry on error; 44px chips with `aria-pressed`; labelled search. |
| `components/dashboard/OnboardingModal.tsx` | Dialog semantics, `aria-pressed`, 44px reroll, keyboard-reachable photo input, safe-area padding, internal scroll. |
| `components/modals/BottomSheet.tsx` | Escape to close, max height with scroll, 44px close button, safe-area padding, focus trap. |
| `hooks/useFocusTrap.ts` (new) | Focus trap and focus restoration shared by both sheets. |
| `tests/chat-expiry.test.ts` (new), `tests/smoke/free-mode.test.ts` | Server refuses messages after expiry; expired Free Mode render has no composer. |
| `components/layout/MotionPreferences.tsx` (new), `app/layout.tsx` | Reduced-motion config; Android keyboard viewport behaviour. |
| `hooks/useLenis.ts`, `app/globals.css` | No smooth scroll and no CSS loops under reduced motion; global focus-visible outline. |
| `app/(auth)/layout.tsx`, `lib/clerkAppearance.ts` | `100dvh` layout; 44px Clerk buttons and inputs. |
| `components/ui/DandiyaSticks.tsx`, `components/layout/CustomCursor.tsx` | Cursor redrawn as one 18px dandiya stick in palette tokens only (kumkum body, two haldi bands, 1px ink edge at 60%, no halo); follows the pointer with no easing, scales 1.15 with a haldi tip on hover and 0.9 on press; a mouse click on a link or button plays a 360ms four-tick haldi spark from the tip (off under reduced motion). |

Behaviour preserved: routes, auth, API calls, billing gating, form submission and validation logic are unchanged. The expired-chat strings checked by the Free Mode smoke test are unchanged.

## 5. Verification results

Executed on 2026-10-13:

- `npm run typecheck` — passed. `npm run lint` — no warnings or errors. `npm test` — 62 passed, 1 todo.
- `npm run build` — passed in an isolated worktree copy (fresh `npm ci`, no `.env`), so the running dev server was not disturbed.
- **Responsive audit** (all views × 9 viewports, before and after): no horizontal overflow before or after; console errors in chat views 9 → 0; undersized touch targets on phones reduced to the dashboard search input's inner element (its 44px wrapper label is the actual tap target) and Clerk's own footer links.
- **Behaviour checks** (12/12 passed): dashboard error shows a retry that reloads the list; filter chips and gender choices expose `aria-pressed`; onboarding is a labelled modal dialog; reroll is 44×44; first Tab stop shows a solid 2px outline; Lenis runs normally and is off under reduced motion; marquee stops under reduced motion; chat composer is labelled; expired Free Mode chat is unblurred, interactive and shows the closed panel.
- **Expired chat is read-only** (confirmed two ways): in Free Mode the composer `<form>` is not rendered once the chat expires (smoke test asserts no form and no message input, while the thread is still rendered), and `POST /api/rooms/[roomId]/messages` returns 403 and writes nothing after expiry (`tests/chat-expiry.test.ts`, 4 cases including granted extra time). In Paid Mode the composer stays but is disabled; the server check is the same.
- **Focus trap** (6/6 passed in headless Chrome, temporary fixture route): focus moves into the onboarding dialog and the bottom sheet on open; 12 Tabs and 6 Shift+Tabs never leave the onboarding dialog; the sheet cycles Close → its two buttons; Escape closes the sheet and focus returns to the button that opened it.
- **Screenshots inspected:** landing at 320/390/1280 (and every section at 320), dashboard at 360/375/1280, onboarding at 375, chat and expired chat at 320/375/1280, sign-in at 320.

**Not verified:** real phones and iOS Safari; on-screen keyboard behaviour; screen readers; the real `/dashboard` and `/chat` pages with a signed-in Clerk session and live Supabase data; Paid Mode sheets (not rendered in Free Mode).

## 6. Remaining work

- Test on real Android Chrome and iOS Safari, including the keyboard over the chat composer.
- A screen-reader pass (TalkBack, VoiceOver) of onboarding and chat.
- Landing copy and claims pending `DEC-008`; Clerk application name.
- At 320×640 the hero call to action is still one scroll down.
