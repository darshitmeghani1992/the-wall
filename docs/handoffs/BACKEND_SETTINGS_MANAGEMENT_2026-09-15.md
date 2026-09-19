# Implementation State: FP-SET-001 Settings Management (Backend)

**Role:** Backend
**Date:** 2026-09-15
**Base:** draft PR #22 tree `94ffaa71efc0527a61c432443f84b5147309e878`

## Built

- `0028_blocked_users_management.sql` adds the exact authenticated-only,
  actor-bound `list_my_blocked_users(uuid,timestamptz,uuid)` RPC. It exposes only an active
  caller's outbound blocks, returns a strict five-field identity projection, and uses 20+1
  keyset pagination.
- `22_blocked_users_management.sql` verifies signature/ACL, status precedence, unavailable
  accounts, paired cursors, outbound-only privacy, exact JSON keys, inactive blocked-target
  manageability, and equal-timestamp two-page pagination without gaps or duplicates.
- `blocked-users-contract.ts` strictly parses the RPC envelope and rejects additional/missing
  keys, malformed UUIDs/timestamps, oversized pages, and invalid continuation cursors.
- `blocks.ts` adds the paged read and makes unblock require the exact deleted row while preserving
  `unblockUser(expectedActorId,userId)`.
- `personal-wall-settings.ts` is the canonical Personal-Wall settings and approved-writer data
  service. Writes are expected-actor preflighted, owner/type anchored, restricted to the three
  approved fields, and require exact returned rows. Approved-writer profile hydration is minimal
  and never drops an association whose profile is RLS-hidden.
- `profiles.ts` keeps the onboarding API but delegates its settings write to the canonical service.
- `expected-actor.ts` maps the session-changed message only for exact `42501` +
  `ACTOR_MISMATCH` server errors.
- `DECISIONS.md` corrects the migration-0027 zero-argument deactivation history and records the
  migration-0028 privacy decision.

## Tested

- **Verified:** TypeScript passes.
- **Verified:** ESLint has zero errors and nine pre-existing warnings. The one concurrent
  Frontend warning found during integration was corrected before this handoff.
- **Verified:** all 20 local client/Frontend contract tests pass.
- **Verified:** `git diff --check` and every Supabase shell script pass syntax checks.
- **Believed-likely:** migration 0028 and DB assertion 22 are PostgreSQL-correct based on direct
  source inspection and established suite conventions.
- **Not verified:** the full PostgreSQL suite and rollback execution, because this workspace has
  no `psql`. CI must execute both migration load/replay and assertion 22 before Reviewer handoff.

## Stubbed / Mocked

None. No hosted data or production service was touched.

## Contract Compliance Check

| Surface | Matches approved contract? | Deviation |
|---|---:|---|
| Block-list RPC signature, precedence, ACL and result | Yes | None |
| 20+1 keyset pagination and 20th-row cursor | Yes | None |
| Strict blocked-user parser | Yes | None |
| Personal-Wall settings fields and actor anchoring | Yes | None |
| Approved-writer association preservation/minimal hydration | Yes | None |
| Exact-row add/remove/unblock | Yes | None |

**Result:** PASS at source-contract level; PostgreSQL execution remains pending.

## Failure / Retry Behavior

- Block-list reads are stable and retry-safe.
- Settings updates save all three values in one SQL statement and are safely retryable.
- Approved-writer duplicate inserts alone map to `already_approved`; all other failures surface.
- Remove/unblock retries after a prior successful delete return an actionable stale-row error and
  never report a false success.
- Migration rollback is client-first and metadata-only; it does not rewrite user data.

## Left To Do

1. Run the full PostgreSQL 16 suite in CI, including migration 0028 replay and assertion 22.
2. Independent Two-Key Reviewer inspection of the exact integrated tree.
3. QA behavioral verification after Reviewer approval.

## Risks / Regulated-Domain Flag

Block relationships and profile identity are personal privacy data. The implementation keeps the
existing bilateral profile RLS boundary and adds only the Founder-approved outbound management
projection. Hosted migration behavior remains unverified and unapproved.

## Contract Flaws / Technical Debt

No contract deviations or new dependencies. No hosted migration, merge, deployment, commit, or
push was performed by Backend.
