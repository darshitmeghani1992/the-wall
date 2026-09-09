# FP-SEC-002 — Secret Mark one-time reveal + 1-hour expiry

**Status:** Implemented (migration `0010`), pending Two-Key (Reviewer + QA/Security).
**Risk class:** HIGH (Secret Mark storage/reveal → Master Spec §91, AIOS Two-Key).
**Master Spec authority:** §27.3 (one-time atomic reveal), §27.4 (one-hour lifetime),
§68 (secret payload data + race-condition requirement), §72 (RLS contract), §111 (expired state).

## Problem
FP-C2 / ADR-008 moved Secret **content** off the base `marks` row into the RLS-gated
`mark_secrets` side table (content never on the base row, never in realtime; owner/recipient
read via RLS). That closes the *content-isolation* leak but does **not** deliver two Master
Spec promises:

1. **One-time reveal (§27.3):** "server atomically records opened state … second reveal must
   fail … do not rely on client-only flag." Today the recipient can re-read
   `mark_secrets.content` indefinitely via a direct `SELECT`.
2. **One-hour lifetime (§27.4 / §68):** the secret must expire 1 hour after creation; at/after
   expiry the payload is unavailable and the shell is cleaned up. Today there is no expiry.

## Design (ADR-010)

### Schema — `0010_secret_reveal_lifecycle.sql` (additive, idempotent)
- `mark_secrets.expires_at timestamptz not null default now() + interval '1 hour'`
- `mark_secrets.opened_at  timestamptz` (NULL = unopened; non-NULL = consumed at that time)

Existing rows (there are none in production yet) get `expires_at = now()+1h` on backfill —
acceptable because Secret Marks have not shipped to a hosted DB.

### Reveal is a gated, atomic RPC — `reveal_secret(p_mark_id uuid) returns jsonb`
`SECURITY DEFINER`, `search_path = public`. Steps:
1. **Authorize:** caller must be the wall owner (recipient) — `exists(marks join walls where
   owner_id = auth.uid())`. Otherwise return `{ok:false, reason:'not_authorized'}` (no content,
   no existence signal about the secret's state).
2. **Atomic consume:** one statement —
   `update mark_secrets set opened_at = now() where mark_id = p_mark_id and opened_at is null
   and now() < expires_at returning content`.
   The row lock makes this the concurrency primitive: two simultaneous callers serialize on the
   row; the first flips `opened_at` and gets `content`; the second re-evaluates `opened_at is
   null` → false → 0 rows. **Two reveals can never both succeed** (§68 race requirement).
3. **Classify failure** (only when step 2 returned nothing) without leaking content:
   `missing` (no row) / `consumed` (`opened_at` already set) / `expired` (`now() >=
   expires_at`). Content is returned **only** on the winning `ok` path.

### Reads become RPC-only for clients
`revoke select on mark_secrets from authenticated` and drop the now-moot `"mark_secrets read
owner"` SELECT policy. A retained direct `SELECT` would let the recipient re-read content and
defeat one-time reveal, so it must go. `service_role` keeps its explicit `SELECT` grant for the
moderation read path (§53). `grant execute on function reveal_secret(uuid) to authenticated`.

### Expiry cleanup — `expire_secret_marks() returns integer`
`SECURITY DEFINER`. Sets expired secret shells `marks.status = 'removed'` (so `getWallMarks`,
which filters `status='active'`, stops showing them — §27.4 shell removal) and deletes the
expired `mark_secrets` rows (payload purge). Returns the number purged. `grant execute … to
service_role`. **Deploy task:** schedule on hosted via `pg_cron` (e.g. every 5 min). Until
scheduled, a still-visible expired shell reveals `expired` at read time, so there is no leak —
only a delayed disappearance. This is the §82-style "safest practical equivalent, remaining
task marked."

## Client
- `src/lib/marks.ts`: `getSecretContent` → **`revealSecret(markId): Promise<RevealResult>`**
  calling `supabase.rpc('reveal_secret', { p_mark_id })`. Emits `secret_mark_opened` analytics
  only on `ok` (no content in the event).
- `src/components/marks/MarkView.tsx`: `SecretMark` gains terminal `consumed` / `expired`
  phases with honest copy (§111), in addition to `locked`/`loading`/`revealed`/`error`.

## Verification (QA / Security — Key 2)
- `supabase/tests/61_secret_reveal.sql` (new) as the acting roles:
  - owner first reveal → `ok` + content; **owner second reveal → `consumed`, no content**;
  - **expired secret → `expired`, no content** (backdated `expires_at`);
  - **non-owner reveal → `not_authorized`, no content**;
  - `opened_at` is set exactly once; base `marks.text` stays NULL throughout.
- `60_secret_marks.sql` owner/non-owner reads migrated to the RPC path (direct client SELECT is
  now revoked).
- Full `run_tests.sh` suite stays green; `tsc` + `eslint` clean.

## Risk register (delta)
| ID | Risk | Mitigation |
|---|---|---|
| R-A3 | Recipient re-reads content out-of-band, defeating one-time reveal | Direct `SELECT` revoked; reads only via the consuming RPC. Harness asserts second reveal → `consumed`. |
| R-A4 | Two concurrent reveals both return content | Single row-locked conditional `UPDATE … RETURNING`; only the winning caller gets content. |
| R-A5 | Expired content still readable | RPC checks `now() < expires_at`; harness asserts `expired`. Cleanup fn purges payload (scheduled deploy task). |
| R-A6 | Failure classification leaks content/existence | Content returned only on `ok`; `not_authorized` returned before any row lookup. |
