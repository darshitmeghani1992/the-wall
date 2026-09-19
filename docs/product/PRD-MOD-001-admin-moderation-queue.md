# PRD-MOD-001 · Admin moderation queue

## Outcome

Authorized administrators can review every open user, Mark, and Shared-Wall report and close it with an explicit, audited decision.

## Acceptance criteria

- Only profiles marked as administrators see the Settings entry point; server authorization remains decisive.
- The queue shows open reports newest-first with target type, reason, details, and age.
- An administrator can dismiss or resolve without changing the target.
- Mark reports can remove the Mark before resolution; user reports can suspend the account before resolution.
- Target action failure leaves the report open and retryable.
- Repeated successful requests do not duplicate audit receipts.
- Missing targets, invalid input, ordinary users, and account-switched requests fail closed.
- Session changes suppress stale loads, actions, errors, UI cleanup, and navigation.

## Release boundary

Migration `0030` is source-only in draft PR #22. Hosted migration, merge, and deployment are not part of this slice.
