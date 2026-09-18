# ADR-015 · Actor-bound admin moderation

## Status

Accepted for draft PR #22; not applied to hosted Supabase.

## Decision

Retire the three callable legacy admin mutation signatures and replace them with overloads whose first argument is the administrator identity captured by the client. Each function checks `auth.uid()` equality before admin authorization or target lookup, locks the target, fails on missing targets, and records one audit row only when state changes.

Mark removal, account suspension, and same-outcome report closure are idempotent. A report cannot move from one terminal outcome to another. Administrators cannot suspend themselves or another administrator through the queue. Reasons are trimmed, required, and bounded to 500 characters.

The client separately preflights the current user and uses a focus/session generation fence across target action, report closure, and UI continuation. This is defense in depth; database authorization is authoritative.

## Consequences

- A delayed admin-A request cannot execute as admin B.
- Missing targets cannot generate misleading audit records.
- Partial success is safely retryable: the target action no-ops, then the still-open report closes.
- Migration `0030` must precede deployment of the updated client.
