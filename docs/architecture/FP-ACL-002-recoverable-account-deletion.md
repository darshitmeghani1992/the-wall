# FP-ACL-002 · Recoverable account deletion

**Build readiness:** READY FOR DRAFT IMPLEMENTATION; NOT READY TO APPLY OR RELEASE
**Risk tier:** Two-Key — schema, authentication lifecycle, privacy, irreversible purge

## Repository discovery

- `profiles.account_status` and actor-bound deactivate/reactivate RPCs already provide the visibility and contribution gate.
- `walls.owner_id` cascades on auth-user deletion; owned Shared Walls must be resolved before a deletion request is created.
- `marks.author_id` becomes null on auth-user deletion; authored Marks must be deleted explicitly first.
- Mark-media deletion and unconsumed-upload cleanup already have durable exact-path outboxes.
- Avatars remain in the public `attachments` bucket and must be removed through the Storage API before database purge preparation and Auth Admin identity deletion.

## Build sequence

1. Add the private request lifecycle and actor-bound RPCs.
2. Extend reactivation so recovery cancels deletion atomically.
3. Add service-only due-work and purge-preparation contracts with deadline, ownership, avatar-row, and authored-Mark checks; final identity removal uses the hosted Auth Admin API.
4. Add deterministic SQL security and lifecycle tests.
5. Add a dedicated typed-confirmation screen and scheduled-deletion recovery copy.
6. Run typecheck, lint, dependency-free client contracts, and the full disposable Postgres suite.
7. Obtain independent Reviewer and QA evidence before any hosted migration, merge, scheduler enablement, or deploy.

## Failure cases

| Case | Required result |
|---|---|
| Signed out or actor mismatch | `42501 ACTOR_MISMATCH`; no state disclosure or mutation |
| Suspended/missing account | unavailable; no request |
| Owned Shared Wall exists | owner action required; account remains active |
| Retry after scheduling | original timestamps returned unchanged |
| Reactivate during window | request removed and account active atomically |
| Purge before deadline | rejected; no data changed |
| Avatar Storage row remains | rejected until Storage API cleanup completes |
| Shared Wall appears unexpectedly | rejected; no cascade loss |
| Valid due purge | authored Marks removed, then auth identity deleted |

## Rollout gates

- Draft source and tests may be committed to PR #22 under the Founder's existing authorization.
- Do not apply migration `0031`, configure a hosted scheduler, merge, or deploy without a later explicit gate.
- Independent Reviewer approval and QA behavioral verification remain mandatory.
