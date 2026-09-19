# PRD-ACL-002 · Recoverable account deletion

**Status:** Founder-approved on 2026-09-18
**Validation tier:** Founder direction / privacy-critical
**Source of truth:** Master Build Spec §82 plus the decision recorded below

## Executive summary

The-Wall must offer permanent account deletion without silently destroying a group-owned history. A user must first transfer or explicitly delete every Shared Wall they own. They can then schedule deletion, which immediately pauses the account and starts a 30-day recovery window. Restoring the account during that window cancels deletion. After the deadline, a privileged backend process permanently removes the identity, Personal Wall, authored Marks on every Wall, social data, and associated media.

## User outcome

- The consequence of deletion is explained before confirmation.
- The user must type `DELETE` to schedule it.
- Owned Shared Walls block scheduling and direct the user to resolve ownership.
- A scheduled account is non-discoverable and non-interactable immediately.
- The user can restore the account for 30 days; restoration cancels deletion.
- Final deletion is irreversible.

## Acceptance criteria

1. Scheduling is accepted only for the authenticated account that initiated the action.
2. Scheduling fails closed when that account owns one or more Shared Walls and returns only the count needed by the UI.
3. The database, not the device clock, sets the request and purge timestamps.
4. A retry returns the original schedule and never extends the recovery window.
5. Reactivation and cancellation are one atomic server transaction and are rejected once the server deadline has passed.
6. Final purge is callable only by a privileged backend actor and only after the server deadline.
7. Final purge deletes all Marks authored by the user before deleting the auth identity, including Marks on other Personal or Shared Walls.
8. Deleting the user's Personal Wall removes all content on that Wall under the existing cascade and media-cleanup contract.
9. Existing protected-media deletion outboxes remain authoritative for object cleanup.
10. The UI never states that deletion is complete while the request is only scheduled.

## Product quality bar

This must feel deliberate, understandable, and reversible until the exact deadline. The destructive copy names the major consequences without legalistic language. No accidental tap can schedule deletion.

## Non-goals

- Automatic or silent Shared-Wall ownership transfer.
- Hosted scheduler configuration, production migration application, merge, or deployment in this draft slice.
- A self-service export feature.
- Defining the jurisdiction-specific legal-retention policy. Because deletion touches personal data, hosted enablement remains blocked until the Founder records that policy with appropriate legal input.

## Assumptions and risks

- **Verified:** the current schema would cascade-delete an owned Shared Wall if its owner auth row were deleted, so the ownership gate is mandatory.
- **Verified:** authored Marks currently use `ON DELETE SET NULL`; explicit pre-purge deletion is required to meet the approved full-deletion policy.
- **Believed-likely:** 30 days is enough time for accidental-deletion recovery and matches the Master Build Spec.
- **Risk:** final media removal still depends on the protected-media operations worker and a hosted scheduler; source readiness is not deployment readiness.
- **Regulated-domain escalation:** legal/retention obligations are unresolved and tracked as `TD-005`; no hosted deletion may be enabled until that Founder gate is closed.

## Success and kill criteria

Success means the actor-binding, ownership gate, idempotency, cancellation, deadline, content deletion, and privilege boundary all pass deterministic tests. Block release if any caller can schedule another account, extend its own deadline by retrying, purge early, or leave authored Marks behind.
