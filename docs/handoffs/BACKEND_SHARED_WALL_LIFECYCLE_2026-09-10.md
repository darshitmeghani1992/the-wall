# Implementation State: Shared-Wall Lifecycle (0026)

**Role:** Backend
**Date:** 2026-09-10
**Base:** `5b6f78c3a5685244a75c0955af1a10ecad39cf74` / tree `f452927fb45b5dde9060df08e8927f9c2b339101`
**Classification:** Database, authorization, privacy, and concurrency; Two-Key review required.
**Deployment state:** Source only. Not committed, pushed, merged, applied to hosted Supabase, or deployed.

## Built

- `supabase/migrations/0026_shared_wall_lifecycle.sql`
  - Adds `walls.open_join` with the Public Shared-Wall constraint.
  - Adds a private, RPC-only `shared_wall_member_removals` ledger.
  - Reconciles owner memberships/tombstones, accepted-member tombstone collisions,
    and legacy `owner` membership roles before restoring runtime triggers.
  - Enforces deferred Shared-Wall, single-owner, and accepted-membership/removal
    collision invariants.
  - Restricts direct Wall creation to active actors creating their own Shared Wall;
    the protected profile trigger remains the Personal-Wall creator.
  - Uses an actor-bound zero-argument active-account helper in RLS, keeping the
    arbitrary-actor `is_active_account(uuid)` predicate private from app roles.
  - Makes Shared-Wall membership, settings, ownership, and deletion lifecycle RPC-only.
  - Implements join, invite/response, removal, leave, settings, deletion, transfer,
    owner removal-list, and minimal private-invite-preview contracts.
  - Extends the actor-bound Wall capability DTO with the approved `join_state`
    vocabulary and derives `can_join` solely from `join_state = 'joinable'`.
  - Adds accepted-invite and ownership-transfer Alert kinds through the protected
    notification writer.
- `supabase/tests/71_shared_wall_lifecycle.sql`
  - Covers grants, creation boundaries, exact preview/capability shapes, every
    join state, removal persistence, reinvite/decline/accept, stale mutations,
    inactive/missing target cleanup, block ordering, transfer, deletion, media
    cleanup outbox, and deferred invariants.
- `supabase/tests/71_shared_wall_upgrade.sh`
  - Applies migrations 0001–0025 on a fresh database, seeds legacy owner,
    active, inactive, blocked, role, and tombstone drift, applies 0026, and
    verifies reconciliation plus runtime-trigger restoration.
- `supabase/tests/72_shared_wall_races.sh` and SQL fixtures
  - Exercises remove/join, block/join, close/join, delete/join, transfer/leave,
    accept/revoke, join/deactivation, and duplicate-join physical races.
- `supabase/tests/80_notifications.sql`
  - Moves the historical Shared-Wall invite Alert assertion to the new RPC.
- `supabase/tests/run_tests.sh`
  - Preserves the legacy pre-cutover membership assertions, then loads 0026 and
    runs the lifecycle, upgrade, and physical-race suites.

## Tested

- **Verified:** exact clean base/tree before editing.
- **Verified:** `bash -n` passes for all changed shell runners.
- **Verified:** `git diff --check` passes.
- **Verified:** every function introduced/replaced by 0026 declares
  `SECURITY DEFINER` and a fixed `pg_catalog, public` search path.
- **Verified:** no migration toggles or alters platform-owned `storage.objects`.
- **Verified:** 0026 RLS policies do not directly invoke a helper whose EXECUTE
  privilege is revoked from `authenticated`.
- **Verified:** clean CI run 126 applied migrations through 0026 and passed the
  Shared-Wall lifecycle assertions preceding the deletion-media fixture. Its
  failure was isolated to test setup creating an upload as `consumed` before
  linking `mark_media`; production integrity correctly rejected that order.
- **Believed-likely:** the corrected deletion fixture now follows the previously
  verified media sequence: validated upload, canonical relation, then consumed.
- **Not verified:** the corrected deletion/outbox assertion, later suites, and
  physical race outcomes. The full suite must rerun in clean CI before this
  Two-Key work may be considered verified or mergeable.

## Stubbed / Mocked

None. The test harness uses its established Supabase compatibility shim, but the
new SQL tests are real database assertions rather than mocked unit tests.

## Contract Compliance Check: FP-SHARED-001 / Migration 0026

### RPCs

| Contract | Matches? | Deviation |
|---|---:|---|
| `join_shared_wall(uuid) -> jsonb` | Yes | None |
| `invite_shared_wall_member(uuid,uuid) -> jsonb` | Yes | None |
| `respond_shared_wall_invite(uuid,boolean) -> jsonb` | Yes | None |
| `remove_shared_wall_member(uuid,uuid) -> jsonb` | Yes | None |
| `leave_shared_wall(uuid) -> jsonb` | Yes | None |
| `update_shared_wall_settings(uuid,text,text,boolean,boolean) -> jsonb` | Yes | None |
| `delete_shared_wall(uuid,text) -> jsonb` | Yes | None |
| `transfer_shared_wall_ownership(uuid,uuid) -> boolean` | Yes | None |
| `list_removed_shared_wall_members(uuid)` | Yes | None |
| `get_my_pending_shared_wall_invite(uuid) -> jsonb` | Yes | None |
| `get_wall_capabilities(uuid) -> jsonb` amendment | Yes | None |

### Schema and authorization

| Contract | Matches? | Deviation |
|---|---:|---|
| `walls.open_join` and Public Shared-Wall check | Yes | None |
| Private removal ledger, no app/service table grant | Yes | None |
| Canonical member-only role | Yes | None |
| Deferred owner/member/removal/collision invariants | Yes | None |
| RPC-only lifecycle and direct-write cutover | Yes | None |
| Wall → sorted profile → pair → sorted membership lock order | Yes | None |
| Minimal invite preview and non-enumerating denial | Yes | None |
| Exact `join_state` priority and unavailable shape | Yes | None |
| Protected Alert writer and expanded kind vocabulary | Yes | None |

**Result:** PASS at source-comparison level. Runtime compliance remains unverified
until PostgreSQL CI executes the migration and all serial/concurrent assertions.

## Failure Recovery

- Lifecycle RPCs lock and mutate within one PostgreSQL transaction; thrown
  infrastructure/Alert failures roll back the entire operation.
- Retried joins/invites return stable `already_member` / `already_invited` states.
- Removal tombstones survive reinvite, revoke, and decline; only accepted invite
  completion clears them in the same transaction.
- Settings, membership, block, active-account, and ownership state are revalidated
  after locks, so stale client capability data does not authorize a write.
- Wall deletion uses exact-name confirmation and existing cascading media outbox
  triggers; no client performs multi-step cleanup.

## Left To Do

1. Independent Reviewer checks this exact frozen source and confidence claims.
2. Clean PostgreSQL CI executes every migration and assertion, including rollback
   behavior and eight two-session races.
3. QA independently verifies hosted Supabase and client lifecycle journeys.
4. Only after Reviewer approval and QA pass may a separately authorized merge or
   deployment be considered.

## Technical Debt Flagged

None added by this implementation.

## Contract Flaws Flagged

None outstanding. The `join_state` amendment and inactive/missing-target removal
clarification were incorporated from the independently approved Architect review.
