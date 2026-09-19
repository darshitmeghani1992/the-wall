# ADR-016 · Recoverable account deletion is a separate server-owned lifecycle

**Status:** Corrected draft candidate; independent Two-Key re-review pending
**Date:** 2026-09-18

## Context

The existing `deactivate_account(uuid)` operation is reversible and intentionally preserves content. Permanent deletion has different consequences and must not be inferred from `profiles.deactivated_at`. The current foreign keys would delete owned Walls while retaining authored Marks as anonymous rows, which is the opposite of the approved policy for Shared Walls and user-authored content.

## Decision

Add a private `account_deletion_requests` lifecycle with a server-calculated 30-day deadline. Expose an actor-bound scheduling RPC, a current-actor status RPC, and service-only due-work/preparation RPCs.

- Scheduling requires exact `DELETE` confirmation, an active account, and zero owned Shared Walls.
- A repeated scheduling call is idempotent and does not move the deadline.
- Scheduling deactivates the account in the same transaction.
- `reactivate_account(uuid)` removes any deletion request and restores the profile in the same transaction before the deadline; recovery is rejected once the server deadline has passed.
- Purge preparation locks the profile and request, rejects early or invalid execution, and deletes both identified and Anonymous authored Marks explicitly. The private worker then uses Supabase Auth's server-only Admin API to delete the identity; existing foreign keys remove the remaining identity-owned rows.
- Protected Mark media is cleaned through the existing exact-path deletion outbox. Unconsumed media is queued by the existing subject-deletion trigger.
- Public avatar-object deletion is an operations precondition for purge preparation; the hosted operator must remove `attachments/avatars/<user-id>/...` through the Storage API before calling the preparation RPC and Auth Admin deletion.

## API contract

`request_account_deletion(expected_actor_id, confirmation)` returns one of:

- `{status: "scheduled", requested_at, purge_after}`
- `{status: "owner_action_required", owned_shared_wall_count}`
- `{status: "unavailable"}`

`get_my_account_deletion()` returns `{status: "scheduled", ...}`, server-owned `{status: "expired", ...}`, or `{status: "none"}`. Clients never infer expiry from the device clock.

`list_due_account_deletions(limit)` and `prepare_account_deletion_for_purge(user_id, expected_requested_at)` are service-only. Preparation returns `true` only for a valid due request and fails closed if avatar Storage rows remain. The worker then calls `auth.admin.deleteUser(user_id, false)`.

## Reversibility

The migration is additive before hosted application. The executable pre-application rollback at `supabase/rollbacks/0031_recoverable_account_deletion_preapply.sql` refuses to run once any deletion request exists, then removes the new surfaces and restores the prior actor-bound reactivation and avatar policies. After the first accepted request, rollback is forward-only: disable new scheduling at the API edge, preserve request state, and ship a corrective migration. A finalized deletion is intentionally irreversible; this is why the 30-day deadline and Two-Key release gates are mandatory.

## Security and privacy notes

- Actor identity is checked before profile or ownership state is disclosed.
- The request table has RLS enabled and no direct client grants.
- Client time is never trusted.
- Service-only due-work and preparation RPCs check the database role and immutable request timestamp supplied by the worker.
- Permanent deletion touches personal data and legal-retention obligations. Hosted enablement is blocked until the Founder records the applicable retention/legal policy; the source currently preserves only already-anonymized, content-free operational evidence.
- The hosted scheduler, migration application, and production execution remain separate deployment gates.
