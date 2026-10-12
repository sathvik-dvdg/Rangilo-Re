# GarbaConnect — agent instructions

Next.js 14 App Router + TypeScript, Clerk auth, Supabase (Postgres, RLS, Realtime), optional Razorpay. See `README.md` for setup and `OBJECTIVES.md` for the product and engineering contract.

Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run build`. There is no test runner yet (objective TEST-001).

## Project governance (mandatory for every coding task)

`OBJECTIVES.md` is the authoritative specification. The repository is the source of truth for *current* behaviour. When they disagree, report the disagreement; don't silently pick one.

Before editing code:

1. Read the sections of `OBJECTIVES.md` relevant to the task and list the objective IDs it affects (e.g. `CFG-001`, `PAY-008`, `ID-001`).
2. Inspect the existing implementation before proposing changes.
3. If the request conflicts with an objective, explain the conflict and the affected IDs **before** making a consequential change. A deviation that changes a security boundary, product commitment or readiness gate (SEC-*, PRIV-*, ID-*, CFG-002/003, FREE-008, GATE-*) needs explicit approval from the user.

While editing:

4. Preserve the Free Mode default. Missing or invalid `BILLING_MODE` means free; credentials alone never enable payments; Paid Mode fails closed. The app must work with no `RAZORPAY_*` variables.
5. Keep the boundaries: secrets never in `NEXT_PUBLIC_*` or client modules; every `supabaseAdmin()` query is preceded by an authorization check; the server decides billing, entitlements, timer, consent and identity disclosure; **payment never substitutes for the disclosed person's consent**.
6. Make small, reviewable changes. No unrelated refactors, no new dependencies or infrastructure without stating why.
7. Schema changes go in a new numbered file in `supabase/migrations/`; never edit an applied migration.
8. Don't enable live payments, add live credentials, or build anything that works around payment-provider restrictions.

After editing:

9. Add or update tests where a runner exists. State plainly which tests were and were not run.
10. Update the affected objectives' status and their row in the §18 matrix. Never mark an objective *Verified* without linking a test or recorded evidence. Planning or docs alone never completes an objective or phase.
11. When the user makes a product or architecture decision, record it in `OBJECTIVES.md` (resolve the DEC-* item, update the objective). Objectives are changeable by decision, not by drift.
12. Report objective conflicts, missing prerequisites, unresolved decisions and remaining work in your final message. Apply the Definition of Done in `OBJECTIVES.md` §19.
