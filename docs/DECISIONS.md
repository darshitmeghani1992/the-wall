# The-Wall Decision Log

Meaningful technical decisions. Trivial choices are omitted (§94). Format:
date · decision · reason · alternatives · reversibility · Founder Gate?

---

## D-0 · 2026-08-20 · Verify the security layer against a real Postgres each session
- **Decision:** Run `supabase/tests/run_tests.sh` against a locally-initialized Postgres 16
  cluster (server binaries are present in the environment) as the standard QA/Security gate,
  instead of leaving RLS "Believed-likely / hosted not run."
- **Reason:** The kickoff mandates adversarial security testing and Two-Key QA. A real DB
  turns RLS/anonymity/secret/membership claims from *believed* into *verified*.
- **Alternatives:** Docker Postgres (daemon unavailable here); hosted Supabase (needs Founder
  credentials — a Gate); static review only (insufficient for a security gate).
- **Reversibility:** Fully reversible (test-only infra).
- **Founder Gate?** No.

## D-1 · 2026-08-20 · Complete Secret lifecycle via migration 0010 + a gated reveal RPC
- **Decision:** Implement Master Spec §27.3/§27.4/§68 as an additive migration `0010`:
  add `expires_at` (default now()+1h) and `opened_at` to `mark_secrets`; add a
  `SECURITY DEFINER` `reveal_secret(uuid)` RPC that (a) authorizes the caller as the wall
  owner/recipient, (b) performs a single atomic `UPDATE … WHERE opened_at IS NULL AND now()
  < expires_at RETURNING content`, and (c) classifies failure as `consumed` / `expired` /
  `not_authorized` / `missing` without leaking content. **Revoke** direct `SELECT` on
  `mark_secrets` from `authenticated` so all reads go through the one-time RPC (a retained
  direct SELECT would defeat one-time reveal). Add `expire_secret_marks()` cleanup fn for a
  scheduled job.
- **Reason:** One-time reveal must be **server-atomic** (spec: "do not rely on client-only
  flag"; two simultaneous reveals must not both succeed). A row-locked conditional UPDATE is
  the simplest correct primitive; `RETURNING` gives content only to the single winning caller.
- **Alternatives:** Client-side "opened" flag (rejected — spoofable, not atomic); advisory
  locks (heavier, unnecessary); trigger-based consume (less legible than one gated RPC).
- **Reversibility:** Additive/idempotent migration; reverting means dropping the columns/fn
  and restoring the SELECT grant. Reversible pre-hosted-apply.
- **Founder Gate?** No for code; **hosted apply is a destructive-production Gate** (unchanged).

## D-2 · 2026-08-20 · Distinct `expired` vs `consumed` reveal states (not a single "gone")
- **Decision:** `reveal_secret` returns `jsonb {ok, reason, content?}` so the client can show
  §111's *specific expired state* separately from *already opened*.
- **Reason:** Spec §111 wants a specific expired message; distinguishing costs one extra
  classify query and leaks nothing (content only ever returned on `ok`).
- **Reversibility:** Reversible (return-shape only).
- **Founder Gate?** No.

## D-3 · 2026-08-20 · Reads of `mark_secrets` are RPC-only for clients; moderation stays direct
- **Decision:** After 0010, `authenticated` has **no** direct table privilege on
  `mark_secrets`; the client uses only `reveal_secret`. `service_role` keeps its explicit
  `SELECT` grant for the moderation read path (§53). The now-moot owner SELECT policy is
  dropped for clarity. Existing `60_secret_marks.sql` owner/non-owner reads are updated to
  the RPC path; new `61_secret_reveal.sql` proves the lifecycle.
- **Reason:** One-time reveal is only real if the content cannot be re-read out-of-band.
- **Reversibility:** Reversible (re-grant + re-add policy).
- **Founder Gate?** No.

## D-4 · 2026-08-20 · Reconciliation posture — Master Spec wins over prototype Mark types
- **Decision:** The obsolete prototype Mark types (`roast`, `award`, `poll`, `doodle`,
  `prediction`) and the "pick a type" composer conflict with §4 (excluded: games/doodles)
  and §21 (single integrated composer; Secret/Anonymous are modes, not types). They are
  **flagged for reconciliation** (BUILD_STATUS Reconciliation Debt) and will be collapsed to
  the integrated composer in a following frontend slice — **not** touched in the same commit
  as the high-risk Secret DB change, to keep the Two-Key security diff minimal and reviewable.
- **Reason:** Authority order (§1) puts the Master Spec above existing code; but sequencing a
  large frontend refactor separately from a security migration keeps each diff auditable.
- **Reversibility:** Reversible (product/UI).
- **Founder Gate?** No (engineering sequencing, §89). Visual result later merits Founder QA.
